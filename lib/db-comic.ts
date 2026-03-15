import type { DatabaseAdapter } from './db-adapter';
import { getSharedAdapter } from './db-connection';
import { generateId } from './utils';
import { getUserById } from './db';
import { randomBytes } from 'crypto';

// ========================================
// Types
// ========================================

export interface ComicProject {
  id: string;
  ownerUserId: string;
  name: string;
  aspectRatio: string;
  mode: string;
  copyText: string | null;
  description: string | null;
  coverImageUrl: string | null;
  durationSeconds: number;
  sizeLabel: string;
  lastEditorUserId: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  deletedBy: string | null;
}

export interface ComicEpisode {
  id: string;
  projectId: string;
  orderNum: number;
  title: string;
  content: string;
  note: string | null;
  sourceType: 'manual' | 'split' | 'import';
  mode: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type ProjectAssetType = 'character' | 'scene' | 'prop';

export interface ProjectAsset {
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

export interface AssetOccurrence {
  id: string;
  assetId: string;
  episodeId: string;
  sourceText: string | null;
  confidence: number | null;
  createdAt: number;
}

export interface AssetOccurrenceWithEpisode extends AssetOccurrence {
  episodeTitle: string;
  episodeOrderNum: number;
}

export interface ProjectAssetQueryOptions {
  type?: ProjectAssetType;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface EpisodeQueryOptions {
  status?: 'active' | 'trash';
  limit?: number;
  offset?: number;
  includeContent?: boolean;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  invitedBy: string | null;
  createdAt: number;
}

export interface ProjectInvite {
  id: string;
  projectId: string;
  inviterUserId: string;
  inviteeEmail: string | null;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: number;
  createdAt: number;
  acceptedAt: number | null;
}

export type ProjectAccess = 'owner' | 'member' | null;

export interface ProjectPreferences {
  id: string;
  projectId: string;
  defaultImageModelId: string | null;
  defaultVideoModelId: string | null;
  defaultTextModelId: string | null;
  defaultStyle: string | null;
  defaultEra: string | null;
  defaultVideoRatio: string;
  defaultCharacterRatio: string;
  defaultSceneRatio: string;
  defaultPropRatio: string;
  defaultCreatureRatio: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectQueryOptions {
  scope?: 'personal' | 'team';
  status?: 'active' | 'trash';
  search?: string;
  limit?: number;
  offset?: number;
}

export type AssetGenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AssetGenerationHistory {
  id: string;
  assetId: string;
  generationId: string | null;
  prompt: string;
  channelId: string | null;
  modelId: string | null;
  aspectRatio: string | null;
  imageSize: string | null;
  imageCount: number;
  imageUrl: string | null;
  status: AssetGenerationStatus;
  createdAt: number;
}

export interface AssetGenerationHistoryQueryOptions {
  limit?: number;
  offset?: number;
  status?: AssetGenerationStatus;
}

// ========================================
// Database Adapter
// ========================================

function getAdapter(): DatabaseAdapter {
  return getSharedAdapter();
}

// ========================================
// Constants
// ========================================

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_INVITE_TOKEN_ATTEMPTS = 5;

// Default ratios for project preferences
const DEFAULT_VIDEO_RATIO = '16:9';
const DEFAULT_CHARACTER_RATIO = '9:16';
const DEFAULT_SCENE_RATIO = '16:9';
const DEFAULT_PROP_RATIO = '1:1';
const DEFAULT_CREATURE_RATIO = '1:1';

// ========================================
// Table Initialization
// ========================================

let tablesInitialized = false;

const CREATE_COMIC_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS comic_projects (
  id VARCHAR(36) PRIMARY KEY,
  owner_user_id VARCHAR(36) NOT NULL,
  name VARCHAR(200) NOT NULL,
  aspect_ratio VARCHAR(20) DEFAULT '16:9',
  mode VARCHAR(20) DEFAULT 'ai_merge',
  copy_text TEXT,
  description TEXT,
  cover_image_url VARCHAR(500),
  duration_seconds INT DEFAULT 0,
  size_label VARCHAR(20) DEFAULT '16:9',
  last_editor_user_id VARCHAR(36),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT DEFAULT NULL,
  deleted_by VARCHAR(36) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS project_members (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role VARCHAR(20) DEFAULT 'editor',
  invited_by VARCHAR(36),
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_invites (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  inviter_user_id VARCHAR(36) NOT NULL,
  invitee_email VARCHAR(255),
  token VARCHAR(64) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  accepted_at BIGINT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS project_preferences (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL UNIQUE,
  default_image_model_id VARCHAR(100),
  default_video_model_id VARCHAR(100),
  default_text_model_id VARCHAR(100),
  default_style VARCHAR(50),
  default_era VARCHAR(50) DEFAULT NULL,
  default_video_ratio VARCHAR(20) DEFAULT '16:9',
  default_character_ratio VARCHAR(20) DEFAULT '9:16',
  default_scene_ratio VARCHAR(20) DEFAULT '16:9',
  default_prop_ratio VARCHAR(20) DEFAULT '1:1',
  default_creature_ratio VARCHAR(20) DEFAULT '1:1',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES comic_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comic_episodes (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  order_num INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content LONGTEXT NOT NULL,
  note TEXT,
  source_type VARCHAR(20) NOT NULL DEFAULT 'manual',
  mode VARCHAR(20) DEFAULT 'ai_merge',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT DEFAULT NULL,
  FOREIGN KEY (project_id) REFERENCES comic_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_assets (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  attributes JSON,
  primary_image_url VARCHAR(500),
  generation_id VARCHAR(36),
  sort_order INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT DEFAULT NULL,
  FOREIGN KEY (project_id) REFERENCES comic_projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_occurrences (
  id VARCHAR(36) PRIMARY KEY,
  asset_id VARCHAR(36) NOT NULL,
  episode_id VARCHAR(36) NOT NULL,
  source_text TEXT,
  confidence FLOAT,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES project_assets(id) ON DELETE CASCADE,
  FOREIGN KEY (episode_id) REFERENCES comic_episodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_generation_history (
  id VARCHAR(36) PRIMARY KEY,
  asset_id VARCHAR(36) NOT NULL,
  generation_id VARCHAR(36),
  prompt TEXT NOT NULL,
  channel_id VARCHAR(36),
  model_id VARCHAR(36),
  aspect_ratio VARCHAR(20),
  image_size VARCHAR(20),
  image_count INT DEFAULT 1,
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at BIGINT NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES project_assets(id) ON DELETE CASCADE
);
`;

const CREATE_INDEXES_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_comic_owner ON comic_projects(owner_user_id)',
  'CREATE INDEX IF NOT EXISTS idx_comic_updated ON comic_projects(updated_at)',
  'CREATE INDEX IF NOT EXISTS idx_comic_deleted ON comic_projects(deleted_at)',
  'CREATE INDEX IF NOT EXISTS idx_member_project ON project_members(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_member_user ON project_members(user_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS uk_member_project_user ON project_members(project_id, user_id)',
  'CREATE UNIQUE INDEX IF NOT EXISTS uk_invite_token ON project_invites(token)',
  'CREATE INDEX IF NOT EXISTS idx_invite_project ON project_invites(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_invite_status ON project_invites(status)',
  'CREATE INDEX IF NOT EXISTS idx_episode_project_status_order ON comic_episodes(project_id, deleted_at, order_num)',
  'CREATE UNIQUE INDEX IF NOT EXISTS uk_episode_project_order_active ON comic_episodes(project_id, order_num) WHERE deleted_at IS NULL',
  'CREATE INDEX IF NOT EXISTS idx_project_assets_project ON project_assets(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_project_assets_project_type ON project_assets(project_id, type)',
  'CREATE INDEX IF NOT EXISTS idx_project_assets_updated ON project_assets(updated_at)',
  'CREATE UNIQUE INDEX IF NOT EXISTS uk_project_assets_name_active ON project_assets(project_id, type, name) WHERE deleted_at IS NULL',
  'CREATE INDEX IF NOT EXISTS idx_asset_occurrences_asset ON asset_occurrences(asset_id)',
  'CREATE INDEX IF NOT EXISTS idx_asset_occurrences_episode ON asset_occurrences(episode_id)',
  'CREATE INDEX IF NOT EXISTS idx_agh_asset_created ON asset_generation_history(asset_id, created_at DESC)',
];

const DB_TYPE = process.env.DB_TYPE || 'sqlite';

function isDuplicateColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code === 'ER_DUP_FIELDNAME') return true;
  const message = (error as { message?: string })?.message;
  return typeof message === 'string' && message.toLowerCase().includes('duplicate column');
}

async function columnExists(db: DatabaseAdapter, table: string, column: string): Promise<boolean> {
  if (DB_TYPE === 'mysql') {
    // Use INFORMATION_SCHEMA instead of SHOW COLUMNS to support prepared statements
    const [rows] = await db.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return (rows as Record<string, unknown>[]).length > 0;
  }
  const [rows] = await db.execute(`PRAGMA table_info(${table})`, []);
  return (rows as Record<string, unknown>[]).some((row) => String(row.name) === column);
}

async function addColumnIfMissing(
  db: DatabaseAdapter,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const exists = await columnExists(db, table, column);
  if (exists) return;
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, []);
  } catch (error) {
    if (isDuplicateColumnError(error)) return;
    throw error;
  }
}

async function ensureComicSchema(db: DatabaseAdapter): Promise<void> {
  await addColumnIfMissing(db, 'comic_projects', 'description', 'TEXT');
  await addColumnIfMissing(db, 'comic_projects', 'cover_image_url', 'VARCHAR(500)');
  await addColumnIfMissing(db, 'comic_episodes', 'mode', "VARCHAR(20) DEFAULT 'ai_merge'");
  await addColumnIfMissing(db, 'project_preferences', 'default_era', 'VARCHAR(50) DEFAULT NULL');
}

export async function initializeComicTables(): Promise<void> {
  if (tablesInitialized) return;

  const db = getAdapter();
  const statements = CREATE_COMIC_TABLES_SQL.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const sql of statements) {
    await db.execute(sql, []);
  }

  for (const indexSql of CREATE_INDEXES_SQL) {
    try {
      await db.execute(indexSql, []);
    } catch {
      // Index may already exist
    }
  }

  await ensureComicSchema(db);

  tablesInitialized = true;
}

// ========================================
// Row Mappers
// ========================================

function mapComicProject(row: Record<string, unknown>): ComicProject {
  const copyText = row.copy_text ? String(row.copy_text) : null;
  const descriptionValue = row.description ?? row.copy_text;
  const description = descriptionValue ? String(descriptionValue) : null;
  const coverImageUrl = row.cover_image_url ? String(row.cover_image_url) : null;

  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    name: String(row.name),
    aspectRatio: String(row.aspect_ratio || '16:9'),
    mode: String(row.mode || 'ai_merge'),
    copyText: copyText ?? description,
    description,
    coverImageUrl,
    durationSeconds: Number(row.duration_seconds) || 0,
    sizeLabel: String(row.size_label || '16:9'),
    lastEditorUserId: row.last_editor_user_id ? String(row.last_editor_user_id) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at ? Number(row.deleted_at) : null,
    deletedBy: row.deleted_by ? String(row.deleted_by) : null,
  };
}

function mapProjectMember(row: Record<string, unknown>): ProjectMember {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    userId: String(row.user_id),
    role: String(row.role || 'editor'),
    invitedBy: row.invited_by ? String(row.invited_by) : null,
    createdAt: Number(row.created_at),
  };
}

function mapProjectInvite(row: Record<string, unknown>): ProjectInvite {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    inviterUserId: String(row.inviter_user_id),
    inviteeEmail: row.invitee_email ? String(row.invitee_email) : null,
    token: String(row.token),
    status: row.status as 'pending' | 'accepted' | 'expired',
    expiresAt: Number(row.expires_at),
    createdAt: Number(row.created_at),
    acceptedAt: row.accepted_at ? Number(row.accepted_at) : null,
  };
}

function mapProjectPreferences(row: Record<string, unknown>): ProjectPreferences {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    defaultImageModelId: row.default_image_model_id ? String(row.default_image_model_id) : null,
    defaultVideoModelId: row.default_video_model_id ? String(row.default_video_model_id) : null,
    defaultTextModelId: row.default_text_model_id ? String(row.default_text_model_id) : null,
    defaultStyle: row.default_style ? String(row.default_style) : null,
    defaultEra: row.default_era ? String(row.default_era) : null,
    defaultVideoRatio: String(row.default_video_ratio || DEFAULT_VIDEO_RATIO),
    defaultCharacterRatio: String(row.default_character_ratio || DEFAULT_CHARACTER_RATIO),
    defaultSceneRatio: String(row.default_scene_ratio || DEFAULT_SCENE_RATIO),
    defaultPropRatio: String(row.default_prop_ratio || DEFAULT_PROP_RATIO),
    defaultCreatureRatio: String(row.default_creature_ratio || DEFAULT_CREATURE_RATIO),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapComicEpisode(row: Record<string, unknown>): ComicEpisode {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    orderNum: Number(row.order_num) || 0,
    title: String(row.title),
    content: row.content ? String(row.content) : '',
    note: row.note ? String(row.note) : null,
    sourceType: (row.source_type as ComicEpisode['sourceType']) || 'manual',
    mode: String(row.mode || 'ai_merge'),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at ? Number(row.deleted_at) : null,
  };
}

function parseAssetAttributes(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object') {
    if (Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function mapProjectAsset(row: Record<string, unknown>): ProjectAsset {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    type: String(row.type) as ProjectAssetType,
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    attributes: parseAssetAttributes(row.attributes),
    primaryImageUrl: row.primary_image_url ? String(row.primary_image_url) : null,
    generationId: row.generation_id ? String(row.generation_id) : null,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    deletedAt: row.deleted_at ? Number(row.deleted_at) : null,
  };
}

function mapAssetOccurrence(row: Record<string, unknown>): AssetOccurrence {
  const confidence = row.confidence;
  return {
    id: String(row.id),
    assetId: String(row.asset_id),
    episodeId: String(row.episode_id),
    sourceText: row.source_text ? String(row.source_text) : null,
    confidence: confidence === null || confidence === undefined ? null : Number(confidence),
    createdAt: Number(row.created_at),
  };
}

function mapAssetOccurrenceWithEpisode(row: Record<string, unknown>): AssetOccurrenceWithEpisode {
  return {
    ...mapAssetOccurrence(row),
    episodeTitle: row.episode_title ? String(row.episode_title) : '',
    episodeOrderNum: Number(row.episode_order_num ?? 0),
  };
}

function normalizeAssetGenerationStatus(value: unknown): AssetGenerationStatus {
  if (value === 'processing' || value === 'completed' || value === 'failed') return value;
  return 'pending';
}

function mapAssetGenerationHistory(row: Record<string, unknown>): AssetGenerationHistory {
  return {
    id: String(row.id),
    assetId: String(row.asset_id),
    generationId: row.generation_id ? String(row.generation_id) : null,
    prompt: row.prompt ? String(row.prompt) : '',
    channelId: row.channel_id ? String(row.channel_id) : null,
    modelId: row.model_id ? String(row.model_id) : null,
    aspectRatio: row.aspect_ratio ? String(row.aspect_ratio) : null,
    imageSize: row.image_size ? String(row.image_size) : null,
    imageCount: Math.max(1, Number(row.image_count || 1)),
    imageUrl: row.image_url ? String(row.image_url) : null,
    status: normalizeAssetGenerationStatus(row.status),
    createdAt: Number(row.created_at),
  };
}

// ========================================
// Comic Project CRUD
// ========================================

export async function createComicProject(data: {
  ownerUserId: string;
  name: string;
  aspectRatio?: string;
  mode?: string;
  copyText?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  durationSeconds?: number;
  sizeLabel?: string;
  lastEditorUserId?: string;
}): Promise<ComicProject> {
  await initializeComicTables();
  const db = getAdapter();
  const now = Date.now();

  const project: ComicProject = {
    id: generateId(),
    ownerUserId: data.ownerUserId,
    name: data.name,
    aspectRatio: data.aspectRatio || '16:9',
    mode: data.mode || 'ai_merge',
    copyText: data.copyText ?? data.description ?? null,
    description: data.description ?? data.copyText ?? null,
    coverImageUrl: data.coverImageUrl ?? null,
    durationSeconds: Math.max(0, Math.floor(data.durationSeconds || 0)),
    sizeLabel: data.sizeLabel || data.aspectRatio || '16:9',
    lastEditorUserId: data.lastEditorUserId || data.ownerUserId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
  };

  await db.execute(
    `INSERT INTO comic_projects (id, owner_user_id, name, aspect_ratio, mode, copy_text, description, cover_image_url, duration_seconds, size_label, last_editor_user_id, created_at, updated_at, deleted_at, deleted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project.id,
      project.ownerUserId,
      project.name,
      project.aspectRatio,
      project.mode,
      project.copyText,
      project.description,
      project.coverImageUrl,
      project.durationSeconds,
      project.sizeLabel,
      project.lastEditorUserId,
      project.createdAt,
      project.updatedAt,
      project.deletedAt,
      project.deletedBy,
    ]
  );

  return project;
}

export async function getComicProjectById(id: string): Promise<ComicProject | null> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM comic_projects WHERE id = ?', [id]);
  const results = rows as Record<string, unknown>[];
  if (results.length === 0) return null;

  return mapComicProject(results[0]);
}

export async function getComicProjects(
  userId: string,
  options: ProjectQueryOptions = {}
): Promise<ComicProject[]> {
  await initializeComicTables();
  const db = getAdapter();

  const { scope = 'personal', status = 'active', search, limit = 50, offset = 0 } = options;

  let sql: string;
  const params: unknown[] = [];

  if (scope === 'team') {
    sql = `
      SELECT DISTINCT p.* FROM comic_projects p
      LEFT JOIN project_members m ON p.id = m.project_id
      WHERE (p.owner_user_id = ? OR m.user_id = ?)
    `;
    params.push(userId, userId);
  } else {
    sql = 'SELECT * FROM comic_projects WHERE owner_user_id = ?';
    params.push(userId);
  }

  if (status === 'trash') {
    sql += ' AND deleted_at IS NOT NULL';
  } else {
    sql += ' AND deleted_at IS NULL';
  }

  if (search) {
    sql += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await db.execute(sql, params);
  return (rows as Record<string, unknown>[]).map(mapComicProject);
}

export async function updateComicProject(
  id: string,
  updates: Partial<{
    name: string;
    aspectRatio: string;
    mode: string;
    copyText: string | null;
    description: string | null;
    coverImageUrl: string | null;
    durationSeconds: number;
    sizeLabel: string;
    lastEditorUserId: string;
  }>
): Promise<ComicProject | null> {
  await initializeComicTables();
  const db = getAdapter();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.aspectRatio !== undefined) {
    fields.push('aspect_ratio = ?');
    values.push(updates.aspectRatio);
  }
  if (updates.mode !== undefined) {
    fields.push('mode = ?');
    values.push(updates.mode);
  }
  if (updates.copyText !== undefined) {
    fields.push('copy_text = ?');
    values.push(updates.copyText);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.coverImageUrl !== undefined) {
    fields.push('cover_image_url = ?');
    values.push(updates.coverImageUrl);
  }
  if (updates.durationSeconds !== undefined) {
    fields.push('duration_seconds = ?');
    values.push(Math.max(0, Math.floor(updates.durationSeconds)));
  }
  if (updates.sizeLabel !== undefined) {
    fields.push('size_label = ?');
    values.push(updates.sizeLabel);
  }
  if (updates.lastEditorUserId !== undefined) {
    fields.push('last_editor_user_id = ?');
    values.push(updates.lastEditorUserId);
  }

  if (fields.length === 0) return getComicProjectById(id);

  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  await db.execute(`UPDATE comic_projects SET ${fields.join(', ')} WHERE id = ?`, values);
  return getComicProjectById(id);
}

export async function softDeleteComicProject(id: string, deletedBy: string): Promise<ComicProject | null> {
  await initializeComicTables();
  const db = getAdapter();
  const now = Date.now();

  await db.execute(
    'UPDATE comic_projects SET deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ?',
    [now, deletedBy, now, id]
  );

  return getComicProjectById(id);
}

export async function restoreComicProject(id: string): Promise<ComicProject | null> {
  await initializeComicTables();
  const db = getAdapter();
  const now = Date.now();

  await db.execute(
    'UPDATE comic_projects SET deleted_at = NULL, deleted_by = NULL, updated_at = ? WHERE id = ?',
    [now, id]
  );

  return getComicProjectById(id);
}

export async function purgeComicProject(id: string): Promise<boolean> {
  await initializeComicTables();
  const db = getAdapter();

  await db.execute('DELETE FROM project_members WHERE project_id = ?', [id]);
  await db.execute('DELETE FROM project_invites WHERE project_id = ?', [id]);
  await db.execute('DELETE FROM project_preferences WHERE project_id = ?', [id]);
  const [, result] = await db.execute('DELETE FROM comic_projects WHERE id = ?', [id]);

  return ((result as { affectedRows?: number })?.affectedRows ?? 0) > 0;
}

export async function duplicateComicProject(id: string, newName?: string): Promise<ComicProject | null> {
  await initializeComicTables();
  const db = getAdapter();

  const existing = await getComicProjectById(id);
  if (!existing) return null;

  const now = Date.now();
  const project: ComicProject = {
    id: generateId(),
    ownerUserId: existing.ownerUserId,
    name: newName || `${existing.name} Copy`,
    aspectRatio: existing.aspectRatio,
    mode: existing.mode,
    copyText: existing.copyText ?? existing.description,
    description: existing.description ?? existing.copyText,
    coverImageUrl: existing.coverImageUrl ?? null,
    durationSeconds: existing.durationSeconds,
    sizeLabel: existing.sizeLabel,
    lastEditorUserId: existing.ownerUserId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
  };

  await db.execute(
    `INSERT INTO comic_projects (id, owner_user_id, name, aspect_ratio, mode, copy_text, description, cover_image_url, duration_seconds, size_label, last_editor_user_id, created_at, updated_at, deleted_at, deleted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project.id,
      project.ownerUserId,
      project.name,
      project.aspectRatio,
      project.mode,
      project.copyText,
      project.description,
      project.coverImageUrl,
      project.durationSeconds,
      project.sizeLabel,
      project.lastEditorUserId,
      project.createdAt,
      project.updatedAt,
      project.deletedAt,
      project.deletedBy,
    ]
  );

  return project;
}

// ========================================
// Project Preferences
// ========================================

export async function createProjectPreferences(
  projectId: string,
  data: Partial<{
    defaultImageModelId: string | null;
    defaultVideoModelId: string | null;
    defaultTextModelId: string | null;
    defaultStyle: string | null;
    defaultEra: string | null;
    defaultVideoRatio: string;
  }> = {}
): Promise<ProjectPreferences> {
  await initializeComicTables();
  const db = getAdapter();
  const now = Date.now();

  const preferences: ProjectPreferences = {
    id: generateId(),
    projectId,
    defaultImageModelId: data.defaultImageModelId ?? null,
    defaultVideoModelId: data.defaultVideoModelId ?? null,
    defaultTextModelId: data.defaultTextModelId ?? null,
    defaultStyle: data.defaultStyle ?? null,
    defaultEra: data.defaultEra ?? null,
    defaultVideoRatio: data.defaultVideoRatio || DEFAULT_VIDEO_RATIO,
    defaultCharacterRatio: DEFAULT_CHARACTER_RATIO,
    defaultSceneRatio: DEFAULT_SCENE_RATIO,
    defaultPropRatio: DEFAULT_PROP_RATIO,
    defaultCreatureRatio: DEFAULT_CREATURE_RATIO,
    createdAt: now,
    updatedAt: now,
  };

  await db.execute(
    `INSERT INTO project_preferences (
      id, project_id, default_image_model_id, default_video_model_id,
      default_text_model_id, default_style, default_era, default_video_ratio,
      default_character_ratio, default_scene_ratio, default_prop_ratio,
      default_creature_ratio, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      preferences.id,
      preferences.projectId,
      preferences.defaultImageModelId,
      preferences.defaultVideoModelId,
      preferences.defaultTextModelId,
      preferences.defaultStyle,
      preferences.defaultEra,
      preferences.defaultVideoRatio,
      preferences.defaultCharacterRatio,
      preferences.defaultSceneRatio,
      preferences.defaultPropRatio,
      preferences.defaultCreatureRatio,
      preferences.createdAt,
      preferences.updatedAt,
    ]
  );

  return preferences;
}

export async function getProjectPreferences(projectId: string): Promise<ProjectPreferences | null> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM project_preferences WHERE project_id = ?', [projectId]);
  const results = rows as Record<string, unknown>[];
  if (results.length === 0) return null;

  return mapProjectPreferences(results[0]);
}

export async function updateProjectPreferences(
  projectId: string,
  updates: Partial<{
    defaultImageModelId: string | null;
    defaultVideoModelId: string | null;
    defaultTextModelId: string | null;
    defaultStyle: string | null;
    defaultEra: string | null;
    defaultVideoRatio: string;
  }>
): Promise<ProjectPreferences | null> {
  await initializeComicTables();
  const db = getAdapter();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.defaultImageModelId !== undefined) {
    fields.push('default_image_model_id = ?');
    values.push(updates.defaultImageModelId);
  }
  if (updates.defaultVideoModelId !== undefined) {
    fields.push('default_video_model_id = ?');
    values.push(updates.defaultVideoModelId);
  }
  if (updates.defaultTextModelId !== undefined) {
    fields.push('default_text_model_id = ?');
    values.push(updates.defaultTextModelId);
  }
  if (updates.defaultStyle !== undefined) {
    fields.push('default_style = ?');
    values.push(updates.defaultStyle);
  }
  if (updates.defaultEra !== undefined) {
    fields.push('default_era = ?');
    values.push(updates.defaultEra);
  }
  if (updates.defaultVideoRatio !== undefined) {
    fields.push('default_video_ratio = ?');
    values.push(updates.defaultVideoRatio);
  }

  if (fields.length === 0) return getProjectPreferences(projectId);

  const existing = await getProjectPreferences(projectId);
  if (!existing) {
    return createProjectPreferences(projectId, updates);
  }

  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(projectId);

  await db.execute(`UPDATE project_preferences SET ${fields.join(', ')} WHERE project_id = ?`, values);
  return getProjectPreferences(projectId);
}

// ========================================
// Comic Episodes
// ========================================

export async function createComicEpisode(data: {
  projectId: string;
  orderNum: number;
  title: string;
  content: string;
  note?: string | null;
  sourceType?: ComicEpisode['sourceType'];
  mode?: string;
}): Promise<ComicEpisode> {
  await initializeComicTables();
  const db = getAdapter();
  const now = Date.now();
  const normalizedOrderNum = Math.max(1, Math.floor(data.orderNum));
  const normalizedTitle = data.title.trim() || `第${normalizedOrderNum}集`;
  const normalizedNote = typeof data.note === 'string' ? data.note.trim() || null : null;
  const normalizedMode = typeof data.mode === 'string' && data.mode.trim() ? data.mode.trim() : 'ai_merge';

  const episode: ComicEpisode = {
    id: generateId(),
    projectId: data.projectId,
    orderNum: normalizedOrderNum,
    title: normalizedTitle,
    content: data.content,
    note: normalizedNote,
    sourceType: data.sourceType || 'manual',
    mode: normalizedMode,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.execute(
    `INSERT INTO comic_episodes (id, project_id, order_num, title, content, note, source_type, mode, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      episode.id,
      episode.projectId,
      episode.orderNum,
      episode.title,
      episode.content,
      episode.note,
      episode.sourceType,
      episode.mode,
      episode.createdAt,
      episode.updatedAt,
      episode.deletedAt,
    ]
  );

  return episode;
}

export async function getComicEpisodeById(id: string): Promise<ComicEpisode | null> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM comic_episodes WHERE id = ?', [id]);
  const results = rows as Record<string, unknown>[];
  if (results.length === 0) return null;

  return mapComicEpisode(results[0]);
}

export async function getComicEpisodes(
  projectId: string,
  options: EpisodeQueryOptions = {}
): Promise<ComicEpisode[]> {
  await initializeComicTables();
  const db = getAdapter();

  const { status = 'active', limit = 50, offset = 0, includeContent = true } = options;

  const selectFields = includeContent
    ? '*'
    : 'id, project_id, order_num, title, note, source_type, mode, created_at, updated_at, deleted_at';

  let sql = `SELECT ${selectFields} FROM comic_episodes WHERE project_id = ?`;
  const params: unknown[] = [projectId];

  if (status === 'trash') {
    sql += ' AND deleted_at IS NOT NULL';
  } else {
    sql += ' AND deleted_at IS NULL';
  }

  sql += ' ORDER BY order_num ASC, created_at ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await db.execute(sql, params);
  return (rows as Record<string, unknown>[]).map(mapComicEpisode);
}

export async function getComicEpisodesCount(
  projectId: string,
  status: 'active' | 'trash' = 'active'
): Promise<number> {
  await initializeComicTables();
  const db = getAdapter();

  let sql = 'SELECT COUNT(*) as cnt FROM comic_episodes WHERE project_id = ?';
  const params: unknown[] = [projectId];

  if (status === 'trash') {
    sql += ' AND deleted_at IS NOT NULL';
  } else {
    sql += ' AND deleted_at IS NULL';
  }

  const [rows] = await db.execute(sql, params);
  const results = rows as Record<string, unknown>[];
  return Number(results[0]?.cnt ?? 0);
}

export async function updateComicEpisode(
  id: string,
  updates: Partial<{
    orderNum: number;
    title: string;
    content: string;
    note: string | null;
  }>
): Promise<ComicEpisode | null> {
  await initializeComicTables();
  const db = getAdapter();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.orderNum !== undefined) {
    fields.push('order_num = ?');
    values.push(Math.max(1, Math.floor(updates.orderNum)));
  }
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.content !== undefined) {
    fields.push('content = ?');
    values.push(updates.content);
  }
  if (updates.note !== undefined) {
    fields.push('note = ?');
    values.push(updates.note);
  }

  if (fields.length === 0) return getComicEpisodeById(id);

  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  await db.execute(`UPDATE comic_episodes SET ${fields.join(', ')} WHERE id = ?`, values);
  return getComicEpisodeById(id);
}

export async function softDeleteComicEpisode(id: string): Promise<ComicEpisode | null> {
  await initializeComicTables();
  const db = getAdapter();
  const now = Date.now();

  await db.execute('UPDATE comic_episodes SET deleted_at = ?, updated_at = ? WHERE id = ?', [
    now,
    now,
    id,
  ]);

  return getComicEpisodeById(id);
}

export async function batchSoftDeleteEpisodes(
  projectId: string,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0;

  await initializeComicTables();
  const db = getAdapter();
  const now = Date.now();
  const safeIds = ids.slice(0, 100);
  const placeholders = safeIds.map(() => '?').join(', ');

  // MySQL: affectedRows 在 results[0] (ResultSetHeader)
  // SQLite: affectedRows 在 results[1] ({ affectedRows, insertId })
  const results = await db.execute(
    `UPDATE comic_episodes
     SET deleted_at = ?, updated_at = ?
     WHERE project_id = ?
       AND deleted_at IS NULL
       AND id IN (${placeholders})`,
    [now, now, projectId, ...safeIds]
  );

  return (results[0] as { affectedRows?: number })?.affectedRows
    ?? (results[1] as { affectedRows?: number })?.affectedRows
    ?? 0;
}

export async function checkEpisodeOrderConflict(
  projectId: string,
  orderNum: number,
  excludeId?: string
): Promise<boolean> {
  await initializeComicTables();
  const db = getAdapter();
  const normalizedOrderNum = Math.max(1, Math.floor(orderNum));

  let sql = 'SELECT id FROM comic_episodes WHERE project_id = ? AND order_num = ? AND deleted_at IS NULL';
  const params: unknown[] = [projectId, normalizedOrderNum];

  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }

  sql += ' LIMIT 1';

  const [rows] = await db.execute(sql, params);
  return (rows as Record<string, unknown>[]).length > 0;
}

export async function getNextEpisodeOrderNum(projectId: string): Promise<number> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT MAX(order_num) as max_order FROM comic_episodes WHERE project_id = ? AND deleted_at IS NULL',
    [projectId]
  );
  const results = rows as Record<string, unknown>[];
  const maxOrder = results[0]?.max_order;
  return (typeof maxOrder === 'number' ? maxOrder : 0) + 1;
}

// ========================================
// Project Assets
// ========================================

function serializeAssetAttributes(value?: Record<string, unknown> | null): string | null {
  if (!value || Object.keys(value).length === 0) return null;
  return JSON.stringify(value);
}

function mergeAssetAttributes(
  existing: Record<string, unknown> | null,
  incoming: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!incoming || Object.keys(incoming).length === 0) return existing;
  if (!existing) return incoming;
  return { ...existing, ...incoming };
}

function normalizeConfidence(value?: number | null): number | null {
  if (value === undefined || value === null) return null;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  return Math.min(1, Math.max(0, raw));
}

async function getProjectAssetByName(
  projectId: string,
  type: ProjectAssetType,
  name: string | null | undefined
): Promise<ProjectAsset | null> {
  if (!name) return null;
  await initializeComicTables();
  const db = getAdapter();
  const normalizedName = name.trim();
  if (!normalizedName) return null;

  const [rows] = await db.execute(
    'SELECT * FROM project_assets WHERE project_id = ? AND type = ? AND name = ? AND deleted_at IS NULL LIMIT 1',
    [projectId, type, normalizedName]
  );
  const results = rows as Record<string, unknown>[];
  if (results.length === 0) return null;
  return mapProjectAsset(results[0]);
}

export async function getProjectAssets(
  projectId: string,
  options: ProjectAssetQueryOptions = {}
): Promise<ProjectAsset[]> {
  await initializeComicTables();
  const db = getAdapter();

  const limit = Math.min(Math.max(1, options.limit || 200), 500);
  const offset = Math.max(0, options.offset || 0);

  let sql = 'SELECT * FROM project_assets WHERE project_id = ?';
  const params: unknown[] = [projectId];

  if (!options.includeDeleted) {
    sql += ' AND deleted_at IS NULL';
  }
  if (options.type) {
    sql += ' AND type = ?';
    params.push(options.type);
  }
  if (options.search) {
    sql += ' AND name LIKE ?';
    params.push(`%${options.search}%`);
  }

  sql += ' ORDER BY sort_order ASC, updated_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await db.execute(sql, params);
  return (rows as Record<string, unknown>[]).map(mapProjectAsset);
}

export async function getProjectAssetById(id: string): Promise<ProjectAsset | null> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM project_assets WHERE id = ?', [id]);
  const results = rows as Record<string, unknown>[];
  if (results.length === 0) return null;
  return mapProjectAsset(results[0]);
}

export async function createProjectAsset(data: {
  projectId: string;
  type: ProjectAssetType;
  name: string;
  description?: string | null;
  attributes?: Record<string, unknown> | null;
  primaryImageUrl?: string | null;
  generationId?: string | null;
  sortOrder?: number;
}): Promise<ProjectAsset> {
  await initializeComicTables();
  const db = getAdapter();
  const now = Date.now();
  const normalizedName = (data.name ?? '').trim();
  if (!normalizedName) {
    throw new Error('Asset name is required');
  }

  const attributes = data.attributes ?? null;

  const asset: ProjectAsset = {
    id: generateId(),
    projectId: data.projectId,
    type: data.type,
    name: normalizedName,
    description: data.description?.trim() || null,
    attributes,
    primaryImageUrl: data.primaryImageUrl ?? null,
    generationId: data.generationId ?? null,
    sortOrder: Math.max(0, Math.floor(data.sortOrder || 0)),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.execute(
    `INSERT INTO project_assets (
      id, project_id, type, name, description, attributes,
      primary_image_url, generation_id, sort_order, created_at,
      updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      asset.id,
      asset.projectId,
      asset.type,
      asset.name,
      asset.description,
      serializeAssetAttributes(attributes),
      asset.primaryImageUrl,
      asset.generationId,
      asset.sortOrder,
      asset.createdAt,
      asset.updatedAt,
      asset.deletedAt,
    ]
  );

  return asset;
}

export async function updateProjectAsset(
  id: string,
  updates: Partial<{
    type: ProjectAssetType;
    name: string;
    description: string | null;
    attributes: Record<string, unknown> | null;
    primaryImageUrl: string | null;
    generationId: string | null;
    sortOrder: number;
  }>
): Promise<ProjectAsset | null> {
  await initializeComicTables();
  const db = getAdapter();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.type !== undefined) {
    fields.push('type = ?');
    values.push(updates.type);
  }
  if (updates.name !== undefined) {
    const normalizedName = (updates.name ?? '').trim();
    if (!normalizedName) throw new Error('Asset name is required');
    fields.push('name = ?');
    values.push(normalizedName);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description?.trim() || null);
  }
  if (updates.attributes !== undefined) {
    fields.push('attributes = ?');
    values.push(serializeAssetAttributes(updates.attributes));
  }
  if (updates.primaryImageUrl !== undefined) {
    fields.push('primary_image_url = ?');
    values.push(updates.primaryImageUrl);
  }
  if (updates.generationId !== undefined) {
    fields.push('generation_id = ?');
    values.push(updates.generationId);
  }
  if (updates.sortOrder !== undefined) {
    fields.push('sort_order = ?');
    values.push(Math.max(0, Math.floor(updates.sortOrder)));
  }

  if (fields.length === 0) return getProjectAssetById(id);

  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  await db.execute(`UPDATE project_assets SET ${fields.join(', ')} WHERE id = ?`, values);
  return getProjectAssetById(id);
}

export async function softDeleteProjectAsset(id: string): Promise<ProjectAsset | null> {
  await initializeComicTables();
  const db = getAdapter();
  const now = Date.now();

  await db.execute(
    'UPDATE project_assets SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );

  return getProjectAssetById(id);
}

export async function upsertProjectAsset(data: {
  projectId: string;
  type: ProjectAssetType;
  name: string;
  description?: string | null;
  attributes?: Record<string, unknown> | null;
  primaryImageUrl?: string | null;
  sortOrder?: number;
}): Promise<ProjectAsset> {
  const existing = await getProjectAssetByName(data.projectId, data.type, data.name);
  if (!existing) {
    try {
      return await createProjectAsset(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('UNIQUE') || msg.includes('Duplicate')) {
        const retry = await getProjectAssetByName(data.projectId, data.type, data.name);
        if (retry) return retry;
      }
      throw err;
    }
  }

  const mergedAttributes = mergeAssetAttributes(existing.attributes, data.attributes ?? null);
  const updates: Partial<{
    description: string | null;
    attributes: Record<string, unknown> | null;
  }> = {};

  if (data.description?.trim()) {
    updates.description = data.description.trim();
  }
  if (mergedAttributes !== existing.attributes) {
    updates.attributes = mergedAttributes;
  }

  if (Object.keys(updates).length === 0) return existing;
  const updated = await updateProjectAsset(existing.id, updates);
  return updated ?? existing;
}

export async function getAssetOccurrences(
  assetId: string,
  options: { episodeId?: string; limit?: number; offset?: number } = {}
): Promise<AssetOccurrence[]> {
  await initializeComicTables();
  const db = getAdapter();

  const limit = Math.min(Math.max(1, options.limit || 200), 500);
  const offset = Math.max(0, options.offset || 0);

  let sql = 'SELECT * FROM asset_occurrences WHERE asset_id = ?';
  const params: unknown[] = [assetId];

  if (options.episodeId) {
    sql += ' AND episode_id = ?';
    params.push(options.episodeId);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await db.execute(sql, params);
  return (rows as Record<string, unknown>[]).map(mapAssetOccurrence);
}

export async function getAssetOccurrencesWithEpisode(
  assetId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<AssetOccurrenceWithEpisode[]> {
  await initializeComicTables();
  const db = getAdapter();

  const limit = Math.min(Math.max(1, options.limit || 200), 500);
  const offset = Math.max(0, options.offset || 0);

  const sql = `
    SELECT ao.*, ce.title AS episode_title, ce.order_num AS episode_order_num
    FROM asset_occurrences ao
    LEFT JOIN comic_episodes ce ON ao.episode_id = ce.id
    WHERE ao.asset_id = ?
    ORDER BY ce.order_num ASC, ao.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await db.execute(sql, [assetId, limit, offset]);
  return (rows as Record<string, unknown>[]).map(mapAssetOccurrenceWithEpisode);
}

export async function createAssetOccurrence(data: {
  assetId: string;
  episodeId: string;
  sourceText?: string | null;
  confidence?: number | null;
}): Promise<AssetOccurrence> {
  await initializeComicTables();
  const db = getAdapter();
  const now = Date.now();

  const occurrence: AssetOccurrence = {
    id: generateId(),
    assetId: data.assetId,
    episodeId: data.episodeId,
    sourceText: data.sourceText ?? null,
    confidence: normalizeConfidence(data.confidence),
    createdAt: now,
  };

  await db.execute(
    `INSERT INTO asset_occurrences (id, asset_id, episode_id, source_text, confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      occurrence.id,
      occurrence.assetId,
      occurrence.episodeId,
      occurrence.sourceText,
      occurrence.confidence,
      occurrence.createdAt,
    ]
  );

  return occurrence;
}

export async function deleteAssetOccurrencesByEpisode(episodeId: string): Promise<number> {
  await initializeComicTables();
  const db = getAdapter();

  const [, result] = await db.execute(
    'DELETE FROM asset_occurrences WHERE episode_id = ?',
    [episodeId]
  );

  return (result as { affectedRows?: number })?.affectedRows ?? 0;
}

export async function deleteAssetOccurrencesByEpisodeAndType(
  episodeId: string,
  types?: ProjectAssetType[]
): Promise<number> {
  if (!types || types.length === 0) {
    return deleteAssetOccurrencesByEpisode(episodeId);
  }

  await initializeComicTables();
  const db = getAdapter();
  const placeholders = types.map(() => '?').join(', ');

  const [, result] = await db.execute(
    `DELETE FROM asset_occurrences
     WHERE episode_id = ? AND asset_id IN (
       SELECT id FROM project_assets
       WHERE type IN (${placeholders})
         AND project_id = (SELECT project_id FROM comic_episodes WHERE id = ?)
     )`,
    [episodeId, ...types, episodeId]
  );

  return (result as { affectedRows?: number })?.affectedRows ?? 0;
}

export async function getEpisodeAssets(episodeId: string): Promise<ProjectAsset[]> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute(
    `SELECT DISTINCT a.*
     FROM project_assets a
     INNER JOIN asset_occurrences o ON o.asset_id = a.id
     WHERE o.episode_id = ? AND a.deleted_at IS NULL
     ORDER BY a.type ASC, a.sort_order ASC, a.updated_at DESC`,
    [episodeId]
  );

  return (rows as Record<string, unknown>[]).map(mapProjectAsset);
}

export async function getProjectAssetStats(projectId: string): Promise<{
  total: number;
  byType: Record<ProjectAssetType, number>;
}> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT type, COUNT(*) as count FROM project_assets WHERE project_id = ? AND deleted_at IS NULL GROUP BY type',
    [projectId]
  );

  const byType: Record<ProjectAssetType, number> = {
    character: 0,
    scene: 0,
    prop: 0,
  };

  let total = 0;
  for (const row of rows as Record<string, unknown>[]) {
    const type = String(row.type) as ProjectAssetType;
    const count = Number(row.count || 0);
    if (type === 'character' || type === 'scene' || type === 'prop') {
      byType[type] = count;
      total += count;
    }
  }

  return { total, byType };
}

// ========================================
// Project Members
// ========================================

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT * FROM project_members WHERE project_id = ? ORDER BY created_at ASC',
    [projectId]
  );

