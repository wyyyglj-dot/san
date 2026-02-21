[根目录](../../CLAUDE.md) > [components](../) > **workspace**

# 工作区组件模块

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-20 | 1.0.0 | 初始化模块文档 |

---

## 模块职责

漫剧项目工作区的中心面板组件，负责在"剧集"和"素材"两个 Tab 之间切换渲染对应的工作视图。

---

## 入口与启动

```typescript
import { WorkspaceCenterPanel } from '@/components/workspace/workspace-center-panel';
```

---

## 对外接口

| 组件 | 文件 | 说明 |
|------|------|------|
| `WorkspaceCenterPanel` | `workspace-center-panel.tsx` | 中心面板，根据 `activeTab` 切换剧集/素材视图 |
| `EpisodeWorkspaceView` | `episode-workspace-view.tsx` | 剧集工作区视图 |
| `AssetWorkspaceView` | `asset-workspace-view.tsx` | 素材工作区视图 |

### WorkspaceCenterPanel

```typescript
interface WorkspaceCenterPanelProps {
  projectId: string;
}
```

通过 `useWorkspaceStore` 的 `activeTab` 状态（`'episodes' | 'assets'`）决定显示哪个视图，使用 CSS opacity 切换实现无闪烁过渡。

---

## 关键依赖与配置

| 依赖 | 用途 |
|------|------|
| `@/lib/stores/workspace-store` | 工作区全局状态 |
| `@/components/assets/*` | 素材管理组件 |
| `@/components/episodes/*` | 剧集管理组件 |

---

## 相关文件清单

```
components/workspace/
  workspace-center-panel.tsx    # 中心面板（Tab 切换）
  episode-workspace-view.tsx    # 剧集工作区视图
  asset-workspace-view.tsx      # 素材工作区视图
```
