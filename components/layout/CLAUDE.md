[根目录](../../CLAUDE.md) > [components](../) > **layout**

# 布局组件模块

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-20 | 1.0.0 | 初始化模块文档 |

---

## 模块职责

应用级布局组件，提供仪表盘外壳、顶部导航栏和侧边栏。

---

## 入口与启动

```typescript
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
```

---

## 对外接口

| 组件 | 文件 | 说明 |
|------|------|------|
| `DashboardShell` | `dashboard-shell.tsx` | 仪表盘外壳，自动检测工作流页面切换全屏模式 |
| `Header` | `header.tsx` | 顶部导航栏（Logo、导航项、用户菜单） |
| `Sidebar` | `sidebar.tsx` | 左侧边栏（导航、视频任务状态、余额显示） |

### DashboardShell

```typescript
interface DashboardShellProps {
  user: SafeUser;
  children: React.ReactNode;
}
```

**功能**:
- 自动检测 `/projects/[id]/(episodes|assets|production)` 路径切换为全屏工作流模式
- 全屏模式下隐藏 Header 和 Sidebar
- 普通模式下显示公告横幅

### Header

```typescript
interface HeaderProps {
  user: SafeUser;
}
```

**导航项**: AI 创作、项目管理、历史、设置

### Sidebar

```typescript
interface SidebarProps {
  user: SafeUser;
}
```

**功能**:
- 导航菜单（支持页面禁用检测）
- 视频生成任务实时状态轮询
- 用户余额显示
- 管理员入口

---

## 关键依赖与配置

| 依赖 | 用途 |
|------|------|
| `@/lib/page-registry` | 页面注册表（禁用检测） |
| `@/components/providers/site-config-provider` | 站点配置 |
| `@/components/ui/announcement` | 公告横幅 |

---

## 相关文件清单

```
components/layout/
  dashboard-shell.tsx   # 仪表盘外壳
  header.tsx            # 顶部导航栏
  sidebar.tsx           # 左侧边栏
```
