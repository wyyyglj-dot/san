// ---------------------------------------------------------------------------
// Unified date formatting utilities
// Replaces scattered toLocaleString / toLocaleDateString calls
// ---------------------------------------------------------------------------

const ZH_CN = 'zh-CN';

/**
 * Standard datetime: "2026/02/22 14:30"
 * Used for generation records, admin tables, etc.
 */
export function formatStandard(ts: number | string | Date): string {
  return new Date(ts).toLocaleString(ZH_CN, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Relative time: "刚刚" / "3分钟前" / "2小时前" / "昨天" / "3天前" / "2月22日"
 */
export function formatRelative(ts: number | string | Date): string {
  const now = Date.now();
  const target = new Date(ts).getTime();
  const diff = now - target;

  if (diff < 0) return formatStandard(ts);

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '刚刚';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;

  const days = Math.floor(hours / 24);
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;

  const d = new Date(ts);
  const thisYear = new Date().getFullYear();
  if (d.getFullYear() === thisYear) {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return formatStandard(ts);
}

/**
 * Date-only timestamp: "2026/02/22"
 * Used for project cards, member lists, etc.
 */
export function formatTimestamp(ts: number | string | Date): string {
  return new Date(ts).toLocaleDateString(ZH_CN, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
