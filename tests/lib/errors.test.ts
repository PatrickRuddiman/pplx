import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Perplexity from '@perplexity-ai/perplexity_ai';
import { handleError, exitNoApiKey } from '../../src/lib/errors.js';

describe('errors', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`__exit_${code ?? 0}__`);
    }) as never);
  });

  afterEach(() => {
    errSpy.mockRestore();
    exitSpy.mockRestore();
  });

  function output(): string {
    return errSpy.mock.calls.map((c) => c.join(' ')).join('\n');
  }

  describe('exitNoApiKey', () => {
    it('prints help and exits 1', () => {
      expect(() => exitNoApiKey()).toThrow('__exit_1__');
      expect(output()).toContain('No API key configured');
    });
  });

  describe('handleError', () => {
    it('handles AuthenticationError', () => {
      const err = new Perplexity.AuthenticationError(401, { error: { message: 'unauthorized' } } as never, undefined, new Headers());
      expect(() => handleError(err)).toThrow('__exit_1__');
      expect(output()).toContain('Invalid or missing API key');
    });

    it('handles RateLimitError', () => {
      const err = new Perplexity.RateLimitError(429, undefined, undefined, new Headers());
      expect(() => handleError(err)).toThrow('__exit_1__');
      expect(output()).toContain('Rate limit');
    });

    it('handles BadRequestError with model in message', () => {
      const err = new Perplexity.BadRequestError(400, { message: 'invalid model name' } as never, 'invalid model name', new Headers());
      expect(() => handleError(err)).toThrow('__exit_1__');
      expect(output()).toContain('model may not be available');
    });

    it('handles BadRequestError without model in message', () => {
      const err = new Perplexity.BadRequestError(400, { message: 'something else' } as never, 'something else', new Headers());
      expect(() => handleError(err)).toThrow('__exit_1__');
      expect(output()).toContain('Bad request');
    });

    it('handles APIConnectionTimeoutError', () => {
      const err = new Perplexity.APIConnectionTimeoutError({ message: 'timed out' });
      expect(() => handleError(err)).toThrow('__exit_1__');
      expect(output()).toContain('timed out');
    });

    it('handles APIConnectionError', () => {
      const err = new Perplexity.APIConnectionError({ message: 'no net' });
      expect(() => handleError(err)).toThrow('__exit_1__');
      expect(output()).toContain('Unable to connect');
    });

    it('handles InternalServerError', () => {
      const err = new Perplexity.InternalServerError(500, undefined, undefined, new Headers());
      expect(() => handleError(err)).toThrow('__exit_1__');
      expect(output()).toContain('server error');
    });

    it('handles generic APIError', () => {
      const err = new Perplexity.APIError(418, undefined, "I'm a teapot", new Headers());
      expect(() => handleError(err)).toThrow('__exit_1__');
      expect(output()).toContain('418');
    });

    it('handles plain Error', () => {
      const err = new Error('boom');
      expect(() => handleError(err)).toThrow('__exit_1__');
      expect(output()).toContain('boom');
    });

    it('handles non-Error values', () => {
      expect(() => handleError('weird')).toThrow('__exit_1__');
      expect(output()).toContain('unexpected error');
    });

    it('stops a spinner if one is provided and spinning', () => {
      const stop = vi.fn();
      const spinner = { isSpinning: true, stop } as unknown as Parameters<typeof handleError>[1];
      expect(() => handleError(new Error('x'), spinner)).toThrow('__exit_1__');
      expect(stop).toHaveBeenCalled();
    });

    it('does not stop spinner if not spinning', () => {
      const stop = vi.fn();
      const spinner = { isSpinning: false, stop } as unknown as Parameters<typeof handleError>[1];
      expect(() => handleError(new Error('x'), spinner)).toThrow('__exit_1__');
      expect(stop).not.toHaveBeenCalled();
    });

    it('prints debug info when verbose', () => {
      const err = new Error('debug me');
      expect(() => handleError(err, undefined, true)).toThrow('__exit_1__');
      expect(output()).toContain('Debug info');
    });
  });
});
