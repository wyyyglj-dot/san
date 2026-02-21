/* eslint-disable no-console */

import { getSystemConfig } from './db';

const ENV_OVERRIDE = process.env.SORA_LOG_VERBOSE;
const CACHE_TTL_MS = 30_000;

let _cachedVerbose: boolean | null = null;
let _cachedAt = 0;
let _refreshPromise: Promise<void> | null = null;

function getEnvOverride(): boolean | null {
  if (ENV_OVERRIDE === 'true') return true;
  if (ENV_OVERRIDE === 'false') return false;
  return null;
}

function isVerbose(): boolean {
  const override = getEnvOverride();
  if (override !== null) return override;
  const now = Date.now();
  if (_cachedVerbose === null || now - _cachedAt >= CACHE_TTL_MS) {
    void refreshVerboseFlag();
  }
  return _cachedVerbose ?? false;
}

export async function refreshVerboseFlag(): Promise<void> {
  if (getEnvOverride() !== null) return;

  const now = Date.now();
  if (_cachedVerbose !== null && now - _cachedAt < CACHE_TTL_MS) return;

  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const config = await getSystemConfig();
      _cachedVerbose = Boolean(config.soraLogVerbose);
      _cachedAt = Date.now();
    } catch {
      _cachedVerbose = _cachedVerbose ?? false;
      _cachedAt = Date.now();
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

export function vLog(value: string | undefined | null, maxLen = 200): string {
  if (value == null) return '';
  if (isVerbose()) return value;
  return value.length > maxLen ? value.substring(0, maxLen) + '...' : value;
}

export { isVerbose as isSoraVerbose };
