import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/api-handler';
import {
  getGroupChannelPermissions,
  setGroupChannelPermissions,
  getUserGroup,
  getVideoChannels,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - 获取用户组可见的渠道
export const GET = adminHandler(async (_req, ctx) => {
  const { id } = ctx.params;

  const group = await getUserGroup(id);
  if (!group) {
    return NextResponse.json({ error: '用户组不存在' }, { status: 404 });
  }

  const channelIds = await getGroupChannelPermissions(id);

  // 获取所有渠道信息
  const allChannels = await getVideoChannels();
  const channels = allChannels.filter(c => channelIds.includes(c.id)).map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    enabled: c.enabled,
    isListed: c.isListed,
  }));

  return NextResponse.json({
    success: true,
    data: {
      channelIds,
      channels,
    },
  });
}, { fallbackMessage: '获取失败', context: '[API] Get group channels error' });

// PUT - 设置用户组可见的渠道
export const PUT = adminHandler(async (req, ctx) => {
  const { id } = ctx.params;
  const body = await req.json();
  const { channelIds } = body;

  if (!Array.isArray(channelIds)) {
    return NextResponse.json({ error: '请提供渠道 ID 列表' }, { status: 400 });
  }

  const group = await getUserGroup(id);
  if (!group) {
    return NextResponse.json({ error: '用户组不存在' }, { status: 404 });
  }

  await setGroupChannelPermissions(id, channelIds);

  return NextResponse.json({ success: true });
}, { fallbackMessage: '设置失败', context: '[API] Set group channels error' });