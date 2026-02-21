# components/admin/ - 后台管理组件

[根目录](../../CLAUDE.md) > [components](../) > **admin**

## 变更记录 (Changelog)

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-20 | 1.1.0 | 新增 agents 子模块、prompts 子模块、admin-page-layout 组件 |
| 2026-02-06 | 1.0.0 | 初始化模块文档 |

---

## 模块职责

`components/admin/` 目录包含后台管理界面的 React 组件，负责：
- 管理后台侧边栏导航
- 调试控制台（Debug Mode）
- 通用配置面板 UI 组件
- Agent 提示词管理系统
- LLM 提示词编辑器

---

## 入口与启动

| 文件 | 职责 |
|------|------|
| `sidebar.tsx` | 管理后台侧边栏导航 |
| `debug-trigger.tsx` | 调试模式触发按钮 |
| `debug-log-viewer.tsx` | 调试日志查看器 |

---

## 对外接口

### AdminSidebar

管理后台侧边栏导航组件。

```typescript
export function AdminSidebar(): JSX.Element
```

**导航分组**:
| 分组 | 菜单项 | 权限 |
|------|--------|------|
| 仪表盘 | 概览、数据统计 | admin, moderator |
| 运营管理 | 用户管理、用户组、卡密管理、邀请码、生成记录、公告管理 | admin (部分 moderator) |
| 功能配置 | Story 一键成片、提示词增强 | admin |
| 模型服务 | 聊天模型、图像渠道、视频渠道、LLM 模型、Agent 提示词 | admin |
| 系统设置 | 页面配置、网站配置、安全与限制、系统稳定性、代理设置 | admin |

### DebugTrigger / DebugLogViewer

调试模式触发按钮和日志查看器（详见 v1.0.0 文档）。

---

## Agent 子模块 (agents/)

Agent 提示词管理系统的完整 CRUD 界面。

| 组件 | 文件 | 说明 |
|------|------|------|
| `AgentList` | `agents/agent-list.tsx` | Agent 列表 |
| `AgentCard` | `agents/agent-card.tsx` | Agent 卡片 |
| `AgentEditor` | `agents/agent-editor.tsx` | Agent 编辑器（完整表单） |
| `PromptPreview` | `agents/prompt-preview.tsx` | 提示词预览 |
| `VersionHistory` | `agents/version-history.tsx` | 版本历史 |

### Agent 编辑器分区 (agents/sections/)

| 组件 | 文件 | 说明 |
|------|------|------|
| `RoleSection` | `sections/role-section.tsx` | 角色定义 |
| `RulesSection` | `sections/rules-section.tsx` | 规则列表 |
| `WorkflowSection` | `sections/workflow-section.tsx` | 工作流步骤 |
| `ExamplesSection` | `sections/examples-section.tsx` | 示例 |
| `FormatSection` | `sections/format-section.tsx` | 输出格式 |
| `PlaceholdersSection` | `sections/placeholders-section.tsx` | 占位符配置 |
| `SchemaDisplay` | `sections/schema-display.tsx` | JSON Schema 展示 |

---

## Prompts 子模块 (prompts/)

| 组件 | 文件 | 说明 |
|------|------|------|
| `PromptEditorCard` | `prompts/prompt-editor-card.tsx` | 提示词编辑卡片 |

---

## UI 子组件 (ui/)

| 组件 | 文件 | 说明 |
|------|------|------|
| `FeatureConfigPanel` | `ui/feature-config-panel.tsx` | 功能配置面板 |
| `ConfigSection` | `ui/config-section.tsx` | 配置区块 |
| `ConfigStatusBadge` | `ui/config-status-badge.tsx` | 状态徽章 |
| `ModelSelector` | `ui/model-selector.tsx` | 模型选择器 |
| `AdminPageLayout` | `ui/admin-page-layout.tsx` | 管理页面通用布局 |

---

## 关键依赖与配置

### 依赖的 Provider

- `useSession`: NextAuth 会话，获取用户角色
- `useSiteConfig`: 站点配置，获取站点名称
- `useDebug`: 调试模式状态和日志

### API 依赖

| API | 用途 |
|-----|------|
| `/api/admin/agents` | Agent CRUD |
| `/api/admin/agents/[featureKey]/versions` | Agent 版本管理 |
| `/api/admin/feature-bindings` | 功能绑定配置 |
| `/api/admin/llm-models` | LLM 模型列表 |

---

## 测试与质量

**当前状态**: 无测试文件

**建议**:
- 为 `AdminSidebar` 添加角色权限过滤测试
- 为 `AgentEditor` 添加表单验证测试
- 为 `ModelSelector` 添加加载和选择测试

---

## 相关文件清单

```
components/admin/
  sidebar.tsx                    # 管理后台侧边栏
  debug-trigger.tsx              # 调试触发按钮
  debug-log-viewer.tsx           # 调试日志查看器
  agents/
    agent-list.tsx               # Agent 列表
    agent-card.tsx               # Agent 卡片
    agent-editor.tsx             # Agent 编辑器
    prompt-preview.tsx           # 提示词预览
    version-history.tsx          # 版本历史
    sections/
      role-section.tsx           # 角色定义
      rules-section.tsx          # 规则列表
      workflow-section.tsx       # 工作流步骤
      examples-section.tsx       # 示例
      format-section.tsx         # 输出格式
      placeholders-section.tsx   # 占位符配置
      schema-display.tsx         # Schema 展示
  prompts/
    prompt-editor-card.tsx       # 提示词编辑卡片
  ui/
    feature-config-panel.tsx     # 功能配置面板
    config-section.tsx           # 配置区块
    config-status-badge.tsx      # 状态徽章
    model-selector.tsx           # 模型选择器
    admin-page-layout.tsx        # 管理页面布局
```
