import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getConfig, saveConfig, resolveApiKey, resolveModel, getConfigDir, _resetConfigDir } from '../../src/lib/config.js';

const TEST_DIR = path.join(os.tmpdir(), 'pplx-cli-test-' + Date.now());

describe('config', () => {
  beforeEach(() => {
    _resetConfigDir();
    process.env.PERPLEXITY_CONFIG_DIR = TEST_DIR;
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.PERPLEXITY_MODEL;
  });

  afterEach(() => {
    _resetConfigDir();
    delete process.env.PERPLEXITY_CONFIG_DIR;
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('getConfigDir', () => {
    it('uses PERPLEXITY_CONFIG_DIR when set', () => {
      expect(getConfigDir()).toBe(TEST_DIR);
    });

    it('uses XDG_CONFIG_HOME when PERPLEXITY_CONFIG_DIR is not set', () => {
      _resetConfigDir();
      delete process.env.PERPLEXITY_CONFIG_DIR;
      const xdg = path.join(os.tmpdir(), 'pplx-xdg-' + Date.now());
      const prevXdg = process.env.XDG_CONFIG_HOME;
      process.env.XDG_CONFIG_HOME = xdg;
      try {
        expect(getConfigDir()).toBe(path.join(xdg, 'pplx'));
      } finally {
        if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
        else process.env.XDG_CONFIG_HOME = prevXdg;
      }
    });
  });

  describe('getConfig / saveConfig', () => {
    it('returns empty config when no file exists', () => {
      const config = getConfig();
      expect(config).toEqual({});
    });

    it('saves and reads config', () => {
      saveConfig({ apiKey: 'test-key-123' });
      const config = getConfig();
      expect(config.apiKey).toBe('test-key-123');
    });

    it('saves config with defaults', () => {
      saveConfig({
        apiKey: 'key',
        defaults: { model: 'sonar-pro', stream: false },
      });
      const config = getConfig();
      expect(config.defaults?.model).toBe('sonar-pro');
      expect(config.defaults?.stream).toBe(false);
    });

    it('creates config directory if it does not exist', () => {
      expect(fs.existsSync(TEST_DIR)).toBe(false);
      saveConfig({ apiKey: 'test' });
      expect(fs.existsSync(TEST_DIR)).toBe(true);
    });
  });

  describe('resolveApiKey', () => {
    it('prefers flag over env over config', () => {
      saveConfig({ apiKey: 'config-key' });
      process.env.PERPLEXITY_API_KEY = 'env-key';
      expect(resolveApiKey('flag-key')).toBe('flag-key');
    });

    it('falls back to env when no flag', () => {
      saveConfig({ apiKey: 'config-key' });
      process.env.PERPLEXITY_API_KEY = 'env-key';
      expect(resolveApiKey()).toBe('env-key');
    });

    it('falls back to config when no flag or env', () => {
      saveConfig({ apiKey: 'config-key' });
      expect(resolveApiKey()).toBe('config-key');
    });

    it('returns undefined when nothing set', () => {
      expect(resolveApiKey()).toBeUndefined();
    });
  });

  describe('resolveModel', () => {
    it('prefers flag over env over config', () => {
      saveConfig({ defaults: { model: 'sonar-pro' } });
      process.env.PERPLEXITY_MODEL = 'sonar-reasoning-pro';
      expect(resolveModel('sonar-deep-research')).toBe('sonar-deep-research');
    });

    it('falls back to env when no flag', () => {
      process.env.PERPLEXITY_MODEL = 'sonar-reasoning-pro';
      expect(resolveModel()).toBe('sonar-reasoning-pro');
    });

    it('falls back to config default', () => {
      saveConfig({ defaults: { model: 'sonar-pro' } });
      expect(resolveModel()).toBe('sonar-pro');
    });

    it('defaults to sonar', () => {
      expect(resolveModel()).toBe('sonar');
    });
  });

  describe('error paths', () => {
    it('returns empty config when file is malformed', () => {
      const dir = TEST_DIR;
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'config.json'), 'not json');
      expect(getConfig()).toEqual({});
    });
  });
});
