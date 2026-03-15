'use client';

import { AssetsView } from './views/assets-view';
import { ExportView } from './views/export-view';
import { OverviewView } from './views/overview-view';
import { ScriptParseView } from './views/script-parse-view';
import { StoryboardView } from './views/storyboard-view';
import type { SidebarView } from './episode-sidebar';
import type { Episode } from './types';

export interface ViewProps {
  selectedEpisodeId: string | null;
  episodes: Episode[];
  currentEpisode?: Episode;
  onDeleteEpisode: (id: string) => void;
}

interface DynamicWorkspaceProps {
  view: SidebarView;
  selectedEpisodeId: string | null;
  episodes: Episode[];
  isLoading: boolean;
  onDeleteEpisode: (id: string) => void;
}

export function DynamicWorkspace({
  view,
  selectedEpisodeId,
  episodes,
  isLoading,
  onDeleteEpisode,
}: DynamicWorkspaceProps) {
  const currentEpisode = episodes.find((episode) => episode.id === selectedEpisodeId);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  const commonProps: ViewProps = {
    selectedEpisodeId,
    episodes,
    currentEpisode,
    onDeleteEpisode,
  };

  switch (view) {
    case 'overview':
      return <OverviewView {...commonProps} />;
    case 'script-parse':
      return <ScriptParseView {...commonProps} />;
    case 'storyboard':
      return <StoryboardView {...commonProps} />;
    case 'assets':
      return <AssetsView {...commonProps} />;
    case 'export':
      return <ExportView {...commonProps} />;
    default:
      return <OverviewView {...commonProps} />;
  }
}
