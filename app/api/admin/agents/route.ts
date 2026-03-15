import { NextRequest, NextResponse } from 'next/server';
import { getAgents, createAgent, getAgentByKey } from '@/lib/db-agent';
import { toSafeAgent, compileSystemPrompt, compileUserPromptTemplate, validateAgentConfig, validateAgentInput } from '@/lib/agent-utils';
import { invalidatePromptCache } from '@/lib/prompt-service';
import { adminHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = adminHandler(async () => {
  const agents = await getAgents();
  return NextResponse.json({ success: true, data: agents });
}, { fallbackMessage: '获取失败', context: '[API] agents GET' });

export const POST = adminHandler(async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  const { featureKey, name, config } = body;

  if (!featureKey || typeof featureKey !== 'string' || !/^[a-z0-9_]+$/.test(featureKey)) {
    return NextResponse.json(
      { success: false, error: 'featureKey 必须为小写字母、数字和下划线' },
      { status: 400 }
    );
  }
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ success: false, error: 'name 必填' }, { status: 400 });
  }

  const configCheck = validateAgentConfig(config);
  if (!configCheck.valid) {
    return NextResponse.json({ success: false, error: configCheck.error }, { status: 400 });
  }

  const inputCheck = validateAgentInput(body);
  if (!inputCheck.valid) {
    return NextResponse.json({ success: false, error: inputCheck.error }, { status: 400 });
  }

  const existing = await getAgentByKey(featureKey);
  if (existing) {
    return NextResponse.json({ success: false, error: 'featureKey 已存在' }, { status: 409 });
  }

  const systemPrompt = compileSystemPrompt(config);
  const userPromptTemplate = compileUserPromptTemplate(config);
  const agent = await createAgent({
    featureKey,
    name,
    description: body.description || '',
    config,
    systemPrompt,
    userPromptTemplate,
  });

  invalidatePromptCache(featureKey);
  return NextResponse.json({ success: true, data: toSafeAgent(agent) });
}, { fallbackMessage: '创建失败', context: '[API] agents POST' });
