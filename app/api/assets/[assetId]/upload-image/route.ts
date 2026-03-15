import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import {
  checkProjectAccess,
  getProjectAssetById,
  updateProjectAsset,
} from '@/lib/db-comic';
import {
  detectMimeType,
  isImageMimeType,
  uploadToPublicUrl,
} from '@/lib/upload-service';

export const dynamic = 'force-dynamic';

export const POST = authHandler(async (req, ctx, session) => {
  const { assetId } = ctx.params;
  const asset = await getProjectAssetById(assetId);
  if (!asset || asset.deletedAt) {
    return NextResponse.json(
      { success: false, error: '资产不存在' },
      { status: 404 },
    );
  }

  const access = await checkProjectAccess(asset.projectId, session.user.id);
  if (!access) {
    return NextResponse.json(
      { success: false, error: '无权限' },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const base64Data =
    typeof body.base64Data === 'string' ? body.base64Data.trim() : '';
  if (!base64Data) {
    return NextResponse.json(
      { success: false, error: '缺少图片数据' },
      { status: 400 },
    );
  }

  const filename =
    typeof body.filename === 'string' ? body.filename.trim() : undefined;
  const inputMime =
    typeof body.mimeType === 'string' ? body.mimeType.trim() : '';

  // Server-side MIME detection from base64 magic bytes (source of truth)
  const detectedMime = detectMimeType(base64Data);

  // If client provides a MIME, cross-check against detected; prefer detected
  const mimeType =
    inputMime && isImageMimeType(inputMime) ? detectedMime || inputMime : detectedMime;

  if (!isImageMimeType(mimeType)) {
    return NextResponse.json(
      { success: false, error: '仅支持图片格式' },
      { status: 400 },
    );
  }

  const result = await uploadToPublicUrl(base64Data, { filename, mimeType });
  const updated = await updateProjectAsset(assetId, {
    primaryImageUrl: result.url,
  });
  if (!updated) {
    return NextResponse.json(
      { success: false, error: '更新资产失败' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: updated, url: result.url });
});
