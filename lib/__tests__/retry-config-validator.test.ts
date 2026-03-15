import { describe, it, expect } from 'vitest';
import {
  getDefaultRetryConfig,
  mergeRetryConfig,
  validateRetryConfig,
  applyHardLimits,
} from '../retry-config-validator';
import type { RetryConfig } from '@/types';

// ---- getDefaultRetryConfig ----

describe('getDefaultRetryConfig', () => {
  it('returns all four strategy keys', () => {
    const cfg = getDefaultRetryConfig();
    expect(cfg).toHaveProperty('http');
    expect(cfg).toHaveProperty('rateLimit');
    expect(cfg).toHaveProperty('soraPolling');
    expect(cfg).toHaveProperty('soraFailed');
  });

  it('returns independent copies each call', () => {
    const a = getDefaultRetryConfig();
    const b = getDefaultRetryConfig();
    a.http.maxAttempts = 999;
    expect(b.http.maxAttempts).not.toBe(999);
  });

  it('default http has expected shape', () => {
    const { http } = getDefaultRetryConfig();
    expect(http.enabled).toBe(true);
    expect(http.maxAttempts).toBe(3);
    expect(http.baseDelayMs).toBe(500);
  });
});

// ---- mergeRetryConfig ----

describe('mergeRetryConfig', () => {
  it('returns base when no overrides', () => {
    const base = getDefaultRetryConfig();
    const merged = mergeRetryConfig(base);
    expect(merged.http.maxAttempts).toBe(base.http.maxAttempts);
  });

  it('partial override only affects specified fields', () => {
    const base = getDefaultRetryConfig();
    const merged = mergeRetryConfig(base, {
      http: { ...base.http, maxAttempts: 7 },
    });
    expect(merged.http.maxAttempts).toBe(7);
    expect(merged.rateLimit.maxAttempts).toBe(base.rateLimit.maxAttempts);
  });
});

// ---- validateRetryConfig ----

describe('validateRetryConfig', () => {
  it('returns no errors for default config', () => {
    const errors = validateRetryConfig(getDefaultRetryConfig());
    expect(errors).toEqual([]);
  });

  it('reports negative maxAttempts', () => {
    const cfg = getDefaultRetryConfig();
    cfg.http.maxAttempts = -1;
    const errors = validateRetryConfig(cfg);
    expect(errors.some((e) => e.includes('http.maxAttempts'))).toBe(true);
  });

  it('reports NaN baseDelayMs', () => {
    const cfg = getDefaultRetryConfig();
    cfg.http.baseDelayMs = NaN;
    const errors = validateRetryConfig(cfg);
    expect(errors.some((e) => e.includes('http.baseDelayMs'))).toBe(true);
  });

  it('reports maxDelayMs < baseDelayMs', () => {
    const cfg = getDefaultRetryConfig();
    cfg.rateLimit.baseDelayMs = 5000;
    cfg.rateLimit.maxDelayMs = 1000;
    const errors = validateRetryConfig(cfg);
    expect(errors.some((e) => e.includes('rateLimit.maxDelayMs'))).toBe(true);
  });

  it('reports jitterRatio out of range', () => {
    const cfg = getDefaultRetryConfig();
    cfg.http.jitterRatio = 0.9;
    const errors = validateRetryConfig(cfg);
    expect(errors.some((e) => e.includes('jitterRatio'))).toBe(true);
  });
});

// ---- applyHardLimits ----

describe('applyHardLimits', () => {
  it('clamps maxAttempts to hard limit', () => {
    const cfg = getDefaultRetryConfig();
    cfg.http.maxAttempts = 999;
    const result = applyHardLimits(cfg);
    expect(result.http.maxAttempts).toBeLessThanOrEqual(10);
  });

  it('preserves valid values', () => {
    const cfg = getDefaultRetryConfig();
    const result = applyHardLimits(cfg);
    expect(result.http.maxAttempts).toBe(3);
    expect(result.http.baseDelayMs).toBe(500);
  });

  it('ensures maxDelayMs >= baseDelayMs after clamping', () => {
    const cfg = getDefaultRetryConfig();
    cfg.http.baseDelayMs = 3000;
    cfg.http.maxDelayMs = 1000;
    const result = applyHardLimits(cfg);
    expect(result.http.maxDelayMs).toBeGreaterThanOrEqual(result.http.baseDelayMs);
  });

  it('clamps soraPolling.maxPollDurationMs', () => {
    const cfg = getDefaultRetryConfig();
    cfg.soraPolling.maxPollDurationMs = 999999999;
    const result = applyHardLimits(cfg);
    expect(result.soraPolling.maxPollDurationMs).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});
