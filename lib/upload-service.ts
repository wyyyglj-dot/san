/* eslint-disable no-console */
import { fetch as undiciFetch, FormData, File } from 'undici';
import { uploadToPicUI } from './picui';
import { getBackupImgbedConfig, getFileConstraints, getPrimaryImgbedConfig } from './imgbed';
import type { ImgbedConfig } from './imgbed';
import { fetchWithRetry } from './http-retry';

const DATA_URL_REGEX = /^data:([^;]+);base64,(.+)$/i;

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

export interface UploadOptions {
  filename?: string;
  mimeType?: string;
}

export interface UploadResult {
  url: string;
  service: 'picui' | 'imgbed-primary' | 'imgbed-backup';
}

interface ParsedBase64Data {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  base64: string;
}

function normalizeMimeType(value?: string): string {
  if (!value) return '';
  return value.split(';')[0].trim().toLowerCase();
}

export function detectMimeType(base64Data: string): string {
  const trimmed = base64Data.trim();
  const match = DATA_URL_REGEX.exec(trimmed);
  if (match?.[1]) {
    return normalizeMimeType(match[1]) || 'application/octet-stream';
  }

  const header = trimmed.slice(0, 32);
  if (header.startsWith('UklGR')) return 'image/webp';
  if (header.startsWith('iVBORw')) return 'image/png';
  if (header.startsWith('/9j/')) return 'image/jpeg';
  if (header.startsWith('R0lGOD')) return 'image/gif';
  if (header.startsWith('Qk')) return 'image/bmp';
  if (header.startsWith('GkXf')) return 'video/webm';
  if (header.includes('ZnR5cA')) return 'video/mp4';

  return 'application/octet-stream';
}

export function isImageMimeType(mimeType: string): boolean {
  return normalizeMimeType(mimeType).startsWith('image/');
}

function getFileExtension(value: string): string {
  const trimmed = value.trim();
  const idx = trimmed.lastIndexOf('.');
  if (idx <= 0 || idx >= trimmed.length - 1) return '';
  return trimmed.slice(idx + 1).toLowerCase();
}

function inferMimeFromFilename(filename?: string): string | undefined {
  if (!filename) return undefined;
  const ext = getFileExtension(filename);
  if (!ext) return undefined;
  return EXTENSION_TO_MIME[ext];
}

function sanitizeFilename(value: string): string {
  const trimmed = value.trim();
  const base = trimmed.split(/[\\/]/).pop() || '';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveFilename(filename: string | undefined, mimeType: string): string {
  const sanitized = filename ? sanitizeFilename(filename) : '';
  const baseName = sanitized || `upload_${Date.now()}`;
  const extension = getFileExtension(baseName);
  if (extension) return baseName;

  const extFromMime = MIME_TO_EXTENSION[mimeType];
  if (extFromMime) return `${baseName}.${extFromMime}`;

  return `${baseName}.bin`;
}

function parseBase64Data(
  base64Data: string,
  options: UploadOptions = {}
): ParsedBase64Data {
  const trimmed = base64Data.trim();
  if (!trimmed) {
    throw new Error('Base64 data is empty');
  }

  let mimeType = normalizeMimeType(options.mimeType);
  let rawBase64 = trimmed;

  const match = DATA_URL_REGEX.exec(trimmed);
  if (match) {
    if (!mimeType) {
      mimeType = normalizeMimeType(match[1]);
    }
    rawBase64 = match[2];
  }

  const cleanedBase64 = rawBase64.replace(/\s+/g, '');
  if (!cleanedBase64) {
    throw new Error('Base64 data is empty');
  }

  if (!mimeType) {
    const detected = detectMimeType(cleanedBase64);
    if (detected && detected !== 'application/octet-stream') {
      mimeType = detected;
    } else {
      mimeType = inferMimeFromFilename(options.filename) || detected;
    }
  }

  if (!mimeType) {
    mimeType = 'application/octet-stream';
  }

  const buffer = Buffer.from(cleanedBase64, 'base64');
  if (!buffer.length) {
    throw new Error('Invalid base64 data');
  }

  const filename = resolveFilename(options.filename, mimeType);

  return {
    buffer,
    mimeType,
    filename,
    base64: cleanedBase64,
  };
}

function isImgbedAvailable(config: ImgbedConfig): boolean {
  return Boolean(config.enabled && config.baseUrl);
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function extractImgbedSrc(payload: unknown): string | null {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    const item = payload[0] as { src?: unknown } | undefined;
    return typeof item?.src === 'string' ? item.src : null;
  }

  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const direct = obj.src;
    if (typeof direct === 'string') return direct;

    const data = obj.data;
    if (Array.isArray(data)) {
      const first = data[0] as { src?: unknown } | undefined;
      if (typeof first?.src === 'string') return first.src;
    }

    if (data && typeof data === 'object') {
      const src = (data as Record<string, unknown>).src;
      if (typeof src === 'string') return src;
    }
  }

  return null;
}

