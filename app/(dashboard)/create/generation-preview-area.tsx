'use client';

import dynamic from 'next/dynamic';
import type { Generation, Task } from './types';

const ResultGallery = dynamic(
  () => import('@/components/generator/result-gallery').then((mod) => mod.ResultGallery),
  { ssr: false, loading: () => <div className="surface p-6 text-sm text-foreground/50">Loading results...</div> }
);

interface GenerationPreviewAreaProps {
  generations: Generation[];
  tasks: Task[];
  onRemoveTask: (taskId: string) => void;
  onRetryTask: (task: Task) => void;
  onClear: (ids: string[]) => void;
}

export function GenerationPreviewArea({
  generations,
  tasks,
  onRemoveTask,
  onRetryTask,
  onClear,
}: GenerationPreviewAreaProps) {
  return (
    <div className="flex-1 overflow-auto min-h-0 mb-4">
      <ResultGallery
        generations={generations}
        tasks={tasks}
        onRemoveTask={onRemoveTask}
        onRetryTask={onRetryTask}
        onClear={onClear}
      />
    </div>
  );
}
