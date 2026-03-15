import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  createComicProject,
  getComicProjects,
  createProjectPreferences,
  purgeComicProject,
} from '@/lib/db-comic';
import { detectMimeType, isImageMimeType, uploadToPublicUrl } from '@/lib/upload-service';
import { validateProjectPreferencesInput } from './preference-validation';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseScope(value: string | null): 'personal' | 'team' {
  return value === 'team' ? 'team' : 'personal';
}

function parseStatus(value: string | null): 'active' | 'trash' {
  return value === 'trash' ? 'trash' : 'active';
}

function parseLimit(value: string | null): number {
  const raw = parseInt(value || '', 10);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(raw, MAX_LIMIT);
}

function parseOffset(value: string | null): number {
  const raw = parseInt(value || '', 10);
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return raw;
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export const GET = authHandler(async (req, _ctx, session) => {
  const searchParams = new URL(req.url).searchParams;
  const scope = parseScope(searchParams.get('scope'));
  const status = parseStatus(searchParams.get('status'));
  const search = searchParams.get('search')?.trim() || undefined;
  const limit = parseLimit(searchParams.get('limit'));
  const offset = parseOffset(searchParams.get('offset'));

  const projects = await getComicProjects(session.user.id, {
    scope,
    status,
    search,
    limit,
    offset,
  });

  return NextResponse.json({ success: true, data: projects });
}, {
  fallbackMessage: '获取项目列表失败',
  context: '[API] Projects list',
});

export const POST = authHandler(async (req, _ctx, session) => {
  const body = await req.json().catch(() => ({}));
  const name =
    typeof body.name === 'string' && body.name.trim() ? body.name.trim() : '未命名项目';
  const aspectRatio =
    typeof body.aspectRatio === 'string' && body.aspectRatio.trim()
      ? body.aspectRatio.trim()
      : '16:9';
  const mode = typeof body.mode === 'string' && body.mode.trim() ? body.mode.trim() : 'ai_merge';
  const descriptionInput = parseOptionalString(body.description);
  const copyTextInput = parseOptionalString(body.copyText);
  const description = descriptionInput ?? copyTextInput;
  const copyText = copyTextInput ?? description;
  const coverImage = typeof body.coverImage === 'string' ? body.coverImage.trim() : '';
  const durationSecondsRaw =
    typeof body.durationSeconds === 'number' ? body.durationSeconds : parseInt(body.durationSeconds, 10);
  const durationSeconds = Number.isFinite(durationSecondsRaw)
    ? Math.max(0, Math.floor(durationSecondsRaw))
    : 0;
  const sizeLabel =
    typeof body.sizeLabel === 'string' && body.sizeLabel.trim() ? body.sizeLabel.trim() : aspectRatio;

  const preferencesInput =
    body && typeof body.preferences === 'object' && body.preferences !== null
      ? (body.preferences as Record<string, unknown>)
      : null;

  const validatedPreferences = await validateProjectPreferencesInput({
    input: preferencesInput,
    userId: session.user.id,
    isAdmin: session.user.role === 'admin',
  });
  if (validatedPreferences.error) {
    return NextResponse.json({ error: validatedPreferences.error }, { status: 400 });
  }

  let coverImageUrl: string | null = null;
  if (coverImage) {
    const mimeType = detectMimeType(coverImage);
    if (!isImageMimeType(mimeType)) {
      return NextResponse.json({ error: '封面图必须是图片格式' }, { status: 400 });
    }
    try {
      const upload = await uploadToPublicUrl(coverImage, { filename: `project_${Date.now()}` });
      coverImageUrl = upload.url;
    } catch (uploadError) {
      console.error('[API] Cover image upload failed:', uploadError);
      return NextResponse.json({ error: '封面图上传失败' }, { status: 502 });
    }
  }

  const project = await createComicProject({
    ownerUserId: session.user.id,
    name,
    aspectRatio,
    mode,
    copyText,
    description,
    coverImageUrl,
    durationSeconds,
    sizeLabel,
    lastEditorUserId: session.user.id,
  });

  try {
    await createProjectPreferences(project.id, {
      ...validatedPreferences.updates,
      defaultVideoRatio: validatedPreferences.updates.defaultVideoRatio || '16:9',
    });
  } catch (prefError) {
    try {
      await purgeComicProject(project.id);
    } catch (cleanupError) {
      console.error('[API] Failed to rollback project after preferences error:', cleanupError);
    }
    throw prefError;
  }

  return NextResponse.json({ success: true, data: project });
}, {
  fallbackMessage: '创建项目失败',
  context: '[API] Project create',
});
