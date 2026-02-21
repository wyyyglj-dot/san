import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { acceptProjectInvite } from '@/lib/db-comic';

export const dynamic = 'force-dynamic';

export const POST = authHandler(async (_req, ctx, session) => {
  const { token } = ctx.params;
  const invite = await acceptProjectInvite(token, session.user.id);
  if (!invite) {
    return NextResponse.json({ error: '邀请链接无效或已过期' }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: invite });
}, {
  fallbackMessage: '接受邀请失败',
  context: '[API] Project invite accept',
});
