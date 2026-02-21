/* eslint-disable no-console */
import type { LlmAgent, AgentVersion, AgentSummary, AgentConfig } from '@/types';
import type { DatabaseAdapter } from './db-adapter';
import { getSharedAdapter } from './db-connection';
import { initializeDatabase } from './db';
import { getAffectedRows } from './db-types';
import { generateId } from './utils';

function getAdapter(): DatabaseAdapter {
  return getSharedAdapter();
}

function parseConfig(json: string): AgentConfig {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.warn('[db-agent] Failed to parse config JSON, using empty config:', error);
    return { role: '', rules: [], workflow: [], examples: [], returnFormat: '', placeholders: [] };
  }
}

function mapLlmAgent(row: Record<string, unknown>): LlmAgent {
  return {
    featureKey: row.feature_key as string,
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    config: parseConfig(String(row.config_json ?? '{}')),
    systemPrompt: String(row.system_prompt ?? ''),
    userPromptTemplate: String(row.user_prompt_template ?? ''),
    defaultConfig: parseConfig(String(row.default_config_json ?? '{}')),
    defaultSystemPrompt: String(row.default_system_prompt ?? ''),
    defaultUserPromptTemplate: String(row.default_user_prompt_template ?? ''),
    currentVersion: Number(row.current_version ?? 1),
    enabled: Boolean(row.enabled),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapAgentVersion(row: Record<string, unknown>): AgentVersion {
  return {
    id: row.id as string,
    featureKey: row.feature_key as string,
    version: Number(row.version),
    config: parseConfig(String(row.config_json ?? '{}')),
    systemPrompt: String(row.system_prompt ?? ''),
    userPromptTemplate: String(row.user_prompt_template ?? ''),
    changeSummary: String(row.change_summary ?? ''),
    createdAt: Number(row.created_at),
    createdBy: String(row.created_by ?? 'system'),
  };
}

// 获取所有 Agent 列表
export async function getAgents(): Promise<AgentSummary[]> {
  await initializeDatabase();
  const db = getAdapter();
  const [rows] = await db.execute(
    'SELECT feature_key, name, description, enabled, current_version, updated_at FROM llm_agents ORDER BY created_at ASC'
  );
  return (rows as Record<string, unknown>[]).map(row => ({
    featureKey: row.feature_key as string,
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    enabled: Boolean(row.enabled),
    currentVersion: Number(row.current_version ?? 1),
    updatedAt: Number(row.updated_at),
  }));
}

// 按 key 获取单个 Agent
export async function getAgentByKey(featureKey: string): Promise<LlmAgent | null> {
  await initializeDatabase();
  const db = getAdapter();
  const [rows] = await db.execute('SELECT * FROM llm_agents WHERE feature_key = ?', [featureKey]);
  const agents = rows as Record<string, unknown>[];
  if (agents.length === 0) return null;
  return mapLlmAgent(agents[0]);
}

// 创建 Agent + 初始版本（事务）
export async function createAgent(agent: {
  featureKey: string;
  name: string;
  description: string;
  config: AgentConfig;
  systemPrompt: string;
  userPromptTemplate: string;
}): Promise<LlmAgent> {
  await initializeDatabase();
  const db = getAdapter();
  const now = Date.now();
  const configJson = JSON.stringify(agent.config);

  await db.runTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO llm_agents (
        feature_key, name, description, config_json, system_prompt, user_prompt_template,
        default_config_json, default_system_prompt, default_user_prompt_template,
        current_version, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agent.featureKey, agent.name, agent.description,
        configJson, agent.systemPrompt, agent.userPromptTemplate,
        configJson, agent.systemPrompt, agent.userPromptTemplate,
        1, 1, now, now,
      ]
    );

    await tx.execute(
      `INSERT INTO llm_agent_versions (
        id, feature_key, version, config_json, system_prompt, user_prompt_template,
        change_summary, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), agent.featureKey, 1, configJson, agent.systemPrompt, agent.userPromptTemplate, '初始版本', now, 'system']
    );
  });

  return (await getAgentByKey(agent.featureKey))!;
}

// 更新 Agent + 创建新版本（事务 + 乐观并发）
export async function updateAgent(
  featureKey: string,
  updates: {
    name?: string;
    description?: string;
    config?: AgentConfig;
    systemPrompt?: string;
    userPromptTemplate?: string;
    enabled?: boolean;
    changeSummary?: string;
    changedBy?: string;
  }
): Promise<LlmAgent | null> {
  await initializeDatabase();
  const db = getAdapter();

  const existing = await getAgentByKey(featureKey);
  if (!existing) return null;

  const now = Date.now();
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.config !== undefined) { fields.push('config_json = ?'); values.push(JSON.stringify(updates.config)); }
  if (updates.systemPrompt !== undefined) { fields.push('system_prompt = ?'); values.push(updates.systemPrompt); }
  if (updates.userPromptTemplate !== undefined) { fields.push('user_prompt_template = ?'); values.push(updates.userPromptTemplate); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }

  const hasContentChange = updates.config !== undefined || updates.systemPrompt !== undefined || updates.userPromptTemplate !== undefined;

  await db.runTransaction(async (tx) => {
    if (hasContentChange) {
      const newVersion = existing.currentVersion + 1;
      fields.push('current_version = ?');
      values.push(newVersion);

      const newConfig = updates.config ?? existing.config;
      const newSystemPrompt = updates.systemPrompt ?? existing.systemPrompt;
      const newUserPromptTemplate = updates.userPromptTemplate ?? existing.userPromptTemplate;

      await tx.execute(
        `INSERT INTO llm_agent_versions (
          id, feature_key, version, config_json, system_prompt, user_prompt_template,
          change_summary, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(), featureKey, newVersion,
          JSON.stringify(newConfig), newSystemPrompt, newUserPromptTemplate,
          updates.changeSummary || '更新配置', now, updates.changedBy || 'admin',
        ]
      );
    }

    // 乐观并发：WHERE 条件包含 current_version 防止并发覆盖
    values.push(existing.currentVersion);
    values.push(featureKey);
    const [result] = await tx.execute(
      `UPDATE llm_agents SET ${fields.join(', ')} WHERE current_version = ? AND feature_key = ?`,
      values
    );
    const affected = getAffectedRows(result);
    if (affected === 0) {
      throw new Error('并发冲突：Agent 已被其他操作修改，请刷新后重试');
    }
  });

  return getAgentByKey(featureKey);
}

