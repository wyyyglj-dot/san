import { NextResponse } from 'next/server';
import { getSystemConfig } from '@/lib/db';
import { fetch as undiciFetch } from 'undici';
import { adminHandler } from '@/lib/api-handler';

interface PicUIImage {
  key: string;
  name: string;
}

interface PicUIListResponse {
  status: boolean;
  message: string;
  data?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    data: PicUIImage[];
  };
}

// POST /api/admin/picui/clear - 清空 PicUI 图床所有图片
export const POST = adminHandler(async () => {
    const config = await getSystemConfig();
    if (!config.picuiApiKey) {
      return NextResponse.json({ error: 'PicUI API Token 未配置' }, { status: 400 });
    }

    const baseUrl = config.picuiBaseUrl.replace(/\/$/, '');
    let deleted = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const listRes = await undiciFetch(`${baseUrl}/images?page=${page}&per_page=100`, {
        headers: {
          'Authorization': `Bearer ${config.picuiApiKey}`,
          'Accept': 'application/json',
        },
      });

      const listData = await listRes.json() as PicUIListResponse;

      if (!listRes.ok || !listData.status || !listData.data) {
        break;
      }

      const images = listData.data.data;
      if (images.length === 0) {
        hasMore = false;
        break;
      }

      for (const image of images) {
        try {
          const delRes = await undiciFetch(`${baseUrl}/images/${image.key}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${config.picuiApiKey}`,
              'Accept': 'application/json',
            },
          });

          if (delRes.ok) {
            deleted++;
          }
        } catch {
          // skip individual image deletion failures
        }
      }

      if (listData.data.current_page >= listData.data.last_page) {
        hasMore = false;
      } else {
        page = 1;
      }
    }

    return NextResponse.json({ success: true, deleted });
}, { fallbackMessage: '清空失败', context: '[API] picui/clear POST' });
