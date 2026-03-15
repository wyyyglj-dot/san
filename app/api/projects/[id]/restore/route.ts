import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getComicProjectById, restoreComicProject } from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

export const POST = authHandler(async (_req, ctx, session) => {
  const { id } = ctx.params;
  const project = await getComicProjectById(id);
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }
  if (project.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const restored = await restoreComicProject(id);
  return NextResponse.json({ success: true, data: restored });
}, {
  fallbackMessage: '恢复项目失败',
  context: '[API] Project restore',
});
