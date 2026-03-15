import type { LogEntry } from '@/types/debug';

export type LogListener = (entry: LogEntry, seq: number) => void;

export interface LogItem {
  seq: number;
  entry: LogEntry;
}

export class RingBuffer {
  private capacity: number;
  private items: LogItem[];
  private nextSeq: number;
  private listeners: Set<LogListener>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.items = [];
    this.nextSeq = 1;
    this.listeners = new Set();
  }

  append(entry: LogEntry): number {
    const seq = this.nextSeq++;
    if (this.items.length >= this.capacity) {
      this.items.shift();
    }
    this.items.push({ seq, entry });

    Array.from(this.listeners).forEach(listener => {
      try {
        listener(entry, seq);
      } catch {
        // Ignore listener errors
      }
    });

    return seq;
  }

  getSince(cursor: number): LogItem[] {
    if (!cursor) {
      return [...this.items];
    }
    return this.items.filter(item => item.seq > cursor);
  }

  oldestSeq(): number {
    return this.items.length ? this.items[0].seq : this.nextSeq;
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

type GlobalLogStore = typeof globalThis & {
  __serverLogStore?: RingBuffer;
};

const globalForLogStore = globalThis as GlobalLogStore;

export const serverLogStore = globalForLogStore.__serverLogStore ?? new RingBuffer(1000);

if (!globalForLogStore.__serverLogStore) {
  globalForLogStore.__serverLogStore = serverLogStore;
}
