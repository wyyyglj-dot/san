import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { initializeDatabase } from '@/lib/db';
import { createDatabaseAdapter } from '@/lib/db-adapter';

export const POST = authHandler(async (req, ctx, session) => {
  await initializeDatabase();
  const db = createDatabaseAdapter();

  // 删除用户所有角色卡
  const [result] = await db.execute(
    'DELETE FROM character_cards WHERE user_id = ?',
    [session.user.id],
  );

  const deletedCount = (result as any).affectedRows || 0;

  return NextResponse.json({
    success: true,
    deletedCount,
  });
});
