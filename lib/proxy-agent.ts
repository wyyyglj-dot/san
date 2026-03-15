/* eslint-disable no-console */
import { ProxyAgent } from 'undici';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { getSystemConfig } from './db';

interface ProxyConfig {
  enabled: boolean;
  url: string;
}

// 缓存：避免每次请求都创建新 Agent
let cachedAgent: { key: string; agent: any } | null = null;

export function parseProxyUrl(url: string): { protocol: string; host: string; port: number } {
  const parsed = new URL(url);
  return {
    protocol: parsed.protocol.replace(':', ''),
    host: parsed.hostname,
    port: parseInt(parsed.port) || (parsed.protocol === 'socks5:' ? 1080 : 7890),
  };
}

export async function getProxyDispatcher(channelProxyUrl?: string): Promise<any | undefined> {
  const config = await getSystemConfig();
  const globalProxy: ProxyConfig = {
    enabled: config.proxyEnabled ?? false,
    url: config.proxyUrl ?? '',
  };

  // 渠道级覆盖 > 全局
  const effectiveUrl = channelProxyUrl || (globalProxy.enabled ? globalProxy.url : '');
  if (!effectiveUrl) return undefined;

  // 缓存命中
  if (cachedAgent && cachedAgent.key === effectiveUrl) {
    return cachedAgent.agent;
  }

  let agent: any;
  if (effectiveUrl.startsWith('socks')) {
    agent = new SocksProxyAgent(effectiveUrl);
  } else {
    agent = new ProxyAgent({
      uri: effectiveUrl,
      requestTls: { timeout: 30000 },
    });
  }

  cachedAgent = { key: effectiveUrl, agent };
  return agent;
}

// 清除缓存（配置变更时调用）
export function clearProxyCache() {
  cachedAgent = null;
}
