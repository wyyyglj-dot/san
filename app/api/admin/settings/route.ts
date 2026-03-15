import { NextRequest, NextResponse } from 'next/server';
import { getSystemConfig, updateSystemConfig } from '@/lib/db';
import { applyHardLimits, getDefaultRetryConfig, mergeRetryConfig, validateRetryConfig } from '@/lib/retry-config-validator';
import { adminHandler } from '@/lib/api-handler';
import { clearProxyCache } from '@/lib/proxy-agent';

export const GET = adminHandler(async () => {
  const config = await getSystemConfig();
  return NextResponse.json({ success: true, data: config });
}, { fallbackMessage: '获取配置失败', context: '[API] settings GET' });

export const POST = adminHandler(async (request: Request) => {
  const updates = await request.json();

  const current = await getSystemConfig();
  const nextUpdates: any = { ...updates };

  if (updates.retryConfig !== undefined) {
    const base = current.retryConfig ?? getDefaultRetryConfig();
    const merged = mergeRetryConfig(base, updates.retryConfig as Partial<typeof base>);
    const errors = validateRetryConfig(merged);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: `Invalid retryConfig: ${errors.join(', ')}` },
        { status: 400 }
      );
    }
    nextUpdates.retryConfig = applyHardLimits(merged);
  }

  if (
    typeof updates.soraBackendUrl === 'string' &&
    updates.soraBackendUrl.trim() &&
    updates.soraBackendUrl.trim() !== (current.soraBackendUrl || '').trim()
  ) {
    nextUpdates.soraBackendToken = '';
  }

  // 清除代理缓存（如果代理配置变更）
  if (updates.proxyEnabled !== undefined || updates.proxyUrl !== undefined) {
    clearProxyCache();
  }

  const config = await updateSystemConfig(nextUpdates);
  return NextResponse.json({ success: true, data: config });
}, { fallbackMessage: '更新配置失败', context: '[API] settings POST' });
