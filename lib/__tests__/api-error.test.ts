import { describe, it, expect } from 'vitest';
import { ApiError } from '../api-error';

describe('ApiError', () => {
  it('is an instance of Error', () => {
    const err = new ApiError('boom');
    expect(err).toBeInstanceOf(Error);
  });

  it('has name "ApiError"', () => {
    expect(new ApiError('x').name).toBe('ApiError');
  });

  it('defaults status to 500', () => {
    expect(new ApiError('x').status).toBe(500);
  });

  it('defaults expose to false', () => {
    expect(new ApiError('x').expose).toBe(false);
  });

  it('accepts custom status', () => {
    expect(new ApiError('x', { status: 404 }).status).toBe(404);
  });

  it('accepts custom code', () => {
    expect(new ApiError('x', { code: 'NOT_FOUND' }).code).toBe('NOT_FOUND');
  });

  it('accepts expose = true', () => {
    expect(new ApiError('x', { expose: true }).expose).toBe(true);
  });

  it('stores cause', () => {
    const cause = new Error('root');
    const err = new ApiError('wrap', { cause });
    expect((err as unknown as { cause: Error }).cause).toBe(cause);
  });

  it('preserves message', () => {
    expect(new ApiError('hello').message).toBe('hello');
  });
});
