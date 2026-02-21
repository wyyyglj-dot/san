import type { RetryConfig, RetryStrategyConfig } from '@/types';

type StrategyLimits = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

const MAX_JITTER_RATIO = 0.5;
const DEFAULT_POLL_DURATION_MS = 40 * 60 * 1000; // 40 minutes
const MAX_POLL_DURATION_MS = 60 * 60 * 1000; // 60 minutes
const DEFAULT_STALL_THRESHOLD = 60;
const MAX_STALL_THRESHOLD = 600;

const DEFAULT_HTTP: RetryStrategyConfig = {
  enabled: true,
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 4000,
  jitterRatio: 0.3,
  respectRetryAfter: true,
};

const DEFAULT_RATE_LIMIT: RetryStrategyConfig = {
  enabled: true,
  maxAttempts: 3,
  baseDelayMs: 1500,
  maxDelayMs: 10000,
  jitterRatio: 0.25,
};

const DEFAULT_SORA_POLLING: RetryStrategyConfig & {
  maxPollDurationMs: number;
  stallThreshold: number;
} = {
  enabled: true,
  maxAttempts: 1,
  baseDelayMs: 2000,
  maxDelayMs: 10000,
  jitterRatio: 0,
  maxPollDurationMs: DEFAULT_POLL_DURATION_MS,
  stallThreshold: DEFAULT_STALL_THRESHOLD,
};

const DEFAULT_SORA_FAILED: RetryStrategyConfig = {
  enabled: true,
  maxAttempts: 3,
  baseDelayMs: 5000,
  maxDelayMs: 5000,
  jitterRatio: 0,
};

const HARD_LIMITS: {
  http: StrategyLimits;
  rateLimit: StrategyLimits;
  soraFailed: StrategyLimits;
  soraPolling: StrategyLimits & { maxPollDurationMs: number; stallThreshold: number };
} = {
  http: { maxAttempts: 10, baseDelayMs: 5000, maxDelayMs: 60000 },
  rateLimit: { maxAttempts: 5, baseDelayMs: 10000, maxDelayMs: 60000 },
  soraFailed: { maxAttempts: 5, baseDelayMs: 60000, maxDelayMs: 60000 },
  soraPolling: {
    maxAttempts: 10,
    baseDelayMs: 60000,
    maxDelayMs: 60000,
    maxPollDurationMs: MAX_POLL_DURATION_MS,
    stallThreshold: MAX_STALL_THRESHOLD,
  },
};

export function getDefaultRetryConfig(): RetryConfig {
  return {
    http: { ...DEFAULT_HTTP },
    rateLimit: { ...DEFAULT_RATE_LIMIT },
    soraPolling: { ...DEFAULT_SORA_POLLING },
    soraFailed: { ...DEFAULT_SORA_FAILED },
  };
}

export function mergeRetryConfig(base: RetryConfig, overrides?: Partial<RetryConfig>): RetryConfig {
  return {
    http: { ...base.http, ...(overrides?.http ?? {}) },
    rateLimit: { ...base.rateLimit, ...(overrides?.rateLimit ?? {}) },
    soraPolling: { ...base.soraPolling, ...(overrides?.soraPolling ?? {}) },
    soraFailed: { ...base.soraFailed, ...(overrides?.soraFailed ?? {}) },
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value as number, min), max);
}

function clampOptionalNumber(
  value: unknown,
  min: number,
  max: number,
  fallback?: number
): number | undefined {
  if (value === undefined || value === null) return fallback;
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value as number, min), max);
}

function normalizeStrategy(
  strategy: RetryStrategyConfig,
  defaults: RetryStrategyConfig,
  limits: StrategyLimits
): RetryStrategyConfig {
  const enabled = typeof strategy.enabled === 'boolean' ? strategy.enabled : defaults.enabled;
  const maxAttempts = clampNumber(strategy.maxAttempts, 1, limits.maxAttempts, defaults.maxAttempts);
  const baseDelayMs = clampNumber(strategy.baseDelayMs, 0, limits.baseDelayMs, defaults.baseDelayMs);
  const maxDelayBase = clampNumber(strategy.maxDelayMs, baseDelayMs, limits.maxDelayMs, defaults.maxDelayMs);
  const maxDelayMs = Math.max(baseDelayMs, maxDelayBase);
  const jitterFallback = defaults.jitterRatio ?? 0;
  const jitterRatio = clampNumber(strategy.jitterRatio, 0, MAX_JITTER_RATIO, jitterFallback);
  const maxElapsedMs = clampOptionalNumber(
    strategy.maxElapsedMs,
    0,
    Number.MAX_SAFE_INTEGER,
    defaults.maxElapsedMs
  );
  const respectRetryAfter =
    typeof strategy.respectRetryAfter === 'boolean'
      ? strategy.respectRetryAfter
      : defaults.respectRetryAfter;

  return {
    enabled,
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    maxElapsedMs,
    jitterRatio,
    respectRetryAfter,
  };
}

