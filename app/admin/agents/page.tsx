'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bot, Plus, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { FeatureConfigPanel } from '@/components/admin/ui/feature-config-panel';
import { AgentList } from '@/components/admin/agents/agent-list';
import type { AgentSummary } from '@/types';

export default function AgentsPage() {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/admin/agents');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAgents(data.data || []);
    } catch (error) {
      console.error(error);
      toast({ title: '加载 Agent 列表失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleDelete = async (featureKey: string) => {
    setDeletingKey(featureKey);
    try {
      const res = await fetch(`/api/admin/agents/${featureKey}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '删除失败');
      setAgents((prev) => prev.filter((a) => a.featureKey !== featureKey));
      toast({ title: 'Agent 已删除' });
    } catch (error) {
      console.error(error);
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setDeletingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
      </div>
    );
  }

  return (
    <FeatureConfigPanel
      title="Agent 管理"
      description="管理 AI Agent 的结构化配置、提示词模板和版本历史"
      icon={Bot}
    >
      <div className="flex justify-end -mt-2 mb-4">
        <Link
          href="/admin/agents/new"
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          创建 Agent
        </Link>
      </div>
      <AgentList agents={agents} onDelete={handleDelete} deletingKey={deletingKey} />
    </FeatureConfigPanel>
  );
}
