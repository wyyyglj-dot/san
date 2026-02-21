'use client';

import { useEffect } from 'react';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';

export default function EpisodeManagementPage() {
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);

  useEffect(() => {
    setActiveTab('episodes');
  }, [setActiveTab]);

  return null;
}
