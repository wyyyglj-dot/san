import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkEpisodeOrderConflict,
  checkProjectAccess,
  getComicEpisodeById,
  getComicProjectById,
  softDeleteComicEpisode,
  updateComicEpisode,
} from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

const MAX_TITLE_LENGTH = 200;

function parsePositiveInt(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : parseInt(String(value || ''), 10);
  if (!Number.isFinite(raw)) return null;
  const normalized = Math.floor(raw);
  if (normalized <= 0) return null;
  return normalized;
}

function parseTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseContent(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.trim()) return null;
  return value;
}

function normalizeNote(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isUniqueConstraintError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'ER_DUP_ENTRY' || code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE';
}

export const PATCH = authHandler(async (req, ctx, session) => {
  const { episodeId } = ctx.params;
  const episode = await getComicEpisodeById(episodeId);
  if (!episode || episode.deletedAt) {
    return NextResponse.json({ error: '剧集不存在' }, { status: 404 });
  }

  const project = await getComicProjectById(episode.projectId);
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const access = await checkProjectAccess(episode.projectId, session.user.id);
  if (!access) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  if (project.deletedAt && access === 'member') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Partial<{
    orderNum: number;
    title: string;
    content: string;
    note: string | null;
  }> = {};

  if (body.orderNum !== undefined) {
    const parsed = parsePositiveInt(body.orderNum);
    if (!parsed) {
      return NextResponse.json({ error: '序号无效' }, { status: 400 });
    }
    updates.orderNum = parsed;
  }

  if (body.title !== undefined) {
    const parsed = parseTitle(body.title);
    if (!parsed) {
      return NextResponse.json({ error: '标题无效' }, { status: 400 });
    }
    if (parsed.length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: '标题过长' }, { status: 400 });
    }
    updates.title = parsed;
  }

  if (body.content !== undefined) {
    const parsed = parseContent(body.content);
    if (!parsed) {
      return NextResponse.json({ error: '内容无效' }, { status: 400 });
    }
    updates.content = parsed;
  }

  if (body.note !== undefined) {
    if (body.note === null) {
      updates.note = null;
    } else if (typeof body.note === 'string') {
      updates.note = normalizeNote(body.note);
    } else {
      return NextResponse.json({ error: '备注无效' }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '没有提供更新内容' }, { status: 400 });
  }

  if (updates.orderNum !== undefined) {
    const hasConflict = await checkEpisodeOrderConflict(
      episode.projectId,
      updates.orderNum,
      episode.id
    );
    if (hasConflict) {
      return NextResponse.json({ error: '序号已存在' }, { status: 409 });
    }
  }

  try {
    const updated = await updateComicEpisode(episodeId, updates);
    if (!updated) {
      return NextResponse.json({ error: '剧集不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: '序号已存在' }, { status: 409 });
    }
    throw error;
  }
});

export const DELETE = authHandler(async (req, ctx, session) => {
  const { episodeId } = ctx.params;
  const episode = await getComicEpisodeById(episodeId);
  if (!episode || episode.deletedAt) {
    return NextResponse.json({ error: '剧集不存在' }, { status: 404 });
  }

  const project = await getComicProjectById(episode.projectId);
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const access = await checkProjectAccess(episode.projectId, session.user.id);
  if (!access) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  if (project.deletedAt && access === 'member') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const deleted = await softDeleteComicEpisode(episodeId);
  if (!deleted) {
    return NextResponse.json({ error: '剧集不存在' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: deleted });
});
