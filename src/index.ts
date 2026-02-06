import { Command } from 'commander';
import { registerQueryCommand, executeQuery } from './commands/query.js';
import { registerConfigCommand } from './commands/config.js';
import { registerHistoryCommand } from './commands/history.js';
import { registerModelsCommand } from './commands/models.js';
import { registerSearchCommand } from './commands/search.js';
import { registerResearchCommand } from './commands/research.js';
import { getConfig } from './lib/config.js';
import { APP_VERSION } from './lib/types.js';

const program = new Command();

program
  .name('pplx')
  .version(APP_VERSION)
  .description('Modern CLI for the Perplexity AI API')
  .option('--api-key <key>', 'Override stored API key')
  .option('--verbose', 'Show debug output')
  .option('--no-color', 'Disable colored output');

// Register all commands
registerQueryCommand(program);
registerConfigCommand(program);
registerHistoryCommand(program);
registerModelsCommand(program);
registerSearchCommand(program);
registerResearchCommand(program);

// Handle default behavior: treat unknown first argument as a query
// This allows `pplx "What is TypeScript?"` without the `query` subcommand
const knownCommands = new Set([
  'query', 'config', 'history', 'models', 'search', 'research',
  'set-key', 'view-key', 'clear-key', 'help',
]);

const args = process.argv.slice(2);

if (args.length > 0 && !args[0].startsWith('-') && !knownCommands.has(args[0])) {
  // Treat as a default query
  const question = args[0];
  const remainingArgs = args.slice(1);

  // Parse remaining args for query options
  const queryProgram = new Command();
  queryProgram
    .option('-m, --model <model>', 'Model to use')
    .option('-s, --stream', 'Stream response', true)
    .option('--no-stream', 'Wait for complete response')
    .option('-o, --output <file>', 'Save response to file')
    .option('--search-mode <mode>', 'Search mode: web, academic, sec')
    .option('--recency <period>', 'Recency filter')
    .option('--after <date>', 'Results after date')
    .option('--before <date>', 'Results before date')
    .option('--domain <domains...>', 'Include domains')
    .option('--exclude-domain <domains...>', 'Exclude domains')
    .option('--images', 'Include images')
    .option('--related', 'Show related questions')
    .option('--reasoning <effort>', 'Reasoning effort')
    .option('--context-size <size>', 'Search context size')
    .option('--language <code>', 'Response language')
    .option('--system <prompt>', 'System prompt')
    .option('--json', 'JSON output')
    .option('--no-citations', 'Hide citations')
    .option('--no-search', 'Disable search')
    .option('--safe-search', 'Safe search')
    .option('--raw', 'Raw output')
    .option('-c, --continue', 'Continue last conversation')
    .option('-t, --thread <id>', 'Continue thread')
    .option('--verbose', 'Debug output')
    .option('--api-key <key>', 'Override API key');

  queryProgram.parse(remainingArgs, { from: 'user' });
  const options = queryProgram.opts();

  // Set API key override if provided
  if (options.apiKey) {
    process.env.PERPLEXITY_API_KEY = options.apiKey;
  }

  const config = getConfig();

  executeQuery(question, {
    model: options.model ?? config.defaults?.model ?? 'sonar',
    stream: options.stream ?? true,
    output: options.output,
    searchMode: options.searchMode ?? config.defaults?.searchMode,
    recency: options.recency,
    after: options.after,
    before: options.before,
    domain: options.domain,
    excludeDomain: options.excludeDomain,
    images: options.images,
    related: options.related,
    reasoning: options.reasoning,
    contextSize: options.contextSize ?? config.defaults?.contextSize,
    language: options.language ?? config.defaults?.language,
    system: options.system,
    json: options.json,
    citations: options.citations ?? true,
    search: options.search ?? true,
    safeSearch: options.safeSearch ?? config.defaults?.safeSearch,
    raw: options.raw,
    continue: options.continue,
    thread: options.thread,
    verbose: options.verbose,
  });
} else if (args.length === 0) {
  program.help();
} else {
  program.parse();
}
