import { Command } from 'commander';
import { SECURITY_HELP_FULL, buildSecurityHelpJson } from '../lib/security-help.js';

export function registerSecurityCommand(program: Command): void {
  program
    .command('security')
    .description('Print the API key security / threat-model documentation')
    .option('--json', 'Emit the documentation as structured JSON for machine consumers')
    .action((options: { json?: boolean }) => {
      if (options.json) {
        console.log(JSON.stringify(buildSecurityHelpJson(), null, 2));
        return;
      }
      console.log(SECURITY_HELP_FULL);
    });
}
