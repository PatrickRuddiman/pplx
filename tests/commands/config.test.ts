import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { registerConfigCommand } from '../../src/commands/config.js';
import { _resetConfigDir, getConfig, saveConfig } from '../../src/lib/config.js';

const TEST_DIR = path.join(os.tmpdir(), 'pplx-cli-cfg-cmd-test-' + Date.now());

describe('config command', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetConfigDir();
    process.env.PERPLEXITY_CONFIG_DIR = TEST_DIR;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    _resetConfigDir();
    delete process.env.PERPLEXITY_CONFIG_DIR;
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  function output(): string {
    return logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
  }

  function errors(): string {
    return errSpy.mock.calls.map((c) => c.join(' ')).join('\n');
  }

  function makeProgram() {
    const program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    return program;
  }

  describe('config set-key / view-key / clear-key', () => {
    it('set-key persists API key', async () => {
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'set-key', 'pplx-test-12345678']);
      expect(getConfig().apiKey).toBe('pplx-test-12345678');
    });

    it('view-key shows masked key', async () => {
      saveConfig({ apiKey: 'abcdefghij1234567890' });
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'view-key']);
      const out = output();
      expect(out).toContain('abcd');
      expect(out).toContain('7890');
      expect(out).toContain('*');
    });

    it('view-key reports when no key set', async () => {
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'view-key']);
      expect(errors()).toContain('No API key set');
    });

    it('view-key with very short key shows ****', async () => {
      saveConfig({ apiKey: 'tiny' });
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'view-key']);
      expect(output()).toContain('****');
    });

    it('clear-key removes the key', async () => {
      saveConfig({ apiKey: 'gone' });
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'clear-key']);
      expect(getConfig().apiKey).toBeUndefined();
    });
  });

  describe('config set / get / list / path', () => {
    it('set persists string default', async () => {
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'set', 'model', 'sonar-pro']);
      expect(getConfig().defaults?.model).toBe('sonar-pro');
    });

    it('set converts boolean defaults', async () => {
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'set', 'stream', 'false']);
      expect(getConfig().defaults?.stream).toBe(false);
    });

    it('set rejects unknown key', async () => {
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'set', 'nope', 'x']);
      expect(errors()).toContain('Unknown config key');
      expect(getConfig().defaults).toBeUndefined();
    });

    it('get returns set value', async () => {
      saveConfig({ defaults: { model: 'sonar-pro' } });
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'get', 'model']);
      expect(output()).toContain('sonar-pro');
    });

    it('get reports (not set) for unset key', async () => {
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'get', 'model']);
      expect(output()).toContain('not set');
    });

    it('get apiKey reports (set) when present', async () => {
      saveConfig({ apiKey: 'k' });
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'get', 'apiKey']);
      expect(output()).toContain('(set)');
    });

    it('get apiKey reports (not set) when absent', async () => {
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'get', 'apiKey']);
      expect(output()).toContain('(not set)');
    });

    it('list shows current configuration', async () => {
      saveConfig({ apiKey: 'k', defaults: { model: 'sonar-pro' } });
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'list']);
      const out = output();
      expect(out).toContain('Configuration');
      expect(out).toContain('sonar-pro');
    });

    it('path prints config directory', async () => {
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'config', 'path']);
      expect(output()).toContain(TEST_DIR);
    });
  });

  describe('top-level aliases', () => {
    it('set-key alias persists key', async () => {
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'set-key', 'top-alias-key']);
      expect(getConfig().apiKey).toBe('top-alias-key');
    });

    it('view-key alias displays key', async () => {
      saveConfig({ apiKey: 'displayme1234567890' });
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'view-key']);
      expect(output()).toContain('disp');
    });

    it('view-key alias reports when no key set', async () => {
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'view-key']);
      expect(errors()).toContain('No API key set');
    });

    it('clear-key alias removes the key', async () => {
      saveConfig({ apiKey: 'gone' });
      const program = makeProgram();
      await program.parseAsync(['node', 'pplx', 'clear-key']);
      expect(getConfig().apiKey).toBeUndefined();
    });
  });
});
