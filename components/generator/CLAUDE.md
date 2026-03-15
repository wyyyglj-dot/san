[根目录](../../CLAUDE.md) > [components](../) > **generator**

# 生成器 UI 组件模块

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-20 | 1.0.0 | 初始化模块文档 |

---

## 模块职责

AI 创作页面的核心 UI 组件，提供 Sora 视频生成面板、生成结果画廊和时间戳选择器。

---

## 入口与启动

```typescript
import { SoraPanel } from '@/components/generator/sora-panel';
import { ResultGallery } from '@/components/generator/result-gallery';
```

---

## 对外接口

| 组件 | 文件 | 说明 |
|------|------|------|
| `SoraPanel` | `sora-panel.tsx` | Sora 视频生成面板（提示词、比例、时长、参考图） |
| `ResultGallery` | `result-gallery.tsx` | 生成结果画廊（支持任务状态轮询、预览、下载） |
| `TimestampSelectorModal` | `timestamp-selector-modal.tsx` | 视频时间戳选择弹窗（用于角色卡创建） |

### SoraPanel

```typescript
interface SoraPanelProps {
  onTaskAdded: (task: Task) => void;
}
```

**功能**: 提示词输入、宽高比选择（landscape/portrait/square）、时长选择（10s/15s）、参考图上传、提交生成任务。

### ResultGallery

```typescript
interface ResultGalleryProps {
  generations: Generation[];
  tasks?: Task[];
  onRemoveTask?: (taskId: string) => void;
  onRetryTask?: (task: Task) => void;
  onClear?: (ids: string[]) => void;
  onDeleteGeneration?: (id: string) => void;
}
```

**功能**: 展示生成历史和进行中的任务，支持全屏预览、下载、重试、删除、角色卡创建。

### Task 类型

```typescript
interface Task {
  id: string;
  prompt: string;
  model?: string;
  modelId?: string;
  channelId?: string;
  type?: string;
  status: 'queued' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  errorMessage?: string;
  result?: Generation;
  createdAt: number;
}
```

---

## 关键依赖与配置

| 依赖 | 用途 |
|------|------|
| `@/lib/utils` | 工具函数 |
| `@/lib/download` | 资源下载 |
| `@/lib/retry-utils` | 重试判断 |
| `@/components/ui/toaster` | Toast 通知 |

---

## 相关文件清单

```
components/generator/
  sora-panel.tsx                # Sora 视频生成面板
  result-gallery.tsx            # 生成结果画廊
  timestamp-selector-modal.tsx  # 时间戳选择弹窗
```
