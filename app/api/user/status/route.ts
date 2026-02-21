import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  buildVideoStatusSnapshotForUser,
  getCachedVideoStatus,
  setCachedVideoStatus,
  startVideoStatusPoller,
} from '@/lib/status-poller';

export const dynamic = 'force-dynamic';

startVideoStatusPoller();

export const GET = authHandler(async (req, ctx, session) => {
  const cached = getCachedVideoStatus(session.user.id);
  if (cached) {
    return NextResponse.json({ success: true, data: cached });
  }

  const snapshot = await buildVideoStatusSnapshotForUser(session.user.id);
  setCachedVideoStatus(session.user.id, snapshot);

  return NextResponse.json({ success: true, data: snapshot });
});
