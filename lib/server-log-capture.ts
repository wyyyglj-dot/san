import { sanitizeBody } from '@/lib/debug-utils';
import { serverLogStore } from '@/lib/server-log-store';
import type { LogEntry, LogType } from '@/types/debug';

type ConsoleFn = (...args: unknown[]) => void;

interface OriginalConsole {
  log: ConsoleFn;
  warn: ConsoleFn;
  error: ConsoleFn;
}

type GlobalLogCapture = typeof globalThis & {
  __serverLogCaptureInstalled?: boolean;
  __serverLogCaptureOriginal?: OriginalConsole;
};

const globalForCapture = globalThis as GlobalLogCapture;

function formatArgs(args: unknown[]): string {
  return args
    .map(arg => {
      if (typeof arg === 'string') {
        return arg;
      }
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

function newLogId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emit(type: LogType, args: unknown[]): void {
  const message = sanitizeBody(formatArgs(args));
  const entry: LogEntry = {
    id: newLogId(),
    timestamp: Date.now(),
    type,
    source: 'server',
    message,
  };
  serverLogStore.append(entry);
}

export function initServerLogCapture(): void {
  if (globalForCapture.__serverLogCaptureInstalled) {
    return;
  }
  globalForCapture.__serverLogCaptureInstalled = true;

  if (!globalForCapture.__serverLogCaptureOriginal) {
    globalForCapture.__serverLogCaptureOriginal = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };
  }

  const original = globalForCapture.__serverLogCaptureOriginal;

  console.log = (...args: unknown[]) => {
    original.log(...args);
    emit('response', args);
  };

  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    emit('response', args);
  };

  console.error = (...args: unknown[]) => {
    original.error(...args);
    emit('error', args);
  };
}
