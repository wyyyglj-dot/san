import { NextResponse } from 'next/server';
import {
  getVideoModels,
  createVideoModel,
  updateVideoModel,
  deleteVideoModel,
} from '@/lib/db';
import { adminHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = adminHandler(async () => {
  const models = await getVideoModels();
  return NextResponse.json({ success: true, data: models });
}, { fallbackMessage: '获取失败', context: '[API] video-models GET' });

export const POST = adminHandler(async (req) => {
  const body = await req.json();
  const {
    channelId, name, description, apiModel, baseUrl, apiKey,
    features, aspectRatios, durations,
    defaultAspectRatio, defaultDuration, hdEnabled, highlight, enabled, sortOrder,
  } = body;

  if (!channelId || !name || !apiModel) {
    return NextResponse.json({ error: '渠道、名称和模型 ID 必填' }, { status: 400 });
  }

  const model = await createVideoModel({
    channelId,
    name,
    description: description || '',
    apiModel,
    baseUrl: baseUrl || undefined,
    apiKey: apiKey || undefined,
    features: features || {
      textToVideo: true, imageToVideo: false, referenceToVideo: false, videoToVideo: false, supportStyles: false,
    },
    aspectRatios: aspectRatios || [
      { value: 'landscape', label: '16:9' },
      { value: 'portrait', label: '9:16' },
    ],
    durations: durations || [
      { value: '10s', label: '10 秒', cost: 100 },
    ],
    defaultAspectRatio: defaultAspectRatio || 'landscape',
    defaultDuration: defaultDuration || '10s',
    hdEnabled: hdEnabled ?? false,
    highlight: highlight || false,
    enabled: enabled !== false,
    sortOrder: sortOrder || 0,
  });

  return NextResponse.json({ success: true, data: model });
}, { fallbackMessage: '创建失败', context: '[API] video-models POST' });

export const PUT = adminHandler(async (req) => {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
  }

  const model = await updateVideoModel(id, updates);
  if (!model) {
    return NextResponse.json({ error: '模型不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: model });
}, { fallbackMessage: '更新失败', context: '[API] video-models PUT' });

export const DELETE = adminHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
  }

  const success = await deleteVideoModel(id);
  if (!success) {
    return NextResponse.json({ error: '删除失败' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}, { fallbackMessage: '删除失败', context: '[API] video-models DELETE' });
