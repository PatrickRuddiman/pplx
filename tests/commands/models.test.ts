import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerModelsCommand } from '../../src/commands/models.js';
import { MODELS } from '../../src/lib/types.js';

describe('models command', () => {
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

  function makeProgram() {
    const program = new Command();
    program.exitOverride();
    registerModelsCommand(program);
    return program;
  }

  it('prints all known models in default mode', async () => {
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'models']);
    const out = output();
    for (const model of Object.values(MODELS)) {
      expect(out).toContain(model.name);
      expect(out).toContain(model.description);
    }
  });

  it('groups models by type with headers', async () => {
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'models']);
    const out = output();
    expect(out).toContain('Search Models');
    expect(out).toContain('Reasoning Models');
    expect(out).toContain('Research Models');
  });

  it('prints raw JSON when --json passed', async () => {
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'models', '--json']);
    const out = output();
    const parsed = JSON.parse(out);
    expect(parsed).toEqual(MODELS);
  });
});
