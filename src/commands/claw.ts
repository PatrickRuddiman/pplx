import { Command } from 'commander';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type Perplexity from '@perplexity-ai/perplexity_ai';
import type { CompletionCreateParamsNonStreaming } from '@perplexity-ai/perplexity_ai/resources/chat/completions';
import { getClient } from '../lib/client.js';
import { resolveApiKey } from '../lib/config.js';
import { exitNoApiKey } from '../lib/errors.js';
import {
  getHistory,
  listThreads,
  getThread,
  saveToHistory,
} from '../lib/history.js';
import {
  MODELS,
  APP_VERSION,
  DEFAULT_SYSTEM_PROMPT,
  type QueryOptions,
} from '../lib/types.js';
import { buildMessages, buildBaseParams } from './query.js';
import { buildSearchParams } from './search.js';

export const DEFAULT_CLAW_PORT = 49411;
export const DEFAULT_CLAW_HOST = '127.0.0.1';
const MAX_BODY_BYTES = 1_000_000;

export type ClawClient = Pick<Perplexity, 'chat' | 'search' | 'async'>;

export interface ClawResult {
  status: number;
  body: unknown;
}

export const CLAW_API_DOC = {
  name: '@pruddiman/pplx claw',
  version: APP_VERSION,
  description:
    'Localhost HTTP gateway for the Perplexity AI CLI. The CLI process holds the (encrypted-at-rest) API key; clients on this loopback never see it.',
  defaultBaseUrl: `http://${DEFAULT_CLAW_HOST}:${DEFAULT_CLAW_PORT}`,
  endpoints: [
    { method: 'GET', path: '/health', summary: 'Liveness probe' },
    { method: 'GET', path: '/api', summary: 'This self-describing API document' },
    { method: 'GET', path: '/models', summary: 'List available Perplexity models' },
    {
      method: 'POST',
      path: '/query',
      summary: 'Send a chat completion query (non-streaming)',
      body: {
        question: 'string (required)',
        model: 'string (optional, default: sonar)',
        system: 'string (optional, override system prompt)',
        searchMode: '"web" | "academic" | "sec"',
        recency: '"hour" | "day" | "week" | "month" | "year"',
        after: 'YYYY-MM-DD',
        before: 'YYYY-MM-DD',
        domain: 'string[] (include only)',
        excludeDomain: 'string[] (added with - prefix)',
        images: 'boolean',
        related: 'boolean',
        reasoning: '"minimal" | "low" | "medium" | "high"',
        contextSize: '"low" | "medium" | "high"',
        language: 'string (BCP-47 code)',
        safeSearch: 'boolean',
        search: 'boolean (default true; false to disable web search)',
      },
    },
    {
      method: 'POST',
      path: '/search',
      summary: 'Search the web via the dedicated Perplexity Search API',
      body: {
        query: 'string (required)',
        maxResults: 'number (default 10)',
        mode: '"web" | "academic" | "sec"',
        recency: '"hour" | "day" | "week" | "month" | "year"',
        domain: 'string[]',
      },
    },
    {
      method: 'POST',
      path: '/research',
      summary: 'Start an async deep-research request (sonar-deep-research)',
      body: { topic: 'string (required)' },
    },
    {
      method: 'GET',
      path: '/research/:id',
      summary: 'Fetch the current status / response of a research request',
    },
    {
      method: 'GET',
      path: '/history',
      summary: 'Recent query history. Use ?threads=true for conversation threads',
      query: { limit: 'number (default 20)', threads: 'boolean' },
    },
    { method: 'GET', path: '/threads/:id', summary: 'Single conversation thread' },
  ],
} as const;

