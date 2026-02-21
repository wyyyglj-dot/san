import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { applyInviteCode } from '@/lib/db-codes';

export const POST = authHandler(async (req, ctx, session) => {
  const { code } = await req.json();
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: '请输入邀请码' }, { status: 400 });
  }

  const result = await applyInviteCode(code.trim(), session.user.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    bonusPoints: result.bonusPoints,
    message: result.bonusPoints ? `使用成功，获得 ${result.bonusPoints} 积分奖励` : '使用成功',
  });
});
