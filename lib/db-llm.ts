import type { FeatureBinding, LlmModel, LlmPrompt } from '@/types';
import type { DatabaseAdapter } from './db-adapter';
import { getSharedAdapter } from './db-connection';
import { initializeDatabase } from './db';
import { generateId } from './utils';
import { getAffectedRows } from './db-types';

function getAdapter(): DatabaseAdapter {
  return getSharedAdapter();
}

function mapLlmModel(row: Record<string, unknown>): LlmModel {
  return {
    id: row.id as string,
    name: row.name as string,
    provider: row.provider as LlmModel['provider'],
    baseUrl: row.base_url as string,
    apiKey: row.api_key as string,
    modelName: row.model_name as string,
    temperature: Number(row.temperature ?? 0.7),
    maxTokens: Number(row.max_tokens ?? 4096),
    enabled: Boolean(row.enabled),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapFeatureBinding(row: Record<string, unknown>): FeatureBinding {
  return {
    featureKey: row.feature_key as string,
    modelType: row.model_type as FeatureBinding['modelType'],
    modelId: row.model_id as string,
    enabled: Boolean(row.enabled),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapLlmPrompt(row: Record<string, unknown>): LlmPrompt {
  return {
    featureKey: row.feature_key as string,
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    systemPrompt: String(row.system_prompt ?? ''),
    userPromptTemplate: String(row.user_prompt_template ?? ''),
    defaultSystemPrompt: String(row.default_system_prompt ?? ''),
    defaultUserPromptTemplate: String(row.default_user_prompt_template ?? ''),
    enabled: Boolean(row.enabled),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

// LLM model CRUD
export async function getLlmModels(): Promise<LlmModel[]> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM llm_models ORDER BY created_at ASC');
  return (rows as Record<string, unknown>[]).map(mapLlmModel);
}

export async function getLlmModelById(id: string): Promise<LlmModel | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM llm_models WHERE id = ?', [id]);
  const models = rows as Record<string, unknown>[];
  if (models.length === 0) return null;

  return mapLlmModel(models[0]);
}

export async function createLlmModel(
  model: Omit<LlmModel, 'id' | 'createdAt' | 'updatedAt'>
): Promise<LlmModel> {
  await initializeDatabase();
  const db = getAdapter();

  const id = generateId();
  const now = Date.now();

  await db.execute(
    `INSERT INTO llm_models (
      id, name, provider, base_url, api_key, model_name,
      temperature, max_tokens, enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      model.name,
      model.provider,
      model.baseUrl,
      model.apiKey,
      model.modelName,
      model.temperature,
      model.maxTokens,
      model.enabled ? 1 : 0,
      now,
      now,
    ]
  );

  return { ...model, id, createdAt: now, updatedAt: now };
}

export async function updateLlmModel(
  id: string,
  updates: Partial<LlmModel>
): Promise<LlmModel | null> {
  await initializeDatabase();
  const db = getAdapter();

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [Date.now()];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.provider !== undefined) { fields.push('provider = ?'); values.push(updates.provider); }
  if (updates.baseUrl !== undefined) { fields.push('base_url = ?'); values.push(updates.baseUrl); }
  if (updates.apiKey !== undefined) { fields.push('api_key = ?'); values.push(updates.apiKey); }
  if (updates.modelName !== undefined) { fields.push('model_name = ?'); values.push(updates.modelName); }
  if (updates.temperature !== undefined) { fields.push('temperature = ?'); values.push(updates.temperature); }
  if (updates.maxTokens !== undefined) { fields.push('max_tokens = ?'); values.push(updates.maxTokens); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }

  if (fields.length === 1) return getLlmModelById(id);

  values.push(id);
  await db.execute(`UPDATE llm_models SET ${fields.join(', ')} WHERE id = ?`, values);

  return getLlmModelById(id);
}

export async function deleteLlmModel(id: string): Promise<boolean> {
  await initializeDatabase();
  const db = getAdapter();

  const [result] = await db.execute('DELETE FROM llm_models WHERE id = ?', [id]);
  return getAffectedRows(result) > 0;
}

// Feature binding CRUD
export async function getFeatureBindings(): Promise<FeatureBinding[]> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM feature_bindings ORDER BY feature_key ASC');
  return (rows as Record<string, unknown>[]).map(mapFeatureBinding);
}

export async function getFeatureBinding(featureKey: string): Promise<FeatureBinding | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT * FROM feature_bindings WHERE feature_key = ?',
    [featureKey]
  );
  const bindings = rows as Record<string, unknown>[];
  if (bindings.length === 0) return null;

  return mapFeatureBinding(bindings[0]);
}

export async function upsertFeatureBinding(
  binding: Omit<FeatureBinding, 'createdAt' | 'updatedAt'>
): Promise<FeatureBinding> {
  await initializeDatabase();
  const db = getAdapter();
  const now = Date.now();

  const existing = await getFeatureBinding(binding.featureKey);
  if (existing) {
    await db.execute(
      `UPDATE feature_bindings
       SET model_type = ?, model_id = ?, enabled = ?, updated_at = ?
       WHERE feature_key = ?`,
      [binding.modelType, binding.modelId, binding.enabled ? 1 : 0, now, binding.featureKey]
    );
    return {
      ...existing,
      ...binding,
      updatedAt: now,
    };
  }

  await db.execute(
    `INSERT INTO feature_bindings (
      feature_key, model_type, model_id, enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [binding.featureKey, binding.modelType, binding.modelId, binding.enabled ? 1 : 0, now, now]
  );

  return {
    ...binding,
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteFeatureBinding(featureKey: string): Promise<boolean> {
  await initializeDatabase();
  const db = getAdapter();

  const [result] = await db.execute(
    'DELETE FROM feature_bindings WHERE feature_key = ?',
    [featureKey]
  );
  return getAffectedRows(result) > 0;
}

// ========================================
// LLM Prompt CRUD
// ========================================

export async function getLlmPrompts(): Promise<LlmPrompt[]> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute('SELECT * FROM llm_prompts ORDER BY feature_key ASC');
  return (rows as Record<string, unknown>[]).map(mapLlmPrompt);
}

export async function getLlmPromptByKey(featureKey: string): Promise<LlmPrompt | null> {
  await initializeDatabase();
  const db = getAdapter();

  const [rows] = await db.execute(
    'SELECT * FROM llm_prompts WHERE feature_key = ?',
    [featureKey]
  );
  const prompts = rows as Record<string, unknown>[];
  if (prompts.length === 0) return null;

  return mapLlmPrompt(prompts[0]);
}

export async function updateLlmPrompt(
  featureKey: string,
  updates: { systemPrompt?: string; userPromptTemplate?: string; enabled?: boolean }
): Promise<LlmPrompt | null> {
  await initializeDatabase();
  const db = getAdapter();

  const existing = await getLlmPromptByKey(featureKey);
  if (!existing) return null;

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [Date.now()];

  if (updates.systemPrompt !== undefined) {
    fields.push('system_prompt = ?');
    values.push(updates.systemPrompt);
  }
  if (updates.userPromptTemplate !== undefined) {
    fields.push('user_prompt_template = ?');
    values.push(updates.userPromptTemplate);
  }
  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }

  if (fields.length === 1) return existing;

  values.push(featureKey);
  await db.execute(
    `UPDATE llm_prompts SET ${fields.join(', ')} WHERE feature_key = ?`,
    values
  );

  return getLlmPromptByKey(featureKey);
}

export async function resetLlmPrompt(featureKey: string): Promise<LlmPrompt | null> {
  await initializeDatabase();
  const db = getAdapter();

  const existing = await getLlmPromptByKey(featureKey);
  if (!existing) return null;

  const now = Date.now();
  await db.execute(
    `UPDATE llm_prompts
     SET system_prompt = default_system_prompt,
         user_prompt_template = default_user_prompt_template,
         updated_at = ?
     WHERE feature_key = ?`,
    [now, featureKey]
  );

  return getLlmPromptByKey(featureKey);
}
