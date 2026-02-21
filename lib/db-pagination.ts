/**
 * Normalize pagination parameters to safe integers within bounds.
 */
export function normalizePagination(
  rawLimit?: unknown,
  rawOffset?: unknown
): { limit: number; offset: number } {
  const rawLimitNum = Number(rawLimit);
  const rawOffsetNum = Number(rawOffset);
  const limit = Math.max(1, Math.min(100, Math.floor(Number.isFinite(rawLimitNum) ? rawLimitNum : 20)));
  const offset = Math.max(0, Math.floor(Number.isFinite(rawOffsetNum) ? rawOffsetNum : 0));
  return { limit, offset };
}

/**
 * Append parameterized LIMIT/OFFSET to a SQL query.
 * Mutates the params array in place.
 */
export function appendLimitOffset(
  sql: string,
  params: unknown[],
  limit: number,
  offset: number
): string {
  params.push(limit, offset);
  return `${sql} LIMIT ? OFFSET ?`;
}

/**
 * Append parameterized LIMIT (no offset) to a SQL query.
 */
export function appendLimit(
  sql: string,
  params: unknown[],
  limit: number
): string {
  params.push(limit);
  return `${sql} LIMIT ?`;
}
