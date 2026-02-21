import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/api-handler';
import { ApiError } from '@/lib/api-error';
import { getAgentByKey, updateAgent, deleteAgent } from '@/lib/db-agent';
import { toSafeAgent, compileSystemPrompt, compileUserPromptTemplate, validateAgentConfig, validateAgentInput } from '@/lib/agent-utils';
import { invalidatePromptCache } from '@/lib/prompt-service';
import { getSchemaForFeature } from '@/lib/schema-registry';

export const dynamic = 'force-dynamic';

// GET - 获取单个 Agent 详情
export const GET = adminHandler(async (_req, ctx) => {
  const { featureKey } = ctx.params;
  const agent = await getAgentByKey(featureKey);
  if (!agent) {
    return NextResponse.json({ success: false, error: 'Agent 不存在' }, { status: 404 });
  }

  const safeAgent = toSafeAgent(agent);
  const jsonSchema = getSchemaForFeature(featureKey);
  return NextResponse.json({
    success: true,
    data: { ...safeAgent, ...(jsonSchema ? { jsonSchema } : {}) },
  });
}, { fallbackMessage: '获取失败', context: '[API] Get agent error' });

// PUT - 更新 Agent
export const PUT = adminHandler(async (req, ctx, session) => {
  const { featureKey } = ctx.params;
  const body = await req.json().catch(() => ({}));
  const { name, description, config, enabled, changeSummary } = body;

  if (config) {
    const configCheck = validateAgentConfig(config);
    if (!configCheck.valid) {
      return NextResponse.json({ success: false, error: configCheck.error }, { status: 400 });
    }
  }

  const inputCheck = validateAgentInput(body);
  if (!inputCheck.valid) {
    return NextResponse.json({ success: false, error: inputCheck.error }, { status: 400 });
  }

  const existing = await getAgentByKey(featureKey);
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Agent 不存在' }, { status: 404 });
  }

  let systemPrompt: string | undefined;
  let userPromptTemplate: string | undefined;
  if (config) {
    systemPrompt = compileSystemPrompt(config);
    userPromptTemplate = compileUserPromptTemplate(config);
  }

  try {
    const updated = await updateAgent(featureKey, {
      name,
      description,
      config,
      systemPrompt,
      userPromptTemplate,
      enabled,
      changeSummary: changeSummary || undefined,
      changedBy: session.user.email || 'admin',
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 });
    }

    invalidatePromptCache(featureKey);
    return NextResponse.json({ success: true, data: toSafeAgent(updated) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '更新失败';
    if (msg.includes('并发冲突')) {
      throw new ApiError(msg, { status: 409, expose: true });
    }
    throw error;
  }
}, { fallbackMessage: '更新失败', context: '[API] Update agent error' });

// DELETE - 删除 Agent
export const DELETE = adminHandler(async (_req, ctx) => {
  const { featureKey } = ctx.params;
  const result = await deleteAgent(featureKey);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || '删除失败' },
      { status: 400 }
    );
  }

  invalidatePromptCache(featureKey);
  return NextResponse.json({ success: true });
}, { fallbackMessage: '删除失败', context: '[API] Delete agent error' });