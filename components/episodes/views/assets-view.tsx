'use client';

import type { ViewProps } from '../dynamic-workspace';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon } from 'lucide-react';

export function AssetsView({ currentEpisode }: ViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
      <div className="bg-card/50 p-6 rounded-full mb-4">
        <ImageIcon className="h-10 w-10 opacity-50" />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">素材生成工坊</h3>
      <p className="max-w-md mb-6">
        批量生成角色、场景和道具素材，支持文生图和图生图。
      </p>
      <Button disabled={!currentEpisode}>
        前往生成 {currentEpisode ? `EP ${currentEpisode.orderNum}` : ''}
      </Button>
    </div>
  );
}
