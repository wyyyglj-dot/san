/* eslint-disable no-console */

const TRANSIENT_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE',
  'PROTOCOL_CONNECTION_LOST', 'ER_CON_COUNT_ERROR',
]);

const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1s
const JITTER_FACTOR = 0.2;

function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as any).code || (error as any).errno;
  if (typeof code === 'string' && TRANSIENT_CODES.has(code)) return true;
  if (error.message?.includes('Connection lost')) return true;
  if (error.message?.includes('ECONNRESET')) return true;
  return false;
}

function delay(attempt: number): number {
  const base = BASE_DELAY * Math.pow(2, attempt); // 1s, 2s, 4s, 8s, 16s
  const jitter = base * JITTER_FACTOR * (Math.random() * 2 - 1); // ±20%
  return Math.max(0, base + jitter);
}

/**
 * Execute a database query with retry for transient connection errors.
 * Does NOT retry within transactions (caller must handle).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { inTransaction?: boolean; context?: string } = {}
): Promise<T> {
  if (options.inTransaction) {
    return fn(); // No retry inside transactions
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt === MAX_RETRIES) {
        throw error;
      }
      const ms = delay(attempt);
      console.warn(
        `[DB Retry] ${options.context || 'query'} attempt ${attempt + 1}/${MAX_RETRIES}, ` +
        `retrying in ${Math.round(ms)}ms: ${(error as Error).message}`
      );
      await new Promise(resolve => setTimeout(resolve, ms));
    }
  }
  throw lastError;
}
