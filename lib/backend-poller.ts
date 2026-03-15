export interface PollStatusResult {
  done: boolean;
  success: boolean;
  progress?: number;
  statusText?: string;
  error?: string;
}

export interface PollOptions {
  softTimeoutMs?: number;
  hardTimeoutMs?: number;
  highFreqIntervalMs?: number;
  lowFreqIntervalMs?: number;
  onProgress?: (progress: number, status: string) => void;
}

const DEFAULT_SOFT_TIMEOUT_MS = 15 * 60 * 1000;   // 15min
const DEFAULT_HARD_TIMEOUT_MS = 60 * 60 * 1000;   // 60min
const DEFAULT_HIGH_FREQ_INTERVAL_MS = 5_000;       // 5s
const DEFAULT_LOW_FREQ_INTERVAL_MS = 30_000;       // 30s

export const POLL_TIMEOUT_MESSAGE = 'polling timeout';

export async function pollBackendTask<T>(
  fetchStatus: () => Promise<{ parsed: PollStatusResult; raw: T }>,
  options?: PollOptions,
): Promise<T> {
  const softTimeout = options?.softTimeoutMs ?? DEFAULT_SOFT_TIMEOUT_MS;
  const hardTimeout = options?.hardTimeoutMs ?? DEFAULT_HARD_TIMEOUT_MS;
  const highFreq = options?.highFreqIntervalMs ?? DEFAULT_HIGH_FREQ_INTERVAL_MS;
  const lowFreq = options?.lowFreqIntervalMs ?? DEFAULT_LOW_FREQ_INTERVAL_MS;
  const { onProgress } = options ?? {};

  const effectiveSoft = hardTimeout > 0 ? Math.min(softTimeout, hardTimeout) : softTimeout;
  const startTime = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const elapsed = Date.now() - startTime;
    if (hardTimeout > 0 && elapsed >= hardTimeout) {
      throw new Error(POLL_TIMEOUT_MESSAGE);
    }

    const { parsed, raw } = await fetchStatus();

    if (hardTimeout > 0 && (Date.now() - startTime) >= hardTimeout) {
      throw new Error(POLL_TIMEOUT_MESSAGE);
    }

    if (onProgress && typeof parsed.progress === 'number' && Number.isFinite(parsed.progress)) {
      onProgress(
        parsed.progress,
        parsed.statusText ?? (parsed.done ? (parsed.success ? 'completed' : 'failed') : 'processing'),
      );
    }

    if (parsed.done) {
      if (parsed.success) return raw;
      throw new Error(parsed.error || 'Task failed');
    }

    const intervalMs = (Date.now() - startTime) < effectiveSoft ? highFreq : lowFreq;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
