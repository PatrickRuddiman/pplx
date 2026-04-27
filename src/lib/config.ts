import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { PerplexityConfig } from './types.js';
import { APP_NAME } from './types.js';
import { encryptSecret, decryptSecret, isEncrypted } from './secret.js';
import { getKeychainBackend } from './keychain.js';

let configDir: string | null = null;

export function getConfigDir(): string {
  if (configDir) return configDir;

  if (process.env.PERPLEXITY_CONFIG_DIR) {
    configDir = process.env.PERPLEXITY_CONFIG_DIR;
  } else if (process.env.XDG_CONFIG_HOME) {
    configDir = path.join(process.env.XDG_CONFIG_HOME, APP_NAME);
  } else if (process.platform === 'win32') {
    configDir = path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      APP_NAME,
    );
  } else {
    configDir = path.join(os.homedir(), '.config', APP_NAME);
  }

  return configDir;
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function migrateOldConfig(): void {
  const oldDir = path.join(os.homedir(), '.perplexity-cli');
  const oldFile = path.join(oldDir, 'config.json');
  const newFile = getConfigPath();

  if (fs.existsSync(oldFile) && !fs.existsSync(newFile)) {
    try {
      const oldData = fs.readFileSync(oldFile, 'utf8');
      const oldConfig = JSON.parse(oldData);
      const newConfig: PerplexityConfig = {};
      if (oldConfig.apiKey) {
        newConfig.apiKey = oldConfig.apiKey;
      }
      saveConfig(newConfig);
    } catch {
      // Silently fail migration - user can re-set their key
    }
  }
}

function readConfigFile(): PerplexityConfig {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data) as PerplexityConfig;
    }
  } catch {
    // Return empty config on read error
  }
  return {};
}

function writeConfigFile(config: PerplexityConfig): void {
  ensureConfigDir();
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(configPath, 0o600);
    } catch {
      // best-effort: filesystem may not support chmod
    }
  }
}

function loadStoredApiKey(stored: PerplexityConfig): string | undefined {
  // 1. Prefer OS keychain when available
  const backend = getKeychainBackend();
  if (backend.id !== 'none') {
    try {
      const fromKeychain = backend.load();
      if (fromKeychain) return fromKeychain;
    } catch {
      // fall through to file
    }
  }

  // 2. Fall back to encrypted-or-plaintext file value
  if (typeof stored.apiKey !== 'string' || stored.apiKey.length === 0) return undefined;
  if (isEncrypted(stored.apiKey)) {
    try {
      return decryptSecret(stored.apiKey);
    } catch {
      return undefined;
    }
  }
  return stored.apiKey;
}

export function getConfig(): PerplexityConfig {
  migrateOldConfig();

  const stored = readConfigFile();
  const result: PerplexityConfig = { ...stored };
  delete result.apiKey;

  const resolved = loadStoredApiKey(stored);
  if (resolved !== undefined) {
    result.apiKey = resolved;

    // Auto-migrate: if a legacy plaintext lives in the file, re-encrypt it.
    // If a value lives in the file but the keychain is now available, move it.
    if (typeof stored.apiKey === 'string' && stored.apiKey.length > 0) {
      const backend = getKeychainBackend();
      if (backend.id !== 'none') {
        try {
          backend.store(resolved);
          const next = { ...stored };
          delete next.apiKey;
          writeConfigFile(next);
        } catch {
          // best-effort migration
        }
      } else if (!isEncrypted(stored.apiKey)) {
        try {
          writeConfigFile({ ...stored, apiKey: encryptSecret(stored.apiKey) });
        } catch {
          // best-effort
        }
      }
    }
  }

  return result;
}

export function saveConfig(config: PerplexityConfig): void {
  const onDisk: PerplexityConfig = { ...config };
  delete onDisk.apiKey;

  // First, take care of the apiKey via keychain when possible.
  if (typeof config.apiKey === 'string' && config.apiKey.length > 0) {
    const backend = getKeychainBackend();
    if (backend.id !== 'none') {
      try {
        backend.store(config.apiKey);
      } catch {
        // keychain failed — fall back to encrypted file
        onDisk.apiKey = encryptSecret(config.apiKey);
      }
    } else {
      onDisk.apiKey = isEncrypted(config.apiKey) ? config.apiKey : encryptSecret(config.apiKey);
    }
  } else if (config.apiKey === undefined) {
    // Explicit clear → also clear keychain entry if any
    const backend = getKeychainBackend();
    if (backend.id !== 'none') {
      try {
        backend.remove();
      } catch {
        // ignore
      }
    }
  }

  writeConfigFile(onDisk);
}

export function resolveApiKey(flagKey?: string): string | undefined {
  return flagKey || process.env.PERPLEXITY_API_KEY || getConfig().apiKey;
}

export function resolveModel(flagModel?: string): string {
  return (
    flagModel ||
    process.env.PERPLEXITY_MODEL ||
    getConfig().defaults?.model ||
    'sonar'
  );
}

export interface KeyStorageInfo {
  backend: 'macos' | 'libsecret' | 'wincred' | 'none';
  description: string;
  hasKey: boolean;
  source: 'keychain' | 'file' | 'env' | 'none';
}

export function getKeyStorageInfo(): KeyStorageInfo {
  const backend = getKeychainBackend();
  let source: KeyStorageInfo['source'] = 'none';
  let hasKey = false;

  if (process.env.PERPLEXITY_API_KEY) {
    source = 'env';
    hasKey = true;
  } else if (backend.id !== 'none') {
    try {
      if (backend.load()) {
        source = 'keychain';
        hasKey = true;
      }
    } catch {
      // ignore
    }
    if (!hasKey) {
      const stored = readConfigFile();
      if (typeof stored.apiKey === 'string' && stored.apiKey.length > 0) {
        source = 'file';
        hasKey = true;
      }
    }
  } else {
    const stored = readConfigFile();
    if (typeof stored.apiKey === 'string' && stored.apiKey.length > 0) {
      source = 'file';
      hasKey = true;
    }
  }

  return {
    backend: backend.id,
    description: backend.description,
    hasKey,
    source,
  };
}

export function _resetConfigDir(): void {
  configDir = null;
}
