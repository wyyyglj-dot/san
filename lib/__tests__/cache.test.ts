import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cache, CacheKeys, CacheTTL, withCache } from '../cache';

beforeEach(() => {
  // clean slate
  cache.deleteByPrefix('');
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---- basic set / get ----

describe('cache set/get', () => {
  it('stores and retrieves a value', () => {
    cache.set('k1', 'hello', 60);
    expect(cache.get('k1')).toBe('hello');
  });

  it('returns null for missing key', () => {
    expect(cache.get('nope')).toBeNull();
  });
});

// ---- TTL expiry ----

describe('cache TTL', () => {
  it('returns null after TTL expires', () => {
    cache.set('ttl', 'val', 5);
    vi.advanceTimersByTime(6000);
    expect(cache.get('ttl')).toBeNull();
  });

  it('returns value before TTL expires', () => {
    cache.set('ttl2', 'val', 10);
    vi.advanceTimersByTime(5000);
    expect(cache.get('ttl2')).toBe('val');
  });
});

// ---- delete / deleteByPrefix ----

describe('cache delete', () => {
  it('deletes a single key', () => {
    cache.set('d1', 1, 60);
    cache.delete('d1');
    expect(cache.get('d1')).toBeNull();
  });

  it('deletes by prefix', () => {
    cache.set('user:1', 'a', 60);
    cache.set('user:2', 'b', 60);
    cache.set('other:1', 'c', 60);
    cache.deleteByPrefix('user:');
    expect(cache.get('user:1')).toBeNull();
    expect(cache.get('user:2')).toBeNull();
    expect(cache.get('other:1')).toBe('c');
  });
});

// ---- stats ----

describe('cache stats', () => {
  it('reports size and keys', () => {
    cache.set('s1', 1, 60);
    cache.set('s2', 2, 60);
    const s = cache.stats();
    expect(s.size).toBe(2);
    expect(s.keys).toContain('s1');
    expect(s.keys).toContain('s2');
  });
});

// ---- withCache ----

describe('withCache', () => {
  it('calls fn on cache miss and caches result', async () => {
    const fn = vi.fn().mockResolvedValue('fresh');
    const result = await withCache('wc1', 60, fn);
    expect(result).toBe('fresh');
    expect(fn).toHaveBeenCalledOnce();

    // second call should hit cache
    const result2 = await withCache('wc1', 60, fn);
    expect(result2).toBe('fresh');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('re-fetches after TTL expires', async () => {
    const fn = vi.fn().mockResolvedValue('v1');
    await withCache('wc2', 2, fn);
    vi.advanceTimersByTime(3000);
    fn.mockResolvedValue('v2');
    const result = await withCache('wc2', 2, fn);
    expect(result).toBe('v2');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
