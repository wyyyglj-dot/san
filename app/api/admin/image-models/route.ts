import { NextResponse } from 'next/server';
import {
  getImageModels,
  getImageModelsByChannel,
  createImageModel,
  updateImageModel,
  deleteImageModel,
} from '@/lib/db';
import { adminHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = adminHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');

  const models = channelId
    ? await getImageModelsByChannel(channelId)
    : await getImageModels();

  return NextResponse.json({ success: true, data: models });
}, { fallbackMessage: '获取失败', context: '[API] image-models GET' });

export const POST = adminHandler(async (req) => {
  const body = await req.json();
  const {
    channelId, name, description, apiModel, apiEndpoint, baseUrl, apiKey,
    features, aspectRatios, resolutions, imageSizes,
    defaultAspectRatio, defaultImageSize,
    requiresReferenceImage, allowEmptyPrompt, highlight, enabled,
    costPerGeneration, sortOrder,
  } = body;

  if (!channelId || !name || !apiModel) {
    return NextResponse.json({ error: '渠道、名称和模型 ID 必填' }, { status: 400 });
  }

  const model = await createImageModel({
    channelId,
    name,
    description: description || '',
    apiModel,
    apiEndpoint: apiEndpoint || 'dalle',
    baseUrl: baseUrl || undefined,
    apiKey: apiKey || undefined,
    features: features || {
      textToImage: true, imageToImage: false, upscale: false,
      matting: false, multipleImages: false, imageSize: false,
    },
    aspectRatios: aspectRatios || ['1:1'],
    resolutions: resolutions || { '1:1': '1024x1024' },
    imageSizes: imageSizes || undefined,
    defaultAspectRatio: defaultAspectRatio || '1:1',
    defaultImageSize: defaultImageSize || undefined,
    requiresReferenceImage: requiresReferenceImage || false,
    allowEmptyPrompt: allowEmptyPrompt || false,
    highlight: highlight || false,
    enabled: enabled !== false,
    costPerGeneration: costPerGeneration || 10,
    sortOrder: sortOrder || 0,
  });

  return NextResponse.json({ success: true, data: model });
}, { fallbackMessage: '创建失败', context: '[API] image-models POST' });

export const PUT = adminHandler(async (req) => {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
  }

  const model = await updateImageModel(id, updates);
  if (!model) {
    return NextResponse.json({ error: '模型不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: model });
}, { fallbackMessage: '更新失败', context: '[API] image-models PUT' });

export const DELETE = adminHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
  }

  const success = await deleteImageModel(id);
  if (!success) {
    return NextResponse.json({ error: '删除失败' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}, { fallbackMessage: '删除失败', context: '[API] image-models DELETE' });
