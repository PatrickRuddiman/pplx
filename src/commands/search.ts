import { Command } from 'commander';
import chalk from 'chalk';
import type { SearchCreateParams, SearchCreateResponse } from '@perplexity-ai/perplexity_ai/resources/search';
import { getClient } from '../lib/client.js';
import { resolveApiKey } from '../lib/config.js';
import { handleError, exitNoApiKey } from '../lib/errors.js';
import { createSpinner } from '../lib/output.js';
import type { SearchOptions } from '../lib/types.js';

export function buildSearchParams(query: string, opts: SearchOptions): SearchCreateParams {
  const params: SearchCreateParams = { query };

  if (typeof opts.maxResults === 'number') params.max_results = opts.maxResults;
  if (opts.mode) params.search_mode = opts.mode;
  if (opts.recency) params.search_recency_filter = opts.recency;
  if (opts.domain && opts.domain.length > 0) params.search_domain_filter = opts.domain;

  return params;
}

export function renderSearchResults(response: SearchCreateResponse): void {
  if (!response.results || response.results.length === 0) {
    console.log(chalk.yellow('No results found.'));
    return;
  }

  console.log(chalk.cyan('Search Results:\n'));
  for (let i = 0; i < response.results.length; i++) {
    const result = response.results[i];
    console.log(`  ${chalk.cyan(`[${i + 1}]`)} ${chalk.white(result.title)}`);
    console.log(`      ${chalk.blue(result.url)}`);
    if (result.date) {
      console.log(`      ${chalk.gray(result.date)}`);
    }
    if (result.snippet) {
      const snippet = result.snippet.length > 200
        ? result.snippet.substring(0, 200) + '...'
        : result.snippet;
      console.log(`      ${chalk.gray(snippet)}`);
    }
    console.log();
  }
}

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search the web via Perplexity Search API')
    .option('--max-results <n>', 'Number of results', '10')
    .option('--mode <mode>', 'Search mode: web, academic, sec')
    .option('--recency <period>', 'Recency filter: hour, day, week, month, year')
    .option('--domain <domains...>', 'Include only these domains')
    .option('--json', 'Output as JSON')
    .action(async (query: string, options: Record<string, unknown>) => {
      const opts: SearchOptions = {
        maxResults: parseInt(options.maxResults as string, 10) || 10,
        mode: options.mode as SearchOptions['mode'],
        recency: options.recency as SearchOptions['recency'],
        domain: options.domain as string[] | undefined,
        json: options.json as boolean | undefined,
        verbose: program.opts().verbose as boolean | undefined,
      };

      const apiKey = resolveApiKey();
      if (!apiKey) exitNoApiKey();

      const client = getClient(apiKey);
      const spinner = createSpinner('Searching...').start();

      try {
        const params = buildSearchParams(query, opts);
        const response = await client.search.create(params);

        spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(response, null, 2));
          return;
        }

        renderSearchResults(response);
      } catch (error) {
        handleError(error, spinner, opts.verbose);
      }
    });
}
