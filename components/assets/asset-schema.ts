import { Users, MapPin, Package } from 'lucide-react';
import type { ElementType } from 'react';
import type { ProjectAssetType } from '@/lib/db-comic';

/** 资产类型视觉配置（图标、颜色、标签） */
export const typeConfig: Record<
  ProjectAssetType,
  { label: string; icon: ElementType; color: string; bgColor: string }
> = {
  character: { label: '角色', icon: Users, color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  scene: { label: '场景', icon: MapPin, color: 'text-green-400', bgColor: 'bg-green-400/10' },
  prop: { label: '道具', icon: Package, color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
};

/** 资产类型中文标签 */
export const typeLabels: Record<ProjectAssetType, string> = {
  character: '角色',
  scene: '场景',
  prop: '道具',
};

/** 各资产类型的属性字段标签 */
export const attributeLabels: Record<ProjectAssetType, Record<string, string>> = {
  character: {
    gender: '性别',
    age: '年龄',
    persona: '人设',
    descriptors: '绘图描述词',
  },
  scene: {
    locationDescription: '地点描述',
    timeOfDay: '时间',
    descriptors: '绘图描述词',
  },
  prop: {
    propDescription: '道具描述',
    descriptors: '绘图描述词',
  },
};
