import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkProjectAccess,
  getComicEpisodeById,
  getComicProjectById,
  getProjectPreferences,
} from '@/lib/db-comic';
import { generateStoryboard } from '@/lib/ai-storyboard-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export const POST = authHandler(async (req, ctx, session) => {
  const { episodeId } = ctx.params;
  const episode = await getComicEpisodeById(episodeId);
  if (!episode || episode.deletedAt) {
    return NextResponse.json(
      { success: false, error: '剧集不存在' },
      { status: 404 },
    );
  }

  const access = await checkProjectAccess(
    episode.projectId,
    session.user.id,
  );
  if (!access) {
    return NextResponse.json(
      { success: false, error: '无权限' },
      { status: 403 },
    );
  }

  const project = await getComicProjectById(episode.projectId);
  if (!project || project.deletedAt) {
    return NextResponse.json(
      { success: false, error: '项目不存在' },
      { status: 404 },
    );
  }

  const content = episode.content?.trim();
  if (!content) {
    return NextResponse.json(
      { success: false, error: '剧集内容为空' },
      { status: 400 },
    );
  }

  const MAX_CONTENT_LENGTH = 50_000;
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { success: false, error: `剧本内容过长（${content.length} 字），上限 ${MAX_CONTENT_LENGTH} 字` },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const preferences = await getProjectPreferences(episode.projectId);
  const textModelId =
    (typeof body.textModelId === 'string' && body.textModelId.trim()) ||
    preferences?.defaultTextModelId ||
    null;

  if (!textModelId) {
    return NextResponse.json(
      { success: false, error: '未配置文本模型，请先在项目设置中配置' },
      { status: 400 },
    );
  }

  try {
    const result = await generateStoryboard(content, textModelId);
    if (result.shots.length === 0) {
      return NextResponse.json(
        { success: false, error: '未能生成有效分镜，请检查剧本内容或更换模型重试' },
        { status: 422 },
      );
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[storyboard] generation failed:', error);
    throw error;
  }
});