export function applyHardLimits(config: RetryConfig): RetryConfig {
  const defaults = getDefaultRetryConfig();
  const merged = mergeRetryConfig(defaults, config);

  const http = normalizeStrategy(merged.http, defaults.http, HARD_LIMITS.http);
  const rateLimit = normalizeStrategy(merged.rateLimit, defaults.rateLimit, HARD_LIMITS.rateLimit);
  const soraFailed = normalizeStrategy(merged.soraFailed, defaults.soraFailed, HARD_LIMITS.soraFailed);
  const soraPollingBase = normalizeStrategy(
    merged.soraPolling,
    defaults.soraPolling,
    HARD_LIMITS.soraPolling
  );

  return {
    http,
    rateLimit,
    soraFailed,
    soraPolling: {
      ...soraPollingBase,
      maxPollDurationMs: clampNumber(
        merged.soraPolling.maxPollDurationMs,
        1,
        HARD_LIMITS.soraPolling.maxPollDurationMs,
        defaults.soraPolling.maxPollDurationMs
      ),
      stallThreshold: clampNumber(
        merged.soraPolling.stallThreshold,
        1,
        HARD_LIMITS.soraPolling.stallThreshold,
        defaults.soraPolling.stallThreshold
      ),
    },
  };
}

function validateStrategy(
  name: string,
  strategy: RetryStrategyConfig,
  limits: StrategyLimits,
  errors: string[]
): void {
  if (typeof strategy.enabled !== 'boolean') {
    errors.push(`${name}.enabled must be boolean`);
  }
  if (
    !Number.isFinite(strategy.maxAttempts) ||
    strategy.maxAttempts < 1 ||
    strategy.maxAttempts > limits.maxAttempts
  ) {
    errors.push(`${name}.maxAttempts must be between 1 and ${limits.maxAttempts}`);
  }
  if (
    !Number.isFinite(strategy.baseDelayMs) ||
    strategy.baseDelayMs < 0 ||
    strategy.baseDelayMs > limits.baseDelayMs
  ) {
    errors.push(`${name}.baseDelayMs must be between 0 and ${limits.baseDelayMs}`);
  }
  if (
    !Number.isFinite(strategy.maxDelayMs) ||
    strategy.maxDelayMs < strategy.baseDelayMs ||
    strategy.maxDelayMs > limits.maxDelayMs
  ) {
    errors.push(`${name}.maxDelayMs must be between ${strategy.baseDelayMs} and ${limits.maxDelayMs}`);
  }
  if (strategy.jitterRatio !== undefined) {
    if (
      !Number.isFinite(strategy.jitterRatio) ||
      strategy.jitterRatio < 0 ||
      strategy.jitterRatio > MAX_JITTER_RATIO
    ) {
      errors.push(`${name}.jitterRatio must be between 0 and ${MAX_JITTER_RATIO}`);
    }
  }
  if (strategy.maxElapsedMs !== undefined) {
    if (!Number.isFinite(strategy.maxElapsedMs) || strategy.maxElapsedMs < 0) {
      errors.push(`${name}.maxElapsedMs must be >= 0`);
    }
  }
  if (strategy.respectRetryAfter !== undefined && typeof strategy.respectRetryAfter !== 'boolean') {
    errors.push(`${name}.respectRetryAfter must be boolean`);
  }
}

export function validateRetryConfig(config: RetryConfig): string[] {
  const errors: string[] = [];

  validateStrategy('http', config.http, HARD_LIMITS.http, errors);
  validateStrategy('rateLimit', config.rateLimit, HARD_LIMITS.rateLimit, errors);
  validateStrategy('soraFailed', config.soraFailed, HARD_LIMITS.soraFailed, errors);
  validateStrategy('soraPolling', config.soraPolling, HARD_LIMITS.soraPolling, errors);

  if (
    !Number.isFinite(config.soraPolling.maxPollDurationMs) ||
    config.soraPolling.maxPollDurationMs < 1 ||
    config.soraPolling.maxPollDurationMs > HARD_LIMITS.soraPolling.maxPollDurationMs
  ) {
    errors.push(
      `soraPolling.maxPollDurationMs must be between 1 and ${HARD_LIMITS.soraPolling.maxPollDurationMs}`
    );
  }
  if (
    !Number.isFinite(config.soraPolling.stallThreshold) ||
    config.soraPolling.stallThreshold < 1 ||
    config.soraPolling.stallThreshold > HARD_LIMITS.soraPolling.stallThreshold
  ) {
    errors.push(
      `soraPolling.stallThreshold must be between 1 and ${HARD_LIMITS.soraPolling.stallThreshold}`
    );
  }

  return errors;
}
