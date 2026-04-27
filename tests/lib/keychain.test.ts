import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

import { spawnSync } from 'node:child_process';
import { getKeychainBackend, isKeychainAvailable } from '../../src/lib/keychain.js';

const spawnMock = vi.mocked(spawnSync);

function ok(stdout = ''): ReturnType<typeof spawnSync> {
  return { status: 0, stdout, stderr: '', signal: null, output: [], pid: 0 } as never;
}

function fail(stderr = 'fail'): ReturnType<typeof spawnSync> {
  return { status: 1, stdout: '', stderr, signal: null, output: [], pid: 0 } as never;
}

describe('keychain backends', () => {
  const platform = process.platform;
  beforeEach(() => {
    spawnMock.mockReset();
    delete process.env.PPLX_DISABLE_KEYCHAIN;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: platform });
  });

  describe('PPLX_DISABLE_KEYCHAIN=1', () => {
    it('returns the noop backend regardless of platform', () => {
      process.env.PPLX_DISABLE_KEYCHAIN = '1';
      const backend = getKeychainBackend();
      expect(backend.id).toBe('none');
      expect(isKeychainAvailable()).toBe(false);
    });
  });

  describe('macOS backend', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
    });

    it('selects macos backend on darwin', () => {
      const backend = getKeychainBackend();
      expect(backend.id).toBe('macos');
    });

    it('load returns trimmed stdout when security succeeds', () => {
      spawnMock.mockReturnValueOnce(ok('the-secret\n'));
      const backend = getKeychainBackend();
      expect(backend.load()).toBe('the-secret');
      expect(spawnMock).toHaveBeenCalledWith(
        '/usr/bin/security',
        expect.arrayContaining(['find-generic-password', '-s', 'pplx']),
        expect.any(Object),
      );
    });

    it('load returns null when security fails', () => {
      spawnMock.mockReturnValueOnce(fail());
      expect(getKeychainBackend().load()).toBeNull();
    });

    it('store invokes add-generic-password and throws on failure', () => {
      spawnMock.mockReturnValueOnce(ok());
      expect(() => getKeychainBackend().store('val')).not.toThrow();
      expect(spawnMock).toHaveBeenCalledWith(
        '/usr/bin/security',
        expect.arrayContaining(['add-generic-password', '-s', 'pplx', '-w', 'val', '-U']),
        expect.any(Object),
      );

      spawnMock.mockReturnValueOnce(fail('bad'));
      expect(() => getKeychainBackend().store('val')).toThrow(/security add-generic-password/);
    });

    it('remove invokes delete-generic-password (errors swallowed)', () => {
      spawnMock.mockReturnValueOnce(fail());
      expect(() => getKeychainBackend().remove()).not.toThrow();
      expect(spawnMock).toHaveBeenCalledWith(
        '/usr/bin/security',
        expect.arrayContaining(['delete-generic-password', '-s', 'pplx']),
        expect.any(Object),
      );
    });
  });

  describe('libsecret (Linux)', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
    });

    it('selects libsecret when secret-tool is on PATH', () => {
      // Each `which secret-tool` from `commandExists` returns 0
      spawnMock.mockReturnValueOnce(ok('/usr/bin/secret-tool\n'));
      const backend = getKeychainBackend();
      expect(backend.id).toBe('libsecret');
    });

    it('falls back to noop when secret-tool is not present', () => {
      spawnMock.mockReturnValueOnce(fail());
      expect(getKeychainBackend().id).toBe('none');
    });

    it('load returns the value when secret-tool succeeds', () => {
      spawnMock.mockReturnValueOnce(ok('/usr/bin/secret-tool\n')); // commandExists
      const backend = getKeychainBackend();
      spawnMock.mockReturnValueOnce(ok('linux-secret\n'));
      expect(backend.load()).toBe('linux-secret');
    });

    it('store passes the secret as stdin and throws on failure', () => {
      spawnMock.mockReturnValueOnce(ok('/usr/bin/secret-tool\n')); // commandExists
      const backend = getKeychainBackend();
      spawnMock.mockReturnValueOnce(ok());
      expect(() => backend.store('xyz')).not.toThrow();
      expect(spawnMock).toHaveBeenLastCalledWith(
        'secret-tool',
        expect.arrayContaining(['store', '--label=pplx', 'service', 'pplx']),
        expect.objectContaining({ input: 'xyz' }),
      );

      spawnMock.mockReturnValueOnce(fail('boom'));
      expect(() => backend.store('xyz')).toThrow(/secret-tool store failed/);
    });
  });

  describe('non-keychain platforms (e.g. Windows)', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
    });

    it('returns the noop backend (file fallback)', () => {
      const backend = getKeychainBackend();
      expect(backend.id).toBe('none');
      expect(backend.load()).toBeNull();
      expect(() => backend.store('x')).toThrow();
    });
  });
});
