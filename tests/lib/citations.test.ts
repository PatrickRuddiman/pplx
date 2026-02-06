import { describe, it, expect } from 'vitest';
import { colorizeInlineCitations } from '../../src/lib/citations.js';

describe('citations', () => {
  describe('colorizeInlineCitations', () => {
    it('processes text with single citation', () => {
      const result = colorizeInlineCitations('This is a fact [1].');
      expect(result).toContain('[1]');
      // Result should either be colorized or unchanged (depends on chalk color support)
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
  });
});
