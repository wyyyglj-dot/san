[根目录](../../CLAUDE.md) > [components](../) > **assets**

# 素材管理组件模块

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-20 | 1.0.0 | 初始化模块文档 |

---

## 模块职责

项目素材（角色、场景、道具）的完整管理 UI，包含素材列表、详情面板、图片生成/上传、编辑弹窗等功能。是漫剧工作台的核心子系统。

---

## 入口与启动

本模块为组件库，通过工作区视图集成使用：

```typescript
import { AssetWorkspace } from '@/components/assets/asset-workspace';
import { AssetDetailContainer } from '@/components/assets/detail/asset-detail-container';
```

---

## 对外接口

### 核心组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `AssetWorkspace` | `asset-workspace.tsx` | 素材工作区主组件，根据状态渲染列表/详情/分析中 |
| `AssetOverviewTable` | `asset-overview-table.tsx` | 素材概览表格（按类型分组） |
| `AssetCardVisual` | `asset-card-visual.tsx` | 素材卡片视觉组件 |
| `AssetDetailPanel` | `asset-detail-panel.tsx` | 素材详情侧面板 |
| `AssetHistoryStrip` | `asset-history-strip.tsx` | 素材图片历史条 |
| `CreationToolbar` | `creation-toolbar.tsx` | 素材创建工具栏 |

### 弹窗组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `CreateAssetDialog` | `create-asset-dialog.tsx` | 创建素材对话框 |
| `AssetEditModal` | `asset-edit-modal.tsx` | 素材编辑弹窗 |

### 状态组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `AssetAnalyzing` | `asset-analyzing.tsx` | AI 分析中状态 |
| `AssetEmptyState` | `asset-empty-state.tsx` | 空状态引导 |

### 详情子模块 (detail/)

| 组件 | 文件 | 说明 |
|------|------|------|
| `AssetDetailContainer` | `detail/asset-detail-container.tsx` | 详情容器 |
| `AssetHero` | `detail/asset-hero.tsx` | 详情头部（主图+名称） |
| `AssetTabsNav` | `detail/asset-tabs-nav.tsx` | 详情 Tab 导航 |
| `AssetOverviewTab` | `detail/tabs/asset-overview-tab.tsx` | 概览 Tab |
| `AssetGalleryTab` | `detail/tabs/asset-gallery-tab.tsx` | 图库 Tab |
| `AssetEpisodesTab` | `detail/tabs/asset-episodes-tab.tsx` | 关联剧集 Tab |
| `AssetStudioTab` | `detail/tabs/asset-studio-tab.tsx` | 工作室 Tab |
| `AssetEditorDialog` | `detail/modals/asset-editor-dialog.tsx` | 编辑器弹窗 |
| `AssetGalleryDialog` | `detail/modals/asset-gallery-dialog.tsx` | 图库弹窗 |

### Schema

| 文件 | 说明 |
|------|------|
| `asset-schema.ts` | 素材表单验证 Schema |

---

## 关键依赖与配置

### 内部依赖

| 依赖 | 用途 |
|------|------|
| `@/lib/stores/workspace-store` | 工作区状态管理 |
| `@/lib/db-comic` | 素材类型定义 (ProjectAsset, ProjectAssetType) |
| `@/components/ui/*` | 基础 UI 组件 |

---

## 数据模型

```typescript
type ProjectAssetType = 'character' | 'scene' | 'prop';

interface ProjectAsset {
  id: string;
  projectId: string;
  type: ProjectAssetType;
  name: string;
  description: string | null;
  attributes: Record<string, unknown> | null;
  primaryImageUrl: string | null;
  generationId: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
```

---

## 测试与质量

**当前状态**: 无测试文件

**建议**:
- 测试 `AssetWorkspace` 的状态切换逻辑
- 测试 `CreateAssetDialog` 的表单验证
- 测试素材筛选和排序功能

---

## 相关文件清单

```
components/assets/
  asset-workspace.tsx           # 素材工作区主组件
  asset-overview-table.tsx      # 概览表格
  asset-card-visual.tsx         # 卡片视觉
  asset-detail-panel.tsx        # 详情面板
  asset-history-strip.tsx       # 图片历史条
  asset-analyzing.tsx           # 分析中状态
  asset-empty-state.tsx         # 空状态
  asset-edit-modal.tsx          # 编辑弹窗
  asset-schema.ts               # 验证 Schema
  create-asset-dialog.tsx       # 创建对话框
  creation-toolbar.tsx          # 创建工具栏
  detail/
    asset-detail-container.tsx  # 详情容器
    asset-hero.tsx              # 详情头部
    asset-tabs-nav.tsx          # Tab 导航
    tabs/
      asset-overview-tab.tsx    # 概览 Tab
      asset-gallery-tab.tsx     # 图库 Tab
      asset-episodes-tab.tsx    # 关联剧集 Tab
      asset-studio-tab.tsx      # 工作室 Tab
    modals/
      asset-editor-dialog.tsx   # 编辑器弹窗
      asset-gallery-dialog.tsx  # 图库弹窗
```
