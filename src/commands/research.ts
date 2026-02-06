import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import { getClient } from '../lib/client.js';
import { resolveApiKey } from '../lib/config.js';
import { handleError, exitNoApiKey } from '../lib/errors.js';
import { createSpinner, printSuccess } from '../lib/output.js';
import { formatCitations, type SearchResult } from '../lib/citations.js';
import type { ResearchOptions } from '../lib/types.js';

async function pollForCompletion(
  client: ReturnType<typeof getClient>,
  requestId: string,
  opts: ResearchOptions,
): Promise<void> {
  const spinner = createSpinner('Researching...').start();
  const startTime = Date.now();
  const timeoutMs = opts.timeout * 60 * 1000;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    spinner.text = `Researching... (${elapsed}s elapsed)`;

    const result = await client.async.chat.completions.get(requestId);

    if (result.status === 'COMPLETED') {
      spinner.stop();

      const response = result.response;
      if (!response) {
        console.log(chalk.yellow('Research completed but no response returned.'));
        return;
      }

      const content = response.choices?.[0]?.message?.content;
      const text = typeof content === 'string' ? content : '';

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.cyan('Research Report:\n'));
        console.log(chalk.white(text));

        formatCitations(
          response.citations as string[] | null,
          response.search_results as unknown as SearchResult[] | null,
        );
      }

      if (opts.output) {
        fs.writeFileSync(opts.output, text);
        printSuccess(`Report saved to ${opts.output}`);
      }

      return;
    }

    if (result.status === 'FAILED') {
      spinner.stop();
      console.error(chalk.red('Research failed.'));
      if (result.error_message) {
        console.error(chalk.gray(result.error_message));
      }
      process.exit(1);
    }

    if (Date.now() - startTime > timeoutMs) {
      spinner.stop();
      console.log(chalk.yellow(`Research timed out after ${opts.timeout} minutes.`));
      console.log(chalk.gray(`Check status later with: pplx research status ${requestId}`));
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, opts.pollInterval * 1000));
  }
}

