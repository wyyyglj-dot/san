import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getPendingGenerations } from '@/lib/db';
import type { Generation } from '@/types';

export const dynamic = 'force-dynamic';

// 获取用户正在进行的任务
export const GET = authHandler(async (req, ctx, session) => {
  const url = new URL(req.url, 'http://localhost');
  const rawLimit = parseInt(url.searchParams.get('limit') || '50');
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 200);
  const tasks = await getPendingGenerations(session.user.id, limit);

  return NextResponse.json({
    data: tasks.map((t: Generation) => ({
      id: t.id,
      prompt: t.prompt,
      type: t.type,
      status: t.status,
      createdAt: t.createdAt,
    })),
  });
});
