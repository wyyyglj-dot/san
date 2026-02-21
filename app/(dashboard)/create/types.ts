import type { Task } from '@/components/generator/result-gallery';
import type {
  Generation,
  SafeImageModel,
  SafeImageChannel,
  SafeVideoModel,
  SafeVideoChannel,
  CharacterCard,
  DailyLimitConfig,
} from '@/types';

export type MediaType = 'image' | 'video';
export type CreationMode = 'normal' | 'remix' | 'storyboard';

export interface DailyUsage {
  imageCount: number;
  videoCount: number;
  characterCardCount: number;
}

export const CREATION_MODES = [
  { id: 'normal', label: '普通生成', description: '文本/图片生成视频' },
  { id: 'remix', label: '视频Remix', description: '基于已有视频继续创作' },
  { id: 'storyboard', label: '视频分镜', description: '多镜头分段生成' },
] as const;

export const VIDEO_STYLES = [
  { id: 'anime', name: 'Anime', image: '/styles/Anime.jpg' },
  { id: 'comic', name: 'Comic', image: '/styles/Comic.jpg' },
  { id: 'festive', name: 'Festive', image: '/styles/Festive.jpg' },
  { id: 'golden', name: 'Golden', image: '/styles/Golden.jpg' },
  { id: 'handheld', name: 'Handheld', image: '/styles/Handheld.jpg' },
  { id: 'news', name: 'News', image: '/styles/News.jpg' },
  { id: 'retro', name: 'Retro', image: '/styles/Retro.jpg' },
  { id: 'selfie', name: 'Selfie', image: '/styles/Selfie.jpg' },
  { id: 'vintage', name: 'Vintage', image: '/styles/Vintage.jpg' },
];

export function getImageResolution(model: SafeImageModel, aspectRatio: string, imageSize?: string): string {
  if (model.features.imageSize && imageSize && typeof model.resolutions[imageSize] === 'object') {
    return (model.resolutions[imageSize] as Record<string, string>)[aspectRatio] || '';
  }
  return (model.resolutions as Record<string, string>)[aspectRatio] || '';
}

export type { Task, Generation, SafeImageModel, SafeImageChannel, SafeVideoModel, SafeVideoChannel, CharacterCard, DailyLimitConfig };
