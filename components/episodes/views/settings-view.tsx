'use client';

import type { ViewProps } from '../dynamic-workspace';
import { Settings } from 'lucide-react';

export function SettingsView(_props: ViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
      <div className="bg-card/50 p-6 rounded-full mb-4">
        <Settings className="h-10 w-10 opacity-50" />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">高级设置</h3>
      <p className="max-w-md">
        配置项目参数、AI 模型选项和导出偏好设置。
      </p>
    </div>
  );
}
