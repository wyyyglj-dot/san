import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// Mock dependencies
const mockGetServerSession = vi.fn();
vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock('../auth', () => ({ authOptions: {} }));

const mockBuildErrorResponse = vi.fn((..._: any[]) =>
  NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 }),
);
vi.mock('../api-error', () => ({
  buildErrorResponse: (...args: any[]) => mockBuildErrorResponse(...args),
}));

const mockCheckRateLimit = vi.fn();
const mockGetClientIdentifier = vi.fn((..._: any[]) => 'user1');
vi.mock('../rate-limiter', () => ({
  checkRateLimit: (...args: any[]) => mockCheckRateLimit(...args),
  getClientIdentifier: (...args: any[]) => mockGetClientIdentifier(...args),
}));

const mockValidateBody = vi.fn();
vi.mock('../validate', () => ({
  validateBody: (...args: unknown[]) => mockValidateBody(...args),
}));

import { createHandler, adminHandler, authHandler } from '../api-handler';

// Helpers
const makeReq = (method = 'GET', url = 'http://localhost/api/test') =>
  new Request(url, { method });

const makeSession = (role = 'user') => ({
  user: { id: 'u1', email: 'a@b.com', role },
});

const okHandler = async () =>
  NextResponse.json({ success: true, data: 'ok' });

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 59, headers: {} });
});

// ---- Authentication ----

describe('createHandler – auth', () => {
  it('returns 401 when session is null', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const handler = createHandler({}, okHandler);
    const res = await handler(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('AUTH_ERROR');
  });

  it('returns 401 when session.user is undefined', async () => {
    mockGetServerSession.mockResolvedValue({});
    const handler = createHandler({}, okHandler);
    const res = await handler(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 200 when authenticated with no role requirement', async () => {
    mockGetServerSession.mockResolvedValue(makeSession());
    const handler = createHandler({}, okHandler);
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
  });
});

// ---- Role authorization ----

describe('createHandler – role check', () => {
  it('returns 403 when single role does not match', async () => {
    mockGetServerSession.mockResolvedValue(makeSession('user'));
    const handler = createHandler({ auth: { role: 'admin' } }, okHandler);
    const res = await handler(makeReq());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('FORBIDDEN');
  });

  it('passes when single role matches', async () => {
    mockGetServerSession.mockResolvedValue(makeSession('admin'));
    const handler = createHandler({ auth: { role: 'admin' } }, okHandler);
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
  });

  it('returns 403 when roles array does not include user role', async () => {
    mockGetServerSession.mockResolvedValue(makeSession('user'));
    const handler = createHandler({ auth: { roles: ['admin', 'moderator'] } }, okHandler);
    const res = await handler(makeReq());
    expect(res.status).toBe(403);
  });

  it('passes when roles array includes user role', async () => {
    mockGetServerSession.mockResolvedValue(makeSession('moderator'));
    const handler = createHandler({ auth: { roles: ['admin', 'moderator'] } }, okHandler);
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
  });
});

// ---- Rate limiting ----

describe('createHandler – rate limit', () => {
  it('returns 429 when rate limited', async () => {
    mockGetServerSession.mockResolvedValue(makeSession());
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      headers: { 'Retry-After': '5', 'X-RateLimit-Remaining': '0' },
    });
    const handler = createHandler(
      { rateLimit: { scope: 'API' as const } },
      okHandler,
    );
    const res = await handler(makeReq());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('5');
  });

  it('passes when rate limit allows', async () => {
    mockGetServerSession.mockResolvedValue(makeSession());
    const handler = createHandler(
      { rateLimit: { scope: 'API' as const } },
      okHandler,
    );
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
  });
});

// ---- Input validation ----

describe('createHandler – schema validation', () => {
  it('returns validation error for invalid POST body', async () => {
    mockGetServerSession.mockResolvedValue(makeSession());
    const validationRes = NextResponse.json(
      { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR' },
      { status: 422 },
    );
    mockValidateBody.mockResolvedValue({ success: false, response: validationRes });

    const handler = createHandler(
      { schema: {} as any },
      okHandler,
    );
    const res = await handler(makeReq('POST'));
    expect(res.status).toBe(422);
  });

  it('patches req.json with validated data on success', async () => {
    mockGetServerSession.mockResolvedValue(makeSession());
    mockValidateBody.mockResolvedValue({ success: true, data: { name: 'clean' } });

    let capturedBody: unknown;
    const handler = createHandler(
      { schema: {} as any },
      async (req) => {
        capturedBody = await req.json();
        return NextResponse.json({ success: true });
      },
    );
    const res = await handler(makeReq('POST'));
    expect(res.status).toBe(200);
    expect(capturedBody).toEqual({ name: 'clean' });
  });

  it('skips validation for GET requests', async () => {
    mockGetServerSession.mockResolvedValue(makeSession());
    const handler = createHandler({ schema: {} as any }, okHandler);
    const res = await handler(makeReq('GET'));
    expect(res.status).toBe(200);
    expect(mockValidateBody).not.toHaveBeenCalled();
  });
});

// ---- Error handling ----

describe('createHandler – error handling', () => {
  it('delegates to buildErrorResponse on throw', async () => {
    mockGetServerSession.mockResolvedValue(makeSession());
    const err = new Error('boom');
    const handler = createHandler(
      { fallbackMessage: 'oops', context: 'test' },
      async () => { throw err; },
    );
    await handler(makeReq());
    expect(mockBuildErrorResponse).toHaveBeenCalledWith(err, {
      fallbackMessage: 'oops',
      context: 'test',
    });
  });
});

// ---- Convenience wrappers ----

describe('adminHandler', () => {
  it('requires admin role', async () => {
    mockGetServerSession.mockResolvedValue(makeSession('user'));
    const handler = adminHandler(okHandler);
    const res = await handler(makeReq());
    expect(res.status).toBe(403);
  });

  it('passes for admin user', async () => {
    mockGetServerSession.mockResolvedValue(makeSession('admin'));
    const handler = adminHandler(okHandler);
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
  });
});

describe('authHandler', () => {
  it('requires authentication but no specific role', async () => {
    mockGetServerSession.mockResolvedValue(makeSession('user'));
    const handler = authHandler(okHandler);
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const handler = authHandler(okHandler);
    const res = await handler(makeReq());
    expect(res.status).toBe(401);
  });
});
