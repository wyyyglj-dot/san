import type { ImageModel, LlmModel, ModelType, VideoModel } from '@/types';
import { getImageModel, getVideoModel } from './db';
import { getFeatureBinding, getLlmModelById } from './db-llm';

type ResolvedConfig = LlmModel | ImageModel | VideoModel;

export async function resolveFeatureBinding(
  featureKey: string,
  modelType: ModelType
): Promise<{ modelId: string; config: ResolvedConfig } | null> {
  const binding = await getFeatureBinding(featureKey);
  if (!binding || !binding.enabled) return null;

  if (binding.modelType !== modelType) {
    console.warn(`[FeatureBinding] Type mismatch for ${featureKey}: expected ${modelType}, got ${binding.modelType}`);
    return null;
  }

  let config: ResolvedConfig | null = null;
  switch (modelType) {
    case 'llm':
      config = await getLlmModelById(binding.modelId);
      break;
    case 'image':
      config = await getImageModel(binding.modelId);
      break;
    case 'video':
      config = await getVideoModel(binding.modelId);
      break;
    default:
      return null;
  }

  if (!config || !config.enabled) return null;

  return { modelId: binding.modelId, config };
}

export async function resolveStoryLlmConfig(): Promise<{
  apiKey: string;
  baseUrl: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
} | null> {
  const resolved = await resolveFeatureBinding('story.llm', 'llm');
  if (!resolved) return null;

  const model = resolved.config as LlmModel;
  return {
    apiKey: model.apiKey,
    baseUrl: model.baseUrl,
    modelName: model.modelName,
    temperature: model.temperature,
    maxTokens: model.maxTokens,
  };
}

export async function resolvePromptEnhanceLlmModel(): Promise<LlmModel | null> {
  const resolved = await resolveFeatureBinding('prompt_enhance.llm', 'llm');
  if (!resolved) return null;
  return resolved.config as LlmModel;
}
