// Canonical security / key-storage documentation surfaced through `--help`
// and the `pplx security` command. Single source of truth — every other
// help surface either embeds an excerpt below or points at `pplx security`.
//
// Backend names below must stay in sync with BACKEND_LABEL in
// src/commands/config.ts.

export interface SecurityHelpSection {
  title: string;
  body: string;
}

export const SECURITY_HELP_SECTIONS: SecurityHelpSection[] = [
  {
    title: 'How your API key is stored',
    body:
      'Resolution order when pplx looks up your key:\n' +
      '  1. --api-key flag (per-command override; never written to disk)\n' +
      '  2. PERPLEXITY_API_KEY environment variable\n' +
      '  3. OS keychain, when available:\n' +
      '       - macOS Keychain (per-app ACLs enforced by the OS)\n' +
      '       - Linux Secret Service (libsecret/secret-tool, gated by your D-Bus session)\n' +
      '  4. AES-256-GCM encrypted file at config.json (the fallback when no\n' +
      '     keychain is reachable). The file is chmod 0600 on POSIX. The\n' +
      '     encryption key is derived from the host machine-id + your user\n' +
      '     identity, so the file does not decrypt on a different machine.\n\n' +
      '`pplx config list` shows the active backend at any time.',
  },
  {
    title: 'What this defends against',
    body:
      '  - Accidental commits / cloud-sync of a plaintext key (file is encrypted at rest).\n' +
      '  - Casual file reads — `cat ~/.config/pplx/config.json` returns ciphertext only.\n' +
      '  - Copying the file to another machine (machine-bound encryption key).\n' +
      '  - On macOS, app-level Keychain ACLs prevent unrelated processes from\n' +
      '    silently reading the entry without a prompt.\n' +
      '  - On Linux, libsecret gates access by the D-Bus session, so a\n' +
      '    process outside your session cannot read it.',
  },
  {
    title: 'What this does NOT defend against',
    body:
      '  - A same-uid attacker on Linux/Windows can recompute the file\n' +
      '    encryption key by reading this CLI bundle: pplx ships as JS, the\n' +
      '    derivation logic is reversible. Encrypted-file storage is\n' +
      '    obfuscation, not strong security, on those platforms.\n' +
      '  - An AI agent (or any other process) running as root on this host\n' +
      '    can extract the key — by reading files, ptracing the CLI process,\n' +
      '    dumping memory, talking to the OS keychain on your behalf, or\n' +
      '    sniffing egress traffic. No on-host scheme defends against root.\n' +
      '  - A compromised npm dependency loaded by this CLI inherits the\n' +
      '    CLI process privileges and can exfiltrate the key.',
  },
  {
    title: 'Recommended deployments',
    body:
      '  - Personal laptop: keychain (or encrypted file) + `pplx claw` for\n' +
      '    AI-agent workflows is adequate. Agents talk to claw on loopback;\n' +
      '    the key is decrypted in the CLI process and never copied to the\n' +
      '    agent.\n' +
      '  - Shared / server / headless box where the threat model includes a\n' +
      '    rooted agent or untrusted code on the same host: do NOT rely on\n' +
      '    on-host storage. Run `pplx claw` on a SEPARATE machine and let\n' +
      '    the agent reach it only over the network (SSH local-forward,\n' +
      '    WireGuard, Tailscale, etc.). The key never lives on the agent\'s\n' +
      '    host. See `pplx claw --help` for the gateway docs.',
  },
];

function renderSections(sections: SecurityHelpSection[]): string {
  return sections
    .map((s) => `${s.title}\n${'─'.repeat(s.title.length)}\n${s.body}`)
    .join('\n\n');
}

export const SECURITY_HELP_FULL: string =
  'pplx — API key security model\n' +
  '=============================\n\n' +
  renderSections(SECURITY_HELP_SECTIONS) +
  '\n';

export const SECURITY_HELP_SHORT: string =
  '\nSecurity:\n' +
  '  API keys are stored in your OS keychain when available, otherwise in an\n' +
  '  AES-encrypted file (chmod 0600). For the full threat model — including\n' +
  '  what this does NOT defend against (root agents, compromised deps) — run:\n' +
  '    pplx security\n';

export const SECURITY_HELP_CONFIG_EXCERPT: string =
  '\nKey storage:\n' +
  '  set-key writes to your OS keychain when one is reachable (macOS Keychain,\n' +
  '  Linux libsecret); otherwise it AES-encrypts the key in config.json with a\n' +
  '  machine-bound key (chmod 0600). After every set-key, pplx prints the\n' +
  '  active backend. `pplx config list` shows it any time.\n' +
  '\n' +
  '  This defends against casual file reads, accidental commits, and copying\n' +
  '  the file to another machine. It does NOT defend against an attacker with\n' +
  '  root on this host or a compromised dependency in the CLI. For the full\n' +
  '  threat model and recommended deployments, run: pplx security\n';

export const SECURITY_HELP_CLAW_EXCERPT: string =
  '\nSecurity model:\n' +
  '  claw exists to give AI agents access to the Perplexity API without ever\n' +
  '  handing them the key. The CLI process holds the decrypted key in memory;\n' +
  '  agents talk to loopback HTTP. This is process isolation — the right\n' +
  '  defense when the agent runs as the same user as you.\n' +
  '\n' +
  '  Important caveat: if the agent runs as root on this host (or any other\n' +
  '  process with root), it can read the key from this process\'s memory or\n' +
  '  the OS keychain regardless of how claw is configured. For that threat\n' +
  '  model, run claw on a SEPARATE machine and reach it only over the\n' +
  '  network. Run `pplx security` for the full model.\n';

export interface SecurityHelpJson {
  title: string;
  sections: SecurityHelpSection[];
}

export function buildSecurityHelpJson(): SecurityHelpJson {
  return {
    title: 'pplx — API key security model',
    sections: SECURITY_HELP_SECTIONS,
  };
}
