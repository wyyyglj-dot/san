import { NextResponse } from 'next/server';
import { createInviteCode, getInviteCodes, deleteInviteCode } from '@/lib/db-codes';
import { adminHandler } from '@/lib/api-handler';

export const GET = adminHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);
  const offset = (page - 1) * limit;
  const showUsed = searchParams.get('showUsed') === 'true';

  const codes = await getInviteCodes({ limit, offset, showUsed });

  return NextResponse.json({ success: true, data: codes, page });
}, { fallbackMessage: '获取邀请码失败', context: '[API] invites GET' });

export const POST = adminHandler(async (req, _ctx, session) => {
  const { bonusPoints = 0, creatorBonus = 0, expiresAt } = await req.json();

  const code = await createInviteCode(session.user.id, bonusPoints, creatorBonus, expiresAt);
  return NextResponse.json({ success: true, data: code });
}, { fallbackMessage: '创建邀请码失败', context: '[API] invites POST' });

export const DELETE = adminHandler(async (req) => {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
  }

  const success = await deleteInviteCode(id);
  return NextResponse.json({ success });
}, { fallbackMessage: '删除失败', context: '[API] invites DELETE' });
