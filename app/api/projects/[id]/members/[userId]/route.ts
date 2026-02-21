import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getComicProjectById, removeProjectMember } from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

export const DELETE = authHandler(async (_req, ctx, session) => {
  const { id, userId } = ctx.params;
  const project = await getComicProjectById(id);
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }
  if (project.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  if (userId === project.ownerUserId) {
    return NextResponse.json({ error: '不能移除所有者' }, { status: 400 });
  }

  const removed = await removeProjectMember(id, userId);
  if (!removed) {
    return NextResponse.json({ error: '成员不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}, {
  fallbackMessage: '移除成员失败',
  context: '[API] Project member remove',
});
