import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  getSafeVideoModels,
  getSafeVideoChannels,
  getUserVisibleVideoChannels,
  getVideoModels,
} from '@/lib/db';
import type { SafeVideoChannel, SafeVideoModel } from '@/types';

export const dynamic = 'force-dynamic';

// GET - 获取可用的视频模型列表（不含敏感信息，基于用户组权限过滤）
export const GET = authHandler(async (req, ctx, session) => {
  const userId = session.user.id;
  const isAdmin = session.user.role === 'admin';

  let channels: SafeVideoChannel[];
  let models: SafeVideoModel[];

  if (isAdmin) {
    [models, channels] = await Promise.all([
      getSafeVideoModels(true),
      getSafeVideoChannels(true),
    ]);
    channels = channels.filter(c => c.isListed);
  } else {
    const visibleChannels = await getUserVisibleVideoChannels(userId);

    channels = visibleChannels.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      enabled: c.enabled,
      isListed: c.isListed,
    }));

    const allModels = await getVideoModels(true);
    const visibleChannelIds = new Set(channels.map(c => c.id));

    models = allModels
      .filter(m => visibleChannelIds.has(m.channelId))
      .map(m => {
        const channel = visibleChannels.find(c => c.id === m.channelId);
        return {
          id: m.id,
          channelId: m.channelId,
          channelType: channel?.type || 'openai-compatible',
          name: m.name,
          description: m.description,
          features: m.features,
          aspectRatios: m.aspectRatios,
          durations: m.durations,
          defaultAspectRatio: m.defaultAspectRatio,
          defaultDuration: m.defaultDuration,
          highlight: m.highlight,
          enabled: m.enabled,
        };
      });
  }

  return NextResponse.json({
    success: true,
    data: { models, channels },
  });
});
