import chalk from 'chalk';

export interface SearchResult {
  title: string;
  url: string;
  date?: string | null;
  snippet?: string;
}

export function formatCitations(
  citations: string[] | null | undefined,
  searchResults: SearchResult[] | null | undefined,
): void {
  if (!citations || citations.length === 0) return;

  console.log();
  console.log(chalk.cyan('Sources:'));

  for (let i = 0; i < citations.length; i++) {
    const url = citations[i];
    const result = searchResults?.find((r) => r.url === url);
    const num = chalk.cyan(`[${i + 1}]`);

    if (result?.title) {
      console.log(`  ${num} ${chalk.white(result.title)}`);
      console.log(`      ${chalk.blue(url)}`);
    } else {
      console.log(`  ${num} ${chalk.blue(url)}`);
    }
  }
}

export function colorizeInlineCitations(text: string): string {
  return text.replace(/\[(\d+)\]/g, (_match, num) => chalk.cyan(`[${num}]`));
}
