import { getRedisClient } from './redis-client';

// ========================================
// Redis sliding window rate limiter
// ========================================

// --- Thresholds (task 4.4) ---

export type RateLimitScope = 'API' | 'AUTH' | 'GENERATE' | 'CHAT';

export const RATE_LIMITS: Record<RateLimitScope, { max: number; windowSec: number }> = {
  API:      { max: 60, windowSec: 60 },
  AUTH:     { max: 5,  windowSec: 60 },
  GENERATE: { max: 10, windowSec: 60 },
  CHAT:     { max: 20, windowSec: 60 },
};

// --- Sliding window Lua script (task 4.3) ---

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

local min = now - window
redis.call('ZREMRANGEBYSCORE', key, '-inf', min)
local count = redis.call('ZCARD', key)

if count < limit then
  redis.call('ZADD', key, now, now .. ':' .. math.random(1, 1000000))
  redis.call('PEXPIRE', key, window)
  return {1, limit - count - 1, window}
else
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset = 0
  if #oldest >= 2 then
    reset = tonumber(oldest[2]) + window - now
  end
  return {0, 0, reset}
end
`;

// --- Fail-open alert dedup (task 4.5) ---

let lastAlertAt = 0;
const ALERT_DEDUP_MS = 5 * 60 * 1000;

function emitFailOpenAlert(err: unknown): void {
  const now = Date.now();
  if (now - lastAlertAt < ALERT_DEDUP_MS) return;
  lastAlertAt = now;
  console.error('[RateLimiter] Redis unavailable, fail-open activated', {
    error: err instanceof Error ? err.message : String(err),
    timestamp: new Date().toISOString(),
  });
}

// --- IP extraction (task 4.6) ---

export function getClientIdentifier(req: Request, userId?: string): string {
  if (userId) return userId;
  const trustProxy = process.env.TRUST_PROXY === 'true';
  const forwarded = req.headers.get('x-forwarded-for');
  if (trustProxy && forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

// --- Core check ---

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  headers: Record<string, string>;
}

export async function checkRateLimit(
  scope: RateLimitScope,
  route: string,
  identifier: string,
): Promise<RateLimitResult> {
  const { max, windowSec } = RATE_LIMITS[scope];
  const windowMs = windowSec * 1000;
  const key = `rl:${scope}:${route}:${identifier}`;

  const redis = getRedisClient();
  if (!redis) {
    return allowed(max, 0);
  }

  try {
    const now = Date.now();
    const result = await redis.eval(
      SLIDING_WINDOW_LUA, 1, key, String(now), String(windowMs), String(max),
    ) as [number, number, number];

    const [ok, remaining, retryMs] = result;
    if (ok === 1) {
      return allowed(remaining, 0);
    }
    return rejected(max, retryMs);
  } catch (err) {
    emitFailOpenAlert(err);
    return allowed(max, 0);
  }
}

// --- Helpers ---

function allowed(remaining: number, retryAfterMs: number): RateLimitResult {
  return {
    allowed: true,
    remaining,
    retryAfterMs,
    headers: {
      'X-RateLimit-Remaining': String(remaining),
    },
  };
}

function rejected(limit: number, retryAfterMs: number): RateLimitResult {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs,
    headers: {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': '0',
      'Retry-After': String(retryAfterSec),
    },
  };
}

/** Reset alert dedup timer for testing */
export function _resetAlertTimer(): void {
  lastAlertAt = 0;
}
