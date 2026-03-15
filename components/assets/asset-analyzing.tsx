'use client';

import { Loader2 } from 'lucide-react';

export function AssetAnalyzing() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
      <h3 className="text-lg font-medium text-foreground mb-2">正在分析资产...</h3>
      <p className="text-sm text-center max-w-md">
        AI 正在分析剧集内容，提取角色、场景和道具信息，请稍候
      </p>
    </div>
  );
}