  return (rows as Record<string, unknown>[]).map(mapProjectMember);
}

async function getProjectMember(projectId: string, userId: string): Promise<ProjectMember | null> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT * FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1',
    [projectId, userId]
  );
  const results = rows as Record<string, unknown>[];
  if (results.length === 0) return null;

  return mapProjectMember(results[0]);
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: string = 'editor',
  invitedBy?: string | null
): Promise<ProjectMember> {
  await initializeComicTables();
  const db = getAdapter();

  const existing = await getProjectMember(projectId, userId);
  if (existing) return existing;

  const member: ProjectMember = {
    id: generateId(),
    projectId,
    userId,
    role: role?.trim() || 'editor',
    invitedBy: invitedBy ?? null,
    createdAt: Date.now(),
  };

  try {
    await db.execute(
      `INSERT INTO project_members (id, project_id, user_id, role, invited_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [member.id, member.projectId, member.userId, member.role, member.invitedBy, member.createdAt]
    );
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'ER_DUP_ENTRY' || code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const retried = await getProjectMember(projectId, userId);
      if (retried) return retried;
    }
    throw err;
  }

  return member;
}

export async function removeProjectMember(projectId: string, userId: string): Promise<boolean> {
  await initializeComicTables();
  const db = getAdapter();

  const [, result] = await db.execute(
    'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, userId]
  );

  return ((result as { affectedRows?: number })?.affectedRows ?? 0) > 0;
}

// ========================================
// Project Invites
// ========================================

function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createProjectInvite(
  projectId: string,
  inviterUserId: string,
  inviteeEmail?: string | null
): Promise<ProjectInvite> {
  await initializeComicTables();
  const db = getAdapter();
  const now = Date.now();
  const expiresAt = now + INVITE_TTL_MS;
  const normalizedEmail = inviteeEmail?.trim().toLowerCase() || null;

  for (let attempt = 0; attempt < MAX_INVITE_TOKEN_ATTEMPTS; attempt++) {
    const token = generateInviteToken();
    const invite: ProjectInvite = {
      id: generateId(),
      projectId,
      inviterUserId,
      inviteeEmail: normalizedEmail,
      token,
      status: 'pending',
      expiresAt,
      createdAt: now,
      acceptedAt: null,
    };

    try {
      await db.execute(
        `INSERT INTO project_invites (id, project_id, inviter_user_id, invitee_email, token, status, expires_at, created_at, accepted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invite.id,
          invite.projectId,
          invite.inviterUserId,
          invite.inviteeEmail,
          invite.token,
          invite.status,
          invite.expiresAt,
          invite.createdAt,
          invite.acceptedAt,
        ]
      );
      return invite;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'ER_DUP_ENTRY' || code === 'SQLITE_CONSTRAINT') {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Failed to generate invite token');
}

export async function getProjectInviteByToken(token: string): Promise<ProjectInvite | null> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM project_invites WHERE token = ?', [token]);
  const results = rows as Record<string, unknown>[];
  if (results.length === 0) return null;

  return mapProjectInvite(results[0]);
}

