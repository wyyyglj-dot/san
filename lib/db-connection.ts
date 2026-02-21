/* eslint-disable no-console */
import { createDatabaseAdapter, type DatabaseAdapter } from './db-adapter';

type HealthState = 'healthy' | 'degraded' | 'unhealthy';

declare global {
  // eslint-disable-next-line no-var
  var __dbAdapter: DatabaseAdapter | undefined;
  // eslint-disable-next-line no-var
  var __dbHealth: {
    state: HealthState;
    consecutiveFailures: number;
    timer: ReturnType<typeof setInterval> | null;
    rebuilding: boolean;
    lastRebuildAttempt: number;
  } | undefined;
}

const HEALTH_CHECK_INTERVAL = 30_000; // 30s
const HEALTH_CHECK_TIMEOUT = 2_000;   // 2s
const REBUILD_COOLDOWN = 30_000;      // 30s

function getHealth() {
  if (!globalThis.__dbHealth) {
    globalThis.__dbHealth = {
      state: 'healthy',
      consecutiveFailures: 0,
      timer: null,
      rebuilding: false,
      lastRebuildAttempt: 0,
    };
  }
  return globalThis.__dbHealth;
}

function updateState(health: ReturnType<typeof getHealth>): void {
  const prev = health.state;
  if (health.consecutiveFailures === 0) {
    health.state = 'healthy';
  } else if (health.consecutiveFailures <= 2) {
    health.state = 'degraded';
  } else {
    health.state = 'unhealthy';
  }
  if (prev !== health.state) {
    console.log(`[DB Health] ${prev} → ${health.state} (failures: ${health.consecutiveFailures})`);
  }
}

async function runHealthCheck(): Promise<void> {
  const adapter = globalThis.__dbAdapter;
  if (!adapter) return;

  const health = getHealth();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
    await adapter.execute('SELECT 1');
    clearTimeout(timeout);
    health.consecutiveFailures = 0;
  } catch {
    health.consecutiveFailures++;
  }

  updateState(health);

  // Trigger rebuild if unhealthy
  if (health.state === 'unhealthy' && !health.rebuilding) {
    const now = Date.now();
    if (now - health.lastRebuildAttempt > REBUILD_COOLDOWN) {
      health.rebuilding = true;
      health.lastRebuildAttempt = now;
      console.log('[DB Health] Triggering pool rebuild...');
      try {
        await globalThis.__dbAdapter?.close();
        globalThis.__dbAdapter = createDatabaseAdapter();
        health.consecutiveFailures = 0;
        updateState(health);
        console.log('[DB Health] Pool rebuilt successfully');
      } catch (err) {
        console.error('[DB Health] Pool rebuild failed:', err);
      } finally {
        health.rebuilding = false;
      }
    }
  }
}

function startHealthCheck(): void {
  const health = getHealth();
  const dbType = process.env.DB_TYPE || 'sqlite';
  // Only run health checks for MySQL (SQLite doesn't need them)
  if (dbType !== 'mysql' || health.timer) return;

  health.timer = setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL);
  // Don't prevent process exit
  if (health.timer && typeof health.timer === 'object' && 'unref' in health.timer) {
    health.timer.unref();
  }
}

export function getSharedAdapter(): DatabaseAdapter {
  if (!globalThis.__dbAdapter) {
    globalThis.__dbAdapter = createDatabaseAdapter();
    console.log(`[DB] 使用数据库类型: ${process.env.DB_TYPE || 'sqlite'}`);
    startHealthCheck();
  }
  return globalThis.__dbAdapter;
}

export function getDbHealthState(): HealthState {
  return getHealth().state;
}

export async function closeAdapter(): Promise<void> {
  const health = getHealth();
  if (health.timer) {
    clearInterval(health.timer);
    health.timer = null;
  }
  if (globalThis.__dbAdapter) {
    await globalThis.__dbAdapter.close();
    globalThis.__dbAdapter = undefined;
  }
}
