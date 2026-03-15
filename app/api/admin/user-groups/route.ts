import { NextResponse } from 'next/server';
import {
  getSafeUserGroups,
  createUserGroup,
  updateUserGroup,
  deleteUserGroup,
} from '@/lib/db';
import { adminHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = adminHandler(async () => {
  const groups = await getSafeUserGroups();
  return NextResponse.json({ success: true, data: groups });
}, { fallbackMessage: '获取失败', context: '[API] user-groups GET' });

export const POST = adminHandler(async (req) => {
  const body = await req.json();
  const { name, description, isDefault } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: '用户组名称必填' }, { status: 400 });
  }

  const group = await createUserGroup({
    name: name.trim(),
    description: description || '',
    isDefault: isDefault || false,
  });

  return NextResponse.json({ success: true, data: group });
}, { fallbackMessage: '创建失败', context: '[API] user-groups POST' });

export const PUT = adminHandler(async (req) => {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
  }

  const group = await updateUserGroup(id, updates);
  if (!group) {
    return NextResponse.json({ error: '用户组不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: group });
}, { fallbackMessage: '更新失败', context: '[API] user-groups PUT' });

export const DELETE = adminHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
  }

  const success = await deleteUserGroup(id);
  if (!success) {
    return NextResponse.json({ error: '删除失败' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}, { fallbackMessage: '删除失败', context: '[API] user-groups DELETE' });
