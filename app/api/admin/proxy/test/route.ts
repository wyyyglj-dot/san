import { NextResponse } from 'next/server';
import { adminHandler } from '@/lib/api-handler';
import { fetch as undiciFetch } from 'undici';
import { getProxyDispatcher } from '@/lib/proxy-agent';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export const POST = adminHandler(async (req, ctx, session) => {
  const body = await req.json();
  const { proxyUrl } = body;

  if (!proxyUrl) {
    return NextResponse.json({ error: '代理地址不能为空' }, { status: 400 });
  }

  const start = Date.now();
  const dispatcher = await getProxyDispatcher(proxyUrl);

  try {
    const response = await undiciFetch('https://www.google.com', {
      method: 'HEAD',
      dispatcher,
      signal: AbortSignal.timeout(10000),
    });

    const latency = Date.now() - start;

    if (response.ok) {
      return NextResponse.json({
        success: true,
        latency,
        message: '代理连接成功',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: `HTTP ${response.status}`,
      }, { status: 200 });
    }
  } catch (error) {
    const latency = Date.now() - start;
    return NextResponse.json({
      success: false,
      latency,
      error: error instanceof Error ? error.message : '连接失败',
    }, { status: 200 });
  }
});
