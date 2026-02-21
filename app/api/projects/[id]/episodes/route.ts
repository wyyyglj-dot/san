import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkEpisodeOrderConflict,
  checkProjectAccess,
  createComicEpisode,
  getComicEpisodes,
  getComicProjectById,
  getNextEpisodeOrderNum,
} from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_TITLE_LENGTH = 200;

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

function parsePositiveInt(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : parseInt(String(value || ''), 10);
  if (!Number.isFinite(raw)) return null;
  const normalized = Math.floor(raw);
  if (normalized <= 0) return null;
  return normalized;
}

function normalizeTitle(value: unknown, orderNum: number): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return `第${orderNum}集`;
}

function normalizeNote(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeSourceType(value: unknown): 'manual' | 'split' | 'import' {
  if (value === 'manual' || value === 'split' || value === 'import') {
    return value;
  }
  return 'manual';
}

function normalizeMode(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  const normalizedFallback = typeof fallback === 'string' ? fallback.trim() : '';
  return normalizedFallback || 'ai_merge';
}

function isUniqueConstraintError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === 'ER_DUP_ENTRY' || code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE';
}

export const GET = authHandler(async (req, ctx, session) => {
    const { id } = ctx.params;
    const project = await getComicProjectById(id);
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const access = await checkProjectAccess(id, session.user.id);
    if (!access) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    if (project.deletedAt && access === 'member') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const searchParams = new URL(req.url).searchParams;
    const status = parseStatus(searchParams.get('status'));
    const limit = parseLimit(searchParams.get('limit'));
    const offset = parseOffset(searchParams.get('offset'));
    const includeContent = searchParams.get('includeContent') !== 'false';

    const episodes = await getComicEpisodes(id, { status, limit, offset, includeContent });
    const nextOrderNum = await getNextEpisodeOrderNum(id);

    return NextResponse.json({ success: true, data: episodes, nextOrderNum });
}, {
  fallbackMessage: '获取剧集列表失败',
  context: '[API] Episodes list',
});

export const POST = authHandler(async (req, ctx, session) => {
    const { id } = ctx.params;
    const project = await getComicProjectById(id);
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const access = await checkProjectAccess(id, session.user.id);
    if (!access) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    if (project.deletedAt && access === 'member') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const orderNum = parsePositiveInt(body.orderNum);
    if (!orderNum) {
      return NextResponse.json({ error: '序号无效' }, { status: 400 });
    }

    const content = typeof body.content === 'string' ? body.content : '';
    if (!content.trim()) {
      return NextResponse.json({ error: '内容不能为空' }, { status: 400 });
    }

    const title = normalizeTitle(body.title, orderNum);
    if (title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: '标题过长' }, { status: 400 });
    }
    const note = normalizeNote(body.note);
    const sourceType = normalizeSourceType(body.sourceType);
    const mode = normalizeMode(body.mode, project.mode || 'ai_merge');

    const hasConflict = await checkEpisodeOrderConflict(id, orderNum);
    if (hasConflict) {
      return NextResponse.json({ error: '序号已存在' }, { status: 409 });
    }

    let episode;
    try {
      episode = await createComicEpisode({
        projectId: id,
        orderNum,
        title,
        content,
        note,
        sourceType,
        mode,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return NextResponse.json({ error: '序号已存在' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data: episode });
}, {
  fallbackMessage: '创建剧集失败',
  context: '[API] Episode create',
});
