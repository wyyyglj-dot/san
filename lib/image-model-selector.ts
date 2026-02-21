import { getImageChannel, getImageModelsByChannel } from '@/lib/db';
import type { ImageModel } from '@/types';

export type ImageOperation = 'text_to_image' | 'image_to_image' | 'upscale' | 'matting';

export interface ImageModelSelectionInput {
  channelId: string;
  operation?: ImageOperation;
  imageSize?: string;
  aspectRatio?: string;
  hasReferenceImage: boolean;
  imageCount: number;
}

function inferOperation(input: ImageModelSelectionInput): ImageOperation {
  if (input.operation) return input.operation;
  if (input.hasReferenceImage) return 'image_to_image';
  return 'text_to_image';
}

function matchesOperation(model: ImageModel, operation: ImageOperation): boolean {
  switch (operation) {
    case 'text_to_image': return model.features.textToImage;
    case 'image_to_image': return model.features.imageToImage;
    case 'upscale': return model.features.upscale;
    case 'matting': return model.features.matting;
    default: return false;
  }
}

export async function selectImageModel(
  input: ImageModelSelectionInput
): Promise<{ model: ImageModel; reason: string[] } | null> {
  const channel = await getImageChannel(input.channelId);
  if (!channel || !channel.enabled) return null;

  const models = await getImageModelsByChannel(input.channelId, true);
  if (models.length === 0) return null;

  const operation = inferOperation(input);
  const reason: string[] = [];

  let candidates = models.filter((m) => matchesOperation(m, operation));
  reason.push(`operation=${operation}: ${candidates.length} candidates`);

  if (input.imageCount > 1) {
    const filtered = candidates.filter((m) => m.features.multipleImages);
    if (filtered.length > 0) {
      candidates = filtered;
      reason.push(`multipleImages: ${candidates.length} candidates`);
    }
  }

  if (input.imageSize) {
    const sizeMatched = candidates.filter(
      (m) => m.features.imageSize && Array.isArray(m.imageSizes) && m.imageSizes.includes(input.imageSize!)
    );
    if (sizeMatched.length === 0) return null;
    candidates = sizeMatched;
    reason.push(`imageSize=${input.imageSize}: ${candidates.length} candidates`);
  }

  if (input.aspectRatio) {
    const ratioMatched = candidates.filter(
      (m) => Array.isArray(m.aspectRatios) && m.aspectRatios.includes(input.aspectRatio!)
    );
    if (ratioMatched.length > 0) {
      candidates = ratioMatched;
      reason.push(`aspectRatio=${input.aspectRatio}: ${candidates.length} candidates`);
    }
  }

  candidates.sort((a, b) => {
    const so = a.sortOrder - b.sortOrder;
    if (so !== 0) return so;
    const ca = a.createdAt - b.createdAt;
    if (ca !== 0) return ca;
    return a.id.localeCompare(b.id);
  });

  if (candidates.length === 0) return null;

  return { model: candidates[0], reason };
}
