import Perplexity from '@perplexity-ai/perplexity_ai';

let _client: Perplexity | null = null;
let _clientKey: string | null = null;

export function getClient(apiKey: string): Perplexity {
  if (_client && _clientKey === apiKey) {
    return _client;
  }

  _client = new Perplexity({
    apiKey,
    maxRetries: 2,
    timeout: 120_000,
  });
  _clientKey = apiKey;

  return _client;
}

// Reset singleton (for testing)
export function _resetClient(): void {
  _client = null;
  _clientKey = null;
}
