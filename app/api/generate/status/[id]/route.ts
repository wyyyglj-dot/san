import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getGeneration, getUserQueuePosition } from '@/lib/db';

export const dynamic = 'force-dynamic';

function convertToMediaUrl(resultUrl: string | undefined, id: string, _type: string): string {
  if (!resultUrl) return '';
  return `/api/media/${id}`;
}

export const GET = authHandler(async (_req, ctx, session) => {
  const { id } = ctx.params;
  const generation = await getGeneration(id);

  if (!generation) {
    return NextResponse.json({ success: false, error: '任务不存在' }, { status: 404 });
  }

  if (generation.userId !== session.user.id) {
    return NextResponse.json({ success: false, error: '无权访问此任务' }, { status: 403 });
  }

  let generationParams: Record<string, unknown> | undefined;
  if (generation.params) {
    if (typeof generation.params === 'string') {
      try {
        generationParams = JSON.parse(generation.params);
      } catch {
        generationParams = undefined;
      }
    } else {
      generationParams = generation.params as Record<string, unknown>;
    }
  }

  let queuePosition: number | undefined;
  if (generation.status === 'queued') {
    queuePosition = await getUserQueuePosition(generation.userId, generation.id);
  }

  return NextResponse.json({
    success: true,
    data: {
      id: generation.id,
      status: generation.status,
      type: generation.type,
      url: convertToMediaUrl(generation.resultUrl, generation.id, generation.type),
      cost: generation.cost,
      progress: generationParams?.progress ?? 0,
      errorMessage: generation.errorMessage,
      params: generationParams,
      createdAt: generation.createdAt,
      updatedAt: generation.updatedAt,
      ...(queuePosition !== undefined && { queuePosition }),
    },
  });
}, { fallbackMessage: '查询失败', context: '[API] Get generation status' });