// 删除 Agent（事务，检查 feature_bindings 依赖）
export async function deleteAgent(featureKey: string): Promise<{ success: boolean; error?: string }> {
  await initializeDatabase();
  const db = getAdapter();

  const [bindings] = await db.execute(
    'SELECT feature_key FROM feature_bindings WHERE feature_key = ?',
    [featureKey]
  );
  if ((bindings as unknown[]).length > 0) {
    return { success: false, error: '该 Agent 已绑定功能，请先解除绑定' };
  }

  let affected = 0;
  await db.runTransaction(async (tx) => {
    await tx.execute('DELETE FROM llm_agent_versions WHERE feature_key = ?', [featureKey]);
    const [result] = await tx.execute('DELETE FROM llm_agents WHERE feature_key = ?', [featureKey]);
    affected = getAffectedRows(result);
  });

  return { success: affected > 0 };
}

// 获取版本历史列表
export async function getAgentVersions(featureKey: string): Promise<AgentVersion[]> {
  await initializeDatabase();
  const db = getAdapter();
  const [rows] = await db.execute(
    'SELECT * FROM llm_agent_versions WHERE feature_key = ? ORDER BY version DESC',
    [featureKey]
  );
  return (rows as Record<string, unknown>[]).map(mapAgentVersion);
}

// 获取指定版本
export async function getAgentVersion(featureKey: string, version: number): Promise<AgentVersion | null> {
  await initializeDatabase();
  const db = getAdapter();
  const [rows] = await db.execute(
    'SELECT * FROM llm_agent_versions WHERE feature_key = ? AND version = ?',
    [featureKey, version]
  );
  const versions = rows as Record<string, unknown>[];
  if (versions.length === 0) return null;
  return mapAgentVersion(versions[0]);
}

// 回滚到指定版本（事务 + 乐观并发）
export async function rollbackAgent(
  featureKey: string,
  targetVersion: number,
  changedBy?: string
): Promise<LlmAgent | null> {
  await initializeDatabase();
  const db = getAdapter();

  const existing = await getAgentByKey(featureKey);
  if (!existing) return null;

  const target = await getAgentVersion(featureKey, targetVersion);
  if (!target) return null;

  const now = Date.now();
  const newVersion = existing.currentVersion + 1;

  await db.runTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO llm_agent_versions (
        id, feature_key, version, config_json, system_prompt, user_prompt_template,
        change_summary, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(), featureKey, newVersion,
        JSON.stringify(target.config), target.systemPrompt, target.userPromptTemplate,
        `回滚到版本 ${targetVersion}`, now, changedBy || 'admin',
      ]
    );

    const [result] = await tx.execute(
      `UPDATE llm_agents SET
        config_json = ?, system_prompt = ?, user_prompt_template = ?,
        current_version = ?, updated_at = ?
      WHERE feature_key = ? AND current_version = ?`,
      [
        JSON.stringify(target.config), target.systemPrompt, target.userPromptTemplate,
        newVersion, now, featureKey, existing.currentVersion,
      ]
    );
    const affected = getAffectedRows(result);
    if (affected === 0) {
      throw new Error('并发冲突：Agent 已被其他操作修改，请刷新后重试');
    }
  });

  return getAgentByKey(featureKey);
}
