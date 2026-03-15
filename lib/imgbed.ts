import { getSystemConfig } from './db';
import type { SystemConfig } from '@/types';

export const IMG_UPLOAD_CHANNELS = ['telegram', 'cfr2', 's3', 'discord', 'huggingface'] as const;
export type ImgbedUploadChannel = typeof IMG_UPLOAD_CHANNELS[number];

export interface ImgbedConfig {
  enabled: boolean;
  baseUrl: string;
  apiToken: string;
  authCode: string;
  uploadChannel: ImgbedUploadChannel;
  uploadFolder: string;
}

export interface ImgbedFileConstraints {
  maxFileSizeMB: number;
  maxFileSizeBytes: number;
  allowedTypes: string[];
  allowedTypesRaw: string;
}

export interface ImgbedFileValidationInput {
  fileName?: string;
  fileType?: string;
  fileSizeBytes?: number;
}

export interface ImgbedFileValidationResult {
  ok: boolean;
  error?: string;
}

const DEFAULT_MAX_FILE_SIZE_MB = 50;

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function normalizeUploadChannel(value: string): ImgbedUploadChannel {
  const normalized = value.trim().toLowerCase() as ImgbedUploadChannel;
  if (IMG_UPLOAD_CHANNELS.includes(normalized)) {
    return normalized;
  }
  return 'telegram';
}

function normalizeUploadFolder(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'character-cards';
  return trimmed.replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/\/$/, '');
}

function normalizeAllowedType(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('.') ? trimmed.slice(1) : trimmed;
}

function parseAllowedTypes(raw: string): string[] {
  return raw.split(',').map(normalizeAllowedType).filter(Boolean);
}

function normalizeMimeType(value?: string): string {
  if (!value) return '';
  return value.split(';')[0].trim().toLowerCase();
}

function extractFileExtension(fileName?: string): string {
  if (!fileName) return '';
  const cleaned = fileName.split('?')[0].split('#')[0];
  const base = cleaned.split('/').pop() || '';
  const idx = base.lastIndexOf('.');
  if (idx <= 0 || idx >= base.length - 1) return '';
  return base.slice(idx + 1).toLowerCase();
}

export async function getPrimaryImgbedConfig(config?: SystemConfig): Promise<ImgbedConfig> {
  const resolved = config ?? await getSystemConfig();
  return {
    enabled: Boolean(resolved.imgbedEnabled),
    baseUrl: normalizeBaseUrl(resolved.imgbedBaseUrl || ''),
    apiToken: resolved.imgbedApiToken || '',
    authCode: resolved.imgbedAuthCode || '',
    uploadChannel: normalizeUploadChannel(resolved.imgbedUploadChannel || ''),
    uploadFolder: normalizeUploadFolder(resolved.imgbedUploadFolder || ''),
  };
}

export async function getBackupImgbedConfig(config?: SystemConfig): Promise<ImgbedConfig> {
  const resolved = config ?? await getSystemConfig();
  return {
    enabled: Boolean(resolved.imgbedBackupEnabled),
    baseUrl: normalizeBaseUrl(resolved.imgbedBackupBaseUrl || ''),
    apiToken: resolved.imgbedBackupApiToken || '',
    authCode: resolved.imgbedBackupAuthCode || '',
    uploadChannel: normalizeUploadChannel(resolved.imgbedBackupUploadChannel || ''),
    uploadFolder: normalizeUploadFolder(resolved.imgbedUploadFolder || ''),
  };
}

export async function getFileConstraints(config?: SystemConfig): Promise<ImgbedFileConstraints> {
  const resolved = config ?? await getSystemConfig();
  const maxFileSizeMB =
    Number.isFinite(resolved.imgbedMaxFileSize) && resolved.imgbedMaxFileSize > 0
      ? resolved.imgbedMaxFileSize
      : DEFAULT_MAX_FILE_SIZE_MB;
  const allowedTypesRaw = typeof resolved.imgbedAllowedTypes === 'string'
    ? resolved.imgbedAllowedTypes.trim()
    : 'mp4,webm,mov,jpg,jpeg,png,gif,webp';
  const allowedTypes = allowedTypesRaw ? parseAllowedTypes(allowedTypesRaw) : [];
  return {
    maxFileSizeMB,
    maxFileSizeBytes: Math.floor(maxFileSizeMB * 1024 * 1024),
    allowedTypes,
    allowedTypesRaw,
  };
}

export function validateFile(
  input: ImgbedFileValidationInput,
  constraints: ImgbedFileConstraints
): ImgbedFileValidationResult {
  const sizeBytes = input.fileSizeBytes;
  if (Number.isFinite(sizeBytes) && sizeBytes! > constraints.maxFileSizeBytes) {
    return {
      ok: false,
      error: `文件大小超过限制（最大 ${constraints.maxFileSizeMB}MB）`,
    };
  }

  if (!constraints.allowedTypes.length) {
    return { ok: true };
  }

  const ext = normalizeAllowedType(extractFileExtension(input.fileName));
  const mime = normalizeMimeType(input.fileType);
  const allowed = new Set(constraints.allowedTypes);
  const mimeSuffix = mime.includes('/') ? mime.split('/')[1] : '';
  const isAllowed =
    (ext && allowed.has(ext)) ||
    (mime && allowed.has(mime)) ||
    (mimeSuffix && allowed.has(mimeSuffix));

  if (!isAllowed) {
    return {
      ok: false,
      error: `不支持的文件类型（允许：${constraints.allowedTypes.join(', ')}）`,
    };
  }

  return { ok: true };
}

export function isValidImgbedUrl(url: string, baseUrl: string): boolean {
  if (!url || !baseUrl) return false;
  try {
    const target = new URL(url);
    const base = new URL(baseUrl);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return false;
    return target.host === base.host;
  } catch {
    return false;
  }
}

export function buildFileUrl(baseUrl: string, input: string): string {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const normalizedBase = normalizeBaseUrl(baseUrl || '');
  if (!normalizedBase) return trimmed;

  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${normalizedBase}${normalizedPath}`;
}
