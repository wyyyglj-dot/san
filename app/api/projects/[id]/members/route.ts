import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getUserByEmail } from '@/lib/db';
import {
  addProjectMember,
  checkProjectAccess,
  getComicProjectById,
  getProjectMembers,
} from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

export const GET = authHandler(async (_req, ctx, session) => {
  const { id } = ctx.params;
  const project = await getComicProjectById(id);
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const access = await checkProjectAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  if (project.deletedAt && access === 'member') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const members = await getProjectMembers(id);
  return NextResponse.json({ success: true, data: members });
}, {
  fallbackMessage: '获取成员列表失败',
  context: '[API] Project members list',
});

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
  const role = typeof body.role === 'string' && body.role.trim() ? body.role.trim() : 'editor';
  const rawUserId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';

  let targetUserId = rawUserId;
  if (!targetUserId && rawEmail) {
    const user = await getUserByEmail(rawEmail);
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }
    targetUserId = user.id;
  }

  if (!targetUserId) {
    return NextResponse.json({ error: '请提供用户 ID 或邮箱' }, { status: 400 });
  }
  if (targetUserId === project.ownerUserId) {
    return NextResponse.json({ error: '所有者已是成员' }, { status: 400 });
  }

  const member = await addProjectMember(id, targetUserId, role, session.user.id);
  return NextResponse.json({ success: true, data: member });
}, {
  fallbackMessage: '添加成员失败',
  context: '[API] Project member add',
});
