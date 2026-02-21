import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getPendingGenerationsCount } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = authHandler(async (req, ctx, session) => {
  const count = await getPendingGenerationsCount(session.user.id);
  return NextResponse.json({ success: true, data: { count } });
});
