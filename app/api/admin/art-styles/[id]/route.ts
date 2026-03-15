import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/api-handler';
import {
  deleteArtStyle,
  getArtStyleById,
  getArtStyleBySlug,
  updateArtStyle,
  type ArtStyle,
} from '@/lib/db';

function isDuplicateKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  const code = (error as { code?: string }).code;
  const errno = (error as { errno?: number }).errno;

  if (code === 'ER_DUP_ENTRY' || errno === 1062) return true;
  if (code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE') return true;
  return normalized.includes('unique') || normalized.includes('duplicate');
}

export const dynamic = 'force-dynamic';

export const GET = adminHandler(async (_req, ctx) => {
  const { id } = ctx.params;
  const style = await getArtStyleById(id);
  if (!style) {
    return NextResponse.json({ error: '画风不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: style });
}, { fallbackMessage: '获取画风失败', context: '[API] Get art style error' });

export const PUT = adminHandler(async (req, ctx) => {
  const { id } = ctx.params;
  const body = await req.json();
  const updates: Partial<Omit<ArtStyle, 'id' | 'createdAt' | 'updatedAt'>> = {};

  if (body.slug !== undefined) {
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    if (!slug) {
      return NextResponse.json({ error: 'slug 不能为空' }, { status: 400 });
    }
    const existing = await getArtStyleBySlug(slug);
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: 'slug 已存在' }, { status: 409 });
    }
    updates.slug = slug;
  }

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name 不能为空' }, { status: 400 });
    }
    updates.name = name;
  }

  if (body.description !== undefined) {
    updates.description = typeof body.description === 'string' ? body.description.trim() : '';
  }

  if (body.coverImageUrl !== undefined) {
    const coverImageUrl = typeof body.coverImageUrl === 'string' ? body.coverImageUrl.trim() : '';
    if (!coverImageUrl) {
      return NextResponse.json({ error: 'coverImageUrl 不能为空' }, { status: 400 });
    }
    updates.coverImageUrl = coverImageUrl;
  }

  if (body.referenceImageUrl !== undefined) {
    updates.referenceImageUrl = typeof body.referenceImageUrl === 'string' ? body.referenceImageUrl.trim() : '';
  }

  if (body.isActive !== undefined) {
    updates.isActive = Boolean(body.isActive);
  }

  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json({ error: 'sortOrder 必须是数字' }, { status: 400 });
    }
    updates.sortOrder = sortOrder;
  }

  let updated: ArtStyle | null = null;
  try {
    updated = await updateArtStyle(id, updates);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return NextResponse.json({ error: 'slug 已存在' }, { status: 409 });
    }
    throw err;
  }
  if (!updated) {
    return NextResponse.json({ error: '画风不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updated });
}, { fallbackMessage: '更新画风失败', context: '[API] Update art style error' });

export const DELETE = adminHandler(async (_req, ctx) => {
  const { id } = ctx.params;
  const success = await deleteArtStyle(id);
  if (!success) {
    return NextResponse.json({ error: '画风不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}, { fallbackMessage: '删除画风失败', context: '[API] Delete art style error' });