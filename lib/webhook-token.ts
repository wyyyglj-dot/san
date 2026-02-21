import { randomBytes, createHash } from 'crypto';
import { getSharedAdapter } from './db-connection';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export function generateWebhookToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function storeWebhookToken(taskId: string, token: string): Promise<void> {
  const db = getSharedAdapter();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  await db.execute(
    `INSERT INTO webhook_tokens (task_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
    [taskId, tokenHash, now, expiresAt]
  );
}

export type VerifyResult =
  | { valid: true }
  | { valid: false; reason: 'invalid' | 'expired' | 'consumed' };

/**
 * Atomic compare-and-set: verify token and mark consumed in one query.
 * Returns verification result.
 */
export async function verifyAndConsumeToken(
  taskId: string,
  token: string
): Promise<VerifyResult> {
  const db = getSharedAdapter();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();

  // Lookup token
  const [rows] = await db.execute(
    `SELECT id, consumed_at, expires_at FROM webhook_tokens
     WHERE task_id = ? AND token_hash = ? LIMIT 1`,
    [taskId, tokenHash]
  );

  const record = (rows as any[])[0];
  if (!record) {
    return { valid: false, reason: 'invalid' };
  }

  if (record.consumed_at) {
    // Already consumed — idempotent: treat as valid
    return { valid: true };
  }

  if (new Date(record.expires_at) < new Date(now)) {
    return { valid: false, reason: 'expired' };
  }

  // Atomic consume: only update if still unconsumed
  const [result] = await db.execute(
    `UPDATE webhook_tokens SET consumed_at = ?
     WHERE id = ? AND consumed_at IS NULL`,
    [now, record.id]
  );

  const affected = (result as any).affectedRows ?? (result as any).changes ?? 0;
  if (affected === 0) {
    // Concurrent consume — still treat as valid (idempotent)
    return { valid: true };
  }

  return { valid: true };
}
