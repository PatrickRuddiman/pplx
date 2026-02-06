import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { PerplexityConfig } from './types.js';
import { APP_NAME } from './types.js';

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
      ensureConfigDir();
      const newConfig: PerplexityConfig = {};
      if (oldConfig.apiKey) {
        newConfig.apiKey = oldConfig.apiKey;
      }
      fs.writeFileSync(newFile, JSON.stringify(newConfig, null, 2));
    } catch {
      // Silently fail migration - user can re-set their key
    }
  }
}

export function getConfig(): PerplexityConfig {
  migrateOldConfig();

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

export function saveConfig(config: PerplexityConfig): void {
  ensureConfigDir();
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
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

// Reset cached config dir (for testing)
export function _resetConfigDir(): void {
  configDir = null;
}
