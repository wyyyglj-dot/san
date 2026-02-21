export type TaskType = 'image' | 'video';

// 软超时：超过后降频轮询（仅视频生效，图片直接停止）
const SOFT_TIMEOUT_MS: Record<TaskType, number> = {
  image: 6 * 60 * 1000,   // 6 分钟
  video: 15 * 60 * 1000,  // 15 分钟
};

// 硬超时：绝对安全上限，超过后无论后端状态都停止
const HARD_TIMEOUT_MS: Record<TaskType, number> = {
  image: 6 * 60 * 1000,   // 6 分钟（与软超时一致）
  video: 60 * 60 * 1000,  // 60 分钟
};

export function getPollingInterval(elapsedMs: number, taskType: TaskType): number {
  if (taskType === 'image') {
    // 图片：前 30 秒每 5 秒，之后每 15 秒
    return elapsedMs < 30_000 ? 5_000 : 15_000;
  }
  // 视频：软超时后降频到 30 秒
  if (elapsedMs >= SOFT_TIMEOUT_MS.video) {
    return 30_000;
  }
  // 视频：前 2 分钟每 5 秒，之后每 15 秒
  return elapsedMs < 120_000 ? 5_000 : 15_000;
}

// 软超时判断：图片到期即停止，视频到期后进入降频模式
export function shouldContinuePolling(elapsedMs: number, taskType: TaskType): boolean {
  return elapsedMs < SOFT_TIMEOUT_MS[taskType];
}

// 硬超时判断：视频任务的绝对安全上限
export function isHardTimeout(elapsedMs: number, taskType: TaskType): boolean {
  return elapsedMs >= HARD_TIMEOUT_MS[taskType];
}
