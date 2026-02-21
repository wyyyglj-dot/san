# components/projects/ - 项目管理组件

[根目录](../../CLAUDE.md) > [components](../) > **projects**

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-06 | 1.0.0 | 初始化模块文档 |

---

## 模块职责

`components/projects/` 目录包含漫剧项目管理相关的 React 组件，负责：
- 项目列表展示与操作
- 项目创建流程
- 团队成员管理
- 画风选择与配置
- 生成偏好设置

---

## 入口与启动

| 文件 | 职责 |
|------|------|
| `project-list.tsx` | 项目列表主组件 |
| `create-project-modal.tsx` | 创建项目弹窗 |

---

## 对外接口

### ProjectList

项目列表表格组件，支持活跃项目和回收站两种模式。

```typescript
interface ProjectListProps {
  projects: ComicProject[];
  type: 'active' | 'trash';
  onDelete?: (id: string) => void;
  onRename?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPurge?: (id: string) => void;
}
```

**功能**:
- 表格展示项目信息（名称、编辑人员、尺寸、时长、创建/更新时间）
- 活跃模式：编辑、重命名、复制、删除
- 回收站模式：恢复、永久删除

### CreateProjectModal

项目创建弹窗，包含完整的创建流程。

```typescript
interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}
```

**功能**:
- 项目基本信息（名称、说明、封面）
- 生成配置（图片/视频/文字模型、影片比例）
- 画风选择
- 调用 `POST /api/projects` 创建项目

### GenerationPreferencesForm

生成偏好配置表单。

```typescript
interface GenerationPreferences {
  defaultImageModelId: string;
  defaultVideoModelId: string;
  defaultTextModelId: string;
  defaultStyle: string;
  defaultVideoRatio: string;
}

interface GenerationPreferencesFormProps {
  preferences: GenerationPreferences;
  onChange: (preferences: GenerationPreferences) => void;
  imageModels: SafeImageModel[];
  videoModels: SafeVideoModel[];
  textModels: SafeLlmModel[];
  isLoading?: boolean;
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
}
```

### ArtStyleSelector

画风选择器组件。

```typescript
interface ArtStyleSelectorProps {
  styles: SafeArtStyle[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
  isLoading?: boolean;
  isAdmin?: boolean;
  onAddStyle?: () => void;
}
```

**功能**:
- 网格展示可用画风
- "不指定"选项（使用模型默认风格）
- 管理员可添加新画风

### ArtStyleCard

单个画风卡片组件。

```typescript
interface ArtStyleCardProps {
  style: SafeArtStyle;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}
```

### MemberList

项目成员列表组件。

```typescript
interface MemberListProps {
  members: ProjectMember[];
  isOwner?: boolean;
  onRemove?: (userId: string) => void;
}
```

### InviteMemberModal

邀请成员弹窗。

```typescript
interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  onInvited?: () => void;
}
```

### ProjectActionMenu

项目操作下拉菜单。

```typescript
interface ProjectActionMenuProps {
  project: ComicProject;
  onDelete?: (id: string) => void;
  onRename?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}
```

**菜单项**: 重命名、创建副本、分享、删除

### AddArtStyleModal

添加画风弹窗（管理员功能）。

```typescript
interface AddArtStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
```

**表单字段**: 名称、Slug、描述、封面图 URL、风格垫图 URL

### CreationModeSelector

创作模式选择器。

```typescript
interface CreationModeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}
```

**模式**:
- `ai_merge`: AI 合并模式（自动生成分镜并合并视频）
- `default`: 默认分镜模式（手动控制每个分镜）

---

## 关键依赖与配置

### 依赖的 UI 组件

- `@/components/ui/dialog`: 弹窗
- `@/components/ui/button`: 按钮
- `@/components/ui/input`: 输入框
- `@/components/ui/textarea`: 文本域
- `@/components/ui/select`: 下拉选择
- `@/components/ui/label`: 标签
- `@/components/ui/dropdown-menu`: 下拉菜单
- `@/components/ui/image-upload`: 图片上传
- `@/components/ui/toaster`: Toast 提示

### 依赖的 Hooks

- `useSession`: NextAuth 会话
- `usePreferenceOptions`: 获取模型和画风选项
- `useToast`: Toast 提示

### API 依赖

| API | 方法 | 用途 |
|-----|------|------|
| `/api/projects` | POST | 创建项目 |
| `/api/projects/[id]/invites` | POST | 邀请成员 |
| `/api/admin/art-styles` | POST | 添加画风 |

---

## 数据模型

### ComicProject

```typescript
interface ComicProject {
  id: string;
  name: string;
  sizeLabel?: string;
  durationSeconds?: number;
  createdAt: number;
  updatedAt: number;
}
```

### ProjectMember

```typescript
interface ProjectMember {
  id: string;
  userId: string;
  role: string;
  createdAt: number;
}
```

### SafeArtStyle

```typescript
interface SafeArtStyle {
  id: string;
  slug: string;
  name: string;
  description?: string;
  coverImageUrl: string;
}
```

---

## 测试与质量

**当前状态**: 无测试文件

**建议**:
- 为 `CreateProjectModal` 添加表单验证测试
- 为 `ArtStyleSelector` 添加选择交互测试
- 为 `ProjectList` 添加列表渲染测试

---

## 常见问题 (FAQ)

**Q: 如何添加新的影片比例选项？**
A: 在 `GenerationPreferencesForm` 的 Select 组件中添加新的 `SelectItem`。

**Q: 画风选择器如何获取数据？**
A: 通过 `usePreferenceOptions` hook 从 `/api/user/preference-options` 获取。

---

## 相关文件清单

```
components/projects/
├── project-list.tsx              # 项目列表
├── create-project-modal.tsx      # 创建项目弹窗
├── generation-preferences-form.tsx # 生成偏好表单
├── art-style-selector.tsx        # 画风选择器
├── art-style-card.tsx            # 画风卡片
├── member-list.tsx               # 成员列表
├── invite-member-modal.tsx       # 邀请成员弹窗
├── project-action-menu.tsx       # 项目操作菜单
├── add-art-style-modal.tsx       # 添加画风弹窗
└── creation-mode-selector.tsx    # 创作模式选择器
```
