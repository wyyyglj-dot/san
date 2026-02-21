import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getUserInviteCode, createUserInviteCode } from '@/lib/db-codes';

export const dynamic = 'force-dynamic';

export const GET = authHandler(async (req, ctx, session) => {
  // Get or create user's invite code
  let code = await getUserInviteCode(session.user.id);
  if (!code) {
    code = await createUserInviteCode(session.user.id);
  }

  return NextResponse.json({ code });
});
