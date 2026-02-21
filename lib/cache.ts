// ========================================
// 简单内存缓存（支持 TTL）
// ========================================

interface CacheEntry<T> {
  value: T;
  expireAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 每分钟清理过期缓存
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.cache.set(key, {
      value,
      expireAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  // 删除匹配前缀的所有缓存
  deleteByPrefix(prefix: string): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    });
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    entries.forEach(([key, entry]) => {
      if (now > entry.expireAt) {
        this.cache.delete(key);
      }
    });
  }

  // 获取缓存统计
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// 全局缓存实例
export const cache = new MemoryCache();

// 缓存键前缀
export const CacheKeys = {
  USER: 'user:',
  SYSTEM_CONFIG: 'system_config',
  CHAT_MODELS: 'chat_models',
  GALLERY: 'gallery:',
  USER_GENERATIONS: 'user_generations:',
} as const;

// 缓存 TTL（秒）
export const CacheTTL = {
  USER: 60,           // 用户信息 1 分钟
  SYSTEM_CONFIG: 300, // 系统配置 5 分钟
  CHAT_MODELS: 300,   // 聊天模型 5 分钟
  GALLERY: 120,       // 画廊 2 分钟
  USER_GENERATIONS: 30, // 用户生成记录 30 秒
} as const;

// 带缓存的函数包装器
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const result = await fn();
  cache.set(key, result, ttlSeconds);
  return result;
}
