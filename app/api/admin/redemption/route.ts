import { NextResponse } from 'next/server';
import {
  createRedemptionCodes,
  getRedemptionCodes,
  getRedemptionCodesCount,
  deleteRedemptionCode,
  deleteRedemptionCodesByBatch,
} from '@/lib/db-codes';
import { adminHandler } from '@/lib/api-handler';

export const GET = adminHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);
  const offset = (page - 1) * limit;
  const batchId = searchParams.get('batchId') || undefined;
  const showUsed = searchParams.get('showUsed') === 'true';

  const codes = await getRedemptionCodes({ limit, offset, batchId, showUsed });
  const total = await getRedemptionCodesCount({ batchId, showUsed });

  return NextResponse.json({
    success: true,
    data: codes,
    total,
    page,
    hasMore: offset + codes.length < total,
  });
}, { fallbackMessage: '获取卡密失败', context: '[API] redemption GET' });

export const POST = adminHandler(async (req) => {
  const { count, points, expiresAt, note } = await req.json();

  if (!count || count < 1 || count > 100) {
    return NextResponse.json({ error: '数量必须在 1-100 之间' }, { status: 400 });
  }
  if (!points || points < 1) {
    return NextResponse.json({ error: '积分必须大于 0' }, { status: 400 });
  }

  const codes = await createRedemptionCodes(count, points, { expiresAt, note });
  return NextResponse.json({ success: true, data: codes });
}, { fallbackMessage: '创建卡密失败', context: '[API] redemption POST' });

export const DELETE = adminHandler(async (req) => {
  const { id, batchId } = await req.json();

  if (batchId) {
    const count = await deleteRedemptionCodesByBatch(batchId);
    return NextResponse.json({ success: true, deleted: count });
  }

  if (id) {
    const success = await deleteRedemptionCode(id);
    return NextResponse.json({ success });
  }

  return NextResponse.json({ error: '缺少参数' }, { status: 400 });
}, { fallbackMessage: '删除失败', context: '[API] redemption DELETE' });
