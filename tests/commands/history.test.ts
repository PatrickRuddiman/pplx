import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { registerHistoryCommand } from '../../src/commands/history.js';
import { _resetConfigDir } from '../../src/lib/config.js';
import {
  saveToHistory,
  createThread,
  saveThread,
  getHistory,
  listThreads,
} from '../../src/lib/history.js';

const TEST_DIR = path.join(os.tmpdir(), 'pplx-cli-history-cmd-test-' + Date.now());

describe('history command', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetConfigDir();
    process.env.PERPLEXITY_CONFIG_DIR = TEST_DIR;
    process.env.PPLX_DISABLE_KEYCHAIN = '1';
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    _resetConfigDir();
    delete process.env.PERPLEXITY_CONFIG_DIR;
    delete process.env.PPLX_DISABLE_KEYCHAIN;
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  function output(): string {
    return logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
  }

  function makeProgram() {
    const program = new Command();
    program.exitOverride();
    registerHistoryCommand(program);
    return program;
  }

  it('warns when there is no history', async () => {
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'history']);
    expect(output()).toContain('No query history');
  });

  it('lists recent queries', async () => {
    saveToHistory('What is X?', 'sonar', 'X is...', 2);
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'history']);
    const out = output();
    expect(out).toContain('Recent Queries');
    expect(out).toContain('What is X?');
    expect(out).toContain('sonar');
  });

  it('respects --limit', async () => {
    for (let i = 0; i < 5; i++) saveToHistory(`Q${i}`, 'sonar');
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'history', '--limit', '2']);
    const out = output();
    // Newest two should be present
    expect(out).toContain('Q4');
    expect(out).toContain('Q3');
    expect(out).not.toContain('Q0');
  });

  it('outputs JSON when --json passed', async () => {
    saveToHistory('JsonQ', 'sonar', 'r', 1);
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'history', '--json']);
    const parsed = JSON.parse(output());
    expect(parsed[0].question).toBe('JsonQ');
  });

  it('--clear empties history and threads', async () => {
    saveToHistory('a', 'sonar');
    createThread('sonar');
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'history', '--clear']);
    expect(getHistory()).toEqual([]);
    expect(listThreads()).toEqual([]);
  });

  it('--threads warns when no threads', async () => {
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'history', '--threads']);
    expect(output()).toContain('No conversation threads');
  });

  it('--threads lists threads', async () => {
    const id = createThread('sonar');
    saveThread(id, 'sonar', [
      { role: 'user', content: 'A long enough question to render in preview output here please.' },
      { role: 'assistant', content: 'reply' },
    ]);
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'history', '--threads']);
    const out = output();
    expect(out).toContain('Conversation Threads');
    expect(out).toContain('sonar');
  });

  it('--threads --json outputs JSON', async () => {
    const id = createThread('sonar');
    saveThread(id, 'sonar', [{ role: 'user', content: 'q' }]);
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'history', '--threads', '--json']);
    const parsed = JSON.parse(output());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe(id);
  });
});
