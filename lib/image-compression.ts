import imageCompression from 'browser-image-compression';

const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * 压缩图片为 JPEG 格式
 * @param file 原始图片文件
 * @returns 压缩后的 JPEG 文件
 */
export async function compressImageToWebP(file: File): Promise<File> {
  // 1. 校验文件大小
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`图片大小不能超过 ${MAX_FILE_SIZE_MB}MB`);
  }

  // 2. 压缩配置（使用 JPEG 以确保最大兼容性）
  const options = {
    maxSizeMB: 15,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
  };

  // 3. 执行压缩（自动使用 Web Worker）
  const compressedFile = await imageCompression(file, options);

  return compressedFile;
}

/**
 * 将文件转换为 Base64 字符串
 * @param file 文件对象
 * @returns Base64 字符串（不含 data URL 前缀）
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
