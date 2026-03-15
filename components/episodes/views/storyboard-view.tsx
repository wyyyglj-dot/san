'use client';

import type { ViewProps } from '../dynamic-workspace';
import { Button } from '@/components/ui/button';
import { Clapperboard } from 'lucide-react';

export function StoryboardView({ currentEpisode }: ViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
      <div className="bg-card/50 p-6 rounded-full mb-4">
        <Clapperboard className="h-10 w-10 opacity-50" />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">AI 分镜生成</h3>
      <p className="max-w-md mb-6">
        基于剧本内容自动生成分镜画面描述和提示词。
      </p>
      <Button disabled={!currentEpisode}>
        生成分镜 {currentEpisode ? `EP ${currentEpisode.orderNum}` : ''}
      </Button>
    </div>
  );
}
