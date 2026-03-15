'use client';

import { useEffect } from 'react';
import { WorkflowHeader } from '@/components/workflow/workflow-header';
import { EpisodeListSidebar } from '@/components/episodes/episode-list-sidebar';
import { AssetSidebar } from '@/components/episodes/asset-sidebar';
import { WorkspaceCenterPanel } from '@/components/workspace/workspace-center-panel';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';

interface WorkflowShellProps {
  projectId: string;
  children: React.ReactNode;
}

export function WorkflowShell({ projectId, children }: WorkflowShellProps) {
  const resetForProject = useWorkspaceStore((s) => s.resetForProject);
  const fetchEpisodes = useWorkspaceStore((s) => s.fetchEpisodes);

  useEffect(() => {
    resetForProject(projectId);
    void fetchEpisodes();
  }, [projectId, resetForProject, fetchEpisodes]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <WorkflowHeader projectId={projectId} />

      <div className="flex flex-1 overflow-hidden relative">
        <EpisodeListSidebar projectId={projectId} />

        <main className="flex-1 relative min-w-0 flex flex-col">
          <WorkspaceCenterPanel projectId={projectId} />
        </main>

        <AssetSidebar />
      </div>

      {/* Route pages (return null) — kept mounted for URL-driven activeTab sync */}
      {children}
    </div>
  );
}
