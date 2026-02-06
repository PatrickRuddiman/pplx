import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig, saveConfig, getConfigDir } from '../lib/config.js';
import { printSuccess } from '../lib/output.js';

const VALID_DEFAULTS = ['model', 'stream', 'searchMode', 'contextSize', 'language', 'safeSearch'] as const;

export function registerConfigCommand(program: Command): void {
  const config = program
    .command('config')
    .description('Manage configuration');

  config
    .command('set-key <key>')
    .description('Set the Perplexity API key')
    .action((key: string) => {
      const cfg = getConfig();
      cfg.apiKey = key;
      saveConfig(cfg);
      printSuccess('API key set successfully.');
    });

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
      console.log(chalk.cyan('Configuration:'));
      console.log(`  ${chalk.white('API key:')} ${cfg.apiKey ? chalk.green('set') : chalk.red('not set')}`);
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
