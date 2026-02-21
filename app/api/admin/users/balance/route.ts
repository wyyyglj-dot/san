import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/api-handler';
import { updateUserBalance } from '@/lib/db';

export const POST = adminHandler(
  async (req, ctx, session) => {
    const { userId, delta } = await req.json();

    if (!userId || typeof delta !== 'number') {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }

    const newBalance = await updateUserBalance(userId, delta, 'clamp');
    return NextResponse.json({ success: true, data: { balance: newBalance } });
  },
  { fallbackMessage: '更新余额失败', context: 'admin-user-balance' }
);
