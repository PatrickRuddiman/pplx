import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  getHistory,
  saveToHistory,
  clearHistory,
  createThread,
  getThread,
  saveThread,
  getLatestThreadId,
  listThreads,
  clearThreads,
} from '../../src/lib/history.js';
import { _resetConfigDir } from '../../src/lib/config.js';

const TEST_DIR = path.join(os.tmpdir(), 'pplx-cli-history-test-' + Date.now());

describe('history', () => {
  beforeEach(() => {
    _resetConfigDir();
    process.env.PERPLEXITY_CONFIG_DIR = TEST_DIR;
  });

  afterEach(() => {
    _resetConfigDir();
    delete process.env.PERPLEXITY_CONFIG_DIR;
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('query history', () => {
    it('returns empty array when no history', () => {
      expect(getHistory()).toEqual([]);
    });

    it('saves and retrieves history entries', () => {
      saveToHistory('What is TypeScript?', 'sonar', 'TypeScript is...', 3);
      const history = getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].question).toBe('What is TypeScript?');
      expect(history[0].model).toBe('sonar');
      expect(history[0].responsePreview).toBe('TypeScript is...');
      expect(history[0].citations).toBe(3);
    });

    it('adds newest entries first', () => {
      saveToHistory('First', 'sonar');
      saveToHistory('Second', 'sonar');
      const history = getHistory();
      expect(history[0].question).toBe('Second');
      expect(history[1].question).toBe('First');
    });

    it('clears history', () => {
      saveToHistory('Test', 'sonar');
      clearHistory();
      expect(getHistory()).toEqual([]);
    });

    it('generates unique IDs', () => {
      saveToHistory('Q1', 'sonar');
      saveToHistory('Q2', 'sonar');
      const history = getHistory();
      expect(history[0].id).not.toBe(history[1].id);
    });
  });

  describe('threads', () => {
    it('creates and retrieves a thread', () => {
      const id = createThread('sonar');
      expect(id).toBeTruthy();
      const thread = getThread(id);
      expect(thread).not.toBeNull();
      expect(thread!.model).toBe('sonar');
      expect(thread!.messages).toEqual([]);
    });

    it('saves messages to a thread', () => {
      const id = createThread('sonar');
      saveThread(id, 'sonar', [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]);
      const thread = getThread(id);
      expect(thread!.messages).toHaveLength(2);
      expect(thread!.messages[0].content).toBe('Hello');
    });

    it('gets latest thread ID', () => {
      const id1 = createThread('sonar');
      saveThread(id1, 'sonar', [{ role: 'user', content: 'A' }]);

      // Small delay to ensure different timestamps
      const id2 = createThread('sonar-pro');
      saveThread(id2, 'sonar-pro', [{ role: 'user', content: 'B' }]);

      expect(getLatestThreadId()).toBe(id2);
    });

    it('lists threads sorted by updated time', () => {
      createThread('sonar');
      createThread('sonar-pro');
      const threads = listThreads();
      expect(threads.length).toBe(2);
      expect(threads[0].updated).toBeGreaterThanOrEqual(threads[1].updated);
    });

    it('clears all threads', () => {
      createThread('sonar');
      createThread('sonar');
      clearThreads();
      expect(listThreads()).toEqual([]);
    });

    it('returns null for non-existent thread', () => {
      expect(getThread('non-existent')).toBeNull();
    });

    it('returns undefined for latest thread when none exist', () => {
      expect(getLatestThreadId()).toBeUndefined();
    });
  });
});
