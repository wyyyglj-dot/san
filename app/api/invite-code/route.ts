import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getInviteCode } from '@/lib/sora-api';

export const dynamic = 'force-dynamic';

export const GET = authHandler(async (req, ctx, session) => {
  const result = await getInviteCode();
  return NextResponse.json(result);
});
