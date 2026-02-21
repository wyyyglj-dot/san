import { NextResponse } from 'next/server';
import { authHandler } from '@/lib/api-handler';
import { getBackupImgbedConfig, getFileConstraints, getPrimaryImgbedConfig } from '@/lib/imgbed';
import type { ImgbedConfig } from '@/lib/imgbed';

export const dynamic = 'force-dynamic';

function redactConfig(config: ImgbedConfig): Omit<ImgbedConfig, 'apiToken' | 'authCode'> & { apiToken: string; authCode: string } {
  return {
    ...config,
    apiToken: config.apiToken ? '***' : '',
    authCode: config.authCode ? '***' : '',
  };
}

export const GET = authHandler(async (req, ctx, session) => {
  const [primary, backup, constraints] = await Promise.all([
    getPrimaryImgbedConfig(),
    getBackupImgbedConfig(),
    getFileConstraints(),
  ]);

  const isAdmin = session.user.role === 'admin';

  return NextResponse.json({
    success: true,
    enabled: primary.enabled,
    primary: isAdmin ? primary : redactConfig(primary),
    backup: isAdmin ? backup : redactConfig(backup),
    constraints: {
      maxFileSize: constraints.maxFileSizeMB,
      allowedTypes: constraints.allowedTypes,
      uploadFolder: primary.uploadFolder,
    },
  });
});