export async function acceptProjectInvite(
  token: string,
  userId: string
): Promise<ProjectInvite | null> {
  await initializeComicTables();
  const db = getAdapter();

  const invite = await getProjectInviteByToken(token);
  if (!invite) return null;

  const now = Date.now();
  if (invite.status !== 'pending') return null;

  if (invite.expiresAt < now) {
    await db.execute('UPDATE project_invites SET status = ? WHERE id = ?', ['expired', invite.id]);
    return null;
  }

  if (invite.inviteeEmail) {
    const user = await getUserById(userId);
    const userEmail = user?.email?.toLowerCase();
    if (!userEmail || userEmail !== invite.inviteeEmail.toLowerCase()) {
      return null;
    }
  }

  const existing = await getProjectMember(invite.projectId, userId);
  if (!existing) {
    await addProjectMember(invite.projectId, userId, 'editor', invite.inviterUserId);
  }

  const acceptedAt = Date.now();
  await db.execute('UPDATE project_invites SET status = ?, accepted_at = ? WHERE id = ?', [
    'accepted',
    acceptedAt,
    invite.id,
  ]);

  return { ...invite, status: 'accepted', acceptedAt };
}

// ========================================
// Access Control
// ========================================

export async function checkProjectAccess(
  projectId: string,
  userId: string
): Promise<ProjectAccess> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT owner_user_id FROM comic_projects WHERE id = ?', [projectId]);
  const projects = rows as Record<string, unknown>[];
  if (projects.length === 0) return null;

  const ownerId = String(projects[0].owner_user_id);
  if (ownerId === userId) return 'owner';

  const [memberRows] = await db.execute(
    'SELECT id FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1',
    [projectId, userId]
  );
  if ((memberRows as Record<string, unknown>[]).length > 0) {
    return 'member';
  }

  return null;
}

