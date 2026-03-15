import { NextResponse } from 'next/server';

export type ApiErrorPayload = {
  success: false;
  error: string;
  code?: string;
};

type ApiErrorOptions = {
  status?: number;
  code?: string;
  expose?: boolean;
  cause?: unknown;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  expose: boolean;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 500;
    this.code = options.code;
    this.expose = options.expose ?? false;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', expose: true, cause });
    this.name = 'ValidationError';
  }
}

export class AuthError extends ApiError {
  constructor(message = '未登录', cause?: unknown) {
    super(message, { status: 401, code: 'AUTH_ERROR', expose: true, cause });
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = '无权限', cause?: unknown) {
    super(message, { status: 403, code: 'FORBIDDEN', expose: true, cause });
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = '资源不存在', cause?: unknown) {
    super(message, { status: 404, code: 'NOT_FOUND', expose: true, cause });
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message = '请求过于频繁，请稍后再试', cause?: unknown) {
    super(message, { status: 429, code: 'RATE_LIMIT', expose: true, cause });
    this.name = 'RateLimitError';
  }
}

function normalizeApiError(error: unknown, fallbackMessage: string): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof Error) {
    return new ApiError(fallbackMessage, { status: 500, code: 'INTERNAL_ERROR', expose: false, cause: error });
  }
  return new ApiError(fallbackMessage, { status: 500, code: 'INTERNAL_ERROR', expose: false });
}

export function buildErrorResponse(
  error: unknown,
  options: { fallbackMessage?: string; context?: string } = {}
): NextResponse<ApiErrorPayload> {
  const fallbackMessage = options.fallbackMessage ?? '操作失败';
  const apiError = normalizeApiError(error, fallbackMessage);
  if (!apiError.expose) {
    console.error(options.context ?? '[API] Error', error);
  }
  const message = apiError.expose ? apiError.message : fallbackMessage;
  const payload: ApiErrorPayload = { success: false, error: message };
  if (apiError.code) {
    payload.code = apiError.code;
  }
  return NextResponse.json(payload, { status: apiError.status });
}
