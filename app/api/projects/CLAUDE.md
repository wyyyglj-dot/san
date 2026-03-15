# Projects API 路由模块

> 面包屑: [根](../../../CLAUDE.md) > [app/api/](../) > projects/

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-20 | 1.0.0 | 初始化文档，覆盖 13 个路由文件 |

---

## 模块概述

漫剧项目管理 API，提供项目 CRUD、成员管理、邀请机制、剧集管理、剧集拆分、素材管理和 AI 素材分析等功能。

- **认证方式**: 手动调用 `getServerSession(authOptions)` 进行认证
- **权限模型**: 基于项目访问权限（owner / member），通过 `checkProjectAccess()` 检查
- **响应格式**: `{ success: boolean, data?: T, error?: string }`
- **路由文件数**: 13 个

---

## 目录结构

```
app/api/projects/
├── route.ts                          # GET 项目列表 / POST 创建项目
├── invites/
│   └── [token]/accept/route.ts       # POST 接受邀请
└── [id]/
    ├── route.ts                      # GET 详情 / PATCH 更新 / DELETE 软删除
    ├── restore/route.ts              # POST 恢复已删除项目
    ├── purge/route.ts                # DELETE 永久删除
    ├── duplicate/route.ts            # POST 复制项目
    ├── members/
    │   ├── route.ts                  # GET 成员列表 / POST 添加成员
    │   └── [userId]/route.ts         # DELETE 移除成员
    ├── invites/route.ts              # POST 创建邀请
    ├── episodes/
    │   ├── route.ts                  # GET 剧集列表 / POST 创建剧集
    │   └── split/route.ts            # POST 文本拆分为剧集
    └── assets/
        ├── route.ts                  # GET 素材列表 / POST 创建素材
        └── analyze/route.ts          # POST AI 素材分析
```

---

## API 端点详细说明

### 1. 项目 CRUD

| 路径 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/projects` | GET | 项目列表（?scope=personal/team, status=active/trash, search, limit, offset） | 登录用户 |
| `/api/projects` | POST | 创建项目（name, aspectRatio, mode, coverImage, preferences 等） | 登录用户 |
| `/api/projects/[id]` | GET | 项目详情（含 preferences 和 access 级别） | owner / member |
| `/api/projects/[id]` | PATCH | 更新项目（name, aspectRatio, mode, coverImage, description, preferences 等） | owner / member |
| `/api/projects/[id]` | DELETE | 软删除项目 | owner only |

### 2. 项目生命周期

| 路径 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/projects/[id]/restore` | POST | 恢复已软删除的项目 | owner only |
| `/api/projects/[id]/purge` | DELETE | 永久删除项目（不可恢复） | owner only |
| `/api/projects/[id]/duplicate` | POST | 复制项目（可选 name，默认 "xxx 副本"） | owner only |

### 3. 成员管理

| 路径 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/projects/[id]/members` | GET | 获取项目成员列表 | owner / member |
| `/api/projects/[id]/members` | POST | 添加成员（userId 或 email，role 默认 editor） | owner only |
| `/api/projects/[id]/members/[userId]` | DELETE | 移除成员（不可移除 owner） | owner only |

### 4. 邀请机制

| 路径 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/projects/[id]/invites` | POST | 创建邀请（email 必填） | owner only |
| `/api/projects/invites/[token]/accept` | POST | 接受邀请（token 路径参数） | 登录用户 |

### 5. 剧集管理

| 路径 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/projects/[id]/episodes` | GET | 剧集列表（?status, limit, offset, includeContent） | owner / member |
| `/api/projects/[id]/episodes` | POST | 创建剧集（orderNum, content 必填，title, note, sourceType, mode） | owner / member |
| `/api/projects/[id]/episodes/split` | POST | 文本拆分为剧集（content + rule: startOrderNum/titleTemplate/maxEpisodes） | owner / member |

剧集拆分特性：
- 支持阿拉伯数字和中文数字标题识别
- 标题模板动态正则生成（如 `第{n}集`）
- 最大 200 集，输入最大 500KB

### 6. 素材管理

| 路径 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/projects/[id]/assets` | GET | 素材列表（?type=character/scene/prop, limit, offset, search）+ 统计 | owner / member |
| `/api/projects/[id]/assets` | POST | 创建素材（type, name 必填，description, attributes, primaryImageUrl） | owner / member |
| `/api/projects/[id]/assets/analyze` | POST | AI 素材分析（episodeIds, types, textModelId）→ 自动提取角色/场景/道具 | owner / member |

AI 素材分析特性：
- 调用 `lib/asset-analyzer.ts` 分析剧集内容
- 自动 upsert 素材（同名合并）
- 记录素材出现位置（occurrence）
- maxDuration: 120s

---

## 核心依赖

| 模块 | 用途 |
|------|------|
| `lib/db-comic.ts` | 项目、剧集、素材、成员、邀请的数据库操作 |
| `lib/db.ts` | 用户查询（getUserByEmail） |
| `lib/upload-service.ts` | 封面图上传（base64 → 公共 URL） |
| `lib/asset-analyzer.ts` | AI 素材分析（角色、场景、道具提取） |
| `lib/auth.ts` | NextAuth 认证配置 |

---

## 设计模式

1. **软删除**: 项目使用 `softDeleteComicProject` + `restoreComicProject`，支持回收站
2. **权限分层**: owner 拥有全部权限，member 受限（不可删除、不可管理成员）
3. **偏好设置**: 项目级偏好（defaultImageModelId, defaultVideoModelId, defaultStyle, defaultEra 等）独立存储
4. **封面图上传**: 支持 base64 图片自动上传到公共 URL，含 MIME 类型检测
5. **剧集序号冲突检测**: 创建剧集前检查 orderNum 唯一性（应用层 + 数据库层双重保障）
