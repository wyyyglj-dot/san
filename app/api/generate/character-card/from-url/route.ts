import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { ApiError } from '@/lib/api-error';
import { createCharacterCardFromUrl } from '@/lib/sora-api';
import { getSystemConfig, getUserDailyUsage, saveCharacterCard, updateCharacterCard, checkUserConcurrencyLimit } from '@/lib/db';
import { uploadToPicUI } from '@/lib/picui';
import {
  buildFileUrl,
  getBackupImgbedConfig,
  getFileConstraints,
  getPrimaryImgbedConfig,
  isValidImgbedUrl,
  validateFile,
} from '@/lib/imgbed';
import type { ImgbedConfig } from '@/lib/imgbed';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface CharacterCardFromUrlRequestBody {
  videoUrl?: string;
  timestamps?: string;
  firstFrameBase64?: string;
}

interface ParsedTimestampRange {
  normalized: string;
  start: number;
  end: number;
}

function parseTimestampRange(value: string): ParsedTimestampRange | null {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return null;

  const start = Math.round(Number(parts[0]));
  const end = Math.round(Number(parts[1]));

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end <= start) return null;

  const diff = end - start;
  if (diff < 1 || diff > 3) return null;

  return { normalized: `${start},${end}`, start, end };
}

function resolveImgbedUrl(
  videoUrl: string,
  primary: ImgbedConfig,
  backup: ImgbedConfig
): string | null {
  // 如果已经是完整 URL，直接验证
  if (/^https?:\/\//i.test(videoUrl)) {
    const primaryAvailable = primary.enabled && Boolean(primary.baseUrl);
    const backupAvailable = backup.enabled && Boolean(backup.baseUrl);

    if (primaryAvailable && isValidImgbedUrl(videoUrl, primary.baseUrl)) {
      return videoUrl;
    }
    if (backupAvailable && isValidImgbedUrl(videoUrl, backup.baseUrl)) {
      return videoUrl;
    }
    // 允许其他公网 URL（如 Sora 返回的 URL）
    return videoUrl;
  }

  // 相对路径，尝试拼接
  const primaryAvailable = primary.enabled && Boolean(primary.baseUrl);
  const backupAvailable = backup.enabled && Boolean(backup.baseUrl);

  if (primaryAvailable) {
    return buildFileUrl(primary.baseUrl, videoUrl);
  }
  if (backupAvailable) {
    return buildFileUrl(backup.baseUrl, videoUrl);
  }

  return null;
}

async function fetchRemoteFileMeta(
  url: string
): Promise<{ fileSizeBytes?: number; fileType?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual', // Don't follow redirects automatically
    });

    clearTimeout(timeoutId);

    // Handle redirects - reject cross-origin redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        try {
          const originalHost = new URL(url).host;
          const redirectHost = new URL(location, url).host;
          if (originalHost !== redirectHost) {
            return { error: '不允许跨域重定向' };
          }
          // Same-origin redirect, follow it
          return fetchRemoteFileMeta(location);
        } catch {
          return { error: '重定向 URL 无效' };
        }
      }
    }

    if (!response.ok) {
      return { error: `远程文件不可访问 (${response.status})` };
    }

    const sizeHeader = response.headers.get('content-length');
    const fileTypeHeader = response.headers.get('content-type');
    const fileSizeBytes = sizeHeader ? Number(sizeHeader) : undefined;

    return {
      fileSizeBytes: Number.isFinite(fileSizeBytes) ? fileSizeBytes : undefined,
      fileType: fileTypeHeader ? fileTypeHeader.split(';')[0].trim() : undefined,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { error: '获取文件信息超时' };
    }
    return { error: '无法获取远程文件信息' };
  }
}

