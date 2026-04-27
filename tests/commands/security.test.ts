import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerSecurityCommand } from '../../src/commands/security.js';
import { SECURITY_HELP_FULL, buildSecurityHelpJson } from '../../src/lib/security-help.js';

describe('security command', () => {
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
    registerSecurityCommand(program);
    return program;
  }

  it('prints the full canonical doc by default', async () => {
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'security']);
    expect(output()).toContain(SECURITY_HELP_FULL.trim());
  });

  it('prints structured JSON with --json', async () => {
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'security', '--json']);
    const parsed = JSON.parse(output());
    expect(parsed).toEqual(buildSecurityHelpJson());
  });

  it('--json output is consumable by an AI agent (sections array, titles, bodies)', async () => {
    const program = makeProgram();
    await program.parseAsync(['node', 'pplx', 'security', '--json']);
    const parsed = JSON.parse(output()) as { title: string; sections: { title: string; body: string }[] };
    expect(parsed.title).toMatch(/security/i);
    expect(Array.isArray(parsed.sections)).toBe(true);
    expect(parsed.sections.length).toBeGreaterThanOrEqual(4);
    const titles = parsed.sections.map((s) => s.title.toLowerCase());
    expect(titles.some((t) => t.includes('stored'))).toBe(true);
    expect(titles.some((t) => t.includes('not defend'))).toBe(true);
  });

  it('command help (helpInformation) advertises the --json flag', () => {
    const program = makeProgram();
    const sec = program.commands.find((c) => c.name() === 'security');
    expect(sec).toBeDefined();
    expect(sec!.helpInformation()).toContain('--json');
  });
});
