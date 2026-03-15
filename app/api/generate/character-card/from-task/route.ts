/* eslint-disable no-console */
import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { ApiError } from '@/lib/api-error';
import { createCharacterCardFromTask, createCharacterCardFromUrl, isValidVideoId, getVideoContentUrl, isSoraVideoId, isProxyVideoId, resolveNativeVideoId } from '@/lib/sora-api';
import { getGeneration, getSystemConfig, getUserDailyUsage, saveCharacterCard, updateCharacterCard, getVideoChannel } from '@/lib/db';
import { createKieCharacterTask, pollKieCharacterCompletion } from '@/lib/kie-api';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface CharacterCardFromTaskRequestBody {
  generationId?: string;
  timestamps?: string;
  characterPrompt?: string;
  characterUserName?: string;
  firstFrameBase64?: string;
}

interface ParsedTimestampRange {
  normalized: string;
  start: number;
  end: number;
}

function parseTimestampRange(value: string, allowDecimal = false): ParsedTimestampRange | null {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return null;

  const rawStart = Number(parts[0]);
  const rawEnd = Number(parts[1]);
  if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return null;
  if (rawStart < 0 || rawEnd <= rawStart) return null;

  // KIE.AI 支持小数时间戳，Sora 兼容 API 只接受整数
  const start = allowDecimal ? Math.round(rawStart * 100) / 100 : Math.round(rawStart);
  const end = allowDecimal ? Math.round(rawEnd * 100) / 100 : Math.round(rawEnd);

  const diff = end - start;
  if (diff < 1 || diff > 4) return null;

  return { normalized: `${start},${end}`, start, end };
}

function parseDurationSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(s)?$/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds : null;
}