// ========================================
// Asset Generation History
// ========================================

export async function createAssetGenerationHistory(data: {
  assetId: string;
  prompt: string;
  generationId?: string | null;
  channelId?: string | null;
  modelId?: string | null;
  aspectRatio?: string | null;
  imageSize?: string | null;
  imageCount?: number;
  imageUrl?: string | null;
  status?: AssetGenerationStatus;
}): Promise<AssetGenerationHistory> {
  await initializeComicTables();
  const db = getAdapter();

  const prompt = data.prompt.trim();
  if (!prompt) throw new Error('Prompt is required');

  const history: AssetGenerationHistory = {
    id: generateId(),
    assetId: data.assetId,
    generationId: data.generationId ?? null,
    prompt,
    channelId: data.channelId ?? null,
    modelId: data.modelId ?? null,
    aspectRatio: data.aspectRatio ?? null,
    imageSize: data.imageSize ?? null,
    imageCount: Math.min(4, Math.max(1, Math.floor(data.imageCount ?? 1))),
    imageUrl: data.imageUrl ?? null,
    status: normalizeAssetGenerationStatus(data.status),
    createdAt: Date.now(),
  };

  await db.execute(
    `INSERT INTO asset_generation_history (
      id, asset_id, generation_id, prompt, channel_id, model_id,
      aspect_ratio, image_size, image_count, image_url, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      history.id, history.assetId, history.generationId, history.prompt,
      history.channelId, history.modelId, history.aspectRatio, history.imageSize,
      history.imageCount, history.imageUrl, history.status, history.createdAt,
    ]
  );

  return history;
}

export async function getAssetGenerationHistoryById(
  id: string
): Promise<AssetGenerationHistory | null> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT * FROM asset_generation_history WHERE id = ? LIMIT 1',
    [id]
  );
  const results = rows as Record<string, unknown>[];
  if (results.length === 0) return null;
  return mapAssetGenerationHistory(results[0]);
}

export async function getAssetGenerationHistory(
  assetId: string,
  options: AssetGenerationHistoryQueryOptions = {}
): Promise<AssetGenerationHistory[]> {
  await initializeComicTables();
  const db = getAdapter();

  const limit = Math.min(Math.max(1, Math.floor(options.limit ?? 20)), 100);
  const offset = Math.max(0, Math.floor(options.offset ?? 0));

  let sql = 'SELECT * FROM asset_generation_history WHERE asset_id = ?';
  const params: unknown[] = [assetId];

  if (options.status) {
    sql += ' AND status = ?';
    params.push(options.status);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await db.execute(sql, params);
  return (rows as Record<string, unknown>[]).map(mapAssetGenerationHistory);
}

export async function getLatestAssetGeneration(
  assetId: string
): Promise<AssetGenerationHistory | null> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT * FROM asset_generation_history WHERE asset_id = ? ORDER BY created_at DESC LIMIT 1',
    [assetId]
  );
  const results = rows as Record<string, unknown>[];
  if (results.length === 0) return null;
  return mapAssetGenerationHistory(results[0]);
}

export async function updateAssetGenerationHistory(
  id: string,
  updates: Partial<{
    generationId: string | null;
    imageUrl: string | null;
    status: AssetGenerationStatus;
  }>
): Promise<AssetGenerationHistory | null> {
  await initializeComicTables();
  const db = getAdapter();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.generationId !== undefined) {
    fields.push('generation_id = ?');
    values.push(updates.generationId);
  }
  if (updates.imageUrl !== undefined) {
    fields.push('image_url = ?');
    values.push(updates.imageUrl);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(normalizeAssetGenerationStatus(updates.status));
  }

  if (fields.length === 0) return getAssetGenerationHistoryById(id);

  values.push(id);
  await db.execute(
    `UPDATE asset_generation_history SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  return getAssetGenerationHistoryById(id);
}

export async function getAssetGenerationHistoryCount(
  assetId: string
): Promise<number> {
  await initializeComicTables();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT COUNT(1) as count FROM asset_generation_history WHERE asset_id = ?',
    [assetId]
  );
  return Number((rows as Record<string, unknown>[])[0]?.count || 0);
}