export const POST = authHandler(async (req, _ctx, session) => {
  let cardId: string | null = null;
  try {
    const body = await req.json() as CharacterCardFromUrlRequestBody;
    const videoUrlRaw = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
    const timestampsRaw = typeof body.timestamps === 'string' ? body.timestamps.trim() : '';
    const firstFrameBase64 = typeof body.firstFrameBase64 === 'string' ? body.firstFrameBase64.trim() : '';

    if (!videoUrlRaw || !timestampsRaw) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const parsed = parseTimestampRange(timestampsRaw);
    if (!parsed) {
      return NextResponse.json({ error: '时间范围格式无效，需要 1-3 秒' }, { status: 400 });
    }

    const [usage, config] = await Promise.all([
      getUserDailyUsage(session.user.id),
      getSystemConfig(),
    ]);

    if (
      config.dailyLimit.characterCardLimit > 0 &&
      usage.characterCardCount >= config.dailyLimit.characterCardLimit
    ) {
      return NextResponse.json(
        { error: '今日角色卡创建次数已达上限' },
        { status: 429 }
      );
    }

    // 检查并发限制
    const concurrencyCheck = await checkUserConcurrencyLimit(session.user.id);
    if (!concurrencyCheck.allowed) {
      return NextResponse.json(
        { error: concurrencyCheck.message },
        { status: 429 }
      );
    }

    const [primary, backup, constraints] = await Promise.all([
      getPrimaryImgbedConfig(config),
      getBackupImgbedConfig(config),
      getFileConstraints(config),
    ]);

    const resolvedUrl = resolveImgbedUrl(videoUrlRaw, primary, backup);
    if (!resolvedUrl) {
      return NextResponse.json({ error: '视频 URL 无效' }, { status: 400 });
    }

    // 验证远程文件
    const meta = await fetchRemoteFileMeta(resolvedUrl);

    // 如果获取元数据失败，返回错误
    if (meta.error) {
      return NextResponse.json(
        { error: meta.error },
        { status: 400 }
      );
    }

    // 如果无法获取文件大小，拒绝请求（防止绕过大小限制）
    if (meta.fileSizeBytes === undefined && constraints.maxFileSizeBytes > 0) {
      return NextResponse.json(
        { error: '无法验证文件大小，请确保文件可访问' },
        { status: 400 }
      );
    }

    const validation = validateFile(
      {
        fileName: resolvedUrl,
        fileType: meta.fileType,
        fileSizeBytes: meta.fileSizeBytes,
      },
      constraints
    );

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error || '文件验证失败' },
        { status: 400 }
      );
    }

    // 上传首帧到图床
    let avatarUrl = firstFrameBase64 || '';
    if (firstFrameBase64) {
      try {
        const picuiUrl = await uploadToPicUI(firstFrameBase64, `avatar_${Date.now()}.jpg`);
        if (picuiUrl) {
          avatarUrl = picuiUrl;
        }
      } catch (err) {
        console.warn('[API] PicUI 上传失败:', err);
      }
    }

    // 创建角色卡记录
    const card = await saveCharacterCard({
      userId: session.user.id,
      characterName: '',
      avatarUrl,
      sourceVideoUrl: resolvedUrl,
      status: 'processing',
    });
    cardId = card.id;

    console.log('[API] 角色卡创建（from-url）:', { cardId, videoUrl: resolvedUrl, timestamps: parsed.normalized });

    // 调用中转站 API
    const result = await createCharacterCardFromUrl({
      url: resolvedUrl,
      timestamps: parsed.normalized,
    });

    const characterName = result.username || result.id || '';
    const avatarFromApi = result.profile_picture_url || avatarUrl;

    const updatedCard = await updateCharacterCard(card.id, {
      characterName,
      avatarUrl: avatarFromApi,
      status: 'completed',
    });
    const finalCard = updatedCard ?? card;

    return NextResponse.json({
      success: true,
      data: {
        id: finalCard.id,
        status: 'completed',
        characterName: finalCard.characterName || characterName,
        avatarUrl: finalCard.avatarUrl || avatarFromApi,
      },
    });
  } catch (error) {
    if (cardId) {
      const errorMessage =
        error instanceof ApiError && error.expose
          ? error.message
          : '角色卡创建失败';
      try {
        await updateCharacterCard(cardId, { status: 'failed', errorMessage });
      } catch (updateError) {
        console.error('[API] Failed to mark character card failed:', updateError);
      }
    }
    throw error;
  }
}, {
  rateLimit: { scope: 'GENERATE', route: '/api/generate/character-card/from-url' },
  fallbackMessage: '角色卡创建失败',
  context: '[API] Character card from-url',
});
