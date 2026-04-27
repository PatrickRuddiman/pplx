import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSpinner,
  printHeader,
  printResponse,
  printStreamChunk,
  printUsage,
  printRelatedQuestions,
  printImages,
  printSuccess,
  printWarning,
  printError,
} from '../../src/lib/output.js';

describe('output', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    writeSpy.mockRestore();
  });

  describe('createSpinner', () => {
    it('returns a spinner with the given text', () => {
      const spinner = createSpinner('hi');
      expect(spinner).toBeDefined();
      expect(spinner.text).toBe('hi');
    });
  });

  describe('printHeader', () => {
    it('writes to console.log', () => {
      printHeader('hello');
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls[0][0]).toContain('hello');
    });
  });

  describe('printResponse', () => {
    it('uses console.log when not raw', () => {
      printResponse('hello', false);
      expect(logSpy).toHaveBeenCalled();
    });

    it('writes raw to stdout when raw', () => {
      printResponse('hello', true);
      expect(writeSpy).toHaveBeenCalledWith('hello');
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('printStreamChunk', () => {
    it('writes to stdout in raw mode', () => {
      printStreamChunk('chunk', true);
      expect(writeSpy).toHaveBeenCalledWith('chunk');
    });

    it('writes colored chunk to stdout in non-raw mode', () => {
      printStreamChunk('chunk', false);
      expect(writeSpy).toHaveBeenCalled();
      expect(writeSpy.mock.calls[0][0]).toContain('chunk');
    });
  });

  describe('printUsage', () => {
    it('formats token counts', () => {
      printUsage(10, 20, 30);
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('10');
      expect(out).toContain('20');
      expect(out).toContain('30');
    });
  });

  describe('printRelatedQuestions', () => {
    it('does nothing for empty list', () => {
      printRelatedQuestions([]);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('prints each question', () => {
      printRelatedQuestions(['What is X?', 'How does Y work?']);
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('What is X?');
      expect(out).toContain('How does Y work?');
    });
  });

  describe('printImages', () => {
    it('does nothing for empty list', () => {
      printImages([]);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('prints url and optional title', () => {
      printImages([
        { url: 'https://img.example.com/a.png', title: 'Alpha' },
        { url: 'https://img.example.com/b.png' },
      ]);
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('Alpha');
      expect(out).toContain('a.png');
      expect(out).toContain('b.png');
    });
  });

  describe('printSuccess / printWarning / printError', () => {
    it('printSuccess uses console.log', () => {
      printSuccess('done');
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls[0][0]).toContain('done');
    });

    it('printWarning uses console.log', () => {
      printWarning('careful');
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls[0][0]).toContain('careful');
    });

    it('printError uses console.error', () => {
      printError('bad');
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toContain('bad');
    });
  });
});
