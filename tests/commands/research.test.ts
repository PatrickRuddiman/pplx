import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  extractResearchText,
  renderResearchStatus,
  renderResearchReport,
  renderResearchSubmission,
} from '../../src/commands/research.js';

function makeResult(over: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    created_at: 1700000000,
    model: 'sonar-deep-research',
    status: 'COMPLETED',
    response: {
      id: 'r-1',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: '' },
          message: { role: 'assistant', content: 'Report body.' },
        },
      ],
      created: 1700000000,
      model: 'sonar-deep-research',
      citations: ['https://example.com'],
      search_results: [{ title: 'Example', url: 'https://example.com', snippet: 's' }],
    },
    ...over,
  } as Parameters<typeof renderResearchReport>[0];
}

describe('research command helpers', () => {
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

  describe('extractResearchText', () => {
    it('returns content string when present', () => {
      expect(extractResearchText(makeResult())).toBe('Report body.');
    });

    it('returns empty string when no response', () => {
      expect(extractResearchText(makeResult({ response: null }))).toBe('');
    });

    it('returns empty string when content is non-string', () => {
      const result = makeResult();
      // @ts-expect-error - intentionally setting non-string content for test
      result.response!.choices[0].message.content = [{ type: 'text', text: 'hi' }];
      expect(extractResearchText(result)).toBe('');
    });
  });

  describe('renderResearchStatus', () => {
    it('prints id and status', () => {
      renderResearchStatus({ id: 'abc', status: 'IN_PROGRESS' });
      const out = output();
      expect(out).toContain('abc');
      expect(out).toContain('IN_PROGRESS');
    });

    it('formats created_at when present', () => {
      renderResearchStatus({ id: 'abc', status: 'COMPLETED', created_at: 1700000000 });
      expect(output()).toContain('Created');
    });

    it('formats completed_at when present', () => {
      renderResearchStatus({
        id: 'abc',
        status: 'COMPLETED',
        created_at: 1700000000,
        completed_at: 1700000010,
      });
      expect(output()).toContain('Completed');
    });
  });

  describe('renderResearchReport', () => {
    it('reports incomplete when status is not COMPLETED', () => {
      renderResearchReport(makeResult({ status: 'IN_PROGRESS' }), {});
      expect(output()).toContain('not yet complete');
    });

    it('reports no response when response missing', () => {
      renderResearchReport(makeResult({ response: null }), {});
      expect(output()).toContain('No response data');
    });

    it('prints JSON when json=true', () => {
      renderResearchReport(makeResult(), { json: true });
      const parsed = JSON.parse(output());
      expect(parsed.id).toBe('req-1');
    });

    it('prints report body and citations when not json', () => {
      renderResearchReport(makeResult(), {});
      const out = output();
      expect(out).toContain('Research Report');
      expect(out).toContain('Report body.');
      expect(out).toContain('https://example.com');
    });

    it('writes to output file when provided', () => {
      const tmp = path.join(os.tmpdir(), `pplx-research-out-${Date.now()}.txt`);
      try {
        renderResearchReport(makeResult(), { output: tmp });
        expect(fs.existsSync(tmp)).toBe(true);
        expect(fs.readFileSync(tmp, 'utf8')).toBe('Report body.');
      } finally {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      }
    });
  });

  describe('renderResearchSubmission', () => {
    it('prints id and status, plus instructions when not waiting', () => {
      renderResearchSubmission(
        { id: 'r1', created_at: 1, model: 'm', status: 'CREATED' },
        false,
      );
      const out = output();
      expect(out).toContain('r1');
      expect(out).toContain('CREATED');
      expect(out).toContain('research status');
      expect(out).toContain('research get');
    });

    it('skips usage instructions when waiting', () => {
      renderResearchSubmission(
        { id: 'r2', created_at: 1, model: 'm', status: 'CREATED' },
        true,
      );
      const out = output();
      expect(out).toContain('r2');
      expect(out).not.toContain('research status');
    });
  });
});
