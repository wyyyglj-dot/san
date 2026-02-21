import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getGeneration, updateGeneration, refundGenerationBalance } from '@/lib/db';
import { triggerNextQueuedTask } from '@/lib/task-scheduler';

// 取消任务
export const DELETE = authHandler(async (req, ctx, session) => {
  const generation = await getGeneration(ctx.params.id);

  if (!generation) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 });
  }

  // 验证任务所有权
  if (generation.userId !== session.user.id) {
    return NextResponse.json({ error: '无权操作此任务' }, { status: 403 });
  }

  // 只能取消 queued、pending 或 processing 状态的任务
  if (generation.status !== 'queued' && generation.status !== 'pending' && generation.status !== 'processing') {
    return NextResponse.json(
      { error: '只能取消进行中的任务' },
      { status: 400 },
    );
  }

  // 更新任务状态为已取消
  await updateGeneration(ctx.params.id, {
    status: 'cancelled',
  });

  try {
    await refundGenerationBalance(generation.id, generation.userId, generation.cost);
  } catch (refundErr) {
    console.error('[API] Failed to refund balance:', refundErr);
  }

  // Trigger next queued task after cancellation
  triggerNextQueuedTask(generation.userId).catch(() => {});

  return NextResponse.json({ success: true });
});
