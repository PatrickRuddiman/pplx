import { Command } from 'commander';
import chalk from 'chalk';
import { MODELS } from '../lib/types.js';

export function registerModelsCommand(program: Command): void {
  program
    .command('models')
    .description('List available Perplexity API models')
    .option('--json', 'Output as JSON')
    .action((options: { json?: boolean }) => {
      if (options.json) {
        console.log(JSON.stringify(MODELS, null, 2));
        return;
      }

      console.log(chalk.cyan('Available Perplexity Models:\n'));

      let currentType = '';
      for (const model of Object.values(MODELS)) {
        if (model.type !== currentType) {
          if (currentType) console.log();
          console.log(chalk.cyan(`  ${model.type} Models:`));
          currentType = model.type;
        }

        console.log(
          `    ${chalk.yellow(model.name.padEnd(24))} ${chalk.gray(model.description)}`,
        );
        console.log(
          `    ${''.padEnd(24)} ${chalk.gray(model.pricing)}`,
        );
      }

      console.log();
      console.log(chalk.gray('  Use with: pplx query "question" --model <model-name>'));
    });
}
