import { NextResponse } from 'next/server';
import {
  getImageChannels,
  createImageChannel,
  updateImageChannel,
  deleteImageChannel,
} from '@/lib/db';
import { adminHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = adminHandler(async () => {
  const channels = await getImageChannels();
  return NextResponse.json({ success: true, data: channels });
}, { fallbackMessage: '获取失败', context: '[API] image-channels GET' });

export const POST = adminHandler(async (req) => {
  const body = await req.json();
  const { name, type, baseUrl, apiKey, enabled, isListed } = body;

  if (!name || !type) {
    return NextResponse.json({ error: '名称和类型必填' }, { status: 400 });
  }

  const channel = await createImageChannel({
    name,
    type,
    baseUrl: baseUrl || '',
    apiKey: apiKey || '',
    enabled: enabled !== false,
    isListed: isListed !== false,
  });

  return NextResponse.json({ success: true, data: channel });
}, { fallbackMessage: '创建失败', context: '[API] image-channels POST' });

export const PUT = adminHandler(async (req) => {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
  }

  const channel = await updateImageChannel(id, updates);
  if (!channel) {
    return NextResponse.json({ error: '渠道不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: channel });
}, { fallbackMessage: '更新失败', context: '[API] image-channels PUT' });

export const DELETE = adminHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
  }

  const success = await deleteImageChannel(id);
  if (!success) {
    return NextResponse.json({ error: '删除失败' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}, { fallbackMessage: '删除失败', context: '[API] image-channels DELETE' });
