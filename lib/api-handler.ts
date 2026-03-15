import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { buildErrorResponse } from './api-error';
import { checkRateLimit, getClientIdentifier, type RateLimitScope } from './rate-limiter';
import { validateBody } from './validate';
import type { ZodSchema } from 'zod';
import type { Session } from 'next-auth';

type UserRole = 'admin' | 'moderator' | 'user';

interface HandlerOptions {
  auth?: { role?: UserRole; roles?: UserRole[] };
  rateLimit?: { scope: RateLimitScope; route?: string };
  schema?: ZodSchema;
  fallbackMessage?: string;
  context?: string;
}

type RouteContext = { params: Record<string, string> };

export function createHandler(
  options: HandlerOptions,
  handler: (req: Request, ctx: RouteContext, session: Session) => Promise<NextResponse>
) {
  return async (req: Request, ctx: RouteContext = { params: {} }) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ success: false, error: '未登录', code: 'AUTH_ERROR' }, { status: 401 });
      }
      if (options.auth?.role && session.user.role !== options.auth.role) {
        return NextResponse.json({ success: false, error: '无权限', code: 'FORBIDDEN' }, { status: 403 });
      }
      if (options.auth?.roles && !options.auth.roles.includes(session.user.role as UserRole)) {
        return NextResponse.json({ success: false, error: '无权限', code: 'FORBIDDEN' }, { status: 403 });
      }

      // Rate limiting: after auth, before business logic
      if (options.rateLimit) {
        const url = new URL(req.url, 'http://localhost');
        const route = options.rateLimit.route ?? url.pathname;
        const identifier = getClientIdentifier(req, session.user?.id);
        const rl = await checkRateLimit(options.rateLimit.scope, route, identifier);
        if (!rl.allowed) {
          const res = NextResponse.json(
            { success: false, error: '请求过于频繁，请稍后再试', code: 'RATE_LIMIT' },
            { status: 429 },
          );
          for (const [k, v] of Object.entries(rl.headers)) {
            res.headers.set(k, v);
          }
          return res;
        }
      }

      // Input validation: after rate limit, before business logic
      const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'];
      if (options.schema && mutating.includes(req.method)) {
        const validation = await validateBody(req, options.schema);
        if (!validation.success) {
          return validation.response;
        }
        // Patch req.json so downstream handlers can re-read the validated body
        const parsed = validation.data;
        (req as { json: () => Promise<unknown> }).json = async () => parsed;
      }

      return await handler(req, ctx, session);
    } catch (error) {
      return buildErrorResponse(error, {
        fallbackMessage: options.fallbackMessage,
        context: options.context,
      });
    }
  };
}

export const adminHandler = (
  handler: (req: Request, ctx: RouteContext, session: Session) => Promise<NextResponse>,
  options?: Omit<HandlerOptions, 'auth'>
) => createHandler({ ...options, auth: { role: 'admin' } }, handler);

export const authHandler = (
  handler: (req: Request, ctx: RouteContext, session: Session) => Promise<NextResponse>,
  options?: Omit<HandlerOptions, 'auth'>
) => createHandler({ ...options, auth: {} }, handler);