export function readBody(req: http.IncomingMessage, max = MAX_BODY_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > max) {
        reject(new Error('Request body exceeds maximum size'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function isLoopbackAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function bodyToOptions(b: Record<string, unknown>): QueryOptions {
  return {
    model: typeof b.model === 'string' ? b.model : 'sonar',
    stream: false,
    searchMode: b.searchMode as QueryOptions['searchMode'],
    recency: b.recency as QueryOptions['recency'],
    after: b.after as string | undefined,
    before: b.before as string | undefined,
    domain: Array.isArray(b.domain) ? (b.domain as string[]) : undefined,
    excludeDomain: Array.isArray(b.excludeDomain) ? (b.excludeDomain as string[]) : undefined,
    images: b.images as boolean | undefined,
    related: b.related as boolean | undefined,
    reasoning: b.reasoning as QueryOptions['reasoning'],
    contextSize: b.contextSize as QueryOptions['contextSize'],
    language: b.language as string | undefined,
    system: b.system as string | undefined,
    citations: true,
    search: b.search === false ? false : true,
    safeSearch: b.safeSearch as boolean | undefined,
  };
}

export async function routeRequest(
  method: string,
  pathname: string,
  query: URLSearchParams,
  body: unknown,
  client: ClawClient,
): Promise<ClawResult> {
  if (method === 'GET' && pathname === '/health') {
    return { status: 200, body: { ok: true, version: APP_VERSION } };
  }

  if (method === 'GET' && (pathname === '/' || pathname === '/api' || pathname === '/openapi')) {
    return { status: 200, body: CLAW_API_DOC };
  }

  if (method === 'GET' && pathname === '/models') {
    return { status: 200, body: MODELS };
  }

  if (method === 'POST' && pathname === '/query') {
    if (!body || typeof body !== 'object') {
      return { status: 400, body: { error: 'JSON body required' } };
    }
    const b = body as Record<string, unknown>;
    if (typeof b.question !== 'string' || b.question.length === 0) {
      return { status: 400, body: { error: 'Body field "question" is required' } };
    }
    const opts = bodyToOptions(b);
    const messages = buildMessages(b.question, opts.system ?? DEFAULT_SYSTEM_PROMPT);
    const params = buildBaseParams(messages, opts);
    const completion = await client.chat.completions.create({
      ...params,
      stream: false,
    } as CompletionCreateParamsNonStreaming);
    const content = completion.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : '';
    saveToHistory(b.question, opts.model, text, completion.citations?.length ?? undefined);
    return { status: 200, body: completion };
  }

  if (method === 'POST' && pathname === '/search') {
    if (!body || typeof body !== 'object') {
      return { status: 400, body: { error: 'JSON body required' } };
    }
    const b = body as Record<string, unknown>;
    if (typeof b.query !== 'string' || b.query.length === 0) {
      return { status: 400, body: { error: 'Body field "query" is required' } };
    }
    const params = buildSearchParams(b.query, {
      maxResults: typeof b.maxResults === 'number' ? b.maxResults : undefined,
      mode: b.mode as 'web' | 'academic' | 'sec' | undefined,
      recency: b.recency as 'hour' | 'day' | 'week' | 'month' | 'year' | undefined,
      domain: Array.isArray(b.domain) ? (b.domain as string[]) : undefined,
    });
    const result = await client.search.create(params);
    return { status: 200, body: result };
  }

  if (method === 'POST' && pathname === '/research') {
    if (!body || typeof body !== 'object') {
      return { status: 400, body: { error: 'JSON body required' } };
    }
    const b = body as Record<string, unknown>;
    if (typeof b.topic !== 'string' || b.topic.length === 0) {
      return { status: 400, body: { error: 'Body field "topic" is required' } };
    }
    const result = await client.async.chat.completions.create({
      request: {
        model: 'sonar-deep-research',
        messages: [{ role: 'user', content: b.topic }],
      },
    });
    return { status: 200, body: result };
  }

  const researchMatch = pathname.match(/^\/research\/([^/]+)$/);
  if (method === 'GET' && researchMatch) {
    const id = researchMatch[1];
    const result = await client.async.chat.completions.get(id);
    return { status: 200, body: result };
  }

  if (method === 'GET' && pathname === '/history') {
    if (query.get('threads') === 'true') {
      return { status: 200, body: listThreads() };
    }
    const limit = parseInt(query.get('limit') ?? '20', 10);
    return { status: 200, body: getHistory().slice(0, Math.max(0, limit)) };
  }

  const threadMatch = pathname.match(/^\/threads\/([^/]+)$/);
  if (method === 'GET' && threadMatch) {
    const thread = getThread(threadMatch[1]);
    if (!thread) return { status: 404, body: { error: 'Thread not found' } };
    return { status: 200, body: thread };
  }

  return { status: 404, body: { error: 'Not found', method, path: pathname } };
}

export function createClawServer(client: ClawClient): http.Server {
  return http.createServer(async (req, res) => {
    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: pplx claw accepts loopback connections only' }));
      return;
    }

    try {
      const host = (req.headers.host ?? 'localhost').split(',')[0];
      const url = new URL(req.url ?? '/', `http://${host}`);
      let body: unknown = null;

      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        const raw = await readBody(req);
        if (raw.length > 0) {
          try {
            body = JSON.parse(raw);
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            return;
          }
        }
      }

      const result = await routeRequest(req.method ?? 'GET', url.pathname, url.searchParams, body, client);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      const status = (error as { status?: number }).status ?? 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
  });
}

export function registerClawCommand(program: Command): void {
  const cmd = program
    .command('claw')
    .description('Run a localhost HTTP gateway exposing the Perplexity API to local clients')
    .option('-p, --port <number>', `Port to listen on (default: ${DEFAULT_CLAW_PORT})`, String(DEFAULT_CLAW_PORT))
    .option('--host <host>', `Bind host; only loopback is accepted (default: ${DEFAULT_CLAW_HOST})`, DEFAULT_CLAW_HOST)
    .option('--print-api', 'Print the JSON API document and exit (the same payload as GET /api)')
    .action((options: { port?: string; host?: string; printApi?: boolean }) => {
      if (options.printApi) {
        console.log(JSON.stringify(CLAW_API_DOC, null, 2));
        return;
      }

      const port = parseInt(options.port ?? String(DEFAULT_CLAW_PORT), 10);
      const host = options.host ?? DEFAULT_CLAW_HOST;

      const apiKey = resolveApiKey();
      if (!apiKey) exitNoApiKey();

      const client = getClient(apiKey);
      const server = createClawServer(client);
      server.listen(port, host, () => {
        const addr = server.address() as AddressInfo;
        const base = `http://${host}:${addr.port}`;
        console.log(`pplx claw listening on ${base}`);
        console.log(`API doc:    GET ${base}/api`);
        console.log(`Health:     GET ${base}/health`);
        console.log('');
        console.log('Loopback only — connections from non-127.0.0.1 are refused.');
        console.log('The CLI process holds the encrypted API key; clients never see it.');
      });
    });

  cmd.addHelpText(
    'after',
    `\nExample workflow for an AI agent:\n` +
      `  1. pplx config set-key <YOUR_KEY>          # one-time, stored encrypted at rest\n` +
      `  2. pplx claw                               # start gateway on http://${DEFAULT_CLAW_HOST}:${DEFAULT_CLAW_PORT}\n` +
      `  3. curl http://${DEFAULT_CLAW_HOST}:${DEFAULT_CLAW_PORT}/api  # discover endpoints\n` +
      `  4. POST /query, /search, /research        # call features without the API key\n\n` +
      `Endpoints (also available as JSON via GET /api or 'pplx claw --print-api'):\n` +
      `  GET    /health                 Liveness probe\n` +
      `  GET    /api                    This document (also /openapi, /)\n` +
      `  GET    /models                 List models\n` +
      `  POST   /query                  body: { question, model?, ...filters }\n` +
      `  POST   /search                 body: { query, maxResults?, mode?, ... }\n` +
      `  POST   /research               body: { topic } -> request id\n` +
      `  GET    /research/:id           Status / result of an async research request\n` +
      `  GET    /history                Recent queries (?limit=N)\n` +
      `  GET    /history?threads=true   List conversation threads\n` +
      `  GET    /threads/:id            Single thread by id\n`,
  );
}
