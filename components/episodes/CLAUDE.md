[根目录](../../CLAUDE.md) > [components](../) > **episodes**

# 剧集管理模块

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-20 | 1.1.0 | 新增 shot-block、workflow-step-nav 组件；补充 API 交互 |
| 2026-02-06 | 1.0.0 | 初始化模块文档 |

---

## 模块职责

剧集管理系统的前端组件，提供剧集的创建、编辑、拆分、分镜生成、素材管理和导出功能。是项目工作台的核心模块。

---

## 入口与启动

本模块为组件库，通过项目页面集成使用。主要入口组件：

```typescript
import { DynamicWorkspace } from '@/components/episodes/dynamic-workspace';
import { EpisodeListSidebar } from '@/components/episodes/episode-list-sidebar';
import { EpisodeSelectorBar } from '@/components/episodes/episode-selector-bar';
```

---

## 对外接口

### 核心组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `DynamicWorkspace` | `dynamic-workspace.tsx` | 动态工作区，根据视图类型渲染不同内容 |
| `EpisodeListSidebar` | `episode-list-sidebar.tsx` | 剧集列表侧边栏（左侧） |
| `AssetSidebar` | `asset-sidebar.tsx` | 素材库侧边栏（右侧） |
| `EpisodeSelectorBar` | `episode-selector-bar.tsx` | 底部剧集选择器 |
| `StageWorkspace` | `stage-workspace.tsx` | 舞台工作区（剧集详情/素材详情） |

### 弹窗组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `AddEpisodeModal` | `add-episode-modal.tsx` | 添加剧集弹窗（支持展开模式） |
| `ScriptSplitterModal` | `script-splitter-modal.tsx` | 剧本拆分助手（实时预览） |

### 视图组件 (views/)

| 组件 | 文件 | 说明 |
|------|------|------|
| `OverviewView` | `views/overview-view.tsx` | 概览视图（项目统计/剧集列表） |
| `ScriptParseView` | `views/script-parse-view.tsx` | 剧本解析视图（AI 分析） |
| `StoryboardView` | `views/storyboard-view.tsx` | AI 分镜生成视图 |
| `ShotBlock` | `views/shot-block.tsx` | 单个分镜块组件 |
| `AssetsView` | `views/assets-view.tsx` | 素材生成工坊 |
| `ExportView` | `views/export-view.tsx` | 导出视图 |
| `SettingsView` | `views/settings-view.tsx` | 高级设置视图 |
| `EpisodeOverview` | `views/episode-overview.tsx` | 单剧集详情视图 |
| `AssetDetailView` | `views/asset-detail-view.tsx` | 素材详情/溶图视图 |

### 辅助组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `EpisodeStepper` | `episode-stepper.tsx` | 剧集序号步进器 |
| `EpisodeSidebar` | `episode-sidebar.tsx` | 功能导航侧边栏 |
| `WorkflowStepNav` | `workflow-step-nav.tsx` | 工作流步骤导航 |
| `CollapsibleSidebar` | `shared/collapsible-sidebar.tsx` | 可折叠侧边栏基础组件 |

---

## 关键依赖与配置

### 内部依赖

| 依赖 | 用途 |
|------|------|
| `@/components/ui/*` | 基础 UI 组件 |
| `@/components/projects/creation-mode-selector` | 创作模式选择器 |
| `@/lib/stores/workspace-store` | 工作区状态管理 |
| `@/lib/utils` | 工具函数 |

### 外部依赖

| 依赖 | 用途 |
|------|------|
| `lucide-react` | 图标 |

---

## 数据模型

### Episode 类型 (types.ts)

```typescript
interface Episode {
  id: string;
  projectId: string;
  orderNum: number;        // 剧集序号
  title: string;           // 剧集标题
  content: string;         // 剧本内容
  note: string | null;     // 备注
  sourceType: 'manual' | 'split' | 'import';  // 来源类型
  createdAt: number;
  updatedAt: number;
}
```

### 拆分相关类型

```typescript
interface SplitRule {
  type: 'episode_heading';
  titleTemplate: string;   // 如 "第{n}集"
  startOrderNum: number;
  maxEpisodes: number;
}

interface SplitPreviewItem {
  orderNum: number;
  title: string;
  content: string;
  sourceType: 'split';
}
```

### 视图类型

```typescript
type SidebarView = 'overview' | 'script-parse' | 'storyboard' | 'assets' | 'export' | 'settings';
```

---

## API 交互

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/projects/{id}/episodes` | GET | 获取剧集列表 |
| `/api/projects/{id}/episodes` | POST | 创建剧集 |
| `/api/episodes/{episodeId}` | PATCH/DELETE | 更新/删除剧集 |
| `/api/projects/{id}/episodes/split` | POST | 剧本拆分预览 |
| `/api/episodes/{episodeId}/storyboard` | POST | AI 分镜生成 |
| `/api/episodes/{episodeId}/assets` | GET | 获取剧集素材 |
| `/api/episodes/{episodeId}/assets/clear` | POST | 清除剧集素材 |

---

## 测试与质量

**当前状态**: 无测试文件

**建议**:
- 测试 `ScriptSplitterModal` 的拆分逻辑
- 测试 `EpisodeStepper` 的边界条件
- 测试视图切换逻辑

---

## 常见问题 (FAQ)

### Q: 如何添加新的视图类型？

1. 在 `episode-sidebar.tsx` 的 `sidebarItems` 数组中添加新项
2. 在 `views/` 目录创建新视图组件
3. 在 `dynamic-workspace.tsx` 的 switch 语句中添加对应 case

### Q: 剧本拆分支持哪些格式？

默认支持 "第N集" 格式，可通过 `titleTemplate` 自定义模板，使用 `{n}` 作为序号占位符。

---

## 相关文件清单

```
components/episodes/
  types.ts                    # 类型定义
  dynamic-workspace.tsx       # 动态工作区
  episode-sidebar.tsx         # 功能导航侧边栏
  episode-stepper.tsx         # 序号步进器
  episode-selector-bar.tsx    # 底部选择器
  episode-list-sidebar.tsx    # 剧集列表侧边栏
  asset-sidebar.tsx           # 素材库侧边栏
  stage-workspace.tsx         # 舞台工作区
  add-episode-modal.tsx       # 添加剧集弹窗
  script-splitter-modal.tsx   # 剧本拆分助手
  workflow-step-nav.tsx       # 工作流步骤导航
  shared/
    collapsible-sidebar.tsx   # 可折叠侧边栏
  views/
    overview-view.tsx         # 概览视图
    script-parse-view.tsx     # 剧本解析
    storyboard-view.tsx       # AI 分镜
    shot-block.tsx            # 分镜块
    assets-view.tsx           # 素材生成
    export-view.tsx           # 导出
    settings-view.tsx         # 设置
    episode-overview.tsx      # 剧集详情
    asset-detail-view.tsx     # 素材详情
```
