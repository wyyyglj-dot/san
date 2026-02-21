import { NextRequest, NextResponse } from 'next/server';
import { getFeatureBindings, upsertFeatureBinding } from '@/lib/db-llm';
import { adminHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = adminHandler(async () => {
  const bindings = await getFeatureBindings();
  return NextResponse.json({ success: true, data: bindings });
}, { fallbackMessage: '获取失败', context: '[API] feature-bindings GET' });

export const PUT = adminHandler(async (request: Request) => {
  const body = await request.json();
  const { featureKey, modelType, modelId, enabled } = body;

  if (!featureKey || !modelType || !modelId) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  if (!['image', 'video', 'llm'].includes(modelType)) {
    return NextResponse.json({ error: '不支持的 modelType' }, { status: 400 });
  }

  const binding = await upsertFeatureBinding({
    featureKey,
    modelType,
    modelId,
    enabled: enabled !== false,
  });

  return NextResponse.json({ success: true, data: binding });
}, { fallbackMessage: '更新失败', context: '[API] feature-bindings PUT' });
