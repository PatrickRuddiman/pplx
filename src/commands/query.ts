import { Command } from 'commander';
import fs from 'node:fs';
import type { CompletionCreateParamsNonStreaming, CompletionCreateParamsStreaming } from '@perplexity-ai/perplexity_ai/resources/chat/completions';
import type { StreamChunk } from '@perplexity-ai/perplexity_ai/resources/chat/chat';
import { getClient } from '../lib/client.js';
import { resolveApiKey, resolveModel, getConfig } from '../lib/config.js';
import { handleError, exitNoApiKey } from '../lib/errors.js';
import { formatCitations, colorizeInlineCitations, type SearchResult } from '../lib/citations.js';
import {
  createSpinner,
  printHeader,
  printResponse,
  printStreamChunk,
  printUsage,
  printRelatedQuestions,
  printSuccess,
} from '../lib/output.js';
import { saveToHistory } from '../lib/history.js';
import { getThread, saveThread, getLatestThreadId, createThread } from '../lib/history.js';
import { DEFAULT_SYSTEM_PROMPT, type QueryOptions } from '../lib/types.js';

function buildMessages(
  question: string,
  systemPrompt: string,
  threadMessages?: Array<{ role: string; content: string }>,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  if (threadMessages) {
    for (const msg of threadMessages) {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }
  }

  messages.push({ role: 'user', content: question });
  return messages;
}

function buildBaseParams(messages: Array<{ role: string; content: string }>, opts: QueryOptions) {
  const params: Record<string, unknown> = {
    model: opts.model,
    messages,
  };

  if (opts.searchMode) params.search_mode = opts.searchMode;
  if (opts.recency) params.search_recency_filter = opts.recency;
  if (opts.after) params.search_after_date_filter = opts.after;
  if (opts.before) params.search_before_date_filter = opts.before;

  if (opts.domain && opts.domain.length > 0) {
    const filters = [...opts.domain];
    if (opts.excludeDomain) {
      for (const d of opts.excludeDomain) {
        filters.push(`-${d}`);
      }
    }
    params.search_domain_filter = filters;
  } else if (opts.excludeDomain && opts.excludeDomain.length > 0) {
    params.search_domain_filter = opts.excludeDomain.map((d) => `-${d}`);
  }

  if (opts.images) params.return_images = true;
  if (opts.related) params.return_related_questions = true;
  if (opts.reasoning) params.reasoning_effort = opts.reasoning;
  if (opts.language) params.search_language_filter = [opts.language];
  if (!opts.search) params.disable_search = true;
  if (opts.safeSearch) params.safe_search = true;

  if (opts.contextSize) {
    params.web_search_options = { search_context_size: opts.contextSize };
  }

  if (opts.json) {
    params.response_format = { type: 'text' as const };
  }

  return params;
}

async function executeQuery(question: string, opts: QueryOptions): Promise<void> {
  const apiKey = resolveApiKey();
  if (!apiKey) exitNoApiKey();

  const model = resolveModel(opts.model);
  const client = getClient(apiKey);
  const systemPrompt = opts.system ?? DEFAULT_SYSTEM_PROMPT;

  // Load thread messages if continuing
  let threadMessages: Array<{ role: string; content: string }> | undefined;
  let threadId: string | undefined;

  if (opts.continue) {
    threadId = getLatestThreadId();
    if (threadId) {
      const thread = getThread(threadId);
      if (thread) threadMessages = thread.messages;
    }
  } else if (opts.thread) {
    threadId = opts.thread;
    const thread = getThread(threadId);
    if (thread) threadMessages = thread.messages;
  }

  const messages = buildMessages(question, systemPrompt, threadMessages);
  const baseParams = buildBaseParams(messages, { ...opts, model });

  try {
    if (opts.stream) {
      if (!opts.raw) printHeader('Streaming response:\n');

      const streamParams = { ...baseParams, stream: true } as CompletionCreateParamsStreaming;
      const stream = await client.chat.completions.create(streamParams);

      let fullResponse = '';
      let citations: string[] | null = null;
      let searchResults: SearchResult[] | null = null;
      let relatedQuestions: string[] = [];

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content && typeof content === 'string') {
          const display = opts.citations !== false
            ? colorizeInlineCitations(content)
            : content;
          printStreamChunk(display, opts.raw ?? false);
          fullResponse += content;
        }

        // Capture metadata from chunks
        if (chunk.citations) citations = chunk.citations as string[];
        if (chunk.search_results) {
          searchResults = chunk.search_results as unknown as SearchResult[];
        }
        const related = (chunk as unknown as Record<string, unknown>).related_questions;
        if (Array.isArray(related)) {
          relatedQuestions = related as string[];
        }
      }

      console.log(); // newline after stream

      if (opts.citations !== false) {
        formatCitations(citations, searchResults);
      }

      if (opts.related && relatedQuestions.length > 0) {
        printRelatedQuestions(relatedQuestions);
      }

      if (opts.output) {
        fs.writeFileSync(opts.output, fullResponse);
        printSuccess(`Response saved to ${opts.output}`);
      }

      saveToHistory(question, model, fullResponse, citations?.length);

      if (threadId || opts.continue) {
        if (!threadId) threadId = createThread(model);
        saveThread(threadId, model, [
          ...(threadMessages ?? []),
          { role: 'user', content: question },
          { role: 'assistant', content: fullResponse },
        ]);
      }
    } else {
      const spinner = createSpinner('Thinking...').start();

      try {
        const nonStreamParams = { ...baseParams, stream: false } as CompletionCreateParamsNonStreaming;
        const completion: StreamChunk = await client.chat.completions.create(nonStreamParams);

        spinner.stop();

        const response = completion.choices?.[0]?.message?.content;
        const responseText = typeof response === 'string' ? response : '';

        if (!opts.raw) printHeader('Response:\n');

        const display = opts.citations !== false
          ? colorizeInlineCitations(responseText)
          : responseText;
        printResponse(display, opts.raw ?? false);

        if (opts.citations !== false) {
          formatCitations(
            completion.citations as string[] | null,
            completion.search_results as unknown as SearchResult[] | null,
          );
        }

        const related = (completion as unknown as Record<string, unknown>).related_questions;
        if (opts.related && Array.isArray(related) && related.length > 0) {
          printRelatedQuestions(related as string[]);
        }

        if (completion.usage) {
          printUsage(
            completion.usage.prompt_tokens,
            completion.usage.completion_tokens,
            completion.usage.total_tokens,
          );
        }

        if (opts.output) {
          fs.writeFileSync(opts.output, responseText);
          printSuccess(`Response saved to ${opts.output}`);
        }

        saveToHistory(question, model, responseText, (completion.citations as string[] | undefined)?.length);

        if (threadId || opts.continue) {
          if (!threadId) threadId = createThread(model);
          saveThread(threadId, model, [
            ...(threadMessages ?? []),
            { role: 'user', content: question },
            { role: 'assistant', content: responseText },
          ]);
        }
      } catch (error) {
        handleError(error, spinner, opts.verbose);
      }
    }
  } catch (error) {
    handleError(error, undefined, opts.verbose);
  }
}

