import { describe, it, expect } from 'vitest';
import { normalizePagination, appendLimitOffset, appendLimit } from '../db-pagination';

describe('db-pagination', () => {
  describe('normalizePagination', () => {
    it('returns defaults for undefined input', () => {
      expect(normalizePagination()).toEqual({ limit: 20, offset: 0 });
    });

    it('clamps limit to [1, 100]', () => {
      expect(normalizePagination(0).limit).toBe(1);
      expect(normalizePagination(-5).limit).toBe(1);
      expect(normalizePagination(200).limit).toBe(100);
      expect(normalizePagination(50).limit).toBe(50);
    });

    it('floors fractional values', () => {
      expect(normalizePagination(10.9).limit).toBe(10);
      expect(normalizePagination(undefined, 5.7).offset).toBe(5);
    });

    it('clamps offset to >= 0', () => {
      expect(normalizePagination(20, -10).offset).toBe(0);
    });

    it('handles string inputs via Number coercion', () => {
      expect(normalizePagination('15', '30')).toEqual({ limit: 15, offset: 30 });
    });

    it('handles NaN inputs', () => {
      expect(normalizePagination('abc', 'xyz')).toEqual({ limit: 20, offset: 0 });
    });
  });

  describe('appendLimitOffset', () => {
    it('appends LIMIT ? OFFSET ? and pushes params', () => {
      const params: unknown[] = ['existing'];
      const result = appendLimitOffset('SELECT * FROM t', params, 10, 20);
      expect(result).toBe('SELECT * FROM t LIMIT ? OFFSET ?');
      expect(params).toEqual(['existing', 10, 20]);
    });
  });

  describe('appendLimit', () => {
    it('appends LIMIT ? and pushes param', () => {
      const params: unknown[] = [];
      const result = appendLimit('SELECT * FROM t', params, 5);
      expect(result).toBe('SELECT * FROM t LIMIT ?');
      expect(params).toEqual([5]);
    });
  });
});
