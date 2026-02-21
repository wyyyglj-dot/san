import { NextResponse } from 'next/server';
import { createHandler } from '@/lib/api-handler';
import {
  getUserById,
  updateUser,
  getUserGenerations,
  getUserGroups_ByUserId,
  addUserToGroup,
  removeUserFromGroup,
} from '@/lib/db';

// 获取用户详情和生成记录
export const GET = createHandler(
  { auth: { roles: ['admin', 'moderator'] }, fallbackMessage: '获取失败', context: '[API] Get user detail error' },
  async (_req, ctx, _session) => {
    const { id } = ctx.params;
    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const [generations, userGroups] = await Promise.all([
      getUserGenerations(id, 100),
      getUserGroups_ByUserId(id),
    ]);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        balance: user.balance,
        disabled: user.disabled,
        concurrencyLimit: user.concurrencyLimit,
        createdAt: user.createdAt,
        groupIds: userGroups.map(g => g.id),
      },
      generations,
      userGroups,
    });
  }
);

// 更新用户（密码、余额、禁用状态、用户组）
export const PUT = createHandler(
  { auth: { roles: ['admin', 'moderator'] }, fallbackMessage: '更新失败', context: '[API] Update user error' },
  async (req, ctx, session) => {
    const { id } = ctx.params;

    // 获取目标用户
    const targetUser = await getUserById(id);
    if (!targetUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // moderator 不能修改 admin 或其他 moderator
    if (session.user.role === 'moderator') {
      if (targetUser.role === 'admin' || targetUser.role === 'moderator') {
        return NextResponse.json({ error: '无权限修改管理员账号' }, { status: 403 });
      }
    }

    const data = await req.json();
    const updates: Record<string, unknown> = {};

    if (data.password !== undefined && data.password.trim()) {
      updates.password = data.password;
    }
    if (data.balance !== undefined) {
      updates.balance = parseInt(data.balance);
    }
    if (data.disabled !== undefined) {
      updates.disabled = Boolean(data.disabled);
    }
    if (data.name !== undefined) {
      updates.name = data.name;
    }
    // 只有 admin 可以修改角色
    if (data.role !== undefined && session.user.role === 'admin') {
      updates.role = data.role;
    }
    // 并发限制
    if (data.concurrencyLimit !== undefined) {
      updates.concurrencyLimit = data.concurrencyLimit === null ? null : parseInt(data.concurrencyLimit);
    }

    const user = await updateUser(id, updates);
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 处理用户组更新（只有 admin 可以修改）
    if (data.groupIds !== undefined && session.user.role === 'admin') {
      const newGroupIds = data.groupIds as string[];
      const currentGroups = await getUserGroups_ByUserId(id);
      const currentGroupIds = currentGroups.map(g => g.id);

      // 添加新的用户组
      for (const groupId of newGroupIds) {
        if (!currentGroupIds.includes(groupId)) {
          await addUserToGroup(id, groupId);
        }
      }

      // 移除不再属于的用户组
      for (const groupId of currentGroupIds) {
        if (!newGroupIds.includes(groupId)) {
          await removeUserFromGroup(id, groupId);
        }
      }
    }

    // 获取更新后的用户组
    const userGroups = await getUserGroups_ByUserId(id);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      balance: user.balance,
      disabled: user.disabled,
      concurrencyLimit: user.concurrencyLimit,
      createdAt: user.createdAt,
      groupIds: userGroups.map(g => g.id),
    });
  }
);
