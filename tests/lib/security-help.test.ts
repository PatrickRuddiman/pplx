import { describe, it, expect } from 'vitest';
import {
  SECURITY_HELP_FULL,
  SECURITY_HELP_SHORT,
  SECURITY_HELP_CONFIG_EXCERPT,
  SECURITY_HELP_CLAW_EXCERPT,
  SECURITY_HELP_SECTIONS,
  buildSecurityHelpJson,
} from '../../src/lib/security-help.js';

describe('security-help canonical doc', () => {
  describe('SECURITY_HELP_FULL', () => {
    it('contains every section title from SECURITY_HELP_SECTIONS', () => {
      for (const s of SECURITY_HELP_SECTIONS) {
        expect(SECURITY_HELP_FULL).toContain(s.title);
      }
    });

    it('names every supported keychain backend', () => {
      expect(SECURITY_HELP_FULL).toContain('macOS Keychain');
      expect(SECURITY_HELP_FULL).toContain('libsecret');
    });

    it('explicitly states the file fallback is encrypted with a machine-bound key', () => {
      expect(SECURITY_HELP_FULL).toMatch(/AES-256-GCM/);
      expect(SECURITY_HELP_FULL.toLowerCase()).toContain('machine');
    });

    it('explicitly names the root-on-host caveat — this is the load-bearing honesty', () => {
      expect(SECURITY_HELP_FULL).toMatch(/root/);
      expect(SECURITY_HELP_FULL).toMatch(/no on-host scheme defends against root/i);
    });

    it('flags compromised dependencies as in-scope for the threat model', () => {
      expect(SECURITY_HELP_FULL.toLowerCase()).toMatch(/compromised npm dependency|compromised dependency/);
    });

    it('recommends running claw on a separate machine for hostile-host deployments', () => {
      expect(SECURITY_HELP_FULL.toLowerCase()).toContain('separate machine');
      expect(SECURITY_HELP_FULL).toContain('pplx claw');
    });

    it('points users at config list to inspect live state', () => {
      expect(SECURITY_HELP_FULL).toContain('pplx config list');
    });
  });

  describe('SECURITY_HELP_SHORT', () => {
    it('points at the canonical command', () => {
      expect(SECURITY_HELP_SHORT).toContain('pplx security');
    });

    it('is short enough to embed in --help (≤ 12 lines)', () => {
      expect(SECURITY_HELP_SHORT.split('\n').length).toBeLessThanOrEqual(12);
    });
  });

  describe('SECURITY_HELP_CONFIG_EXCERPT', () => {
    it('points at the canonical command', () => {
      expect(SECURITY_HELP_CONFIG_EXCERPT).toContain('pplx security');
    });

    it('mentions both keychain and encrypted-file paths', () => {
      expect(SECURITY_HELP_CONFIG_EXCERPT.toLowerCase()).toContain('keychain');
      expect(SECURITY_HELP_CONFIG_EXCERPT.toLowerCase()).toContain('encrypt');
    });
  });

  describe('SECURITY_HELP_CLAW_EXCERPT', () => {
    it('points at the canonical command', () => {
      expect(SECURITY_HELP_CLAW_EXCERPT).toContain('pplx security');
    });

    it('repeats the root-agent caveat', () => {
      expect(SECURITY_HELP_CLAW_EXCERPT).toMatch(/root/);
    });

    it('recommends off-host claw for hostile environments', () => {
      expect(SECURITY_HELP_CLAW_EXCERPT.toLowerCase()).toContain('separate machine');
    });
  });

  describe('buildSecurityHelpJson', () => {
    it('returns a structured object with every section', () => {
      const json = buildSecurityHelpJson();
      expect(json.title).toBeTruthy();
      expect(json.sections).toEqual(SECURITY_HELP_SECTIONS);
      expect(json.sections.length).toBeGreaterThanOrEqual(4);
      for (const s of json.sections) {
        expect(s.title).toBeTruthy();
        expect(s.body).toBeTruthy();
      }
    });

    it('round-trips through JSON.stringify cleanly', () => {
      const a = buildSecurityHelpJson();
      const b = JSON.parse(JSON.stringify(a));
      expect(b).toEqual(a);
    });
  });
});
