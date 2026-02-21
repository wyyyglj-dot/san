import { NextResponse } from 'next/server';
import {
  getLlmPrompts,
  getLlmPromptByKey,
  updateLlmPrompt,
  resetLlmPrompt,
} from '@/lib/db-llm';
import { invalidatePromptCache, validateTemplate } from '@/lib/prompt-service';
import { adminHandler } from '@/lib/api-handler';
import type { LlmPrompt, SafeLlmPrompt } from '@/types';

export const dynamic = 'force-dynamic';

function toSafe(prompt: LlmPrompt): SafeLlmPrompt {
  const { defaultSystemPrompt, defaultUserPromptTemplate, ...rest } = prompt;
  return rest;
}

// GET - 获取所有提示词模板
export const GET = adminHandler(async () => {
  const prompts = await getLlmPrompts();
  const safePrompts: SafeLlmPrompt[] = prompts.map(toSafe);
  return NextResponse.json({ success: true, data: safePrompts });
}, { fallbackMessage: '获取失败', context: '[API] llm-prompts GET' });

// PUT - 更新提示词模板
export const PUT = adminHandler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const { featureKey, systemPrompt, userPromptTemplate, enabled } = body;

  if (!featureKey || typeof featureKey !== 'string') {
    return NextResponse.json({ success: false, error: 'featureKey 必填' }, { status: 400 });
  }
  if (typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
    return NextResponse.json({ success: false, error: '系统提示词不能为空' }, { status: 400 });
  }
  if (typeof userPromptTemplate !== 'string' || !userPromptTemplate.trim()) {
    return NextResponse.json({ success: false, error: '用户提示词模板不能为空' }, { status: 400 });
  }

  const existing = await getLlmPromptByKey(featureKey);
  if (!existing) {
    return NextResponse.json({ success: false, error: '提示词不存在' }, { status: 404 });
  }

  const missingInUser = validateTemplate(featureKey, userPromptTemplate);
  if (missingInUser.length > 0) {
    return NextResponse.json(
      { success: false, error: `用户模板缺少必需占位符: ${missingInUser.join(', ')}` },
      { status: 400 }
    );
  }

  const updated = await updateLlmPrompt(featureKey, {
    systemPrompt,
    userPromptTemplate,
    enabled: enabled !== undefined ? Boolean(enabled) : undefined,
  });

  if (!updated) {
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 });
  }

  invalidatePromptCache(featureKey);
  return NextResponse.json({ success: true, data: toSafe(updated) });
}, { fallbackMessage: '更新失败', context: '[API] llm-prompts PUT' });

// POST - 重置提示词为默认值
export const POST = adminHandler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const { featureKey, action } = body;

  if (!featureKey || typeof featureKey !== 'string') {
    return NextResponse.json({ success: false, error: 'featureKey 必填' }, { status: 400 });
  }
  if (action !== 'reset') {
    return NextResponse.json({ success: false, error: '无效操作' }, { status: 400 });
  }

  const updated = await resetLlmPrompt(featureKey);
  if (!updated) {
    return NextResponse.json({ success: false, error: '提示词不存在' }, { status: 404 });
  }

  invalidatePromptCache(featureKey);
  return NextResponse.json({ success: true, data: toSafe(updated) });
}, { fallbackMessage: '重置失败', context: '[API] llm-prompts POST' });
