import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getGeneration, updateGeneration, refundGenerationBalance } from '@/lib/db';

export const POST = authHandler(async (req, ctx, session) => {
  const generation = await getGeneration(ctx.params.id);
  if (!generation) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 });
  }

  if (generation.userId !== session.user.id) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  // 只能取消排队中的任务
  if (generation.status !== 'queued') {
    return NextResponse.json(
      { error: `任务状态为 ${generation.status}，无法取消` },
      { status: 400 },
    );
  }

  // 更新状态为 cancelled
  await updateGeneration(ctx.params.id, { status: 'cancelled' });

  // 退款
  await refundGenerationBalance(ctx.params.id, generation.userId, generation.cost);

  return NextResponse.json({ success: true });
});
