'use client';

import type { ViewProps } from '../dynamic-workspace';
import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';

export function ScriptParseView({ currentEpisode }: ViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
      <div className="bg-card/50 p-6 rounded-full mb-4">
        <Wand2 className="h-10 w-10 opacity-50" />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">剧本智能解析</h3>
      <p className="max-w-md mb-6">
        AI 将自动分析剧本中的角色、场景和道具，提取关键信息辅助分镜生成。
      </p>
      <Button disabled={!currentEpisode}>
        开始解析 {currentEpisode ? `EP ${currentEpisode.orderNum}` : ''}
      </Button>
    </div>
  );
}
