// 判断视频生成错误是否可重试（超时类错误）
export function isRetryableVideoError(errorMessage?: string | null): boolean {
  if (!errorMessage) return false;
  const msg = String(errorMessage);
  const patterns = [
    '轮询超时',
    '超过最大轮询时长',
    '进度长时间无变化',
    '任务超时',
    'poll timeout',
    'polling timeout',
  ];
  const lower = msg.toLowerCase();
  return patterns.some(p => lower.includes(p) || msg.includes(p));
}
