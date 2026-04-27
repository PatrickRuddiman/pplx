import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig, saveConfig, getConfigDir, getKeyStorageInfo } from '../lib/config.js';
import { printSuccess } from '../lib/output.js';
import { SECURITY_HELP_CONFIG_EXCERPT } from '../lib/security-help.js';

const VALID_DEFAULTS = ['model', 'stream', 'searchMode', 'contextSize', 'language', 'safeSearch'] as const;

const BACKEND_LABEL: Record<ReturnType<typeof getKeyStorageInfo>['backend'], string> = {
  macos: 'macOS Keychain',
  libsecret: 'Linux Secret Service (libsecret)',
  wincred: 'Windows Credential Manager',
  none: 'no OS keychain available',
};

export function reportKeyStorage(): void {
  const info = getKeyStorageInfo();
  if (info.source === 'keychain') {
    console.log(chalk.green(`Stored in ${BACKEND_LABEL[info.backend]}.`));
    return;
  }
  if (info.source === 'file') {
    console.log(chalk.yellow('Stored in encrypted file at rest (config.json).'));
    if (info.backend !== 'none') {
      console.log(
        chalk.gray(
          `  ${BACKEND_LABEL[info.backend]} was detected on this system but the write/read failed — falling back to file.`,
        ),
      );
      console.log(
        chalk.gray(
          process.platform === 'linux'
            ? '  On Linux, libsecret needs a running keyring (e.g. gnome-keyring) and an unlocked D-Bus session.'
            : '  Check that your OS keychain service is reachable.',
        ),
      );
    } else {
      console.log(chalk.gray('  No OS keychain backend is available on this system.'));
    }
    console.log(
      chalk.gray(
        '  AES-256-GCM with a machine-derived key. This stops casual file reads but is not strong ' +
          'against an attacker that reads the CLI bundle. For agent workflows, prefer `pplx claw` ' +
          'so the key never leaves this process.',
      ),
    );
  }
}

export function registerConfigCommand(program: Command): void {
  const config = program
    .command('config')
    .description('Manage configuration');

  config.addHelpText('after', SECURITY_HELP_CONFIG_EXCERPT);

  const setKey = config
    .command('set-key <key>')
    .description('Set the Perplexity API key')
    .action((key: string) => {
      const cfg = getConfig();
      cfg.apiKey = key;
      saveConfig(cfg);
      printSuccess('API key set successfully.');
      reportKeyStorage();
    });
  setKey.addHelpText('after', SECURITY_HELP_CONFIG_EXCERPT);

  config
    .command('view-key')
    .description('View the currently set API key (masked)')
    .action(() => {
      const cfg = getConfig();
      if (!cfg.apiKey) {
        console.error(chalk.red('No API key set. Run: pplx config set-key <key>'));
        return;
      }
      const key = cfg.apiKey;
      const masked =
        key.length > 8
          ? `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`
          : '****';
      console.log(chalk.blue('API key:'), chalk.yellow(masked));
    });

  config
    .command('clear-key')
    .description('Remove the stored API key')
    .action(() => {
      const cfg = getConfig();
      delete cfg.apiKey;
      saveConfig(cfg);
      printSuccess('API key cleared.');
    });

  config
    .command('set <key> <value>')
    .description('Set a default config value (model, stream, searchMode, contextSize, language, safeSearch)')
    .action((key: string, value: string) => {
      if (!VALID_DEFAULTS.includes(key as (typeof VALID_DEFAULTS)[number])) {
        console.error(chalk.red(`Unknown config key: ${key}`));
        console.error(chalk.gray(`Valid keys: ${VALID_DEFAULTS.join(', ')}`));
        return;
      }
      const cfg = getConfig();
      if (!cfg.defaults) cfg.defaults = {};

      if (key === 'stream' || key === 'safeSearch') {
        (cfg.defaults as Record<string, unknown>)[key] = value === 'true';
      } else {
        (cfg.defaults as Record<string, unknown>)[key] = value;
      }

      saveConfig(cfg);
      printSuccess(`Set ${key} = ${value}`);
    });

  config
    .command('get <key>')
    .description('Get a config value')
    .action((key: string) => {
      const cfg = getConfig();
      if (key === 'apiKey') {
        console.log(cfg.apiKey ? '(set)' : '(not set)');
      } else {
        const val = cfg.defaults?.[key as keyof typeof cfg.defaults];
        console.log(val !== undefined ? String(val) : chalk.gray('(not set)'));
      }
    });

  config
    .command('list')
    .description('Show all configuration')
    .action(() => {
      const cfg = getConfig();
      const info = getKeyStorageInfo();
      console.log(chalk.cyan('Configuration:'));
      console.log(`  ${chalk.white('API key:')} ${cfg.apiKey ? chalk.green('set') : chalk.red('not set')}`);
      console.log(`  ${chalk.white('Source:')} ${chalk.yellow(info.source)} ${chalk.gray(`(${info.description})`)}`);
      console.log(`  ${chalk.white('Config path:')} ${chalk.gray(getConfigDir())}`);
      if (cfg.defaults && Object.keys(cfg.defaults).length > 0) {
        console.log();
        console.log(chalk.cyan('Defaults:'));
        for (const [k, v] of Object.entries(cfg.defaults)) {
          console.log(`  ${chalk.white(k + ':')} ${chalk.yellow(String(v))}`);
        }
      }
    });

  config
    .command('path')
    .description('Show config directory path')
    .action(() => {
      console.log(getConfigDir());
    });

  // Top-level aliases for backward compatibility
  program
    .command('set-key <key>')
    .description('Set the Perplexity API key (alias for config set-key)')
    .action((key: string) => {
      const cfg = getConfig();
      cfg.apiKey = key;
      saveConfig(cfg);
      printSuccess('API key set successfully.');
      reportKeyStorage();
    });

  program
    .command('view-key')
    .description('View the API key (alias for config view-key)')
    .action(() => {
      const cfg = getConfig();
      if (!cfg.apiKey) {
        console.error(chalk.red('No API key set. Run: pplx config set-key <key>'));
        return;
      }
      const key = cfg.apiKey;
      const masked =
        key.length > 8
          ? `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`
          : '****';
      console.log(chalk.blue('API key:'), chalk.yellow(masked));
    });

  program
    .command('clear-key')
    .description('Remove the API key (alias for config clear-key)')
    .action(() => {
      const cfg = getConfig();
      delete cfg.apiKey;
      saveConfig(cfg);
      printSuccess('API key cleared.');
    });
}
