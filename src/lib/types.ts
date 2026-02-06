export interface PerplexityConfig {
  apiKey?: string;
  defaults?: ConfigDefaults;
}

export interface ConfigDefaults {
  model?: string;
  stream?: boolean;
  searchMode?: 'web' | 'academic' | 'sec';
  contextSize?: 'low' | 'medium' | 'high';
  language?: string;
  safeSearch?: boolean;
}

export interface HistoryEntry {
  id: string;
  threadId?: string;
  question: string;
  model: string;
  timestamp: number;
  responsePreview?: string;
  citations?: number;
  tokensUsed?: number;
}

export interface ThreadFile {
  id: string;
  created: number;
  updated: number;
  model: string;
  messages: Array<{ role: string; content: string }>;
}

export interface QueryOptions {
  model: string;
  stream: boolean;
  output?: string;
  searchMode?: 'web' | 'academic' | 'sec';
  recency?: 'hour' | 'day' | 'week' | 'month' | 'year';
  after?: string;
  before?: string;
  domain?: string[];
  excludeDomain?: string[];
  images?: boolean;
  related?: boolean;
  reasoning?: 'minimal' | 'low' | 'medium' | 'high';
  contextSize?: 'low' | 'medium' | 'high';
  language?: string;
  system?: string;
  json?: boolean;
  citations?: boolean;
  search?: boolean;
  safeSearch?: boolean;
  raw?: boolean;
  continue?: boolean;
  thread?: string;
  verbose?: boolean;
}

export interface SearchOptions {
  maxResults?: number;
  mode?: 'web' | 'academic' | 'sec';
  recency?: 'hour' | 'day' | 'week' | 'month' | 'year';
  domain?: string[];
  json?: boolean;
  verbose?: boolean;
}

export interface ResearchOptions {
  pollInterval: number;
  timeout: number;
  wait: boolean;
  output?: string;
  json?: boolean;
  verbose?: boolean;
}

export const MODELS = {
  sonar: {
    name: 'sonar',
    type: 'Search',
    description: 'Lightweight search with real-time web grounding',
    pricing: '$1 / $1 per 1M tokens',
  },
  'sonar-pro': {
    name: 'sonar-pro',
    type: 'Search',
    description: 'Advanced search for complex queries, 2x citations',
    pricing: '$3 / $15 per 1M tokens',
  },
  'sonar-reasoning-pro': {
    name: 'sonar-reasoning-pro',
    type: 'Reasoning',
    description: 'Chain of Thought reasoning (DeepSeek-R1)',
    pricing: 'Premium tier',
  },
  'sonar-deep-research': {
    name: 'sonar-deep-research',
    type: 'Research',
    description: 'Expert-level research with exhaustive web analysis',
    pricing: 'Premium tier',
  },
} as const;

export type ModelName = keyof typeof MODELS;

export const MODEL_NAMES = Object.keys(MODELS) as ModelName[];

export const DEFAULT_MODEL = 'sonar' as const;
export const DEFAULT_SYSTEM_PROMPT = 'Be precise and concise.';
export const APP_NAME = 'pplx';
export const APP_VERSION = '1.0.0';