export async function deleteAssetGenerationHistoryByIds(
  assetId: string,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0;
  await initializeComicTables();
  const db = getAdapter();

  // 限制单次最多 100 条
  const safeIds = ids.slice(0, 100);
  const placeholders = safeIds.map(() => '?').join(', ');

  // MySQL: affectedRows 在 results[0] (ResultSetHeader)
  // SQLite: affectedRows 在 results[1] ({ affectedRows, insertId })
  const results = await db.execute(
    `DELETE FROM asset_generation_history WHERE asset_id = ? AND id IN (${placeholders})`,
    [assetId, ...safeIds]
  );

  return (results[0] as { affectedRows?: number })?.affectedRows
    ?? (results[1] as { affectedRows?: number })?.affectedRows
    ?? 0;
}

export async function deleteAllAssetGenerationHistory(
  assetId: string
): Promise<number> {
  await initializeComicTables();
  const db = getAdapter();

  // MySQL: affectedRows 在 results[0] (ResultSetHeader)
  // SQLite: affectedRows 在 results[1] ({ affectedRows, insertId })
  const results = await db.execute(
    'DELETE FROM asset_generation_history WHERE asset_id = ?',
    [assetId]
  );

  return (results[0] as { affectedRows?: number })?.affectedRows
    ?? (results[1] as { affectedRows?: number })?.affectedRows
    ?? 0;
}
