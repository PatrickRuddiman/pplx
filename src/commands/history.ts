import { Command } from 'commander';
import chalk from 'chalk';
import { getHistory, clearHistory, listThreads, clearThreads } from '../lib/history.js';
import { printSuccess, printWarning } from '../lib/output.js';

export function registerHistoryCommand(program: Command): void {
  program
    .command('history')
    .description('View history of recent queries')
    .option('--limit <n>', 'Number of entries to show', '20')
    .option('--clear', 'Clear all history')
    .option('--json', 'Output as JSON')
    .option('--threads', 'Show conversation threads')
    .action((options: { limit: string; clear?: boolean; json?: boolean; threads?: boolean }) => {
      if (options.clear) {
        clearHistory();
        clearThreads();
        printSuccess('History and threads cleared.');
        return;
      }

      if (options.threads) {
        const threads = listThreads();
        if (threads.length === 0) {
          printWarning('No conversation threads found.');
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(threads, null, 2));
          return;
        }

        console.log(chalk.cyan('Conversation Threads:\n'));
        for (const thread of threads) {
          const date = new Date(thread.updated).toLocaleString();
          const msgCount = thread.messages.length;
          const firstMsg = thread.messages.find((m) => m.role === 'user');
          const preview = firstMsg
            ? firstMsg.content.substring(0, 80) + (firstMsg.content.length > 80 ? '...' : '')
            : '(empty)';

          console.log(chalk.yellow(`  ${thread.id.substring(0, 8)}`));
          console.log(chalk.white(`  ${preview}`));
          console.log(chalk.gray(`  ${date} | ${thread.model} | ${msgCount} messages`));
          console.log();
        }
        console.log(chalk.gray(`Continue a thread with: pplx query "question" --thread <id>`));
        return;
      }

      const history = getHistory();
      if (history.length === 0) {
        printWarning('No query history found.');
        return;
      }

      const limit = parseInt(options.limit, 10) || 20;
      const entries = history.slice(0, limit);

      if (options.json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
      }

      console.log(chalk.cyan('Recent Queries:\n'));
      for (const entry of entries) {
        const date = new Date(entry.timestamp).toLocaleString();
        console.log(chalk.white(`  ${entry.question}`));
        const meta = [date, entry.model];
        if (entry.citations) meta.push(`${entry.citations} sources`);
        console.log(chalk.gray(`  ${meta.join(' | ')}`));
        if (entry.responsePreview) {
          const preview = entry.responsePreview.substring(0, 100);
          console.log(chalk.gray(`  ${preview}${entry.responsePreview.length > 100 ? '...' : ''}`));
        }
        console.log();
      }
    });
}
