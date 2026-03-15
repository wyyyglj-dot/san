import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkProjectAccess,
  getComicProjectById,
  getProjectPreferences,
  softDeleteComicProject,
  updateComicProject,
  updateProjectPreferences,
} from '@/lib/db-comic';
import { detectMimeType, isImageMimeType, uploadToPublicUrl } from '@/lib/upload-service';
import { validateProjectPreferencesInput } from '../preference-validation';

export const dynamic = 'force-dynamic';

export const GET = authHandler(async (_req, ctx, session) => {
  const { id } = ctx.params;
  const project = await getComicProjectById(id);
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const access = await checkProjectAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  if (project.deletedAt && access === 'member') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const preferences = await getProjectPreferences(id);
  return NextResponse.json({ success: true, data: project, preferences, access });
}, {
  fallbackMessage: '获取项目失败',
  context: '[API] Project detail',
});

export const PATCH = authHandler(async (req, ctx, session) => {
  const { id } = ctx.params;
  const project = await getComicProjectById(id);
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const access = await checkProjectAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  if (project.deletedAt && access === 'member') {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  let hasUpdates = false;

  if (typeof body.name === 'string') {
    const value = body.name.trim();
    if (!value) {
      return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 });
    }
    updates.name = value;
    hasUpdates = true;
  }
  if (typeof body.aspectRatio === 'string') {
    const value = body.aspectRatio.trim();
    if (!value) {
      return NextResponse.json({ error: '比例不能为空' }, { status: 400 });
    }
    updates.aspectRatio = value;
    hasUpdates = true;
  }
  if (typeof body.mode === 'string') {
    const value = body.mode.trim();
    if (!value) {
      return NextResponse.json({ error: '模式不能为空' }, { status: 400 });
    }
    updates.mode = value;
    hasUpdates = true;
  }
  if (body.copyText !== undefined) {
    updates.copyText = body.copyText === null ? null : String(body.copyText);
    hasUpdates = true;
  }
  if (body.durationSeconds !== undefined) {
    const value = typeof body.durationSeconds === 'number'
      ? body.durationSeconds
      : parseInt(body.durationSeconds, 10);
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: '时长无效' }, { status: 400 });
    }
    updates.durationSeconds = Math.floor(value);
    hasUpdates = true;
  }
  if (typeof body.sizeLabel === 'string') {
    const value = body.sizeLabel.trim();
    if (!value) {
      return NextResponse.json({ error: '尺寸标签不能为空' }, { status: 400 });
    }
    updates.sizeLabel = value;
    hasUpdates = true;
  }
  if (body.description !== undefined) {
    updates.description = body.description === null ? null : String(body.description);
    hasUpdates = true;
  }

  const preferencesInput =
    body && typeof body.preferences === 'object' && body.preferences !== null
      ? (body.preferences as Record<string, unknown>)
      : null;
  const validatedPreferences = await validateProjectPreferencesInput({
    input: preferencesInput,
    userId: session.user.id,
    isAdmin: session.user.role === 'admin',
  });
  if (validatedPreferences.error) {
    return NextResponse.json({ error: validatedPreferences.error }, { status: 400 });
  }

  if (body.coverImage !== undefined) {
    if (body.coverImage === null) {
      updates.coverImageUrl = null;
      hasUpdates = true;
    } else if (typeof body.coverImage === 'string') {
      const coverImage = body.coverImage.trim();
      if (coverImage) {
        const mimeType = detectMimeType(coverImage);
        if (!isImageMimeType(mimeType)) {
          return NextResponse.json({ error: '封面图必须是图片格式' }, { status: 400 });
        }
        try {
          const upload = await uploadToPublicUrl(coverImage, { filename: `project_${Date.now()}` });
          updates.coverImageUrl = upload.url;
          hasUpdates = true;
        } catch (uploadError) {
          console.error('[API] Cover image upload failed:', uploadError);
          return NextResponse.json({ error: '封面图上传失败' }, { status: 502 });
        }
      }
    }
  }

  if (!hasUpdates && !preferencesInput) {
    return NextResponse.json({ error: '没有提供更新内容' }, { status: 400 });
  }

  let updated = project;
  if (hasUpdates) {
    updates.lastEditorUserId = session.user.id;
    const saved = await updateComicProject(id, updates as Parameters<typeof updateComicProject>[1]);
    if (!saved) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }
    updated = saved;
  }

  if (preferencesInput) {
    await updateProjectPreferences(id, validatedPreferences.updates);
  }

  return NextResponse.json({ success: true, data: updated });
}, {
  fallbackMessage: '更新项目失败',
  context: '[API] Project update',
});

export const DELETE = authHandler(async (_req, ctx, session) => {
  const { id } = ctx.params;
  const project = await getComicProjectById(id);
  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }
  if (project.ownerUserId !== session.user.id) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const updated = await softDeleteComicProject(id, session.user.id);
  return NextResponse.json({ success: true, data: updated });
}, {
  fallbackMessage: '删除项目失败',
  context: '[API] Project delete',
});
