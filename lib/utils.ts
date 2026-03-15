import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatStandard } from '@/lib/date-utils';

// 合并 className
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 生成 UUID
export function generateId(): string {
  return crypto.randomUUID();
}

// 格式化日期 — 委托给 date-utils (保持向后兼容)
export const formatDate = formatStandard;

// 格式化余额
export function formatBalance(balance: number): string {
  return balance.toLocaleString('zh-CN');
}

// 文件转 Base64
export function fileToBase64(file: File): Promise<string> {
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

// 延迟
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 截断文本
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}
