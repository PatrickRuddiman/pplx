import { describe, it, expect, beforeEach } from 'vitest';
import { getClient, _resetClient } from '../../src/lib/client.js';

describe('client', () => {
  beforeEach(() => {
    _resetClient();
  });

  it('creates a Perplexity client', () => {
    const client = getClient('test-key');
    expect(client).toBeDefined();
    expect(client.chat).toBeDefined();
    expect(client.chat.completions).toBeDefined();
  });

  it('returns same client for same key', () => {
    const client1 = getClient('test-key');
    const client2 = getClient('test-key');
    expect(client1).toBe(client2);
  });

  it('creates new client for different key', () => {
    const client1 = getClient('key-1');
    const client2 = getClient('key-2');
    expect(client1).not.toBe(client2);
  });
});
