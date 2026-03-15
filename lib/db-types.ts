/**
 * Database query result row type.
 * All db.execute() SELECT results return arrays of this type.
 *
 * Uses `any` for values to avoid hundreds of explicit casts in row-mapping code.
 * Centralising the `any` here (instead of scattering `as any[]` across db files)
 * provides a single upgrade point when stricter typing is desired.
 */
export type DbRow = Record<string, any>;

/**
 * Extract affectedRows from a write operation result.
 *
 * MySQL returns ResultSetHeader as the first tuple element with `.affectedRows`.
 * SQLite adapter returns `{ affectedRows, insertId }` as the second tuple element,
 * but also places `.changes` on the result for compatibility.
 *
 * This helper normalises both patterns into a single number.
 */
export function getAffectedRows(result: unknown): number {
  if (result == null) return 0;
  const r = result as Record<string, unknown>;
  return Number(r.affectedRows ?? r.changes ?? 0);
}

/**
 * Extract insertId from a write operation result.
 */
export function getInsertId(result: unknown): number {
  if (result == null) return 0;
  const r = result as Record<string, unknown>;
  return Number(r.insertId ?? 0);
}
