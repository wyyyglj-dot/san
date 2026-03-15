'use client';

import * as React from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Palette, Film } from 'lucide-react';

const tabs = [
  { value: 'overview', label: '概览', icon: Eye },
  { value: 'studio', label: '创作', icon: Palette },
  { value: 'episodes', label: '剧集', icon: Film },
] as const;

export function AssetTabsNav() {
  return (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-white/[0.06] px-4 py-2">
      <TabsList className="w-full justify-start">
        {tabs.map(({ value, label, icon: TabIcon }) => (
          <TabsTrigger key={value} value={value} className="gap-1.5">
            <TabIcon className="h-3.5 w-3.5" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
