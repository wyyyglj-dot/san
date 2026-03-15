'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, memo, useMemo } from 'react';
import { Check, Copy } from 'lucide-react';

interface MarkdownProps {
  content: string;
}

// 代码块组件
function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 内联代码
  if (!className) {
    return (
      <code className="px-1.5 py-0.5 bg-card/50 border border-white/[0.05] rounded text-sm font-mono text-foreground/65" {...props}>
        {children}
      </code>
    );
  }

  // 代码块
  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-card/50 border-b border-white/[0.05] rounded-t-xl">
        <span className="text-xs text-foreground/50 font-mono">{language || 'code'}</span>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-foreground/50 hover:text-foreground hover:bg-card/50 rounded transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              已复制
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              复制
            </>
          )}
        </button>
      </div>
      <pre className="p-4 bg-card/40 rounded-b-xl overflow-x-auto">
        <code className={`text-sm font-mono ${className}`} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

// 使用 memo 优化，避免不必要的重渲染
export const Markdown = memo(function Markdown({ content }: MarkdownProps) {
  // 缓存 components 配置
  const components = useMemo(() => ({
    // 代码
    code: CodeBlock,
    // 段落
    p: ({ children }: { children?: React.ReactNode }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
    // 标题
    h1: ({ children }: { children?: React.ReactNode }) => <h1 className="text-xl font-semibold mb-4 mt-6 first:mt-0">{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-lg font-semibold mb-3 mt-5 first:mt-0">{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-base font-semibold mb-2 mt-4 first:mt-0">{children}</h3>,
    // 列表
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
    li: ({ children }: { children?: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
    // 引用
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-2 border-white/[0.06] pl-4 my-3 text-foreground/60 italic">
        {children}
      </blockquote>
    ),
    // 链接
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200 underline-offset-4 hover:underline">
        {children}
      </a>
    ),
    // 表格
    table: ({ children }: { children?: React.ReactNode }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border border-white/[0.06] rounded-lg overflow-hidden">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-card/50">{children}</thead>,
    th: ({ children }: { children?: React.ReactNode }) => <th className="px-4 py-2 text-left text-sm font-medium border-b border-white/[0.05]">{children}</th>,
    td: ({ children }: { children?: React.ReactNode }) => <td className="px-4 py-2 text-sm border-b border-white/[0.05]">{children}</td>,
    // 分割线
    hr: () => <hr className="my-6 border-white/[0.06]" />,
    // 强调
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>,
    em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
    // 删除线
    del: ({ children }: { children?: React.ReactNode }) => <del className="line-through text-foreground/50">{children}</del>,
  }), []);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
});
