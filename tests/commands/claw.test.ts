import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  routeRequest,
  createClawServer,
  isLoopbackAddress,
  CLAW_API_DOC,
  DEFAULT_CLAW_PORT,
  type ClawClient,
} from '../../src/commands/claw.js';
import { _resetConfigDir } from '../../src/lib/config.js';
import { saveToHistory, createThread, saveThread, getHistory } from '../../src/lib/history.js';
import { APP_VERSION } from '../../src/lib/types.js';

const TEST_DIR = path.join(os.tmpdir(), 'pplx-claw-test-' + Date.now());

function makeMockClient(): { client: ClawClient; mocks: Record<string, ReturnType<typeof vi.fn>> } {
  const mocks = {
    chatCreate: vi.fn(),
    searchCreate: vi.fn(),
    asyncCreate: vi.fn(),
    asyncGet: vi.fn(),
  };
  const client = {
    chat: { completions: { create: mocks.chatCreate } },
    search: { create: mocks.searchCreate },
    async: { chat: { completions: { create: mocks.asyncCreate, get: mocks.asyncGet } } },
  } as unknown as ClawClient;
  return { client, mocks };
}

function chatResponse(content: string, citations: string[] = []) {
  return {
    id: 'r1',
    choices: [
      {
        index: 0,
        delta: { role: 'assistant', content: '' },
        message: { role: 'assistant', content },
      },
    ],
    created: 0,
    model: 'sonar',
    citations,
    search_results: [],
  };
}

