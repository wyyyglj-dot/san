import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getUserDailyUsage, getSystemConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/user/daily-usage - 获取用户今日使用量和限制
export const GET = authHandler(async (req, ctx, session) => {
  const [usage, config] = await Promise.all([
    getUserDailyUsage(session.user.id),
    getSystemConfig(),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      usage,
      limits: config.dailyLimit,
    },
  });
});
