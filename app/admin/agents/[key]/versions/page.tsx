'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, History, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { VersionHistory } from '@/components/admin/agents/version-history';
import type { AgentVersion } from '@/types';

export default function VersionsPage({ params }: { params: { key: string } }) {
  const { key } = params;
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [agentName, setAgentName] = useState('');

  const fetchData = async () => {
    try {
      const [versionsRes, agentRes] = await Promise.all([
        fetch(`/api/admin/agents/${key}/versions`),
        fetch(`/api/admin/agents/${key}`),
      ]);
      const versionsData = await versionsRes.json();
      const agentData = await agentRes.json();

      if (versionsData.success) setVersions(versionsData.data || []);
      if (agentData.success) {
        setCurrentVersion(agentData.data.currentVersion);
        setAgentName(agentData.data.name);
      }
    } catch (error) {
      console.error(error);
      toast({ title: '加载版本历史失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const handleRollback = async (targetVersion: number) => {
    try {
      const res = await fetch(`/api/admin/agents/${key}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetVersion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '回滚失败');

      toast({ title: `已回滚到版本 v${targetVersion}` });
      setLoading(true);
      await fetchData();
    } catch (error) {
      console.error(error);
      toast({
        title: '回滚失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/agents/${key}`}
          className="p-2 rounded-lg text-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extralight text-foreground">版本历史</h1>
            <p className="text-sm text-foreground/50">{agentName} · 当前 v{currentVersion}</p>
          </div>
        </div>
      </div>

      <VersionHistory
        versions={versions}
        currentVersion={currentVersion}
        onRollback={handleRollback}
      />
    </div>
  );
}
