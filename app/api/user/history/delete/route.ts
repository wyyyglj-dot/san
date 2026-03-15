import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { deleteGeneration, deleteGenerations, deleteAllUserGenerations } from '@/lib/db';

export const POST = authHandler(async (req, ctx, session) => {
  const body = await req.json();
  const { action, id, ids } = body;

  let deletedCount = 0;

  switch (action) {
    case 'single':
      // 删除单个
      if (!id) {
        return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
      }
      const success = await deleteGeneration(id, session.user.id);
      deletedCount = success ? 1 : 0;
      break;

    case 'batch':
      // 批量删除
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: '缺少 ids 参数' }, { status: 400 });
      }
      if (ids.length > 100) {
        return NextResponse.json({ error: '一次最多删除 100 条' }, { status: 400 });
      }
      deletedCount = await deleteGenerations(ids, session.user.id);
      break;

    case 'all':
      // 清空所有
      deletedCount = await deleteAllUserGenerations(session.user.id);
      break;

    default:
      return NextResponse.json({ error: '无效的操作类型' }, { status: 400 });
  }

  return NextResponse.json({ success: true, deletedCount });
}, { rateLimit: { scope: 'API', route: 'history-delete' } });
