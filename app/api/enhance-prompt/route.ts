import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { enhancePrompt } from '@/lib/sora-api';

export const POST = authHandler(async (req, ctx, session) => {
  const body = await req.json();
  const { prompt, expansion_level, duration_s } = body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: '请输入提示词' }, { status: 400 });
  }

  const result = await enhancePrompt({
    prompt: prompt.trim(),
    expansion_level: expansion_level || 'medium',
    duration_s,
  });

  const isAdmin = session.user.role === 'admin';

  return NextResponse.json({
    success: true,
    data: {
      enhanced_prompt: result.enhanced_prompt,
    },
    ...(isAdmin && result._debug && { _debug: result._debug }),
  });
});
