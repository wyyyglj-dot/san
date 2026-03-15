import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
  _resetAlertTimer,
} from '../rate-limiter';

// Mock redis-client module
const mockEval = vi.fn();
const mockRedis = { eval: mockEval };

vi.mock('../redis-client', () => ({
  getRedisClient: vi.fn(() => mockRedis),
  _resetForTest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  _resetAlertTimer();
});

// ---- Thresholds ----

describe('RATE_LIMITS', () => {
  it('defines correct thresholds', () => {
    expect(RATE_LIMITS.API).toEqual({ max: 60, windowSec: 60 });
    expect(RATE_LIMITS.AUTH).toEqual({ max: 5, windowSec: 60 });
    expect(RATE_LIMITS.GENERATE).toEqual({ max: 10, windowSec: 60 });
    expect(RATE_LIMITS.CHAT).toEqual({ max: 20, windowSec: 60 });
  });
});

// ---- Sliding window enforcement ----

describe('checkRateLimit', () => {
  it('allows request when under limit', async () => {
    mockEval.mockResolvedValue([1, 59, 0]);
    const result = await checkRateLimit('API', '/test', 'user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it('rejects request when over limit', async () => {
    mockEval.mockResolvedValue([0, 0, 5000]);
    const result = await checkRateLimit('API', '/test', 'user1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.headers['Retry-After']).toBe('5');
  });

  it('passes correct key format to Redis', async () => {
    mockEval.mockResolvedValue([1, 4, 0]);
    await checkRateLimit('AUTH', '/login', 'ip:1.2.3.4');
    expect(mockEval).toHaveBeenCalledWith(
      expect.any(String), 1,
      'rl:AUTH:/login:ip:1.2.3.4',
      expect.any(String), expect.any(String), expect.any(String),
    );
  });
});

// ---- Key isolation ----

describe('key isolation', () => {
  it('different users get independent counters', async () => {
    mockEval.mockResolvedValueOnce([0, 0, 3000]); // user A blocked
    mockEval.mockResolvedValueOnce([1, 9, 0]);     // user B allowed

    const a = await checkRateLimit('GENERATE', '/gen', 'userA');
    const b = await checkRateLimit('GENERATE', '/gen', 'userB');

    expect(a.allowed).toBe(false);
    expect(b.allowed).toBe(true);
  });
});

// ---- Fail-open ----

describe('fail-open', () => {
  it('allows request when Redis throws', async () => {
    mockEval.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await checkRateLimit('API', '/test', 'user1');
    expect(result.allowed).toBe(true);
  });

  it('allows request when Redis times out', async () => {
    mockEval.mockRejectedValue(new Error('Command timed out'));
    const result = await checkRateLimit('API', '/test', 'user1');
    expect(result.allowed).toBe(true);
  });

  it('deduplicates alerts within 5 minutes', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockEval.mockRejectedValue(new Error('down'));

    await checkRateLimit('API', '/a', 'u1');
    await checkRateLimit('API', '/b', 'u1');

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

// ---- No Redis configured ----

describe('no Redis', () => {
  it('allows all requests when REDIS_URL is unset', async () => {
    const mod = await import('../redis-client');
    vi.mocked(mod.getRedisClient).mockReturnValueOnce(null);
    const result = await checkRateLimit('API', '/test', 'user1');
    expect(result.allowed).toBe(true);
  });
});

// ---- getClientIdentifier ----

describe('getClientIdentifier', () => {
  const makeReq = (headers: Record<string, string> = {}) =>
    new Request('http://localhost', {
      headers: new Headers(headers),
    });

  it('returns userId when provided', () => {
    expect(getClientIdentifier(makeReq(), 'uid123')).toBe('uid123');
  });

  it('returns x-forwarded-for first IP when TRUST_PROXY=true', () => {
    process.env.TRUST_PROXY = 'true';
    const id = getClientIdentifier(
      makeReq({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }),
    );
    expect(id).toBe('1.2.3.4');
    delete process.env.TRUST_PROXY;
  });

  it('ignores x-forwarded-for when TRUST_PROXY is not set', () => {
    delete process.env.TRUST_PROXY;
    const id = getClientIdentifier(
      makeReq({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '9.9.9.9' }),
    );
    expect(id).toBe('9.9.9.9');
  });

  it('falls back to unknown', () => {
    delete process.env.TRUST_PROXY;
    expect(getClientIdentifier(makeReq())).toBe('unknown');
  });
});
