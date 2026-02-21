import { describe, it, expect } from 'vitest';
import { cn, truncate, formatBalance } from '../utils';

// ---- cn ----

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('handles tailwind conflicts (last wins)', () => {
    const result = cn('p-4', 'p-2');
    expect(result).toBe('p-2');
  });

  it('handles empty / falsy inputs', () => {
    expect(cn('', undefined, null, 'x')).toBe('x');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });
});

// ---- truncate ----

describe('truncate', () => {
  it('returns original when shorter than limit', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });

  it('returns original when equal to limit', () => {
    expect(truncate('abc', 3)).toBe('abc');
  });

  it('truncates and appends ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });
});

// ---- formatBalance ----

describe('formatBalance', () => {
  it('formats zero', () => {
    expect(formatBalance(0)).toBe('0');
  });

  it('formats large number with locale separators', () => {
    const result = formatBalance(1234567);
    // zh-CN uses comma separators
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  it('formats negative number', () => {
    const result = formatBalance(-100);
    expect(result).toContain('-');
    expect(result).toContain('100');
  });
});
