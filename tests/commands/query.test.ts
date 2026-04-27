import { describe, it, expect } from 'vitest';
import { buildMessages, buildBaseParams } from '../../src/commands/query.js';
import type { QueryOptions } from '../../src/lib/types.js';

const baseOpts = (over: Partial<QueryOptions> = {}): QueryOptions => ({
  model: 'sonar',
  stream: true,
  ...over,
});

describe('query command helpers', () => {
  describe('buildMessages', () => {
    it('starts with system prompt and ends with the user question', () => {
      const messages = buildMessages('What is X?', 'Be precise.');
      expect(messages[0]).toEqual({ role: 'system', content: 'Be precise.' });
      expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'What is X?' });
    });

    it('inserts thread messages between system prompt and current question', () => {
      const messages = buildMessages('Follow-up?', 'sys', [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
      ]);
      expect(messages).toHaveLength(4);
      expect(messages[1].content).toBe('first');
      expect(messages[2].content).toBe('reply');
      expect(messages[3].content).toBe('Follow-up?');
    });

    it('handles empty thread messages array', () => {
      const messages = buildMessages('q', 'sys', []);
      expect(messages).toHaveLength(2);
    });
  });

  describe('buildBaseParams', () => {
    const messages = [{ role: 'user', content: 'hi' }];

    it('always includes model and messages', () => {
      const p = buildBaseParams(messages, baseOpts());
      expect(p.model).toBe('sonar');
      expect(p.messages).toBe(messages);
    });

    it('sets search_mode when provided', () => {
      const p = buildBaseParams(messages, baseOpts({ searchMode: 'academic' }));
      expect(p.search_mode).toBe('academic');
    });

    it('sets recency filter', () => {
      const p = buildBaseParams(messages, baseOpts({ recency: 'week' }));
      expect(p.search_recency_filter).toBe('week');
    });

    it('sets after/before date filters', () => {
      const p = buildBaseParams(messages, baseOpts({ after: '2026-01-01', before: '2026-04-01' }));
      expect(p.search_after_date_filter).toBe('2026-01-01');
      expect(p.search_before_date_filter).toBe('2026-04-01');
    });

    it('combines include and exclude domains', () => {
      const p = buildBaseParams(
        messages,
        baseOpts({ domain: ['good.com'], excludeDomain: ['bad.com'] }),
      );
      expect(p.search_domain_filter).toEqual(['good.com', '-bad.com']);
    });

    it('uses only exclude domains when no include given', () => {
      const p = buildBaseParams(messages, baseOpts({ excludeDomain: ['bad.com', 'spam.io'] }));
      expect(p.search_domain_filter).toEqual(['-bad.com', '-spam.io']);
    });

    it('sets return_images', () => {
      const p = buildBaseParams(messages, baseOpts({ images: true }));
      expect(p.return_images).toBe(true);
    });

    it('sets return_related_questions', () => {
      const p = buildBaseParams(messages, baseOpts({ related: true }));
      expect(p.return_related_questions).toBe(true);
    });

    it('sets reasoning_effort', () => {
      const p = buildBaseParams(messages, baseOpts({ reasoning: 'high' }));
      expect(p.reasoning_effort).toBe('high');
    });

    it('sets language filter as array', () => {
      const p = buildBaseParams(messages, baseOpts({ language: 'en' }));
      expect(p.search_language_filter).toEqual(['en']);
    });

    it('sets disable_search when search is false', () => {
      const p = buildBaseParams(messages, baseOpts({ search: false }));
      expect(p.disable_search).toBe(true);
    });

    it('does not set disable_search when search is true or undefined', () => {
      expect(buildBaseParams(messages, baseOpts({ search: true })).disable_search).toBeUndefined();
      expect(buildBaseParams(messages, baseOpts()).disable_search).toBeUndefined();
    });

    it('sets safe_search', () => {
      const p = buildBaseParams(messages, baseOpts({ safeSearch: true }));
      expect(p.safe_search).toBe(true);
    });

    it('wraps context size in web_search_options', () => {
      const p = buildBaseParams(messages, baseOpts({ contextSize: 'high' }));
      expect(p.web_search_options).toEqual({ search_context_size: 'high' });
    });

    it('does not set domain filter when both are absent', () => {
      const p = buildBaseParams(messages, baseOpts());
      expect(p.search_domain_filter).toBeUndefined();
    });

    it('sets response_format when json is true', () => {
      const p = buildBaseParams(messages, baseOpts({ json: true }));
      expect(p.response_format).toEqual({ type: 'text' });
    });

    it('does not set response_format when json is falsy', () => {
      const p = buildBaseParams(messages, baseOpts());
      expect(p.response_format).toBeUndefined();
    });
  });
});
