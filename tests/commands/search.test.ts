import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SearchCreateResponse } from '@perplexity-ai/perplexity_ai/resources/search';
import { buildSearchParams, renderSearchResults } from '../../src/commands/search.js';

describe('search command', () => {
  describe('buildSearchParams', () => {
    it('returns base params with just query', () => {
      const p = buildSearchParams('hello', {});
      expect(p.query).toBe('hello');
      expect(p.max_results).toBeUndefined();
      expect(p.search_mode).toBeUndefined();
    });

    it('passes max_results through', () => {
      const p = buildSearchParams('q', { maxResults: 5 });
      expect(p.max_results).toBe(5);
    });

    it('passes search_mode through', () => {
      const p = buildSearchParams('q', { mode: 'academic' });
      expect(p.search_mode).toBe('academic');
    });

    it('passes search_recency_filter through', () => {
      const p = buildSearchParams('q', { recency: 'week' });
      expect(p.search_recency_filter).toBe('week');
    });

    it('passes search_domain_filter through', () => {
      const p = buildSearchParams('q', { domain: ['a.com', 'b.com'] });
      expect(p.search_domain_filter).toEqual(['a.com', 'b.com']);
    });

    it('skips domain filter when empty array', () => {
      const p = buildSearchParams('q', { domain: [] });
      expect(p.search_domain_filter).toBeUndefined();
    });

    it('combines all params', () => {
      const p = buildSearchParams('q', {
        maxResults: 3,
        mode: 'sec',
        recency: 'day',
        domain: ['sec.gov'],
      });
      expect(p.query).toBe('q');
      expect(p.max_results).toBe(3);
      expect(p.search_mode).toBe('sec');
      expect(p.search_recency_filter).toBe('day');
      expect(p.search_domain_filter).toEqual(['sec.gov']);
    });
  });

  describe('renderSearchResults', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    function output(): string {
      return logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    }

    it('warns when no results', () => {
      const resp: SearchCreateResponse = { id: 'r1', results: [] };
      renderSearchResults(resp);
      expect(output()).toContain('No results');
    });

    it('prints title, url, and snippet', () => {
      const resp: SearchCreateResponse = {
        id: 'r1',
        results: [
          {
            title: 'Hello World',
            url: 'https://example.com',
            snippet: 'A short snippet.',
          },
        ],
      };
      renderSearchResults(resp);
      const out = output();
      expect(out).toContain('Hello World');
      expect(out).toContain('https://example.com');
      expect(out).toContain('A short snippet.');
    });

    it('prints date when present', () => {
      const resp: SearchCreateResponse = {
        id: 'r1',
        results: [
          {
            title: 'A',
            url: 'https://a.com',
            snippet: 's',
            date: '2026-01-01',
          },
        ],
      };
      renderSearchResults(resp);
      expect(output()).toContain('2026-01-01');
    });

    it('truncates long snippets', () => {
      const long = 'x'.repeat(500);
      const resp: SearchCreateResponse = {
        id: 'r1',
        results: [{ title: 'A', url: 'https://a.com', snippet: long }],
      };
      renderSearchResults(resp);
      const out = output();
      expect(out).toContain('...');
      // Should not contain the entire 500-char string
      expect(out).not.toContain('x'.repeat(500));
    });

    it('numbers results', () => {
      const resp: SearchCreateResponse = {
        id: 'r1',
        results: [
          { title: 'A', url: 'https://a.com', snippet: '' },
          { title: 'B', url: 'https://b.com', snippet: '' },
        ],
      };
      renderSearchResults(resp);
      const out = output();
      expect(out).toMatch(/\[1\]/);
      expect(out).toMatch(/\[2\]/);
    });
  });
});
