import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getConfigDir } from './config.js';
import type { HistoryEntry, ThreadFile } from './types.js';

const MAX_HISTORY = 100;
const MAX_THREADS = 50;
const PREVIEW_LENGTH = 200;

function getHistoryPath(): string {
  return path.join(getConfigDir(), 'history.json');
}

function getThreadsDir(): string {
  return path.join(getConfigDir(), 'threads');
}

function getThreadPath(threadId: string): string {
  return path.join(getThreadsDir(), `${threadId}.json`);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getHistory(): HistoryEntry[] {
  const historyPath = getHistoryPath();
  try {
    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, 'utf8');
      return JSON.parse(data) as HistoryEntry[];
    }
  } catch {
    // Return empty on error
  }
  return [];
}

function saveHistory(entries: HistoryEntry[]): void {
  ensureDir(getConfigDir());
  fs.writeFileSync(getHistoryPath(), JSON.stringify(entries, null, 2));
}

export function saveToHistory(
  question: string,
  model: string,
  response?: string,
  citationCount?: number,
): void {
  const entries = getHistory();

  entries.unshift({
    id: crypto.randomUUID(),
    question,
    model,
    timestamp: Date.now(),
    responsePreview: response ? response.substring(0, PREVIEW_LENGTH) : undefined,
    citations: citationCount,
  });

  // Prune to max
  saveHistory(entries.slice(0, MAX_HISTORY));
}

export function clearHistory(): void {
  const historyPath = getHistoryPath();
  if (fs.existsSync(historyPath)) {
    fs.unlinkSync(historyPath);
  }
}

// Thread management

export function getThread(threadId: string): ThreadFile | null {
  const threadPath = getThreadPath(threadId);
  try {
    if (fs.existsSync(threadPath)) {
      const data = fs.readFileSync(threadPath, 'utf8');
      return JSON.parse(data) as ThreadFile;
    }
  } catch {
    // Return null on error
  }
  return null;
}

export function createThread(model: string): string {
  const id = crypto.randomUUID();
  const thread: ThreadFile = {
    id,
    created: Date.now(),
    updated: Date.now(),
    model,
    messages: [],
  };

  ensureDir(getThreadsDir());
  fs.writeFileSync(getThreadPath(id), JSON.stringify(thread, null, 2));
  pruneThreads();
  return id;
}

export function saveThread(
  threadId: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
): void {
  const existing = getThread(threadId);
  const thread: ThreadFile = {
    id: threadId,
    created: existing?.created ?? Date.now(),
    updated: Date.now(),
    model,
    messages,
  };

  ensureDir(getThreadsDir());
  fs.writeFileSync(getThreadPath(threadId), JSON.stringify(thread, null, 2));
}

export function getLatestThreadId(): string | undefined {
  const threadsDir = getThreadsDir();
  if (!fs.existsSync(threadsDir)) return undefined;

  const files = fs.readdirSync(threadsDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return undefined;

  let latest: { id: string; updated: number } | null = null;

  for (const file of files) {
    try {
      const data = fs.readFileSync(path.join(threadsDir, file), 'utf8');
      const thread = JSON.parse(data) as ThreadFile;
      if (!latest || thread.updated > latest.updated) {
        latest = { id: thread.id, updated: thread.updated };
      }
    } catch {
      continue;
    }
  }

  return latest?.id;
}

export function listThreads(): ThreadFile[] {
  const threadsDir = getThreadsDir();
  if (!fs.existsSync(threadsDir)) return [];

  const files = fs.readdirSync(threadsDir).filter((f) => f.endsWith('.json'));
  const threads: ThreadFile[] = [];

  for (const file of files) {
    try {
      const data = fs.readFileSync(path.join(threadsDir, file), 'utf8');
      threads.push(JSON.parse(data) as ThreadFile);
    } catch {
      continue;
    }
  }

  return threads.sort((a, b) => b.updated - a.updated);
}

function pruneThreads(): void {
  const threads = listThreads();
  if (threads.length <= MAX_THREADS) return;

  const toRemove = threads.slice(MAX_THREADS);
  for (const thread of toRemove) {
    const threadPath = getThreadPath(thread.id);
    if (fs.existsSync(threadPath)) {
      fs.unlinkSync(threadPath);
    }
  }
}

export function clearThreads(): void {
  const threadsDir = getThreadsDir();
  if (!fs.existsSync(threadsDir)) return;

  const files = fs.readdirSync(threadsDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    fs.unlinkSync(path.join(threadsDir, file));
  }
}
