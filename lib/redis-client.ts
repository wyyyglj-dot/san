import Redis from 'ioredis';

let client: Redis | null = null;

const CONNECT_TIMEOUT = 200;
const COMMAND_TIMEOUT = 200;
const MAX_RETRIES = 1;

export function getRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (client) return client;

  client = new Redis(url, {
    connectTimeout: CONNECT_TIMEOUT,
    commandTimeout: COMMAND_TIMEOUT,
    maxRetriesPerRequest: MAX_RETRIES,
    retryStrategy(times) {
      // Always retry with capped delay to allow reconnection after Redis restart
      return Math.min(times * 200, 5000);
    },
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on('error', () => {
    // Errors handled at call site via fail-open
  });

  client.connect().catch(() => {
    // Connection failure handled at call site
  });

  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => {});
    client = null;
  }
}

/** Reset singleton for testing */
export function _resetForTest(): void {
  client = null;
}
