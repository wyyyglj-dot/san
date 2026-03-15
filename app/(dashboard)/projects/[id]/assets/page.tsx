'use client';

import { useEffect } from 'react';
import { useWorkspaceStore } from '@/lib/stores/workspace-store';

export default function AssetManagementPage() {
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);

  useEffect(() => {
    setActiveTab('assets');
  }, [setActiveTab]);

  return null;
}
