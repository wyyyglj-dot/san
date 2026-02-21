'use client';

import { Bot } from 'lucide-react';
import { AgentCard } from './agent-card';
import type { AgentSummary } from '@/types';

interface AgentListProps {
  agents: AgentSummary[];
  onDelete: (key: string) => void;
  deletingKey?: string | null;
}

export function AgentList({ agents, onDelete, deletingKey }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-card/40 border border-white/[0.06] flex items-center justify-center mb-4">
          <Bot className="w-8 h-8 text-foreground/20" />
        </div>
        <h3 className="text-lg font-medium text-foreground/60 mb-1">暂无 Agent</h3>
        <p className="text-sm text-muted-foreground">点击右上角「创建 Agent」开始配置</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((agent) => (
        <AgentCard key={agent.featureKey} agent={agent} onDelete={onDelete} isDeleting={deletingKey === agent.featureKey} />
      ))}
    </div>
  );
}
