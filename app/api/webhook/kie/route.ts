import { NextRequest, NextResponse } from 'next/server';
import { updateGeneration, getGeneration } from '@/lib/db';
import { verifyAndConsumeToken } from '@/lib/webhook-token';

export const dynamic = 'force-dynamic';

interface KieCallbackData {
  taskId: string;
  state: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail';
  resultJson?: string;
  failCode?: string;
  failMsg?: string;
  progress?: number;
}

const TERMINAL_STATES = new Set(['completed', 'failed']);

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('taskId');
    const token = searchParams.get('token');

    if (!generationId) {
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
    }

    // Verify webhook token
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await verifyAndConsumeToken(generationId, token);
    if (!result.valid) {
      if (result.reason === 'expired') {
        return NextResponse.json({ error: 'Token expired' }, { status: 410 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data: KieCallbackData = await request.json();
    console.log(`[Webhook] kie.ai callback for task ${generationId}:`, data.state);

    // State determinism: skip if already in terminal state
    const existing = await getGeneration(generationId);
    if (existing && TERMINAL_STATES.has(existing.status)) {
      return NextResponse.json({ success: true });
    }

    if (data.state === 'success' && data.resultJson) {
      const parsed = JSON.parse(data.resultJson);
      const url = parsed.resultUrls?.[0];

      if (url) {
        await updateGeneration(generationId, {
          status: 'completed',
          resultUrl: url,
          params: { progress: 100 },
        });
      }
    } else if (data.state === 'fail') {
      await updateGeneration(generationId, {
        status: 'failed',
        errorMessage: data.failMsg || '生成失败',
      });
    } else if (data.progress !== undefined) {
      await updateGeneration(generationId, {
        params: { progress: data.progress },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Webhook] kie.ai callback error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'kie-ai-webhook' });
}
