import { type ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

export interface ValidationResult<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  response: NextResponse;
}

/**
 * Validate request body against a Zod schema.
 * - strict mode: rejects unknown keys
 * - empty strings coerced to undefined before validation
 */
export async function validateBody<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<ValidationResult<T> | ValidationFailure> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: '请求体格式错误', code: 'VALIDATION_ERROR' },
        { status: 422 },
      ),
    };
  }

  // Coerce empty strings to undefined
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (obj[key] === '') obj[key] = undefined;
    }
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: '输入校验失败',
          code: 'VALIDATION_ERROR',
          issues: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 422 },
      ),
    };
  }

  return { success: true, data: result.data };
}
