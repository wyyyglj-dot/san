import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/api-handler';
import {
  getUserGroup,
  getGroupModelPricing,
  setGroupModelPricing,
  deleteGroupModelPricing,
  batchSetGroupModelPricing,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - 获取用户组的模型定价覆盖
export const GET = adminHandler(async (_req, ctx) => {
  const { id } = ctx.params;

  const group = await getUserGroup(id);
  if (!group) {
    return NextResponse.json({ error: '用户组不存在' }, { status: 404 });
  }

  const pricings = await getGroupModelPricing(id);

  return NextResponse.json({
    success: true,
    data: pricings,
  });
}, { fallbackMessage: '获取定价失败', context: '[API] Get group pricing error' });

// POST - 批量设置定价覆盖
export const POST = adminHandler(async (req, ctx) => {
  const { id } = ctx.params;

  const group = await getUserGroup(id);
  if (!group) {
    return NextResponse.json({ error: '用户组不存在' }, { status: 404 });
  }

  const body = await req.json();
  const { pricings } = body as {
    pricings: Array<{ modelId: string; modelType: string; customCost: number }>;
  };

  if (!Array.isArray(pricings) || pricings.length === 0) {
    return NextResponse.json({ error: '请提供定价数据' }, { status: 400 });
  }

  // Validate
  for (const p of pricings) {
    if (!p.modelId || !p.modelType || typeof p.customCost !== 'number' || p.customCost < 0) {
      return NextResponse.json({ error: '定价数据格式错误' }, { status: 400 });
    }
  }

  await batchSetGroupModelPricing(id, pricings);

  return NextResponse.json({ success: true });
}, { fallbackMessage: '设置定价失败', context: '[API] Set group pricing error' });

// DELETE - 删除某个模型的定价覆盖
export const DELETE = adminHandler(async (req, ctx) => {
  const { id } = ctx.params;

  const group = await getUserGroup(id);
  if (!group) {
    return NextResponse.json({ error: '用户组不存在' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const modelId = searchParams.get('modelId');
  if (!modelId) {
    return NextResponse.json({ error: '缺少 modelId' }, { status: 400 });
  }

  await deleteGroupModelPricing(id, modelId);

  return NextResponse.json({ success: true });
}, { fallbackMessage: '删除定价失败', context: '[API] Delete group pricing error' });
