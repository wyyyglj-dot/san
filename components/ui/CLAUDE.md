[根目录](../../CLAUDE.md) > [components](../) > **ui**

# UI 组件库模块

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-06 | 1.0.0 | 初始化模块文档 |

---

## 模块职责

基础 UI 组件库，基于 Radix UI 原语和 Tailwind CSS 构建，提供统一的设计系统和可复用的 React 组件。

---

## 入口与启动

本模块为纯组件库，无独立入口。组件按需导入使用：

```typescript
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
```

---

## 对外接口

### 表单组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `Button` | `button.tsx` | 按钮组件，支持 8 种变体 (default/destructive/outline/secondary/ghost/link/gradient/brand) |
| `Input` | `input.tsx` | 文本输入框 |
| `Textarea` | `textarea.tsx` | 多行文本输入 |
| `Label` | `label.tsx` | 表单标签 |
| `Switch` | `switch.tsx` | 开关切换 |
| `Select` | `select.tsx` | 下拉选择器 |
| `Captcha` | `captcha.tsx` | 验证码组件（含刷新逻辑） |
| `ImageUpload` | `image-upload.tsx` | 图片上传组件（支持拖拽） |

### 布局组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `Card` | `card.tsx` | 卡片容器 (Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter) |
| `Tabs` | `tabs.tsx` | 标签页 |
| `ScrollArea` | `scroll-area.tsx` | 自定义滚动区域 |
| `Separator` | `separator.tsx` | 分隔线 |
| `Badge` | `badge.tsx` | 徽章标签 |

### 弹层组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `Dialog` | `dialog.tsx` | 模态对话框 |
| `AlertDialog` | `alert-dialog.tsx` | 确认对话框 |
| `DropdownMenu` | `dropdown-menu.tsx` | 下拉菜单 |
| `Toaster` | `toaster.tsx` | Toast 通知系统（含 `useToast` hook 和 `toast` 函数） |

### 背景与动效组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `AnimatedBackground` | `animated-background.tsx` | 首页/认证页动态背景（粒子 + 渐变球） |
| `DashboardBackground` | `dashboard-background.tsx` | 仪表盘背景 |
| `ParticlesBackground` | `particles.tsx` | 粒子动画背景 |
| `AnnouncementBanner` | `announcement.tsx` | 公告横幅 |

### 内容展示组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `Markdown` | `markdown.tsx` | Markdown 渲染器（支持 GFM、代码高亮、复制） |

---

## 关键依赖与配置

### 外部依赖

| 依赖 | 用途 |
|------|------|
| `@radix-ui/react-*` | 无障碍原语组件 |
| `class-variance-authority` | 组件变体管理 |
| `lucide-react` | 图标库 |
| `react-markdown` | Markdown 解析 |
| `remark-gfm` | GitHub 风格 Markdown |

### 工具函数

- `cn()` - 来自 `@/lib/utils`，用于合并 Tailwind 类名

---

## 数据模型

本模块为纯 UI 组件，不直接操作数据库。

---

## 测试与质量

**当前状态**: 无测试文件

**建议**:
- 使用 Storybook 进行组件文档和视觉测试
- 使用 React Testing Library 进行交互测试
- 优先覆盖 `Toaster`、`Captcha`、`ImageUpload` 等有状态组件

---

## 常见问题 (FAQ)

### Q: 如何自定义按钮样式？

使用 `variant` 和 `size` props，或通过 `className` 覆盖：

```tsx
<Button variant="gradient" size="lg" className="custom-class">
  自定义按钮
</Button>
```

### Q: Toast 通知如何使用？

```tsx
import { toast, useToast } from '@/components/ui/toaster';

// 函数式调用
toast({ title: '操作成功' });

// Hook 方式
const { toast } = useToast();
toast({ title: '操作成功', variant: 'destructive' });
```

### Q: 背景动画如何禁用？

组件自动检测 `prefers-reduced-motion` 媒体查询，用户系统设置减少动画时自动降级为静态效果。

---

## 相关文件清单

```
components/ui/
  alert-dialog.tsx      # 确认对话框
  animated-background.tsx # 动态背景
  announcement.tsx      # 公告横幅
  badge.tsx             # 徽章
  button.tsx            # 按钮
  captcha.tsx           # 验证码
  card.tsx              # 卡片
  dashboard-background.tsx # 仪表盘背景
  dashboard-background-wrapper.tsx # 背景包装器
  dialog.tsx            # 对话框
  dropdown-menu.tsx     # 下拉菜单
  image-upload.tsx      # 图片上传
  input.tsx             # 输入框
  label.tsx             # 标签
  markdown.tsx          # Markdown 渲染
  particles.tsx         # 粒子背景
  particles-wrapper.tsx # 粒子包装器
  scroll-area.tsx       # 滚动区域
  select.tsx            # 选择器
  separator.tsx         # 分隔线
  switch.tsx            # 开关
  tabs.tsx              # 标签页
  textarea.tsx          # 文本域
  toaster.tsx           # Toast 通知
```
