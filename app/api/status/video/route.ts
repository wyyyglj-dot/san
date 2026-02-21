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

const STATUS_MAX_AGE_MS = 5_000;

export const GET = authHandler(async (req, ctx, session) => {
  const userId = session.user.id;
  const now = Date.now();
  const cached = getCachedVideoStatus(userId);
  if (cached && now - cached.updatedAt < STATUS_MAX_AGE_MS) {
    return NextResponse.json({ success: true, data: cached });
  }

  const snapshot = await buildVideoStatusSnapshotForUser(userId);
  setCachedVideoStatus(userId, snapshot);

  return NextResponse.json({ success: true, data: snapshot });
});