function extractImgbedError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const error = obj.error;
  if (typeof error === 'string' && error.trim()) return error.trim();
  const message = obj.message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  return null;
}

async function uploadToImgbed(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  config: ImgbedConfig
): Promise<string> {
  if (!config.enabled || !config.baseUrl) {
    throw new Error('文件床未配置');
  }

  const uploadUrl = new URL('/upload', config.baseUrl);
  uploadUrl.searchParams.set('uploadChannel', config.uploadChannel || 'telegram');
  uploadUrl.searchParams.set('returnFormat', 'full');
  if (config.uploadFolder) {
    uploadUrl.searchParams.set('uploadFolder', config.uploadFolder);
  }
  if (!config.apiToken && config.authCode) {
    uploadUrl.searchParams.set('authCode', config.authCode);
  }

  const buildFormData = () => {
    const formData = new FormData();
    const file = new File([buffer], filename, { type: mimeType || 'application/octet-stream' });
    formData.append('file', file);
    return formData;
  };

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (config.apiToken) {
    headers.Authorization = `Bearer ${config.apiToken}`;
  }

  const response = await fetchWithRetry(undiciFetch, uploadUrl.toString(), () => ({
    method: 'POST',
    headers,
    body: buildFormData(),
  }));

  const responseText = await response.text();
  let payload: unknown = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const detail = extractImgbedError(payload);
    const message = detail
      ? `文件床上传失败: ${detail}`
      : `文件床上传失败: HTTP ${response.status}`;
    throw new Error(message);
  }

  const src = extractImgbedSrc(payload);
  if (!src) {
    throw new Error('文件床响应缺少文件 URL');
  }

  if (/^https?:\/\//i.test(src)) return src;

  const normalizedBase = normalizeBaseUrl(config.baseUrl);
  const normalizedPath = src.startsWith('/') ? src : `/${src}`;
  return `${normalizedBase}${normalizedPath}`;
}

export async function uploadToPublicUrl(
  base64Data: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const parsed = parseBase64Data(base64Data, options);
  const { buffer, mimeType, filename, base64 } = parsed;
  const isImage = isImageMimeType(mimeType);

  const constraints = await getFileConstraints();
  if (constraints.maxFileSizeBytes > 0 && buffer.length > constraints.maxFileSizeBytes) {
    throw new Error(`文件大小超过限制（最大 ${constraints.maxFileSizeMB}MB）`);
  }

  console.log('[Upload] 开始上传:', { filename, mimeType, isImage, size: buffer.length });

  if (isImage) {
    try {
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const picuiUrl = await uploadToPicUI(dataUrl, filename);
      if (picuiUrl) {
        console.log('[Upload] PicUI 上传成功:', picuiUrl.substring(0, 80));
        return { url: picuiUrl, service: 'picui' };
      }
    } catch (error) {
      console.warn('[Upload] PicUI 上传失败:', error);
    }
  }

  const [primary, backup] = await Promise.all([
    getPrimaryImgbedConfig(),
    getBackupImgbedConfig(),
  ]);

  const errors: string[] = [];

  if (isImgbedAvailable(primary)) {
    try {
      const url = await uploadToImgbed(buffer, filename, mimeType, primary);
      console.log('[Upload] 主文件床上传成功:', url.substring(0, 80));
      return { url, service: 'imgbed-primary' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '主文件床上传失败';
      console.warn('[Upload] 主文件床上传失败:', msg);
      errors.push(msg);
    }
  } else {
    errors.push('主文件床未配置');
  }

  if (isImgbedAvailable(backup)) {
    try {
      const url = await uploadToImgbed(buffer, filename, mimeType, backup);
      console.log('[Upload] 备用文件床上传成功:', url.substring(0, 80));
      return { url, service: 'imgbed-backup' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '备用文件床上传失败';
      console.warn('[Upload] 备用文件床上传失败:', msg);
      errors.push(msg);
    }
  } else {
    errors.push('备用文件床未配置');
  }

  const detail = errors.filter(Boolean).join('; ');
  throw new Error(detail ? `上传失败: ${detail}` : '所有上传服务均不可用');
}
