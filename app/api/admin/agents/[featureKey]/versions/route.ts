import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/api-handler';
import { ApiError } from '@/lib/api-error';
import { getAgentVersions, rollbackAgent, getAgentByKey } from '@/lib/db-agent';
import { toSafeAgent } from '@/lib/agent-utils';
import { invalidatePromptCache } from '@/lib/prompt-service';

export const dynamic = 'force-dynamic';

// GET - 获取版本历史列表
export const GET = adminHandler(async (_req, ctx) => {
  const { featureKey } = ctx.params;
  const versions = await getAgentVersions(featureKey);
  return NextResponse.json({ success: true, data: versions });
}, { fallbackMessage: '获取失败', context: '[API] Get agent versions error' });

// POST - 回滚到指定版本
export const POST = adminHandler(async (req, ctx, session) => {
  const { featureKey } = ctx.params;
  const body = await req.json().catch(() => ({}));
  const { targetVersion } = body;

  if (!targetVersion || typeof targetVersion !== 'number' || !Number.isInteger(targetVersion) || targetVersion < 1) {
    return NextResponse.json(
      { success: false, error: 'targetVersion 必须为正整数' },
      { status: 400 }
    );
  }

  const agent = await getAgentByKey(featureKey);
  if (!agent) {
    return NextResponse.json({ success: false, error: 'Agent 不存在' }, { status: 404 });
  }

  try {
    const updated = await rollbackAgent(
      featureKey,
      targetVersion,
      session.user.email || 'admin'
    );
    if (!updated) {
      return NextResponse.json({ success: false, error: '目标版本不存在' }, { status: 404 });
    }

    invalidatePromptCache(featureKey);
    return NextResponse.json({ success: true, data: toSafeAgent(updated) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '回滚失败';
    if (msg.includes('并发冲突')) {
      throw new ApiError(msg, { status: 409, expose: true });
    }
    throw error;
  }
}, { fallbackMessage: '回滚失败', context: '[API] Rollback agent error' });
