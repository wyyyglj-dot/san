'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { AgentEditor } from '@/components/admin/agents/agent-editor';
import type { AgentConfig } from '@/types';

export default function NewAgentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSave = async (data: {
    featureKey: string;
    name: string;
    description: string;
    config: AgentConfig;
    enabled: boolean;
  }) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '创建失败');
      toast({ title: 'Agent 创建成功' });
      router.push(`/admin/agents/${data.featureKey}`);
    } catch (error) {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/agents"
          className="p-2 rounded-lg text-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-extralight text-foreground">
          创建 Agent
        </h1>
      </div>
      <AgentEditor onSave={handleSave} saving={saving} />
    </div>
  );
}
