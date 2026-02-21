'use client';

import { Boxes, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AssetEmptyStateProps {
  onAnalyze: () => void;
  hasAnalyzed?: boolean;
}

export function AssetEmptyState({ onAnalyze, hasAnalyzed = false }: AssetEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
      <div className="w-20 h-20 bg-muted/50 rounded-2xl flex items-center justify-center mb-6">
        <Boxes className="h-10 w-10 opacity-50" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        暂无资产数据
      </h3>
      <p className="text-sm text-center max-w-md mb-6">
        {hasAnalyzed
          ? '分析已完成，但未提取到相关资产信息。您可以尝试修改剧本后重新分析'
          : '点击下方按钮，AI 将自动分析剧集内容，提取角色、场景和道具信息'}
      </p>
      <Button onClick={onAnalyze} className="gap-2">
        <Sparkles className="h-4 w-4" />
        {hasAnalyzed ? '重新分析' : '分析资产'}
      </Button>
    </div>
  );
}
