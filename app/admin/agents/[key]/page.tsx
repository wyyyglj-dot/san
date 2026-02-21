'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, History } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { AgentEditor } from '@/components/admin/agents/agent-editor';
import type { SafeLlmAgent, AgentConfig } from '@/types';

export default function AgentEditPage({
  params,
}: {
  params: { key: string };
}) {
  const { key } = params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState<SafeLlmAgent | null>(null);

  useEffect(() => {
    fetch(`/api/admin/agents/${key}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setAgent(data.data);
        else toast({ title: 'Agent 不存在', variant: 'destructive' });
      })
      .catch(() => toast({ title: '加载失败', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [key]);

  const handleSave = async (data: {
    config: AgentConfig;
    name: string;
    description: string;
    enabled: boolean;
    changeSummary?: string;
  }) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/agents/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '保存失败');
      setAgent(result.data);
      toast({ title: '保存成功' });
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-foreground/30" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-16 text-foreground/50">
        Agent 不存在
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/agents"
            className="p-2 rounded-lg text-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extralight text-foreground">
              {agent.name}
            </h1>
            <p className="text-sm text-foreground/50">
              {agent.featureKey} · v{agent.currentVersion}
            </p>
          </div>
        </div>
        <Link
          href={`/admin/agents/${key}/versions`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground/50 hover:text-foreground hover:bg-white/[0.06] transition-colors"
        >
          <History className="w-4 h-4" />
          版本历史
        </Link>
      </div>
      <AgentEditor initialData={agent} onSave={handleSave} saving={saving} />
    </div>
  );
}
