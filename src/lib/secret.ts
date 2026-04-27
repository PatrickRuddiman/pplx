import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const ENC_PREFIX = 'enc:v1:';
const SCRYPT_SALT = 'pplx-key-salt-v1';

let _cachedKey: Buffer | null = null;

function readMachineId(): string {
  try {
    if (process.platform === 'linux') {
      for (const p of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
        if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
      }
    } else if (process.platform === 'darwin') {
      const out = execFileSync('/usr/sbin/ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], {
        encoding: 'utf8',
        timeout: 2000,
      });
      const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match) return match[1];
    } else if (process.platform === 'win32') {
      const out = execFileSync('wmic', ['csproduct', 'get', 'UUID'], {
        encoding: 'utf8',
        timeout: 2000,
      });
      const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length >= 2) return lines[1];
    }
  } catch {
    // fall through
  }
  return '';
}

export function _resetSecretKey(): void {
  _cachedKey = null;
}

function deriveKey(): Buffer {
  if (_cachedKey) return _cachedKey;
  const machineId = readMachineId();
  const user = os.userInfo();
  const material = [
    process.env.PPLX_KEY_MATERIAL ?? '',
    machineId,
    user.username,
    user.uid?.toString() ?? '',
    user.homedir,
    process.platform,
  ].join('|');
  _cachedKey = crypto.scryptSync(material, SCRYPT_SALT, 32);
  return _cachedKey;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const payload = stored.slice(ENC_PREFIX.length);
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret: expected 3 segments');
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const key = deriveKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}
