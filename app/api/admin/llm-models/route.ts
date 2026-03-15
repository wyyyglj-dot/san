import { NextRequest, NextResponse } from 'next/server';
import {
  getLlmModels,
  getLlmModelById,
  createLlmModel,
  updateLlmModel,
  deleteLlmModel,
} from '@/lib/db-llm';
import type { SafeLlmModel } from '@/types';
import { adminHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = adminHandler(async () => {
  const models = await getLlmModels();
  const safeModels: SafeLlmModel[] = models.map(({ apiKey, ...rest }) => rest);
  return NextResponse.json({ success: true, data: safeModels });
}, { fallbackMessage: '获取失败', context: '[API] llm-models GET' });

export const POST = adminHandler(async (request: Request) => {
  const body = await request.json();
  const { name, provider, baseUrl, apiKey, modelName, temperature, maxTokens, enabled } = body;

  if (!name || !provider || !baseUrl || !apiKey || !modelName) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  if (!['gemini', 'openai-compatible'].includes(provider)) {
    return NextResponse.json({ error: '不支持的 provider 类型' }, { status: 400 });
  }

  const model = await createLlmModel({
    name,
    provider,
    baseUrl,
    apiKey,
    modelName,
    temperature: temperature ?? 0.7,
    maxTokens: maxTokens ?? 4096,
    enabled: enabled !== false,
  });

  const { apiKey: _, ...safeModel } = model;
  return NextResponse.json({ success: true, data: safeModel });
}, { fallbackMessage: '创建失败', context: '[API] llm-models POST' });
