import { NextResponse } from 'next/server';
import { createArtStyle, getArtStyleBySlug, getArtStyles } from '@/lib/db';
import { adminHandler } from '@/lib/api-handler';

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

export const GET = adminHandler(async () => {
  const styles = await getArtStyles();
  return NextResponse.json({ success: true, data: styles });
}, { fallbackMessage: '获取画风列表失败', context: '[API] art-styles GET' });

export const POST = adminHandler(async (req) => {
  const body = await req.json();
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const coverImageUrl = typeof body.coverImageUrl === 'string' ? body.coverImageUrl.trim() : '';

  if (!slug || !name || !coverImageUrl) {
    return NextResponse.json(
      { error: 'slug、name 和 coverImageUrl 为必填项' },
      { status: 400 }
    );
  }

  const existing = await getArtStyleBySlug(slug);
  if (existing) {
    return NextResponse.json({ error: 'slug 已存在' }, { status: 409 });
  }

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const referenceImageUrl = typeof body.referenceImageUrl === 'string' ? body.referenceImageUrl.trim() : '';
  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

  try {
    const style = await createArtStyle({
      slug, name, description, coverImageUrl, referenceImageUrl, isActive, sortOrder,
    });
    return NextResponse.json({ success: true, data: style });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json({ error: 'slug 已存在' }, { status: 409 });
    }
    throw error;
  }
}, { fallbackMessage: '创建画风失败', context: '[API] art-styles POST' });
