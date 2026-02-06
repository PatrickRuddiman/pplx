import { Command } from 'commander';
import chalk from 'chalk';
import type { CompletionCreateParamsNonStreaming } from '@perplexity-ai/perplexity_ai/resources/chat/completions';
import type { StreamChunk } from '@perplexity-ai/perplexity_ai/resources/chat/chat';
import { getClient } from '../lib/client.js';
import { resolveApiKey } from '../lib/config.js';
import { handleError, exitNoApiKey } from '../lib/errors.js';
import { createSpinner } from '../lib/output.js';
import type { SearchOptions } from '../lib/types.js';

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
        const params: Record<string, unknown> = {
          model: 'sonar',
          messages: [
            { role: 'system', content: 'Provide concise search results with sources.' },
            { role: 'user', content: query },
          ],
          stream: false,
          num_search_results: opts.maxResults,
          return_related_questions: true,
        };

        if (opts.mode) params.search_mode = opts.mode;
        if (opts.recency) params.search_recency_filter = opts.recency;
        if (opts.domain) params.search_domain_filter = opts.domain;

        const completion: StreamChunk = await client.chat.completions.create(
          params as unknown as CompletionCreateParamsNonStreaming,
        );

        spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(completion, null, 2));
          return;
        }

        const content = completion.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
          console.log(chalk.white(content));
        }

        const citations = completion.citations as string[] | undefined;
        const searchResults = completion.search_results as
          | Array<{ title: string; url: string; snippet?: string }>
          | undefined;

        if (searchResults && searchResults.length > 0) {
          console.log();
          console.log(chalk.cyan('Search Results:\n'));
          for (let i = 0; i < searchResults.length; i++) {
            const result = searchResults[i];
            console.log(`  ${chalk.cyan(`[${i + 1}]`)} ${chalk.white(result.title)}`);
            console.log(`      ${chalk.blue(result.url)}`);
            if (result.snippet) {
              console.log(`      ${chalk.gray(result.snippet.substring(0, 150))}`);
            }
            console.log();
          }
        } else if (citations && citations.length > 0) {
          console.log();
          console.log(chalk.cyan('Sources:\n'));
          for (let i = 0; i < citations.length; i++) {
            console.log(`  ${chalk.cyan(`[${i + 1}]`)} ${chalk.blue(citations[i])}`);
          }
          console.log();
        }
      } catch (error) {
        handleError(error, spinner, opts.verbose);
      }
    });
}
