'use client';

import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import { EpisodeWorkspaceView } from './episode-workspace-view';
import { AssetWorkspaceView } from './asset-workspace-view';
import { cn } from '@/lib/utils';

interface WorkspaceCenterPanelProps {
  projectId: string;
}

export function WorkspaceCenterPanel({ projectId }: WorkspaceCenterPanelProps) {
  const activeTab = useWorkspaceStore((s) => s.activeTab);

  return (
    <div className="flex-1 relative overflow-hidden bg-background/30">
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-200 ease-in-out',
          activeTab === 'episodes'
            ? 'opacity-100 z-10 visible'
            : 'opacity-0 pointer-events-none z-0 invisible',
        )}
      >
        <EpisodeWorkspaceView projectId={projectId} />
      </div>

      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-200 ease-in-out',
          activeTab === 'assets'
            ? 'opacity-100 z-10 visible'
            : 'opacity-0 pointer-events-none z-0 invisible',
        )}
      >
        <AssetWorkspaceView projectId={projectId} />
      </div>
    </div>
  );
}
