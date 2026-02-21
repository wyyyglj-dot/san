import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { redeemCode } from '@/lib/db-codes';

export const POST = authHandler(async (req, ctx, session) => {
  const { code } = await req.json();
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: '请输入卡密' }, { status: 400 });
  }

  const result = await redeemCode(code.trim(), session.user.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    points: result.points,
    message: `兑换成功，获得 ${result.points} 积分`,
  });
});
