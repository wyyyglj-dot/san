import { NextResponse } from 'next/server';
import { authHandler, adminHandler } from '@/lib/api-handler';
import { getChatModels, createChatModel, updateChatModel, deleteChatModel } from '@/lib/db';

export const GET = authHandler(async (req, ctx, session) => {
  const isAdmin = session.user.role === 'admin';
  const url = new URL(req.url, 'http://localhost');
  const all = url.searchParams.get('all') === 'true';

  // Admin can get all models with full data
  if (isAdmin && all) {
    const models = await getChatModels(false);
    return NextResponse.json({ success: true, data: models });
  }

  // Regular users only get enabled models without sensitive data
  const models = await getChatModels(true);
  const safeModels = models.map((m) => ({
    id: m.id,
    name: m.name,
    modelId: m.modelId,
    supportsVision: m.supportsVision,
    maxTokens: m.maxTokens,
    enabled: m.enabled,
    costPerMessage: m.costPerMessage,
  }));

  return NextResponse.json({ success: true, data: safeModels });
});

export const POST = adminHandler(async (req, ctx, session) => {
  const body = await req.json();
  const { name, apiUrl, apiKey, modelId, supportsVision, maxTokens, costPerMessage, enabled } = body;

  if (!name || !apiUrl || !apiKey || !modelId) {
    return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
  }

  const model = await createChatModel({
    name,
    apiUrl,
    apiKey,
    modelId,
    supportsVision: supportsVision ?? false,
    maxTokens: maxTokens ?? 4096,
    costPerMessage: costPerMessage ?? 1,
    enabled: enabled ?? true,
  });

  return NextResponse.json({ success: true, data: model });
});

export const PUT = adminHandler(async (req, ctx, session) => {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ success: false, error: '缺少 ID' }, { status: 400 });
  }

  const model = await updateChatModel(id, updates);
  if (!model) {
    return NextResponse.json({ success: false, error: '模型不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: model });
});

export const DELETE = adminHandler(async (req, ctx, session) => {
  const url = new URL(req.url, 'http://localhost');
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: '缺少 ID' }, { status: 400 });
  }

  const success = await deleteChatModel(id);
  if (!success) {
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
});