export function registerQueryCommand(program: Command): void {
  const query = program
    .command('query <question>')
    .description('Send a query to the Perplexity API')
    .option('-m, --model <model>', 'Model to use')
    .option('-s, --stream', 'Stream response in real-time', true)
    .option('--no-stream', 'Wait for complete response')
    .option('-o, --output <file>', 'Save response to file')
    .option('--search-mode <mode>', 'Search mode: web, academic, sec')
    .option('--recency <period>', 'Filter by recency: hour, day, week, month, year')
    .option('--after <date>', 'Only results after date (YYYY-MM-DD)')
    .option('--before <date>', 'Only results before date (YYYY-MM-DD)')
    .option('--domain <domains...>', 'Include only these domains')
    .option('--exclude-domain <domains...>', 'Exclude these domains')
    .option('--images', 'Include images (sonar-pro only)')
    .option('--related', 'Show related questions')
    .option('--reasoning <effort>', 'Reasoning effort: minimal, low, medium, high')
    .option('--context-size <size>', 'Search context: low, medium, high')
    .option('--language <code>', 'Preferred response language')
    .option('--system <prompt>', 'Custom system prompt')
    .option('--json', 'Request JSON output')
    .option('--no-citations', 'Hide citations')
    .option('--no-search', 'Disable web search')
    .option('--safe-search', 'Enable safe search filtering')
    .option('--raw', 'Output raw text (no formatting)')
    .option('-c, --continue', 'Continue last conversation')
    .option('-t, --thread <id>', 'Continue a specific thread');

  query.action(async (question: string, options: Record<string, unknown>) => {
    const config = getConfig();
    const opts: QueryOptions = {
      model: (options.model as string) ?? config.defaults?.model ?? 'sonar',
      stream: options.stream as boolean,
      output: options.output as string | undefined,
      searchMode: (options.searchMode as QueryOptions['searchMode']) ?? config.defaults?.searchMode,
      recency: options.recency as QueryOptions['recency'],
      after: options.after as string | undefined,
      before: options.before as string | undefined,
      domain: options.domain as string[] | undefined,
      excludeDomain: options.excludeDomain as string[] | undefined,
      images: options.images as boolean | undefined,
      related: options.related as boolean | undefined,
      reasoning: options.reasoning as QueryOptions['reasoning'],
      contextSize: (options.contextSize as QueryOptions['contextSize']) ?? config.defaults?.contextSize,
      language: (options.language as string | undefined) ?? config.defaults?.language,
      system: options.system as string | undefined,
      json: options.json as boolean | undefined,
      citations: options.citations as boolean,
      search: options.search as boolean,
      safeSearch: (options.safeSearch as boolean | undefined) ?? config.defaults?.safeSearch,
      raw: options.raw as boolean | undefined,
      continue: options.continue as boolean | undefined,
      thread: options.thread as string | undefined,
      verbose: program.opts().verbose as boolean | undefined,
    };

    await executeQuery(question, opts);
  });
}

export { executeQuery };
