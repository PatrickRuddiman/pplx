import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TEST_DIR = path.join(os.tmpdir(), 'pplx-cli-fallback-test-' + Date.now());

const fakeBackend = {
  id: 'libsecret' as const,
  description: 'Linux Secret Service (libsecret, mocked)',
  available: () => true,
  load: vi.fn<() => string | null>(),
  store: vi.fn<(secret: string) => void>(),
  remove: vi.fn<() => void>(),
};

vi.mock('../../src/lib/keychain.js', () => ({
  getKeychainBackend: () => fakeBackend,
  isKeychainAvailable: () => true,
}));

import { saveConfig, getConfig, getKeyStorageInfo, _resetConfigDir } from '../../src/lib/config.js';

describe('config — keychain detected but unwriteable', () => {
  beforeEach(() => {
    fakeBackend.load.mockReset();
    fakeBackend.store.mockReset();
    fakeBackend.remove.mockReset();
    _resetConfigDir();
    process.env.PERPLEXITY_CONFIG_DIR = TEST_DIR;
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.PPLX_DISABLE_KEYCHAIN;
  });

  afterEach(() => {
    _resetConfigDir();
    delete process.env.PERPLEXITY_CONFIG_DIR;
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('falls through to encrypted file when backend.store throws', () => {
    fakeBackend.store.mockImplementation(() => {
      throw new Error('no D-Bus session');
    });
    fakeBackend.load.mockReturnValue(null);

    saveConfig({ apiKey: 'pplx-fail-1234567890' });

    // File should now contain the encrypted apiKey
    const raw = JSON.parse(fs.readFileSync(path.join(TEST_DIR, 'config.json'), 'utf8'));
    expect(typeof raw.apiKey).toBe('string');
    expect(raw.apiKey).toMatch(/^enc:v1:/);
  });

  it('reports source=file (not keychain) even though backend was detected', () => {
    fakeBackend.store.mockImplementation(() => {
      throw new Error('no keyring');
    });
    fakeBackend.load.mockReturnValue(null);

    saveConfig({ apiKey: 'pplx-fail-key' });
    const info = getKeyStorageInfo();

    expect(info.backend).toBe('libsecret');
    expect(info.source).toBe('file');
    expect(info.hasKey).toBe(true);
    expect(info.description).toContain('encrypted');
    expect(info.description).not.toContain('libsecret');
  });

  it('reports source=keychain when backend.store succeeds and load returns the value', () => {
    let storedValue: string | null = null;
    fakeBackend.store.mockImplementation((secret) => {
      storedValue = secret;
    });
    fakeBackend.load.mockImplementation(() => storedValue);

    saveConfig({ apiKey: 'pplx-good-key' });
    const info = getKeyStorageInfo();

    expect(info.source).toBe('keychain');
    expect(info.description).toBe('Linux Secret Service (libsecret, mocked)');

    // File should not contain apiKey
    const raw = JSON.parse(fs.readFileSync(path.join(TEST_DIR, 'config.json'), 'utf8'));
    expect(raw.apiKey).toBeUndefined();

    // getConfig returns the live key
    expect(getConfig().apiKey).toBe('pplx-good-key');
  });
});
