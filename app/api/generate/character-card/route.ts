/* eslint-disable no-console */
import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { saveCharacterCard, updateCharacterCard, deleteCharacterCard, getUserById, checkUserConcurrencyLimit } from '@/lib/db';
import { createCharacterCard } from '@/lib/sora-api';
import { uploadToPicUI } from '@/lib/picui';

// 配置路由段选项
export const maxDuration = 300; // 5分钟超时
export const dynamic = 'force-dynamic';

interface CharacterCardRequest {
  videoBase64: string; // base64 编码的视频数据
  firstFrameBase64: string; // 视频第一帧的 base64 图片
  username?: string; // 自定义角色用户名（不含 @）
  displayName?: string; // 自定义角色显示名称
  instructionSet?: string; // 角色指令集
  safetyInstructionSet?: string; // 安全指令集
  timestamps?: string; // 时间戳
}

// 后台处理任务
async function processCharacterCardTask(
  cardId: string,
  userId: string,
  body: CharacterCardRequest
): Promise<void> {
  try {
    console.log(`[Task ${cardId}] 开始处理角色卡生成任务`);

    // 调用非流式 API
    const result = await createCharacterCard({
      video_base64: body.videoBase64,
      model: 'sora-video-10s',
      timestamps: body.timestamps || '0,3',
      username: body.username,
      display_name: body.displayName,
      instruction_set: body.instructionSet,
      safety_instruction_set: body.safetyInstructionSet,
    });

    // 调试日志：打印完整返回结果
    console.log(`[Task ${cardId}] API 返回结果:`, JSON.stringify(result));

    // 尝试从多个来源获取角色名称
    // 1. 直接从 data 字段获取
    let returnedUsername = result.data?.username;
    let returnedDisplayName = result.data?.display_name;
    const cameoId = result.data?.cameo_id;

    // 2. 如果 data.message 是 JSON 字符串，尝试解析
    if (!returnedUsername && result.data?.message && result.data.message.startsWith('{')) {
      try {
        const messageData = JSON.parse(result.data.message);
        returnedUsername = messageData.username;
        returnedDisplayName = messageData.display_name;
        console.log(`[Task ${cardId}] 从 message 解析: username=${returnedUsername}`);
      } catch {
        // message 不是 JSON，忽略
      }
    }

    // 3. 使用 cameo_id 或 result.id 作为备选
    const characterName = returnedUsername || returnedDisplayName || cameoId || result.id || '未命名角色';

    console.log(`[Task ${cardId}] 角色卡创建成功: ${characterName}`);

    // 更新角色卡记录为完成状态
    await updateCharacterCard(cardId, {
      characterName,
      status: 'completed',
    });

    console.log(`[Task ${cardId}] 任务完成`);
  } catch (error) {
    console.error(`[Task ${cardId}] 角色卡生成失败:`, error);

    // 失败时直接删除记录
    await deleteCharacterCard(cardId, userId);
  }
}

export const POST = authHandler(async (req, _ctx, session) => {
    const body: CharacterCardRequest = await req.json();

    if (!body.videoBase64) {
      return NextResponse.json(
        { success: false, error: '请上传视频文件' },
        { status: 400 }
      );
    }

    const user = await getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 401 });
    }

    const concurrencyCheck = await checkUserConcurrencyLimit(session.user.id);
    if (!concurrencyCheck.allowed) {
      return NextResponse.json(
        { success: false, error: concurrencyCheck.message },
        { status: 429 }
      );
    }

    // 尝试上传头像到 PicUI 图床
    let avatarUrl = body.firstFrameBase64;
    try {
      const picuiUrl = await uploadToPicUI(body.firstFrameBase64, `avatar_${Date.now()}.jpg`);
      if (picuiUrl) {
        avatarUrl = picuiUrl;
        console.log('[API] 角色卡头像已上传到 PicUI:', picuiUrl);
      }
    } catch (err) {
      console.warn('[API] PicUI 上传失败，使用 base64:', err);
    }

    // 创建角色卡记录（状态为 processing）
    const card = await saveCharacterCard({
      userId: user.id,
      characterName: '',
      avatarUrl,
      sourceVideoUrl: undefined,
      status: 'processing',
    });

    // 在后台异步处理（不等待完成）
    processCharacterCardTask(card.id, user.id, body).catch((err) => {
      console.error('[API] 角色卡后台任务启动失败:', err);
    });

    const isAdmin = session.user.role === 'admin';

    // 立即返回任务 ID
    return NextResponse.json({
      success: true,
      ...(isAdmin && {
        _debug: {
          apiUrl: null,
          model: 'sora-video-10s',
          channelType: 'sora',
          channelId: null,
        },
      }),
      data: {
        id: card.id,
        status: 'processing',
        message: '角色卡创建任务已提交，正在后台处理中',
      },
    });
}, {
  rateLimit: { scope: 'GENERATE', route: '/api/generate/character-card' },
  fallbackMessage: '生成失败',
  context: '[API] Character card generation',
});
