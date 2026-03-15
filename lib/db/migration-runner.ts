/* eslint-disable no-console */
import { createHash } from 'crypto';
import type { DatabaseAdapter } from '../db-adapter';

export interface Migration {
  id: string;        // e.g. '20260221_add_webhook_tokens'
  sql: string;       // SQL to execute
  isDDL?: boolean;   // DDL cannot be wrapped in transaction (MySQL implicit commit)
}

interface MigrationRecord {
  id: string;
  checksum: string;
  executed_at: string;
  success: number;
}

function computeChecksum(sql: string): string {
  return createHash('sha256').update(sql.trim()).digest('hex').slice(0, 16);
}

async function ensureMigrationsTable(db: DatabaseAdapter): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(100) PRIMARY KEY,
      checksum VARCHAR(16) NOT NULL,
      executed_at DATETIME NOT NULL,
      success TINYINT NOT NULL DEFAULT 1
    )
  `);
}

async function acquireLock(db: DatabaseAdapter, dbType: string): Promise<boolean> {
  if (dbType === 'mysql') {
    const [rows] = await db.execute('SELECT GET_LOCK(?, 10) as acquired', ['sanhub_migration']);
    return (rows as any[])[0]?.acquired === 1;
  }
  // SQLite: single-writer by default, no explicit lock needed
  return true;
}

async function releaseLock(db: DatabaseAdapter, dbType: string): Promise<void> {
  if (dbType === 'mysql') {
    await db.execute('SELECT RELEASE_LOCK(?)', ['sanhub_migration']);
  }
}

/**
 * Run all pending migrations in order.
 * - Checksum drift detection: if a previously executed migration's checksum
 *   doesn't match, throws an error (startup fails).
 * - DDL migrations run outside transactions (MySQL implicit commit).
 * - Non-DDL migrations run inside transactions.
 * - Concurrent lock prevents parallel execution.
 */
export async function runMigrations(
  db: DatabaseAdapter,
  migrations: Migration[],
  options: { dbType?: string; baseline?: boolean } = {}
): Promise<{ applied: string[]; skipped: string[] }> {
  const dbType = options.dbType || process.env.DB_TYPE || 'sqlite';
  await ensureMigrationsTable(db);

  const locked = await acquireLock(db, dbType);
  if (!locked) {
    throw new Error('[Migration] Failed to acquire lock — another migration may be running');
  }

  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    // Load existing records
    const [rows] = await db.execute('SELECT id, checksum, success FROM schema_migrations ORDER BY id');
    const existing = new Map<string, MigrationRecord>();
    for (const row of rows as MigrationRecord[]) {
      existing.set(row.id, row);
    }

    for (const migration of migrations) {
      const checksum = computeChecksum(migration.sql);
      const record = existing.get(migration.id);

      if (record) {
        // Checksum drift detection
        if (record.checksum !== checksum) {
          throw new Error(
            `[Migration] Checksum mismatch for "${migration.id}": ` +
            `expected ${record.checksum}, got ${checksum}. ` +
            `Manual intervention required.`
          );
        }
        skipped.push(migration.id);
        continue;
      }

      // Baseline mode: record without executing
      if (options.baseline) {
        await db.execute(
          'INSERT INTO schema_migrations (id, checksum, executed_at, success) VALUES (?, ?, ?, 1)',
          [migration.id, checksum, new Date().toISOString()]
        );
        skipped.push(migration.id);
        continue;
      }

      // Execute migration
      console.log(`[Migration] Running: ${migration.id}`);
      const now = new Date().toISOString();

      try {
        if (migration.isDDL || dbType === 'sqlite') {
          // DDL or SQLite: execute directly (no transaction wrapping)
          const statements = migration.sql.split(';').filter(s => s.trim());
          for (const stmt of statements) {
            await db.execute(stmt);
          }
        } else {
          // Non-DDL MySQL: wrap in transaction
          await db.runTransaction(async (txDb) => {
            const statements = migration.sql.split(';').filter(s => s.trim());
            for (const stmt of statements) {
              await txDb.execute(stmt);
            }
          });
        }

        await db.execute(
          'INSERT INTO schema_migrations (id, checksum, executed_at, success) VALUES (?, ?, ?, 1)',
          [migration.id, checksum, now]
        );
        applied.push(migration.id);
        console.log(`[Migration] Completed: ${migration.id}`);
      } catch (error) {
        // Record failure
        await db.execute(
          'INSERT INTO schema_migrations (id, checksum, executed_at, success) VALUES (?, ?, ?, 0)',
          [migration.id, checksum, now]
        ).catch(() => { /* ignore recording failure */ });

        throw new Error(
          `[Migration] Failed: ${migration.id} — ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  } finally {
    await releaseLock(db, dbType);
  }

  return { applied, skipped };
}
