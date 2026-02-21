import { describe, it, expect } from 'vitest';
import { validateBody } from '../validate';
import { registerSchema } from '../schemas/auth';
import { changePasswordSchema } from '../schemas/user';

function makeReq(body: unknown): Request {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeBadReq(): Request {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not json',
  });
}

// ---- Unknown key rejection (strict mode) ----

describe('validateBody strict mode', () => {
  it('rejects unknown keys', async () => {
    const result = await validateBody(
      makeReq({ currentPassword: 'old', newPassword: 'newpass', extra: 'bad' }),
      changePasswordSchema,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const json = await result.response.json();
      expect(result.response.status).toBe(422);
      expect(json.code).toBe('VALIDATION_ERROR');
    }
  });
});

// ---- Empty string coercion ----

describe('empty string handling', () => {
  it('coerces empty strings to undefined', async () => {
    const result = await validateBody(
      makeReq({ currentPassword: '', newPassword: 'newpass' }),
      changePasswordSchema,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const json = await result.response.json();
      expect(json.issues[0].path).toBe('currentPassword');
    }
  });
});

// ---- Type coercion ----

describe('type validation', () => {
  it('rejects wrong types', async () => {
    const result = await validateBody(
      makeReq({ currentPassword: 123, newPassword: 'newpass' }),
      changePasswordSchema,
    );
    expect(result.success).toBe(false);
  });
});

// ---- 422 response format ----

describe('422 response format', () => {
  it('returns correct envelope', async () => {
    const result = await validateBody(
      makeReq({ name: '', email: 'bad', password: '12' }),
      registerSchema,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(422);
      const json = await result.response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.error).toBe('输入校验失败');
      expect(Array.isArray(json.issues)).toBe(true);
      expect(json.issues.length).toBeGreaterThan(0);
    }
  });

  it('returns 422 for malformed JSON', async () => {
    const result = await validateBody(makeBadReq(), registerSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(422);
    }
  });
});

// ---- Valid input ----

describe('valid input', () => {
  it('passes valid register input', async () => {
    const result = await validateBody(
      makeReq({ name: 'test', email: 'a@b.com', password: '123456' }),
      registerSchema,
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: 'test',
        email: 'a@b.com',
        password: '123456',
      });
    }
  });

  it('passes valid password change input', async () => {
    const result = await validateBody(
      makeReq({ currentPassword: 'old123', newPassword: 'new123' }),
      changePasswordSchema,
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentPassword).toBe('old123');
      expect(result.data.newPassword).toBe('new123');
    }
  });
});
