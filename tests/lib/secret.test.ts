import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  _resetSecretKey,
} from '../../src/lib/secret.js';

describe('secret', () => {
  beforeEach(() => {
    _resetSecretKey();
  });

  describe('isEncrypted', () => {
    it('returns true for ciphertext format', () => {
      const ct = encryptSecret('hello');
      expect(isEncrypted(ct)).toBe(true);
    });

    it('returns false for plaintext', () => {
      expect(isEncrypted('plain')).toBe(false);
      expect(isEncrypted('pplx-1234567890abcdef')).toBe(false);
    });
  });

  describe('encrypt / decrypt round-trip', () => {
    it('round-trips a typical API key', () => {
      const plain = 'pplx-test-key-1234567890ABCDEFG';
      const ct = encryptSecret(plain);
      expect(ct).not.toBe(plain);
      expect(ct).toMatch(/^enc:v1:/);
      expect(decryptSecret(ct)).toBe(plain);
    });

    it('produces a different ciphertext each call (random IV)', () => {
      const a = encryptSecret('same');
      const b = encryptSecret('same');
      expect(a).not.toBe(b);
      expect(decryptSecret(a)).toBe('same');
      expect(decryptSecret(b)).toBe('same');
    });

    it('decryptSecret returns input as-is when not encrypted', () => {
      expect(decryptSecret('plain-key')).toBe('plain-key');
    });

    it('round-trips empty string and unicode', () => {
      expect(decryptSecret(encryptSecret(''))).toBe('');
      expect(decryptSecret(encryptSecret('🔑'))).toBe('🔑');
    });
  });

  describe('error cases', () => {
    it('throws on malformed ciphertext (wrong segment count)', () => {
      expect(() => decryptSecret('enc:v1:onlyonepart')).toThrow();
    });

    it('throws when ciphertext was encrypted under a different machine identity', () => {
      const original = process.env.PPLX_KEY_MATERIAL;
      process.env.PPLX_KEY_MATERIAL = 'machine-A';
      _resetSecretKey();
      const ct = encryptSecret('secret');

      process.env.PPLX_KEY_MATERIAL = 'machine-B';
      _resetSecretKey();
      expect(() => decryptSecret(ct)).toThrow();

      if (original === undefined) delete process.env.PPLX_KEY_MATERIAL;
      else process.env.PPLX_KEY_MATERIAL = original;
      _resetSecretKey();
    });
  });
});
