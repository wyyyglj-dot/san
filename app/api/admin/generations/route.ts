import { NextResponse } from 'next/server';
import { getAllGenerations, adminDeleteGeneration } from '@/lib/db-codes';
import { adminHandler } from '@/lib/api-handler';

export const GET = adminHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);
  const offset = (page - 1) * limit;

  const userId = searchParams.get('userId') || undefined;
  const type = searchParams.get('type') || undefined;
  const status = searchParams.get('status') || undefined;

  const { generations, total } = await getAllGenerations({ limit, offset, userId, type, status });

  return NextResponse.json({
    success: true,
    data: generations,
    total,
    page,
    hasMore: offset + generations.length < total,
  });
}, { fallbackMessage: '获取记录失败', context: '[API] generations GET' });

export const DELETE = adminHandler(async (req) => {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
  }

  const success = await adminDeleteGeneration(id);
  return NextResponse.json({ success });
}, { fallbackMessage: '删除失败', context: '[API] generations DELETE' });