export function registerResearchCommand(program: Command): void {
  const research = program
    .command('research')
    .description('Deep research using sonar-deep-research (async)');

  research
    .command('start <topic>')
    .description('Start a deep research task')
    .option('--poll-interval <seconds>', 'Polling interval in seconds', '10')
    .option('--timeout <minutes>', 'Max wait time in minutes', '30')
    .option('--no-wait', 'Submit and return request ID without waiting')
    .option('-o, --output <file>', 'Save result to file')
    .option('--json', 'Output as JSON')
    .action(async (topic: string, options: Record<string, unknown>) => {
      const opts: ResearchOptions = {
        pollInterval: parseInt(options.pollInterval as string, 10) || 10,
        timeout: parseInt(options.timeout as string, 10) || 30,
        wait: options.wait as boolean,
        output: options.output as string | undefined,
        json: options.json as boolean | undefined,
        verbose: program.opts().verbose as boolean | undefined,
      };

      const apiKey = resolveApiKey();
      if (!apiKey) exitNoApiKey();

      const client = getClient(apiKey);

      try {
        const spinner = createSpinner('Submitting research request...').start();

        const asyncResponse = await client.async.chat.completions.create({
          request: {
            model: 'sonar-deep-research',
            messages: [{ role: 'user', content: topic }],
          },
        });

        spinner.stop();

        const requestId = asyncResponse.id;
        console.log(chalk.cyan('Research ID:'), chalk.yellow(requestId));
        console.log(chalk.gray(`Status: ${asyncResponse.status}`));

        if (!opts.wait) {
          console.log();
          console.log(chalk.gray('Check status with:'), `pplx research status ${requestId}`);
          console.log(chalk.gray('Get result with:'), `pplx research get ${requestId}`);
          return;
        }

        console.log();
        await pollForCompletion(client, requestId, opts);
      } catch (error) {
        handleError(error, undefined, opts.verbose);
      }
    });

  research
    .command('status <requestId>')
    .description('Check status of a research request')
    .action(async (requestId: string) => {
      const apiKey = resolveApiKey();
      if (!apiKey) exitNoApiKey();

      const client = getClient(apiKey);

      try {
        const result = await client.async.chat.completions.get(requestId);

        console.log(chalk.cyan('Research Status:'));
        console.log(`  ${chalk.white('ID:')} ${result.id}`);
        console.log(`  ${chalk.white('Status:')} ${chalk.yellow(result.status)}`);

        if (result.created_at) {
          console.log(`  ${chalk.white('Created:')} ${new Date(result.created_at * 1000).toLocaleString()}`);
        }
        if (result.completed_at) {
          console.log(`  ${chalk.white('Completed:')} ${new Date(result.completed_at * 1000).toLocaleString()}`);
        }
      } catch (error) {
        handleError(error, undefined, program.opts().verbose);
      }
    });

  research
    .command('get <requestId>')
    .description('Get result of a completed research request')
    .option('-o, --output <file>', 'Save result to file')
    .option('--json', 'Output as JSON')
    .action(async (requestId: string, options: { output?: string; json?: boolean }) => {
      const apiKey = resolveApiKey();
      if (!apiKey) exitNoApiKey();

      const client = getClient(apiKey);

      try {
        const result = await client.async.chat.completions.get(requestId);

        if (result.status !== 'COMPLETED') {
          console.log(chalk.yellow(`Research is not yet complete. Status: ${result.status}`));
          return;
        }

        const response = result.response;
        if (!response) {
          console.log(chalk.yellow('No response data available.'));
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        const content = response.choices?.[0]?.message?.content;
        const text = typeof content === 'string' ? content : '';

        console.log(chalk.cyan('Research Report:\n'));
        console.log(chalk.white(text));

        formatCitations(
          response.citations as string[] | null,
          response.search_results as unknown as SearchResult[] | null,
        );

        if (options.output) {
          fs.writeFileSync(options.output, text);
          printSuccess(`Report saved to ${options.output}`);
        }
      } catch (error) {
        handleError(error, undefined, program.opts().verbose);
      }
    });

  // Make `pplx research "topic"` work as shorthand for `pplx research start "topic"`
  research
    .argument('[topic]', 'Research topic (shorthand for: research start "topic")')
    .option('--poll-interval <seconds>', 'Polling interval', '10')
    .option('--timeout <minutes>', 'Max wait time', '30')
    .option('--no-wait', 'Submit and return ID only')
    .option('-o, --output <file>', 'Save result to file')
    .option('--json', 'Output as JSON')
    .action(async (topic: string | undefined, options: Record<string, unknown>) => {
      if (!topic) return;
      // Delegate to start subcommand logic
      const opts: ResearchOptions = {
        pollInterval: parseInt(options.pollInterval as string, 10) || 10,
        timeout: parseInt(options.timeout as string, 10) || 30,
        wait: options.wait as boolean,
        output: options.output as string | undefined,
        json: options.json as boolean | undefined,
        verbose: program.opts().verbose as boolean | undefined,
      };

      const apiKey = resolveApiKey();
      if (!apiKey) exitNoApiKey();

      const client = getClient(apiKey);

      try {
        const spinner = createSpinner('Submitting research request...').start();

        const asyncResponse = await client.async.chat.completions.create({
          request: {
            model: 'sonar-deep-research',
            messages: [{ role: 'user', content: topic }],
          },
        });

        spinner.stop();

        const requestId = asyncResponse.id;
        console.log(chalk.cyan('Research ID:'), chalk.yellow(requestId));
        console.log(chalk.gray(`Status: ${asyncResponse.status}`));

        if (!opts.wait) {
          console.log();
          console.log(chalk.gray('Check status with:'), `pplx research status ${requestId}`);
          console.log(chalk.gray('Get result with:'), `pplx research get ${requestId}`);
          return;
        }

        console.log();
        await pollForCompletion(client, requestId, opts);
      } catch (error) {
        handleError(error, undefined, opts.verbose);
      }
    });
}
