import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { createProjectInvite, getComicProjectById } from '@/lib/db-comic';

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
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : '';
  if (!email) {
    return NextResponse.json({ error: '请提供邮箱地址' }, { status: 400 });
  }

  const invite = await createProjectInvite(id, session.user.id, email);
  return NextResponse.json({ success: true, data: invite });
}, {
  fallbackMessage: '创建邀请失败',
  context: '[API] Project invite create',
});
