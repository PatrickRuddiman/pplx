import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import type { CompletionGetResponse, CompletionCreateResponse } from '@perplexity-ai/perplexity_ai/resources/async/chat/completions';
import { getClient } from '../lib/client.js';
import { resolveApiKey } from '../lib/config.js';
import { handleError, exitNoApiKey } from '../lib/errors.js';
import { createSpinner, printSuccess } from '../lib/output.js';
import { formatCitations, type SearchResult } from '../lib/citations.js';
import type { ResearchOptions } from '../lib/types.js';

type AsyncResearchResult = CompletionGetResponse;

export function extractResearchText(result: AsyncResearchResult): string {
  const content = result.response?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}

export function renderResearchStatus(result: Pick<AsyncResearchResult, 'id' | 'status' | 'created_at' | 'completed_at'>): void {
  console.log(chalk.cyan('Research Status:'));
  console.log(`  ${chalk.white('ID:')} ${result.id}`);
  console.log(`  ${chalk.white('Status:')} ${chalk.yellow(result.status)}`);

  if (result.created_at) {
    console.log(`  ${chalk.white('Created:')} ${new Date(result.created_at * 1000).toLocaleString()}`);
  }
  if (result.completed_at) {
    console.log(`  ${chalk.white('Completed:')} ${new Date(result.completed_at * 1000).toLocaleString()}`);
  }
}

export function renderResearchReport(
  result: AsyncResearchResult,
  opts: { json?: boolean; output?: string },
): void {
  if (result.status !== 'COMPLETED') {
    console.log(chalk.yellow(`Research is not yet complete. Status: ${result.status}`));
    return;
  }

  const response = result.response;
  if (!response) {
    console.log(chalk.yellow('No response data available.'));
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const text = extractResearchText(result);

  console.log(chalk.cyan('Research Report:\n'));
  console.log(chalk.white(text));

  formatCitations(
    response.citations as string[] | null,
    response.search_results as unknown as SearchResult[] | null,
  );

  if (opts.output) {
    fs.writeFileSync(opts.output, text);
    printSuccess(`Report saved to ${opts.output}`);
  }
}

export function renderResearchSubmission(asyncResponse: CompletionCreateResponse, wait: boolean): void {
  const requestId = asyncResponse.id;
  console.log(chalk.cyan('Research ID:'), chalk.yellow(requestId));
  console.log(chalk.gray(`Status: ${asyncResponse.status}`));

  if (!wait) {
    console.log();
    console.log(chalk.gray('Check status with:'), `pplx research status ${requestId}`);
    console.log(chalk.gray('Get result with:'), `pplx research get ${requestId}`);
  }
}

async function pollForCompletion(
  client: ReturnType<typeof getClient>,
  requestId: string,
  opts: ResearchOptions,
): Promise<void> {
  const spinner = createSpinner('Researching...').start();
  const startTime = Date.now();
  const timeoutMs = opts.timeout * 60 * 1000;

  while (true) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    spinner.text = `Researching... (${elapsed}s elapsed)`;

    const result = await client.async.chat.completions.get(requestId);

    if (result.status === 'COMPLETED') {
      spinner.stop();
      renderResearchReport(result, { json: opts.json, output: opts.output });
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

async function startResearch(
  topic: string,
  opts: ResearchOptions,
): Promise<void> {
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
    renderResearchSubmission(asyncResponse, opts.wait);

    if (!opts.wait) return;

    console.log();
    await pollForCompletion(client, asyncResponse.id, opts);
  } catch (error) {
    handleError(error, undefined, opts.verbose);
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

      await startResearch(topic, opts);
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
        renderResearchStatus(result);
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
        renderResearchReport(result, options);
      } catch (error) {
        handleError(error, undefined, program.opts().verbose);
      }
    });

  research
    .argument('[topic]', 'Research topic (shorthand for: research start "topic")')
    .option('--poll-interval <seconds>', 'Polling interval', '10')
    .option('--timeout <minutes>', 'Max wait time', '30')
    .option('--no-wait', 'Submit and return ID only')
    .option('-o, --output <file>', 'Save result to file')
    .option('--json', 'Output as JSON')
    .action(async (topic: string | undefined, options: Record<string, unknown>) => {
      if (!topic) return;

      const opts: ResearchOptions = {
        pollInterval: parseInt(options.pollInterval as string, 10) || 10,
        timeout: parseInt(options.timeout as string, 10) || 30,
        wait: options.wait as boolean,
        output: options.output as string | undefined,
        json: options.json as boolean | undefined,
        verbose: program.opts().verbose as boolean | undefined,
      };

      await startResearch(topic, opts);
    });
}
