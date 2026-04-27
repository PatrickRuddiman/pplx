import { APP_VERSION } from '../lib/types.js';
import { DEFAULT_CLAW_HOST, DEFAULT_CLAW_PORT } from './claw-constants.js';

export function buildOpenApiSpec(): Record<string, unknown> {
  return {
    openapi: '3.0.3',
    info: {
      title: 'pplx claw',
      version: APP_VERSION,
      description:
        'Localhost HTTP gateway for the Perplexity AI CLI. Loopback only (127.0.0.1 / ::1). ' +
        'The CLI process holds the API key (OS keychain when available, AES-encrypted file otherwise); ' +
        'clients on this loopback never see it.',
      license: { name: 'MIT' },
    },
    servers: [
      {
        url: `http://${DEFAULT_CLAW_HOST}:${DEFAULT_CLAW_PORT}`,
        description: 'Default loopback endpoint',
      },
    ],
    paths: {
      '/health': {
        get: {
          summary: 'Liveness probe',
          operationId: 'getHealth',
          responses: {
            '200': {
              description: 'Service is up',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } },
              },
            },
          },
        },
      },
      '/api': {
        get: {
          summary: 'Self-describing API summary (human-readable)',
          operationId: 'getApiSummary',
          responses: {
            '200': {
              description: 'API summary',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
      '/api/spec': {
        get: {
          summary: 'This OpenAPI 3.0 specification',
          operationId: 'getApiSpec',
          responses: {
            '200': {
              description: 'OpenAPI specification document',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
      '/models': {
        get: {
          summary: 'List available Perplexity models',
          operationId: 'listModels',
          responses: {
            '200': {
              description: 'Model catalog keyed by model name',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    additionalProperties: { $ref: '#/components/schemas/Model' },
                  },
                },
              },
            },
          },
        },
      },
      '/query': {
        post: {
          summary: 'Send a chat completion query (non-streaming)',
          operationId: 'createQuery',
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/QueryRequest' } },
            },
          },
          responses: {
            '200': {
              description: 'Chat completion response',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ChatCompletion' } },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
      '/search': {
        post: {
          summary: 'Web search via the dedicated Perplexity Search API',
          operationId: 'createSearch',
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SearchRequest' } },
            },
          },
          responses: {
            '200': {
              description: 'Search results',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/SearchResponse' } },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '500': { $ref: '#/components/responses/ServerError' },
          },
        },
      },
      '/research': {
        post: {
          summary: 'Start an async deep-research request (sonar-deep-research)',
          operationId: 'startResearch',
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ResearchRequest' } },
            },
          },
          responses: {
            '200': {
              description: 'Research request submitted',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ResearchSubmission' },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
          },
        },
      },
      '/research/{id}': {
        get: {
          summary: 'Fetch the current status / response of a research request',
          operationId: 'getResearch',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Async request id returned by POST /research',
            },
          ],
          responses: {
            '200': {
              description: 'Async research state',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ResearchState' } },
              },
            },
          },
        },
      },
      '/history': {
        get: {
          summary: 'Recent query history (or thread list when ?threads=true)',
          operationId: 'getHistory',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20, minimum: 0 },
              description: 'Maximum number of history entries to return',
            },
            {
              name: 'threads',
              in: 'query',
              schema: { type: 'boolean' },
              description: 'When true, return conversation threads instead of single queries',
            },
          ],
          responses: {
            '200': {
              description: 'History entries or thread list',
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      {
                        type: 'array',
                        items: { $ref: '#/components/schemas/HistoryEntry' },
                      },
                      {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Thread' },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      '/threads/{id}': {
        get: {
          summary: 'Single conversation thread by id',
          operationId: 'getThread',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Thread',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Thread' } },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
    },
    components: {
      schemas: {
        HealthResponse: {
          type: 'object',
          required: ['ok', 'version'],
          properties: {
            ok: { type: 'boolean' },
            version: { type: 'string' },
          },
        },
        Model: {
          type: 'object',
          required: ['name', 'type', 'description', 'pricing'],
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: ['Search', 'Reasoning', 'Research'] },
            description: { type: 'string' },
            pricing: { type: 'string' },
          },
        },
        ErrorResponse: {
          type: 'object',
          required: ['error'],
          properties: { error: { type: 'string' } },
        },
        QueryRequest: {
          type: 'object',
          required: ['question'],
          properties: {
            question: { type: 'string', description: 'User prompt' },
            model: {
              type: 'string',
              default: 'sonar',
              description: 'Perplexity model id (see GET /models)',
            },
            system: {
              type: 'string',
              description: 'Override the default system prompt',
            },
            searchMode: { type: 'string', enum: ['web', 'academic', 'sec'] },
            recency: {
              type: 'string',
              enum: ['hour', 'day', 'week', 'month', 'year'],
            },
            after: { type: 'string', format: 'date' },
            before: { type: 'string', format: 'date' },
            domain: {
              type: 'array',
              items: { type: 'string' },
              description: 'Whitelist these domains in web search results',
            },
            excludeDomain: {
              type: 'array',
              items: { type: 'string' },
              description: 'Exclude these domains; merged with domain[] using - prefix',
            },
            images: { type: 'boolean' },
            related: { type: 'boolean' },
            reasoning: {
              type: 'string',
              enum: ['minimal', 'low', 'medium', 'high'],
            },
            contextSize: { type: 'string', enum: ['low', 'medium', 'high'] },
            language: { type: 'string', description: 'BCP-47 language code' },
            safeSearch: { type: 'boolean' },
            search: {
              type: 'boolean',
              default: true,
              description: 'When false, sets disable_search and skips web grounding',
            },
          },
        },
        ChatCompletion: {
          type: 'object',
          additionalProperties: true,
          description:
            'Pass-through of the upstream Perplexity chat completion (StreamChunk shape: id, choices, citations, search_results, usage, ...).',
          properties: {
            id: { type: 'string' },
            model: { type: 'string' },
            choices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'integer' },
                  message: {
                    type: 'object',
                    properties: {
                      role: { type: 'string' },
                      content: { type: 'string' },
                    },
                  },
                },
                additionalProperties: true,
              },
            },
            citations: {
              type: 'array',
              items: { type: 'string' },
              nullable: true,
            },
            search_results: {
              type: 'array',
              items: { $ref: '#/components/schemas/UpstreamSearchResult' },
              nullable: true,
            },
            usage: { type: 'object', additionalProperties: true, nullable: true },
          },
        },
        UpstreamSearchResult: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            snippet: { type: 'string' },
            date: { type: 'string', nullable: true },
            last_updated: { type: 'string', nullable: true },
          },
          additionalProperties: true,
        },
        SearchRequest: {
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string' },
            maxResults: { type: 'integer', default: 10, minimum: 1 },
            mode: { type: 'string', enum: ['web', 'academic', 'sec'] },
            recency: {
              type: 'string',
              enum: ['hour', 'day', 'week', 'month', 'year'],
            },
            domain: { type: 'array', items: { type: 'string' } },
          },
        },
        SearchResponse: {
          type: 'object',
          required: ['id', 'results'],
          properties: {
            id: { type: 'string' },
            results: {
              type: 'array',
              items: { $ref: '#/components/schemas/SearchHit' },
            },
            server_time: { type: 'string', nullable: true },
          },
        },
        SearchHit: {
          type: 'object',
          required: ['title', 'url', 'snippet'],
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            snippet: { type: 'string' },
            date: { type: 'string', nullable: true },
            last_updated: { type: 'string', nullable: true },
          },
        },
        ResearchRequest: {
          type: 'object',
          required: ['topic'],
          properties: {
            topic: { type: 'string', description: 'The research question or brief' },
          },
        },
        ResearchSubmission: {
          type: 'object',
          required: ['id', 'status'],
          properties: {
            id: { type: 'string' },
            status: {
              type: 'string',
              enum: ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
            },
            created_at: { type: 'integer', description: 'Unix epoch seconds' },
            model: { type: 'string' },
          },
        },
        ResearchState: {
          type: 'object',
          required: ['id', 'status'],
          additionalProperties: true,
          properties: {
            id: { type: 'string' },
            status: {
              type: 'string',
              enum: ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
            },
            created_at: { type: 'integer' },
            started_at: { type: 'integer', nullable: true },
            completed_at: { type: 'integer', nullable: true },
            failed_at: { type: 'integer', nullable: true },
            error_message: { type: 'string', nullable: true },
            response: {
              nullable: true,
              $ref: '#/components/schemas/ChatCompletion',
            },
          },
        },
        HistoryEntry: {
          type: 'object',
          required: ['id', 'question', 'model', 'timestamp'],
          properties: {
            id: { type: 'string' },
            question: { type: 'string' },
            model: { type: 'string' },
            timestamp: { type: 'integer', description: 'Unix epoch milliseconds' },
            responsePreview: { type: 'string', nullable: true },
            citations: { type: 'integer', nullable: true },
            threadId: { type: 'string', nullable: true },
          },
        },
        Thread: {
          type: 'object',
          required: ['id', 'created', 'updated', 'model', 'messages'],
          properties: {
            id: { type: 'string' },
            created: { type: 'integer' },
            updated: { type: 'integer' },
            model: { type: 'string' },
            messages: {
              type: 'array',
              items: { $ref: '#/components/schemas/ThreadMessage' },
            },
          },
        },
        ThreadMessage: {
          type: 'object',
          required: ['role', 'content'],
          properties: {
            role: {
              type: 'string',
              enum: ['system', 'user', 'assistant', 'tool'],
            },
            content: { type: 'string' },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Invalid or missing request body',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        ServerError: {
          description: 'Upstream or internal error',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
      },
    },
  };
}

export const OPENAPI_PATHS = [
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
] as const;
