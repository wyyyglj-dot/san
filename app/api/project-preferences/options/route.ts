import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  getActiveArtStyles,
  getSafeImageChannels,
  getSafeImageModels,
  getSafeVideoChannels,
  getSafeVideoModels,
  getUserVisibleImageChannels,
  getUserVisibleVideoChannels,
  getVideoModels,
} from '@/lib/db';
import { getLlmModels } from '@/lib/db-llm';
import type {
  SafeImageChannel,
  SafeLlmModel,
  SafeVideoChannel,
  SafeVideoModel,
} from '@/types';

export const dynamic = 'force-dynamic';

const VIDEO_RATIO_OPTIONS = [
  { value: '16:9', label: '横屏 16:9', description: '大部分视频平台' },
  { value: '9:16', label: '竖屏 9:16', description: '短视频/Stories' },
  { value: '1:1', label: '方形 1:1', description: '头像/单图常用' },
];

export const GET = authHandler(async (req, ctx, session) => {
  const userId = session.user.id;
  const isAdmin = session.user.role === 'admin';

  const [rawImageModels, llmModels, artStyles] = await Promise.all([
    getSafeImageModels(true),
    getLlmModels(),
    getActiveArtStyles(),
  ]);

  // Image channels + permission filtering
  let imageModels = rawImageModels;
  let imageChannels: SafeImageChannel[];
  if (isAdmin) {
    imageChannels = (await getSafeImageChannels(true)).filter((c) => c.isListed);
  } else {
    const visibleChannels = await getUserVisibleImageChannels(userId);
    imageChannels = visibleChannels.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      enabled: c.enabled,
      isListed: c.isListed,
    }));
  }
  const imageChannelIds = new Set(imageChannels.map((c) => c.id));
  imageModels = rawImageModels.filter((m) => imageChannelIds.has(m.channelId));

  // Video channels + permission filtering
  let videoChannels: SafeVideoChannel[];
  let videoModels: SafeVideoModel[];
  if (isAdmin) {
    const [safeVideoModels, safeVideoChannels] = await Promise.all([
      getSafeVideoModels(true),
      getSafeVideoChannels(true),
    ]);
    videoModels = safeVideoModels;
    videoChannels = safeVideoChannels.filter((c) => c.isListed);
    const adminVideoChannelIds = new Set(videoChannels.map((c) => c.id));
    videoModels = videoModels.filter((m) => adminVideoChannelIds.has(m.channelId));
  } else {
    const visibleChannels = await getUserVisibleVideoChannels(userId);
    videoChannels = visibleChannels.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      enabled: c.enabled,
      isListed: c.isListed,
    }));
    const visibleChannelIds = new Set(visibleChannels.map((c) => c.id));
    const allModels = await getVideoModels(true);
    videoModels = allModels
      .filter((model) => visibleChannelIds.has(model.channelId))
      .map((model) => {
        const channel = visibleChannels.find((c) => c.id === model.channelId);
        return {
          id: model.id,
          channelId: model.channelId,
          channelType: channel?.type || 'openai-compatible',
          name: model.name,
          description: model.description,
          features: model.features,
          aspectRatios: model.aspectRatios,
          durations: model.durations,
          defaultAspectRatio: model.defaultAspectRatio,
          defaultDuration: model.defaultDuration,
          highlight: model.highlight,
          enabled: model.enabled,
        };
      });
  }

  // Filter enabled LLM models and remove apiKey
  const textModels: SafeLlmModel[] = llmModels
    .filter((model) => model.enabled)
    .map(({ apiKey, ...rest }) => rest);

  return NextResponse.json({
    success: true,
    data: {
      imageModels,
      imageChannels,
      videoModels,
      videoChannels,
      textModels,
      styles: artStyles,
      videoRatios: VIDEO_RATIO_OPTIONS,
    },
  });
});