describe('claw routing', () => {
  beforeEach(() => {
    _resetConfigDir();
    process.env.PERPLEXITY_CONFIG_DIR = TEST_DIR;
    process.env.PPLX_DISABLE_KEYCHAIN = '1';
  });

  afterEach(() => {
    _resetConfigDir();
    delete process.env.PERPLEXITY_CONFIG_DIR;
    delete process.env.PPLX_DISABLE_KEYCHAIN;
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('isLoopbackAddress', () => {
    it.each([
      ['127.0.0.1', true],
      ['::1', true],
      ['::ffff:127.0.0.1', true],
      ['10.0.0.1', false],
      ['192.168.1.1', false],
      [undefined, false],
    ])('classifies %s as loopback=%s', (addr, expected) => {
      expect(isLoopbackAddress(addr as string | undefined)).toBe(expected);
    });
  });

  describe('GET /health', () => {
    it('returns ok and version', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/health', new URLSearchParams(), null, client);
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ ok: true, version: APP_VERSION });
    });
  });

  describe('GET /api', () => {
    it('returns the self-describing summary', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/api', new URLSearchParams(), null, client);
      expect(r.status).toBe(200);
      expect(r.body).toBe(CLAW_API_DOC);
    });

    it('also serves /', async () => {
      const { client } = makeMockClient();
      expect((await routeRequest('GET', '/', new URLSearchParams(), null, client)).body).toBe(CLAW_API_DOC);
    });

    it('summary advertises /api/spec', () => {
      const paths = CLAW_API_DOC.endpoints.map((e) => `${e.method} ${e.path}`);
      expect(paths).toContain('GET /api/spec');
      expect((CLAW_API_DOC as { specUrl: string }).specUrl).toBe('/api/spec');
    });
  });

  describe('GET /api/spec (OpenAPI)', () => {
    it('returns a valid OpenAPI 3 document', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/api/spec', new URLSearchParams(), null, client);
      expect(r.status).toBe(200);
      const spec = r.body as Record<string, unknown>;
      expect(spec.openapi).toMatch(/^3\./);
      expect((spec.info as { title: string }).title).toBe('pplx claw');
      expect((spec.info as { version: string }).version).toBeTruthy();
      expect(spec.paths).toBeTypeOf('object');
      expect(spec.components).toBeTypeOf('object');
    });

    it('declares every implemented route in the paths object', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/api/spec', new URLSearchParams(), null, client);
      const paths = (r.body as { paths: Record<string, unknown> }).paths;
      for (const p of [
        '/health',
        '/api',
        '/api/spec',
        '/models',
        '/query',
        '/search',
        '/research',
        '/research/{id}',
        '/history',
        '/threads/{id}',
      ]) {
        expect(paths).toHaveProperty(p);
      }
    });

    it('declares request schemas for POST endpoints', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/api/spec', new URLSearchParams(), null, client);
      const spec = r.body as { paths: Record<string, Record<string, { requestBody?: unknown }>> };
      expect(spec.paths['/query'].post.requestBody).toBeDefined();
      expect(spec.paths['/search'].post.requestBody).toBeDefined();
      expect(spec.paths['/research'].post.requestBody).toBeDefined();
    });

    it('declares all referenced schemas under components.schemas', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/api/spec', new URLSearchParams(), null, client);
      const spec = r.body as { components: { schemas: Record<string, unknown> } };
      const schemas = spec.components.schemas;
      for (const name of [
        'HealthResponse',
        'Model',
        'ErrorResponse',
        'QueryRequest',
        'ChatCompletion',
        'SearchRequest',
        'SearchResponse',
        'SearchHit',
        'ResearchRequest',
        'ResearchSubmission',
        'ResearchState',
        'HistoryEntry',
        'Thread',
        'ThreadMessage',
      ]) {
        expect(schemas).toHaveProperty(name);
      }
    });

    it('also serves /openapi and /openapi.json as aliases', async () => {
      const { client } = makeMockClient();
      const a = await routeRequest('GET', '/openapi', new URLSearchParams(), null, client);
      const b = await routeRequest('GET', '/openapi.json', new URLSearchParams(), null, client);
      expect((a.body as { openapi: string }).openapi).toMatch(/^3\./);
      expect((b.body as { openapi: string }).openapi).toMatch(/^3\./);
    });

    it('every $ref points to an existing components.schemas/responses entry', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/api/spec', new URLSearchParams(), null, client);
      const json = JSON.stringify(r.body);
      const refs = [...json.matchAll(/"\$ref"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
      const spec = r.body as { components: { schemas: Record<string, unknown>; responses: Record<string, unknown> } };
      for (const ref of refs) {
        const m = ref.match(/^#\/components\/(schemas|responses)\/(.+)$/);
        expect(m, `unexpected $ref shape: ${ref}`).not.toBeNull();
        if (!m) continue;
        const bucket = m[1] === 'schemas' ? spec.components.schemas : spec.components.responses;
        expect(bucket, `missing ${m[1]} entry: ${m[2]}`).toHaveProperty(m[2]);
      }
    });
  });

  describe('GET /models', () => {
    it('returns the model catalog', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/models', new URLSearchParams(), null, client);
      expect(r.status).toBe(200);
      expect(r.body).toHaveProperty('sonar');
      expect(r.body).toHaveProperty('sonar-pro');
    });
  });

  describe('POST /query', () => {
    it('rejects missing body', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('POST', '/query', new URLSearchParams(), null, client);
      expect(r.status).toBe(400);
    });

    it('rejects missing question field', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('POST', '/query', new URLSearchParams(), { model: 'sonar' }, client);
      expect(r.status).toBe(400);
    });

    it('forwards options to chat completions and saves history', async () => {
      const { client, mocks } = makeMockClient();
      mocks.chatCreate.mockResolvedValue(chatResponse('hello', ['https://a.com']));

      const r = await routeRequest(
        'POST',
        '/query',
        new URLSearchParams(),
        { question: 'hi', model: 'sonar-pro', recency: 'week', search: false },
        client,
      );

      expect(r.status).toBe(200);
      expect(mocks.chatCreate).toHaveBeenCalledTimes(1);
      const callArg = mocks.chatCreate.mock.calls[0][0];
      expect(callArg.model).toBe('sonar-pro');
      expect(callArg.search_recency_filter).toBe('week');
      expect(callArg.disable_search).toBe(true);
      expect(callArg.stream).toBe(false);

      const history = getHistory();
      expect(history[0].question).toBe('hi');
      expect(history[0].model).toBe('sonar-pro');
      expect(history[0].citations).toBe(1);
    });

    it('uses custom system prompt when provided', async () => {
      const { client, mocks } = makeMockClient();
      mocks.chatCreate.mockResolvedValue(chatResponse('ok'));

      await routeRequest(
        'POST',
        '/query',
        new URLSearchParams(),
        { question: 'q', system: 'You are pirate.' },
        client,
      );

      const callArg = mocks.chatCreate.mock.calls[0][0];
      expect(callArg.messages[0]).toEqual({ role: 'system', content: 'You are pirate.' });
    });
  });

  describe('POST /search', () => {
    it('rejects missing query', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('POST', '/search', new URLSearchParams(), {}, client);
      expect(r.status).toBe(400);
    });

    it('forwards options and returns search response', async () => {
      const { client, mocks } = makeMockClient();
      const fakeResp = { id: 's1', results: [{ title: 'A', url: 'https://a.com', snippet: 's' }] };
      mocks.searchCreate.mockResolvedValue(fakeResp);

      const r = await routeRequest(
        'POST',
        '/search',
        new URLSearchParams(),
        { query: 'foo', maxResults: 5, mode: 'academic', domain: ['arxiv.org'] },
        client,
      );

      expect(r.status).toBe(200);
      expect(r.body).toBe(fakeResp);
      const arg = mocks.searchCreate.mock.calls[0][0];
      expect(arg.query).toBe('foo');
      expect(arg.max_results).toBe(5);
      expect(arg.search_mode).toBe('academic');
      expect(arg.search_domain_filter).toEqual(['arxiv.org']);
    });
  });

  describe('POST /research and GET /research/:id', () => {
    it('rejects missing topic', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('POST', '/research', new URLSearchParams(), {}, client);
      expect(r.status).toBe(400);
    });

    it('starts research with the deep-research model', async () => {
      const { client, mocks } = makeMockClient();
      mocks.asyncCreate.mockResolvedValue({ id: 'req-1', status: 'CREATED', created_at: 0, model: 'sonar-deep-research' });

      const r = await routeRequest('POST', '/research', new URLSearchParams(), { topic: 'X' }, client);
      expect(r.status).toBe(200);
      expect((r.body as { id: string }).id).toBe('req-1');

      const arg = mocks.asyncCreate.mock.calls[0][0];
      expect(arg.request.model).toBe('sonar-deep-research');
      expect(arg.request.messages[0].content).toBe('X');
    });

    it('GET /research/:id returns the polled state', async () => {
      const { client, mocks } = makeMockClient();
      mocks.asyncGet.mockResolvedValue({ id: 'req-1', status: 'IN_PROGRESS', created_at: 0, model: 'sonar-deep-research' });
      const r = await routeRequest('GET', '/research/req-1', new URLSearchParams(), null, client);
      expect(r.status).toBe(200);
      expect(mocks.asyncGet).toHaveBeenCalledWith('req-1');
    });
  });

  describe('GET /history and /threads/:id', () => {
    it('returns recent history', async () => {
      saveToHistory('Q1', 'sonar');
      saveToHistory('Q2', 'sonar');
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/history', new URLSearchParams(), null, client);
      expect(r.status).toBe(200);
      const arr = r.body as Array<{ question: string }>;
      expect(arr[0].question).toBe('Q2');
    });

    it('respects ?limit', async () => {
      for (let i = 0; i < 5; i++) saveToHistory(`Q${i}`, 'sonar');
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/history', new URLSearchParams('limit=2'), null, client);
      expect((r.body as unknown[])).toHaveLength(2);
    });

    it('returns threads when ?threads=true', async () => {
      const id = createThread('sonar');
      saveThread(id, 'sonar', [{ role: 'user', content: 'hi' }]);
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/history', new URLSearchParams('threads=true'), null, client);
      const arr = r.body as Array<{ id: string }>;
      expect(arr[0].id).toBe(id);
    });

    it('returns specific thread by id', async () => {
      const id = createThread('sonar');
      saveThread(id, 'sonar', [{ role: 'user', content: 'hi' }]);
      const { client } = makeMockClient();
      const r = await routeRequest('GET', `/threads/${id}`, new URLSearchParams(), null, client);
      expect(r.status).toBe(200);
      expect((r.body as { id: string }).id).toBe(id);
    });

    it('returns 404 for unknown thread', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/threads/nope', new URLSearchParams(), null, client);
      expect(r.status).toBe(404);
    });
  });

  describe('unknown routes', () => {
    it('returns 404 with method/path echoed', async () => {
      const { client } = makeMockClient();
      const r = await routeRequest('GET', '/nope', new URLSearchParams(), null, client);
      expect(r.status).toBe(404);
      expect(r.body).toMatchObject({ method: 'GET', path: '/nope' });
    });
  });
});

