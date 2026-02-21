import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/api-handler';
import {
  getUserGroupMembers,
  addUserToGroup,
  removeUserFromGroup,
  getUserGroup,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - 获取用户组成员
export const GET = adminHandler(async (_req, ctx) => {
  const { id } = ctx.params;

  const group = await getUserGroup(id);
  if (!group) {
    return NextResponse.json({ error: '用户组不存在' }, { status: 404 });
  }

  const members = await getUserGroupMembers(id);
  return NextResponse.json({ success: true, data: members });
}, { fallbackMessage: '获取失败', context: '[API] Get group members error' });

// POST - 添加成员到用户组
export const POST = adminHandler(async (req, ctx) => {
  const { id } = ctx.params;
  const body = await req.json();
  const { userIds } = body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: '请提供用户 ID 列表' }, { status: 400 });
  }

  const group = await getUserGroup(id);
  if (!group) {
    return NextResponse.json({ error: '用户组不存在' }, { status: 404 });
  }

  for (const userId of userIds) {
    await addUserToGroup(userId, id);
  }

  return NextResponse.json({ success: true });
}, { fallbackMessage: '添加失败', context: '[API] Add group members error' });

// DELETE - 从用户组移除成员
export const DELETE = adminHandler(async (req, ctx) => {
  const { id } = ctx.params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: '缺少用户 ID' }, { status: 400 });
  }

  const group = await getUserGroup(id);
  if (!group) {
    return NextResponse.json({ error: '用户组不存在' }, { status: 404 });
  }

  await removeUserFromGroup(userId, id);
  return NextResponse.json({ success: true });
}, { fallbackMessage: '移除失败', context: '[API] Remove group member error' });
