'use client';

import type { ViewProps } from '../dynamic-workspace';
import { Download } from 'lucide-react';

export function ExportView(_props: ViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
      <div className="bg-card/50 p-6 rounded-full mb-4">
        <Download className="h-10 w-10 opacity-50" />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">导出项目</h3>
      <p className="max-w-md">
        导出剧集数据、分镜脚本或生成的素材资源。
      </p>
    </div>
  );
}