describe('claw HTTP server', () => {
  let server: http.Server;
  let port: number;
  let mocks: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    _resetConfigDir();
    process.env.PERPLEXITY_CONFIG_DIR = TEST_DIR;
    process.env.PPLX_DISABLE_KEYCHAIN = '1';
    const { client, mocks: m } = makeMockClient();
    mocks = m;
    server = createClawServer(client);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    _resetConfigDir();
    delete process.env.PERPLEXITY_CONFIG_DIR;
    delete process.env.PPLX_DISABLE_KEYCHAIN;
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  async function request(method: string, p: string, body?: unknown): Promise<{ status: number; body: unknown }> {
    const res = await fetch(`http://127.0.0.1:${port}${p}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json };
  }

  it('serves /health over HTTP', async () => {
    const r = await request('GET', '/health');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true });
  });

  it('rejects malformed JSON bodies', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ error: expect.stringContaining('JSON') });
  });

  it('serves /api as JSON', async () => {
    const r = await request('GET', '/api');
    expect(r.status).toBe(200);
    expect((r.body as { name: string }).name).toContain('claw');
  });

  it('serves /api/spec as OpenAPI JSON', async () => {
    const r = await request('GET', '/api/spec');
    expect(r.status).toBe(200);
    const spec = r.body as { openapi: string; paths: Record<string, unknown> };
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.paths).toHaveProperty('/query');
  });

  it('routes POST /search end-to-end', async () => {
    mocks.searchCreate.mockResolvedValue({ id: 's1', results: [] });
    const r = await request('POST', '/search', { query: 'hi' });
    expect(r.status).toBe(200);
    expect(mocks.searchCreate).toHaveBeenCalled();
  });

  it('returns 500 with error message when handler throws', async () => {
    mocks.searchCreate.mockRejectedValue(new Error('upstream blew up'));
    const r = await request('POST', '/search', { query: 'hi' });
    expect(r.status).toBe(500);
    expect((r.body as { error: string }).error).toContain('upstream blew up');
  });
});

describe('claw --help', () => {
  it('points at pplx security so users can find the threat model', async () => {
    const { Command } = await import('commander');
    const { registerClawCommand } = await import('../../src/commands/claw.js');
    const program = new Command();
    registerClawCommand(program);
    const claw = program.commands.find((c) => c.name() === 'claw') as InstanceType<typeof Command>;
    expect(claw).toBeDefined();
    const captured: string[] = [];
    claw.configureOutput({
      writeOut: (s) => captured.push(s),
      writeErr: (s) => captured.push(s),
    });
    claw.outputHelp();
    expect(captured.join('')).toContain('pplx security');
  });
});

describe('claw constants', () => {
  it('default port is 49411', () => {
    expect(DEFAULT_CLAW_PORT).toBe(49411);
  });

  it('CLAW_API_DOC documents every implemented endpoint', () => {
    const paths = CLAW_API_DOC.endpoints.map((e) => `${e.method} ${e.path}`);
    expect(paths).toContain('GET /health');
    expect(paths).toContain('GET /api');
    expect(paths).toContain('GET /models');
    expect(paths).toContain('POST /query');
    expect(paths).toContain('POST /search');
    expect(paths).toContain('POST /research');
    expect(paths).toContain('GET /research/:id');
    expect(paths).toContain('GET /history');
    expect(paths).toContain('GET /threads/:id');
  });
});
