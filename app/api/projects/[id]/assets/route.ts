import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkProjectAccess,
  createProjectAsset,
  getComicProjectById,
  getProjectAssets,
  getProjectAssetStats,
  type ProjectAssetType,
} from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

function parseAssetType(value: string | null): ProjectAssetType | null {
  if (value === 'character' || value === 'scene' || value === 'prop') return value;
  return null;
}

export const GET = authHandler(async (req, ctx, session) => {
    const { id } = ctx.params;
    const project = await getComicProjectById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: '项目不存在' }, { status: 404 });
    }

    const access = await checkProjectAccess(id, session.user.id);
    if (!access) {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const searchParams = new URL(req.url).searchParams;
    const typeParam = searchParams.get('type');
    const type = typeParam ? parseAssetType(typeParam) : undefined;
    if (typeParam && !type) {
      return NextResponse.json({ success: false, error: '无效的资产类型' }, { status: 400 });
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10) || 200, 500);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);
    const search = searchParams.get('search')?.trim() || undefined;

    const [assets, stats] = await Promise.all([
      getProjectAssets(id, { type: type ?? undefined, limit, offset, search }),
      getProjectAssetStats(id),
    ]);

    return NextResponse.json({ success: true, data: assets, stats });
}, {
  fallbackMessage: '获取资产失败',
  context: '[API] Project assets list',
});

export const POST = authHandler(async (req, ctx, session) => {
    const { id } = ctx.params;
    const project = await getComicProjectById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: '项目不存在' }, { status: 404 });
    }

    const access = await checkProjectAccess(id, session.user.id);
    if (!access) {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const type = parseAssetType(typeof body.type === 'string' ? body.type : null);
    if (!type) {
      return NextResponse.json({ success: false, error: '无效的资产类型' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ success: false, error: '资产名称不能为空' }, { status: 400 });
    }
    if (name.length > 200) {
      return NextResponse.json({ success: false, error: '资产名称过长' }, { status: 400 });
    }

    const asset = await createProjectAsset({
      projectId: id,
      type,
      name,
      description: typeof body.description === 'string' ? body.description : undefined,
      attributes: body.attributes && typeof body.attributes === 'object' ? body.attributes : undefined,
      primaryImageUrl: typeof body.primaryImageUrl === 'string' ? body.primaryImageUrl : undefined,
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
    });

    return NextResponse.json({ success: true, data: asset });
}, {
  fallbackMessage: '创建资产失败',
  context: '[API] Project asset create',
});
