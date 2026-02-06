import Perplexity from '@perplexity-ai/perplexity_ai';
import chalk from 'chalk';
import type { Ora } from 'ora';

export function handleError(error: unknown, spinner?: Ora, verbose?: boolean): never {
  if (spinner?.isSpinning) {
    spinner.stop();
  }

  if (error instanceof Perplexity.AuthenticationError) {
    console.error(chalk.red('Error: Invalid or missing API key.'));
    console.error(chalk.yellow('Run: pplx config set-key <your-api-key>'));
  } else if (error instanceof Perplexity.RateLimitError) {
    console.error(chalk.red('Error: Rate limit exceeded.'));
    console.error(chalk.yellow('Wait a moment and try again, or check your usage tier.'));
  } else if (error instanceof Perplexity.BadRequestError) {
    const msg = error.message;
    console.error(chalk.red('Error: Bad request.'));
    if (msg.toLowerCase().includes('model')) {
      console.error(chalk.yellow('The specified model may not be available. Run: pplx models'));
    } else {
      console.error(chalk.gray(msg));
    }
  } else if (error instanceof Perplexity.APIConnectionTimeoutError) {
    console.error(chalk.red('Error: Request timed out.'));
    console.error(chalk.yellow('Check your internet connection and try again.'));
  } else if (error instanceof Perplexity.APIConnectionError) {
    console.error(chalk.red('Error: Unable to connect to Perplexity API.'));
    console.error(chalk.yellow('Check your internet connection.'));
  } else if (error instanceof Perplexity.InternalServerError) {
    console.error(chalk.red('Error: Perplexity API server error.'));
    console.error(chalk.yellow('Try again in a moment.'));
  } else if (error instanceof Perplexity.APIError) {
    console.error(chalk.red(`Error: API returned status ${error.status}.`));
    console.error(chalk.gray(error.message));
  } else if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`));
  } else {
    console.error(chalk.red('An unexpected error occurred.'));
  }

  if (verbose && error instanceof Error) {
    console.error(chalk.gray('\nDebug info:'));
    console.error(chalk.gray(error.stack ?? String(error)));
    if (error instanceof Perplexity.APIError) {
      console.error(chalk.gray(`Status: ${error.status}`));
    }
  }

  process.exit(1);
}

export function exitNoApiKey(): never {
  console.error(chalk.red('Error: No API key configured.'));
  console.error(chalk.yellow('Set your key: pplx config set-key <your-api-key>'));
  console.error(chalk.yellow('Or set PERPLEXITY_API_KEY environment variable.'));
  process.exit(1);
}
