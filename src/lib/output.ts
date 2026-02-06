import chalk from 'chalk';
import ora, { type Ora } from 'ora';

export function createSpinner(text: string): Ora {
  return ora({ text, color: 'cyan' });
}

export function printHeader(text: string): void {
  console.log(chalk.cyan(text));
}

export function printResponse(text: string, raw: boolean): void {
  if (raw) {
    process.stdout.write(text);
  } else {
    console.log(chalk.white(text));
  }
}

export function printStreamChunk(text: string, raw: boolean): void {
  if (raw) {
    process.stdout.write(text);
  } else {
    process.stdout.write(chalk.white(text));
  }
}

export function printUsage(promptTokens: number, completionTokens: number, totalTokens: number): void {
  console.log(
    chalk.gray('\nTokens:'),
    chalk.yellow(`${promptTokens} prompt + ${completionTokens} completion = ${totalTokens} total`),
  );
}

export function printRelatedQuestions(questions: string[]): void {
  if (questions.length === 0) return;
  console.log();
  console.log(chalk.cyan('Related questions:'));
  for (const q of questions) {
    console.log(chalk.gray(`  - ${q}`));
  }
  console.log(chalk.gray(`\nRun any with: pplx "your question"`));
}

export function printImages(images: Array<{ url: string; title?: string }>): void {
  if (images.length === 0) return;
  console.log();
  console.log(chalk.cyan('Images:'));
  for (const img of images) {
    if (img.title) {
      console.log(chalk.gray(`  ${img.title}`));
    }
    console.log(chalk.blue(`  ${img.url}`));
  }
}

export function printSuccess(message: string): void {
  console.log(chalk.green(`${message}`));
}

export function printWarning(message: string): void {
  console.log(chalk.yellow(message));
}

export function printError(message: string): void {
  console.error(chalk.red(message));
}
