'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface AssetDetailViewProps {
  assetId: string;
  onClose: () => void;
}

export function AssetDetailView({ assetId, onClose }: AssetDetailViewProps) {
  return (
    <div className="flex flex-col h-full bg-background/20">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] bg-card/10">
        <div>
          <h2 className="text-lg font-semibold">资产详情</h2>
          <p className="text-xs text-muted-foreground font-mono">{assetId}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="w-32 h-32 bg-muted rounded-full mx-auto flex items-center justify-center">
            <span className="text-4xl">🎨</span>
          </div>
          <h3 className="text-xl font-medium">资产配置面板</h3>
          <p className="text-muted-foreground max-w-md">
            在此处调整角色、场景或道具的详细参数，并进行溶图操作。
          </p>
          <Button>开始溶图</Button>
        </div>
      </div>
    </div>
  );
}