export const POST = authHandler(async (req, _ctx, session) => {
  let cardId: string | null = null;
  try {
    const body = await req.json() as CharacterCardFromTaskRequestBody;
    const generationId = typeof body.generationId === 'string' ? body.generationId.trim() : '';
    const timestampsRaw = typeof body.timestamps === 'string' ? body.timestamps.trim() : '';
    const characterPrompt = typeof body.characterPrompt === 'string' ? body.characterPrompt.trim() : '';
    const effectiveCharacterPrompt = characterPrompt || '.';
    const characterUserName = typeof body.characterUserName === 'string' ? body.characterUserName.trim() : '';
    const firstFrameBase64 = typeof body.firstFrameBase64 === 'string' ? body.firstFrameBase64 : '';

    if (!generationId || !timestampsRaw) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const generation = await getGeneration(generationId);
    if (!generation) {
      return NextResponse.json({ error: '生成记录不存在' }, { status: 404 });
    }

    // 打印生成记录的详细信息用于调试
    console.log('[API] 生成记录详细信息:', {
      id: generation.id,
      type: generation.type,
      status: generation.status,
      resultUrl: generation.resultUrl || '(空)',
      params: generation.params ? JSON.stringify(generation.params) : '(空)',
      createdAt: generation.createdAt,
    });

    if (generation.userId !== session.user.id) {
      return NextResponse.json({ error: '无权访问此记录' }, { status: 403 });
    }

    if (generation.type !== 'sora-video') {
      return NextResponse.json({ error: '仅支持视频类型' }, { status: 400 });
    }

    if (generation.status !== 'completed') {
      return NextResponse.json({ error: '视频尚未生成完成' }, { status: 409 });
    }

    const videoId = typeof generation.params?.videoId === 'string' ? generation.params.videoId : '';
    const videoChannelId = typeof generation.params?.videoChannelId === 'string' ? generation.params.videoChannelId : undefined;

    console.log('[API] 角色卡 videoChannelId 提取:', {
      videoChannelId: videoChannelId || '(空/undefined)',
      paramsKeys: generation.params ? Object.keys(generation.params) : [],
      rawVideoChannelId: generation.params?.videoChannelId,
    });

    // 判断是否为 KIE.AI 渠道
    let isKieChannel = generation.params?.videoChannelType === 'kie-ai';
    let kieChannelConfig: { baseUrl: string; apiKey: string } | null = null;
    if (videoChannelId) {
      // 兼容旧记录：通过 channelId 查询渠道类型
      const channel = await getVideoChannel(videoChannelId);
      if (channel?.type === 'kie-ai') {
        isKieChannel = true;
      }
      if (isKieChannel && channel) {
        kieChannelConfig = { baseUrl: channel.baseUrl, apiKey: channel.apiKey };
      }
    }

    // KIE.AI 渠道支持小数时间戳和 1-4 秒时长
    const parsed = parseTimestampRange(timestampsRaw, isKieChannel);
    if (!parsed) {
      return NextResponse.json({ error: `时间范围格式无效，需要 1-${isKieChannel ? 4 : 4} 秒` }, { status: 400 });
    }

    // KIE.AI 渠道角色描述为空时自动使用默认值

    // 优先使用保存的原始外部 URL（本地下载后 resultUrl 会变为本地路径）
    const originalVideoUrl = typeof generation.params?.originalVideoUrl === 'string' ? generation.params.originalVideoUrl.trim() : '';
    const videoUrl = originalVideoUrl || (generation.resultUrl || '').trim();
    // 排除 chatcmpl-* 前缀的 ID（OpenAI 兼容渠道返回的 completion ID，不是有效的 Sora 任务 ID）
    const hasValidVideoId = Boolean(videoId) && isValidVideoId(videoId) && !videoId.startsWith('chatcmpl-');
    const hasValidVideoUrl = videoUrl.startsWith('http://') || videoUrl.startsWith('https://');
    const useUrlMethod = !hasValidVideoId;

    // 打印关键字段用于调试
    console.log('[API] 角色卡创建关键字段:', {
      videoId: videoId || '(空)',
      originalVideoUrl: originalVideoUrl || '(空)',
      videoUrl: videoUrl || '(空)',
      hasValidVideoId,
      hasValidVideoUrl,
      useUrlMethod,
    });

    if (!videoId && !videoUrl) {
      return NextResponse.json({ error: '缺少视频 ID 和 URL，无法创建角色卡' }, { status: 400 });
    }
    if (useUrlMethod && !hasValidVideoUrl) {
      return NextResponse.json({ error: '视频 ID 格式无效且缺少有效的视频 URL' }, { status: 400 });
    }

    const durationSeconds = parseDurationSeconds(generation.params?.duration);
    if (durationSeconds !== null && durationSeconds > 0 && parsed.end > durationSeconds) {
      return NextResponse.json({ error: '结束时间超出视频时长' }, { status: 400 });
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

    const card = await saveCharacterCard({
      userId: session.user.id,
      characterName: '',
      avatarUrl: '',
      sourceVideoUrl: generation.resultUrl || undefined,
      status: 'processing',
    });
    cardId = card.id;

    const creationMethod = isKieChannel ? 'kie-ai' : (useUrlMethod ? 'url' : 'from_task');
    console.log('[API] 角色卡创建方式:', {
      generationId,
      method: creationMethod,
      videoId: hasValidVideoId ? videoId : undefined,
      videoUrl: hasValidVideoUrl ? videoUrl : undefined,
      timestamps: parsed.normalized,
      characterPrompt: isKieChannel ? effectiveCharacterPrompt.substring(0, 50) : undefined,
    });

    // KIE.AI 渠道：使用 sora-2-characters-pro API
    if (isKieChannel) {
      if (!kieChannelConfig && videoChannelId) {
        const channel = await getVideoChannel(videoChannelId);
        if (channel) {
          kieChannelConfig = { baseUrl: channel.baseUrl, apiKey: channel.apiKey };
        }
      }
      if (!kieChannelConfig?.baseUrl || !kieChannelConfig?.apiKey) {
        return NextResponse.json({ error: 'KIE.AI 渠道配置缺失' }, { status: 500 });
      }

      const { taskId: characterTaskId } = await createKieCharacterTask(
        {
          originTaskId: videoId,
          timestamps: parsed.normalized,
          characterPrompt: effectiveCharacterPrompt,
          characterUserName: characterUserName || undefined,
        },
        kieChannelConfig
      );

      const { characterId, characterUserName: returnedUserName } = await pollKieCharacterCompletion(
        characterTaskId,
        kieChannelConfig
      );

      const displayName = returnedUserName || characterId;
      // 优先使用前端截取的第一帧，回退到源视频 URL
      const kieAvatarUrl = firstFrameBase64 || videoUrl || generation.resultUrl || '';
      const updatedCard = await updateCharacterCard(card.id, {
        characterName: displayName,
        avatarUrl: kieAvatarUrl,
        status: 'completed',
      });
      const finalCard = updatedCard ?? card;

      console.log('[API] KIE.AI 角色卡创建成功:', { cardId: finalCard.id, characterId, characterUserName });

      return NextResponse.json({
        success: true,
        data: {
          id: finalCard.id,
          status: finalCard.status,
          characterName: finalCard.characterName || displayName,
          avatarUrl: finalCard.avatarUrl,
          characterId,
        },
      });
    }

    // 非 KIE.AI 渠道：使用现有 Sora 兼容 API
    let result;
    if (useUrlMethod) {
      // 直接使用 URL 方式
      result = await createCharacterCardFromUrl({
        url: videoUrl,
        timestamps: parsed.normalized,
      }, videoChannelId);
    } else {
      // 如果 videoId 是代理格式 (model:uuid)，先解析为原生 video_xxx 格式
      const resolvedVideoId = await resolveNativeVideoId(videoId, videoChannelId);
      console.log('[API] 解析后的 videoId:', { original: videoId, resolved: resolvedVideoId });

      // 始终优先尝试 from_task（真人角色卡只能用 from_task 创建）
      try {
        result = await createCharacterCardFromTask({
          from_task: resolvedVideoId,
          timestamps: parsed.normalized,
        }, videoChannelId);
      } catch (taskError) {
        const errMsg = taskError instanceof Error ? taskError.message : String(taskError);

        // 如果是代理格式 ID，尝试剥离模型前缀后重试 from_task
        if (isProxyVideoId(resolvedVideoId)) {
          const strippedId = resolvedVideoId.replace(/^[^:]+:/, '');
          console.log('[API] from_task 代理格式失败，尝试剥离前缀重试:', {
            original: resolvedVideoId,
            stripped: strippedId,
            error: errMsg,
          });
          try {
            result = await createCharacterCardFromTask({
              from_task: strippedId,
              timestamps: parsed.normalized,
            }, videoChannelId);
          } catch (strippedError) {
            // 剥离前缀也失败，回退到 url（仅非真人角色卡可用）
            if (hasValidVideoUrl) {
              console.log('[API] from_task 所有格式均失败，回退到 URL 方式（注意：真人角色卡不支持此方式）:', {
                error: strippedError instanceof Error ? strippedError.message : String(strippedError),
                videoUrl: videoUrl.substring(0, 80),
              });
              result = await createCharacterCardFromUrl({
                url: videoUrl,
                timestamps: parsed.normalized,
              }, videoChannelId);
            } else {
              throw taskError;
            }
          }
        } else if (hasValidVideoUrl) {
          // 非代理格式 from_task 失败，回退到 url
          console.log('[API] from_task 方式失败，回退到 URL 方式:', {
            error: errMsg,
            videoUrl: videoUrl.substring(0, 80),
          });
          result = await createCharacterCardFromUrl({
            url: videoUrl,
            timestamps: parsed.normalized,
          }, videoChannelId);
        } else if (isSoraVideoId(videoId)) {
          // 旧视频无 originalVideoUrl，尝试通过 videoId 向上游查询原始 URL
          console.log('[API] from_task 方式失败且无外部 URL，尝试通过 videoId 查询原始 URL:', {
            error: errMsg,
            videoId,
            videoChannelId: videoChannelId || '(空)',
          });
          try {
            const recoveredUrl = await getVideoContentUrl(videoId, videoChannelId);
            if (recoveredUrl && (recoveredUrl.startsWith('http://') || recoveredUrl.startsWith('https://'))) {
              console.log('[API] 成功恢复原始 URL，回退到 URL 方式:', { recoveredUrl: recoveredUrl.substring(0, 80) });
              result = await createCharacterCardFromUrl({
                url: recoveredUrl,
                timestamps: parsed.normalized,
              }, videoChannelId);
            } else {
              throw taskError;
            }
          } catch (urlRecoverError) {
            console.error('[API] 通过 videoId 恢复 URL 也失败:', urlRecoverError instanceof Error ? urlRecoverError.message : String(urlRecoverError));
            throw taskError;
          }
        } else {
          throw taskError;
        }
      }
    }

    const characterName = result.username || result.id || '';
    const avatarUrl = result.profile_picture_url || '';

    const updatedCard = await updateCharacterCard(card.id, {
      characterName,
      avatarUrl,
      status: 'completed',
    });
    const finalCard = updatedCard ?? card;

    console.log('[API] 角色卡创建成功:', { cardId: finalCard.id, characterName });

    return NextResponse.json({
      success: true,
      data: {
        id: finalCard.id,
        status: finalCard.status,
        characterName: finalCard.characterName || characterName,
        avatarUrl: finalCard.avatarUrl || avatarUrl,
      },
    });
  } catch (error) {
    if (cardId) {
      const errorMessage =
        error instanceof ApiError && error.expose ? error.message : '角色卡创建失败';
      try {
        await updateCharacterCard(cardId, { status: 'failed', errorMessage });
      } catch (updateError) {
        console.error('[API] Failed to mark character card failed:', updateError);
      }
    }
    throw error;
  }
}, {
  rateLimit: { scope: 'GENERATE', route: '/api/generate/character-card/from-task' },
  fallbackMessage: '角色卡创建失败',
  context: '[API] Character card from-task',
});
