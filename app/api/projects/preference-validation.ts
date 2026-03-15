import {
  getActiveArtStyles,
  getSafeImageChannels,
  getSafeImageModels,
  getSafeVideoChannels,
  getSafeVideoModels,
  getUserVisibleImageChannels,
  getUserVisibleVideoChannels,
} from '@/lib/db';
import { getLlmModels } from '@/lib/db-llm';

type PreferenceUpdates = Partial<{
  defaultImageModelId: string | null;
  defaultVideoModelId: string | null;
  defaultTextModelId: string | null;
  defaultStyle: string | null;
  defaultEra: string | null;
  defaultVideoRatio: string;
}>;

interface ValidateProjectPreferencesParams {
  input: Record<string, unknown> | null;
  userId: string;
  isAdmin: boolean;
}

interface ValidateProjectPreferencesResult {
  error?: string;
  updates: PreferenceUpdates;
}

const ALLOWED_ERAS = ['modern', 'ancient', 'medieval'] as const;

function parseNullableString(
  value: unknown,
): { value: string | null | undefined; invalid: boolean } {
  if (value === undefined) return { value: undefined, invalid: false };
  if (value === null) return { value: null, invalid: false };
  if (typeof value !== 'string') return { value: undefined, invalid: true };

  const trimmed = value.trim();
  return { value: trimmed || null, invalid: false };
}

export async function validateProjectPreferencesInput({
  input,
  userId,
  isAdmin,
}: ValidateProjectPreferencesParams): Promise<ValidateProjectPreferencesResult> {
  if (!input) {
    return { updates: {} };
  }

  const updates: PreferenceUpdates = {};

  const [enabledTextModels, activeStyles, allowedImageModelIds, allowedVideoModelIds] = await Promise.all([
    getLlmModels().then((models) => new Set(models.filter((model) => model.enabled).map((model) => model.id))),
    getActiveArtStyles().then((styles) => new Set(styles.map((style) => style.slug))),
    getAllowedImageModelIds(userId, isAdmin),
    getAllowedVideoModelIds(userId, isAdmin),
  ]);

  const defaultImageModelId = parseNullableString(input.defaultImageModelId);
  if (defaultImageModelId.invalid) {
    return { error: '无效的图片模型配置', updates: {} };
  }
  if (defaultImageModelId.value !== undefined) {
    if (defaultImageModelId.value !== null && !allowedImageModelIds.has(defaultImageModelId.value)) {
      return { error: '无效的图片模型配置', updates: {} };
    }
    updates.defaultImageModelId = defaultImageModelId.value;
  }

  const defaultVideoModelId = parseNullableString(input.defaultVideoModelId);
  if (defaultVideoModelId.invalid) {
    return { error: '无效的视频模型配置', updates: {} };
  }
  if (defaultVideoModelId.value !== undefined) {
    if (defaultVideoModelId.value !== null && !allowedVideoModelIds.has(defaultVideoModelId.value)) {
      return { error: '无效的视频模型配置', updates: {} };
    }
    updates.defaultVideoModelId = defaultVideoModelId.value;
  }

  const defaultTextModelId = parseNullableString(input.defaultTextModelId);
  if (defaultTextModelId.invalid) {
    return { error: '无效的文字模型配置', updates: {} };
  }
  if (defaultTextModelId.value !== undefined) {
    if (defaultTextModelId.value !== null && !enabledTextModels.has(defaultTextModelId.value)) {
      return { error: '无效的文字模型配置', updates: {} };
    }
    updates.defaultTextModelId = defaultTextModelId.value;
  }

  const defaultStyle = parseNullableString(input.defaultStyle);
  if (defaultStyle.invalid) {
    return { error: '无效的画风配置', updates: {} };
  }
  if (defaultStyle.value !== undefined) {
    if (defaultStyle.value !== null && !activeStyles.has(defaultStyle.value)) {
      return { error: '无效的画风配置', updates: {} };
    }
    updates.defaultStyle = defaultStyle.value;
  }

  const defaultEra = parseNullableString(input.defaultEra);
  if (defaultEra.invalid) {
    return { error: '无效的时代设定', updates: {} };
  }
  if (defaultEra.value !== undefined) {
    if (defaultEra.value !== null && !ALLOWED_ERAS.includes(defaultEra.value as (typeof ALLOWED_ERAS)[number])) {
      return { error: '无效的时代设定', updates: {} };
    }
    updates.defaultEra = defaultEra.value;
  }

  if (input.defaultVideoRatio !== undefined) {
    const ratio = String(input.defaultVideoRatio).trim();
    if (ratio) {
      updates.defaultVideoRatio = ratio;
    }
  }

  return { updates };
}

async function getAllowedImageModelIds(userId: string, isAdmin: boolean): Promise<Set<string>> {
  const imageModels = await getSafeImageModels(true);

  if (isAdmin) {
    const imageChannels = (await getSafeImageChannels(true)).filter((channel) => channel.isListed);
    const channelIds = new Set(imageChannels.map((channel) => channel.id));
    return new Set(
      imageModels
        .filter((model) => channelIds.has(model.channelId))
        .map((model) => model.id),
    );
  }

  const visibleChannels = await getUserVisibleImageChannels(userId);
  const visibleChannelIds = new Set(visibleChannels.map((channel) => channel.id));

  return new Set(
    imageModels
      .filter((model) => visibleChannelIds.has(model.channelId))
      .map((model) => model.id),
  );
}

async function getAllowedVideoModelIds(userId: string, isAdmin: boolean): Promise<Set<string>> {
  if (isAdmin) {
    const [videoModels, videoChannels] = await Promise.all([
      getSafeVideoModels(true),
      getSafeVideoChannels(true),
    ]);
    const channelIds = new Set(
      videoChannels.filter((channel) => channel.isListed).map((channel) => channel.id),
    );

    return new Set(
      videoModels
        .filter((model) => channelIds.has(model.channelId))
        .map((model) => model.id),
    );
  }

  const [videoModels, visibleChannels] = await Promise.all([
    getSafeVideoModels(true),
    getUserVisibleVideoChannels(userId),
  ]);
  const visibleChannelIds = new Set(visibleChannels.map((channel) => channel.id));

  return new Set(
    videoModels
      .filter((model) => visibleChannelIds.has(model.channelId))
      .map((model) => model.id),
  );
}
