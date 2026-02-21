[根目录](../../CLAUDE.md) > [components](../) > **workflow**

# 工作流外壳模块

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-20 | 1.0.0 | 初始化模块文档 |

---

## 模块职责

漫剧项目工作流的顶层布局外壳，组合头部导航、剧集侧边栏、中心面板和素材侧边栏，形成完整的三栏工作台布局。

---

## 入口与启动

```typescript
import { WorkflowShell } from '@/components/workflow/workflow-shell';
```

---

## 对外接口

| 组件 | 文件 | 说明 |
|------|------|------|
| `WorkflowShell` | `workflow-shell.tsx` | 工作流外壳，全屏三栏布局 |
| `WorkflowHeader` | `workflow-header.tsx` | 工作流顶部导航栏 |

### WorkflowShell

```typescript
interface WorkflowShellProps {
  projectId: string;
  children: React.ReactNode;
}
```

**布局结构**:
```
+---------------------------+
|     WorkflowHeader        |
+------+------------+------+
| 剧集 |   中心面板  | 素材 |
| 侧栏 |            | 侧栏 |
+------+------------+------+
```

初始化时调用 `resetForProject(projectId)` 和 `fetchEpisodes()` 加载项目数据。

---

## 关键依赖与配置

| 依赖 | 用途 |
|------|------|
| `@/lib/stores/workspace-store` | 工作区状态管理 |
| `@/components/episodes/episode-list-sidebar` | 剧集列表侧边栏 |
| `@/components/episodes/asset-sidebar` | 素材库侧边栏 |
| `@/components/workspace/workspace-center-panel` | 中心面板 |

---

## 相关文件清单

```
components/workflow/
  workflow-shell.tsx     # 工作流外壳
  workflow-header.tsx    # 工作流头部导航
```
