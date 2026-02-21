// ========================================
// 页面注册表 - 单一来源
// 供后台配置页和导航渲染共用
// ========================================

export type PageMatchType = 'exact' | 'prefix';

export interface PageRegistryItem {
  href: string;
  label: string;
  icon: string;
  matchType: PageMatchType;
  description?: string;
}

export const PAGE_REGISTRY: PageRegistryItem[] = [
  { href: '/create', label: 'AI 创作', icon: 'Sparkles', matchType: 'exact', description: '图片 / 视频生成' },
  { href: '/projects', label: '项目管理', icon: 'FolderKanban', matchType: 'prefix', description: '漫剧作品管理' },
  { href: '/history', label: '历史', icon: 'History', matchType: 'exact', description: '作品记录' },
  { href: '/settings', label: '设置', icon: 'Settings', matchType: 'exact', description: '账号管理' },
];

/**
 * 检查页面是否被禁用
 * @param pathname 当前路径
 * @param disabledPages 禁用的页面路径列表
 * @returns 是否被禁用
 */
export function isPageDisabled(pathname: string, disabledPages: string[]): boolean {
  if (!disabledPages || disabledPages.length === 0) return false;

  for (const page of PAGE_REGISTRY) {
    if (!disabledPages.includes(page.href)) continue;

    if (page.matchType === 'exact') {
      if (pathname === page.href) return true;
    } else {
      // prefix 匹配
      if (pathname === page.href || pathname.startsWith(page.href + '/')) return true;
    }
  }

  return false;
}

/**
 * 获取可见的页面列表（过滤掉禁用的页面）
 * @param disabledPages 禁用的页面路径列表
 * @returns 可见的页面列表
 */
export function getVisiblePages(disabledPages: string[]): PageRegistryItem[] {
  if (!disabledPages || disabledPages.length === 0) return PAGE_REGISTRY;
  return PAGE_REGISTRY.filter(page => !disabledPages.includes(page.href));
}
