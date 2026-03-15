import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getComicProjectById, purgeComicProject } from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

export const DELETE = authHandler(async (_req, ctx, session) => {
  const { id } = ctx.params;
  const project = await getComicProjectById(id);
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }
  if (project.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const deleted = await purgeComicProject(id);
  return NextResponse.json({ success: true, data: { deleted } });
}, {
  fallbackMessage: '永久删除项目失败',
  context: '[API] Project purge',
});
