'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface SchemaDisplayProps {
  schema: object | null | undefined;
}

export function SchemaDisplay({ schema }: SchemaDisplayProps) {
  const [open, setOpen] = useState(false);

  if (!schema) {
    return (
      <p className="text-sm text-foreground/40 mt-3">
        此 Agent 无预定义输出格式约束
      </p>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="schema-content-panel"
        className="flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        查看系统强制输出格式 (JSON Schema)
      </button>
      {open && (
        <div id="schema-content-panel" className="mt-2">
          <pre className="bg-black/20 rounded-lg p-4 text-xs overflow-auto max-h-64 text-foreground/60 font-mono">
            {JSON.stringify(schema, null, 2)}
          </pre>
          <p className="text-xs text-foreground/40 mt-2">
            此格式由代码强制执行（Gemini 模型），编辑&quot;输出格式&quot;时请确保描述与此 Schema 一致
          </p>
        </div>
      )}
    </div>
  );
}
