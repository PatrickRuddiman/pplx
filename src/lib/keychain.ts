import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import os from 'node:os';

const SERVICE_NAME = 'pplx';

export interface KeychainBackend {
  readonly id: 'macos' | 'libsecret' | 'wincred' | 'none';
  readonly description: string;
  available(): boolean;
  load(): string | null;
  store(secret: string): void;
  remove(): void;
}

function run(cmd: string, args: string[], input?: string): SpawnSyncReturns<string> {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: 5000,
    input,
  });
}

function commandExists(cmd: string): boolean {
  const which = process.platform === 'win32' ? 'where' : 'which';
  const r = run(which, [cmd]);
  return r.status === 0;
}

function account(): string {
  return os.userInfo().username || 'default';
}

const macosBackend: KeychainBackend = {
  id: 'macos',
  description: 'macOS Keychain (per-app ACLs enforced by the OS)',
  available() {
    return process.platform === 'darwin';
  },
  load() {
    const r = run('/usr/bin/security', ['find-generic-password', '-s', SERVICE_NAME, '-a', account(), '-w']);
    if (r.status !== 0) return null;
    const out = (r.stdout ?? '').trim();
    return out.length > 0 ? out : null;
  },
  store(secret: string) {
    const r = run('/usr/bin/security', [
      'add-generic-password',
      '-s',
      SERVICE_NAME,
      '-a',
      account(),
      '-w',
      secret,
      '-U',
    ]);
    if (r.status !== 0) {
      throw new Error(`security add-generic-password failed: ${r.stderr || r.stdout}`);
    }
  },
  remove() {
    run('/usr/bin/security', ['delete-generic-password', '-s', SERVICE_NAME, '-a', account()]);
  },
};

const libsecretBackend: KeychainBackend = {
  id: 'libsecret',
  description: 'Linux Secret Service (libsecret / secret-tool, gated by D-Bus session)',
  available() {
    return process.platform === 'linux' && commandExists('secret-tool');
  },
  load() {
    const r = run('secret-tool', ['lookup', 'service', SERVICE_NAME, 'account', account()]);
    if (r.status !== 0) return null;
    const out = (r.stdout ?? '').trim();
    return out.length > 0 ? out : null;
  },
  store(secret: string) {
    const r = run(
      'secret-tool',
      ['store', '--label=pplx', 'service', SERVICE_NAME, 'account', account()],
      secret,
    );
    if (r.status !== 0) {
      throw new Error(`secret-tool store failed: ${r.stderr || r.stdout}`);
    }
  },
  remove() {
    run('secret-tool', ['clear', 'service', SERVICE_NAME, 'account', account()]);
  },
};

const noopBackend: KeychainBackend = {
  id: 'none',
  description: 'No OS keychain available; falling back to encrypted file at rest (obfuscation only)',
  available: () => false,
  load: () => null,
  store: () => {
    throw new Error('No keychain backend available');
  },
  remove: () => {},
};

const _backends: KeychainBackend[] = [macosBackend, libsecretBackend];

export function getKeychainBackend(): KeychainBackend {
  if (process.env.PPLX_DISABLE_KEYCHAIN === '1') return noopBackend;
  for (const b of _backends) {
    if (b.available()) return b;
  }
  return noopBackend;
}

export function isKeychainAvailable(): boolean {
  return getKeychainBackend().id !== 'none';
}
