import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getUserCharacterCards, getPendingCharacterCards, deleteCharacterCard } from '@/lib/db';

export const GET = authHandler(async (req, ctx, session) => {
  // 支持分页
  const url = new URL(req.url, 'http://localhost');
  const rawPage = parseInt(url.searchParams.get('page') || '1');
  const page = Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1);
  const rawLimit = parseInt(url.searchParams.get('limit') || '50');
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100);
  const offset = (page - 1) * limit;
  const pendingOnly = url.searchParams.get('pending') === 'true';

  let cards;
  if (pendingOnly) {
    cards = await getPendingCharacterCards(session.user.id, limit);
  } else {
    cards = await getUserCharacterCards(session.user.id, limit, offset);
  }

  return NextResponse.json({
    success: true,
    data: cards,
    page,
    limit,
  });
});

export const DELETE = authHandler(async (req, ctx, session) => {
  const { cardId } = await req.json();

  if (!cardId) {
    return NextResponse.json({ error: '缺少卡片 ID' }, { status: 400 });
  }

  const deleted = await deleteCharacterCard(cardId, session.user.id);

  if (!deleted) {
    return NextResponse.json({ error: '删除失败或无权限' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
});
