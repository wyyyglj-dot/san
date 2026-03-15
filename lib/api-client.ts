'use client';

// ---------------------------------------------------------------------------
// Client-side API fetch wrapper
// - 10s timeout via AbortController
// - credentials: same-origin
// - Envelope validation: { success, data?, error?, code? }
// - 401 → redirect to login
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT = 10_000;

/** Client-side API error (safe for browser, no server imports) */
export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 0, code = 'UNKNOWN') {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

/** Standard API envelope returned by all backend routes */
export interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  requestId?: string;
}

export type ApiFetchOptions = Omit<RequestInit, 'signal'> & {
  /** Override default 10s timeout (ms). 0 = no timeout. */
  timeout?: number;
  /** Skip automatic 401 redirect (e.g. for login route itself) */
  skipAuthRedirect?: boolean;
};

/**
 * Unified fetch wrapper for all client-side API calls.
 *
 * @throws {ApiClientError} on network / timeout / protocol / business errors
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, skipAuthRedirect = false, ...init } = options;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  if (timeout > 0) {
    timer = setTimeout(() => controller.abort(), timeout);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiClientError('请求超时', 0, 'UPSTREAM_TIMEOUT');
    }
    throw new ApiClientError('网络错误', 0, 'NETWORK_ERROR');
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  // 401 → redirect to login
  if (res.status === 401 && !skipAuthRedirect) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiClientError('未登录', 401, 'AUTH_ERROR');
  }

  // Parse JSON envelope
  let body: ApiEnvelope<T>;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError('响应格式异常', res.status, 'PARSE_ERROR');
  }

  // Envelope validation
  if (typeof body !== 'object' || body === null || typeof body.success !== 'boolean') {
    throw new ApiClientError('响应格式异常', res.status, 'PROTOCOL_ERROR');
  }

  if (!body.success) {
    throw new ApiClientError(
      body.error ?? '操作失败',
      res.status,
      body.code ?? 'BUSINESS_ERROR',
    );
  }

  // Non-2xx with success=true is a protocol inconsistency
  if (!res.ok) {
    throw new ApiClientError(`HTTP ${res.status}`, res.status, 'HTTP_ERROR');
  }

  return body.data as T;
}

// ---------------------------------------------------------------------------
// Convenience helpers for common HTTP methods
// ---------------------------------------------------------------------------

export function apiGet<T = unknown>(url: string, opts?: ApiFetchOptions) {
  return apiFetch<T>(url, { method: 'GET', ...opts });
}

export function apiPost<T = unknown>(url: string, body?: unknown, opts?: ApiFetchOptions) {
  const { headers, ...rest } = opts ?? {};
  return apiFetch<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });
}

export function apiPut<T = unknown>(url: string, body?: unknown, opts?: ApiFetchOptions) {
  const { headers, ...rest } = opts ?? {};
  return apiFetch<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });
}

export function apiPatch<T = unknown>(url: string, body?: unknown, opts?: ApiFetchOptions) {
  const { headers, ...rest } = opts ?? {};
  return apiFetch<T>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });
}

export function apiDelete<T = unknown>(url: string, opts?: ApiFetchOptions) {
  return apiFetch<T>(url, { method: 'DELETE', ...opts });
}
