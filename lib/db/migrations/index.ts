import type { Migration } from '../migration-runner';

/**
 * Baseline migration: records existing schema as already applied.
 * This covers all ALTER TABLE operations that were previously inline in db.ts.
 */
export const baseline: Migration = {
  id: '00000000_baseline',
  sql: '-- Baseline: existing schema already applied',
  isDDL: true,
};

/**
 * Add webhook_tokens table.
 */
export const addWebhookTokens: Migration = {
  id: '20260221_add_webhook_tokens',
  sql: `
    CREATE TABLE IF NOT EXISTS webhook_tokens (
      id INTEGER PRIMARY KEY AUTO_INCREMENT,
      task_id VARCHAR(36) NOT NULL,
      token_hash VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL,
      consumed_at DATETIME DEFAULT NULL,
      expires_at DATETIME NOT NULL,
      INDEX idx_task_token (task_id, token_hash)
    )
  `,
  isDDL: true,
};

/** All migrations in order */
export const allMigrations: Migration[] = [
  baseline,
  addWebhookTokens,
];
