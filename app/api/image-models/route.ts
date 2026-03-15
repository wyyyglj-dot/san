import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getSafeImageModels, getSafeImageChannels, getUserVisibleImageChannels } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = authHandler(async (req, ctx, session) => {
  const userId = session.user.id;
  const isAdmin = session.user.role === 'admin';

  const models = await getSafeImageModels(true);

  let channels;
  if (isAdmin) {
    channels = (await getSafeImageChannels(true)).filter(c => c.isListed);
  } else {
    const visibleChannels = await getUserVisibleImageChannels(userId);
    channels = visibleChannels.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      enabled: c.enabled,
      isListed: c.isListed,
    }));
  }

  return NextResponse.json({
    success: true,
    data: { models, channels },
  });
});
