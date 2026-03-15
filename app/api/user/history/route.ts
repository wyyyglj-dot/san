import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getUserGenerations } from '@/lib/db';
import type { Generation } from '@/types';

// 所有媒体统一走代理，避免防盗链/过期/CORS 问题
function convertToMediaUrl(generation: Generation): Generation {
  const { resultUrl } = generation;
  if (!resultUrl) return generation;
  return { ...generation, resultUrl: `/api/media/${generation.id}` };
}

export const GET = authHandler(async (req, ctx, session) => {
  // 支持分页
  const url = new URL(req.url, 'http://localhost');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = (page - 1) * limit;

  const generations = await getUserGenerations(session.user.id, limit, offset);

  // 将 base64 URL 转换为媒体 API URL，大幅减小响应体积
  const processedGenerations = generations.map(convertToMediaUrl);

  return NextResponse.json(
    { success: true, data: processedGenerations, page, limit },
  );
}, { rateLimit: { scope: 'API', route: 'history' } });
