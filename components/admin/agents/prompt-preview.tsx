'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import { compileSystemPrompt, compileUserPromptTemplate } from '@/lib/agent-utils';
import type { AgentConfig } from '@/types';

interface PromptPreviewProps {
  config: AgentConfig;
}

export function PromptPreview({ config }: PromptPreviewProps) {
  const [preview, setPreview] = useState('');
  const [userPromptPreview, setUserPromptPreview] = useState('');
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPreview(compileSystemPrompt(config));
      setUserPromptPreview(compileUserPromptTemplate(config));
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [config]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="sticky top-6">
      <div className="bg-card/40 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground/70">
            提示词预览
          </h3>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors"
            aria-label={copied ? '已复制' : '复制提示词'}
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
        <pre className="text-xs text-foreground/60 whitespace-pre-wrap break-words max-h-[calc(100vh-200px)] overflow-y-auto font-mono leading-relaxed">
          {preview || '编辑左侧配置后，预览将在此显示...'}
        </pre>
        {userPromptPreview && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <h4 className="text-xs font-medium text-foreground/50 mb-2">用户提示词（自动生成）</h4>
            <pre className="text-xs text-foreground/60 whitespace-pre-wrap break-words font-mono leading-relaxed">
              {userPromptPreview}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
