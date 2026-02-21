import { NextResponse } from 'next/server';
import { createHandler } from '@/lib/api-handler';
import { getAllUsers, getUsersCount } from '@/lib/db';

export const GET = createHandler(
  { auth: { roles: ['admin', 'moderator'] }, fallbackMessage: '获取用户列表失败', context: 'admin-users-list' },
  async (req, ctx, session) => {
    const searchParams = new URL(req.url).searchParams;
    const rawPage = parseInt(searchParams.get('page') || '1');
    const page = Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1);
    const rawLimit = parseInt(searchParams.get('limit') || '50');
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 200);
    const search = searchParams.get('q')?.trim() || undefined;
    const offset = (page - 1) * limit;

    const [users, total] = await Promise.all([
      getAllUsers({ limit, offset, search }),
      getUsersCount(search),
    ]);

    const hasMore = offset + users.length < total;

    return NextResponse.json({
      success: true,
      data: users,
      page,
      limit,
      total,
      hasMore,
    });
  }
);
