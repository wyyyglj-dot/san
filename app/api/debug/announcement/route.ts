import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/api-handler';

// 调试接口 - 直接查询数据库
export const GET = adminHandler(async (req, ctx, session) => {
  // 动态导入以避免循环依赖
  const { createDatabaseAdapter } = await import('@/lib/db-adapter');
  const db = createDatabaseAdapter();

  const [rows] = await db.execute('SELECT * FROM system_config WHERE id = 1');
  const configs = rows as any[];

  if (configs.length === 0) {
    return NextResponse.json({ error: '配置不存在' });
  }

  const row = configs[0];

  return NextResponse.json({
    success: true,
    raw: {
      announcement_title: row.announcement_title,
      announcement_content: row.announcement_content,
      announcement_enabled: row.announcement_enabled,
      announcement_updated_at: row.announcement_updated_at,
    },
    parsed: {
      title: row.announcement_title || '',
      content: row.announcement_content || '',
      enabled: Boolean(row.announcement_enabled),
      updatedAt: Number(row.announcement_updated_at) || 0,
    },
    allColumns: Object.keys(row),
  });
});
