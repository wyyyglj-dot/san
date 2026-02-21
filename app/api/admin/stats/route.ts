import { NextResponse } from 'next/server';
import { getStatsOverview } from '@/lib/db-codes';
import { createHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = createHandler(
  { auth: { roles: ['admin', 'moderator'] }, fallbackMessage: '获取统计失败', context: '[API] stats GET' },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(Number(searchParams.get('days')) || 30, 7), 90);

    const stats = await getStatsOverview(days);
    return NextResponse.json({ success: true, data: stats });
  }
);
