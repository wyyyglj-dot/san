import { describe, it, expect } from 'vitest';
import { generateWebhookToken, hashToken } from '../webhook-token';

describe('webhook-token', () => {
  describe('generateWebhookToken', () => {
    it('generates a base64url string', () => {
      const token = generateWebhookToken();
      expect(token).toBeTruthy();
      expect(token.length).toBeGreaterThan(30);
      // base64url: no +, /, or =
      expect(token).not.toMatch(/[+/=]/);
    });

    it('generates unique tokens', () => {
      const tokens = new Set(Array.from({ length: 10 }, () => generateWebhookToken()));
      expect(tokens.size).toBe(10);
    });
  });

  describe('hashToken', () => {
    it('returns a 64-char hex string (SHA-256)', () => {
      const hash = hashToken('test-token');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic', () => {
      const a = hashToken('same-input');
      const b = hashToken('same-input');
      expect(a).toBe(b);
    });

    it('differs for different inputs', () => {
      const a = hashToken('token-a');
      const b = hashToken('token-b');
      expect(a).not.toBe(b);
    });
  });
});
