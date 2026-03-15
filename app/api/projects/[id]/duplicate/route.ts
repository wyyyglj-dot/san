import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { duplicateComicProject, getComicProjectById } from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

export const POST = authHandler(async (req, ctx, session) => {
  const { id } = ctx.params;
  const project = await getComicProjectById(id);
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }
  if (project.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name =
    typeof body.name === 'string' && body.name.trim()
      ? body.name.trim()
      : `${project.name} 副本`;

  const duplicated = await duplicateComicProject(id, name);
  if (!duplicated) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: duplicated });
}, {
  fallbackMessage: '复制项目失败',
  context: '[API] Project duplicate',
});
