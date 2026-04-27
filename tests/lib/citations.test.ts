import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { colorizeInlineCitations, formatCitations } from '../../src/lib/citations.js';

describe('citations', () => {
  describe('colorizeInlineCitations', () => {
    it('processes text with single citation', () => {
      const result = colorizeInlineCitations('This is a fact [1].');
      expect(result).toContain('[1]');
      expect(result.length).toBeGreaterThanOrEqual('This is a fact [1].'.length);
    });

    it('processes text with multiple citations', () => {
      const result = colorizeInlineCitations('Fact one [1] and fact two [2].');
      expect(result).toContain('[1]');
      expect(result).toContain('[2]');
    });

    it('leaves text without citations unchanged', () => {
      const text = 'No citations here.';
      const result = colorizeInlineCitations(text);
      expect(result).toBe(text);
    });

    it('handles empty string', () => {
      expect(colorizeInlineCitations('')).toBe('');
    });

    it('does not colorize non-numeric brackets', () => {
      const text = 'Array [index] access';
      const result = colorizeInlineCitations(text);
      expect(result).toBe(text);
    });

    it('handles back-to-back citations', () => {
      const result = colorizeInlineCitations('Multi [1][2][3] cite');
      expect(result).toContain('[1]');
      expect(result).toContain('[2]');
      expect(result).toContain('[3]');
    });
  });

  describe('formatCitations', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it('does nothing when citations is null', () => {
      formatCitations(null, null);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('does nothing when citations is undefined', () => {
      formatCitations(undefined, undefined);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('does nothing for empty citations array', () => {
      formatCitations([], []);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('prints urls without titles when no search results', () => {
      formatCitations(['https://example.com'], null);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('Sources');
      expect(output).toContain('https://example.com');
    });

    it('prints titles when matched search result exists', () => {
      formatCitations(
        ['https://example.com'],
        [{ title: 'Example Site', url: 'https://example.com' }],
      );
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('Example Site');
      expect(output).toContain('https://example.com');
    });

    it('handles citations whose URL has no matching search result', () => {
      formatCitations(
        ['https://other.com'],
        [{ title: 'Example', url: 'https://example.com' }],
      );
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('https://other.com');
      expect(output).not.toContain('Example');
    });

    it('numbers citations starting from 1', () => {
      formatCitations(['https://a.com', 'https://b.com'], null);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toMatch(/\[1\]/);
      expect(output).toMatch(/\[2\]/);
    });
  });
});
