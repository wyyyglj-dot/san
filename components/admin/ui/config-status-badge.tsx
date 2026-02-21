import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfigStatusBadgeProps {
  configured: boolean;
  label?: string;
}

export function ConfigStatusBadge({ configured, label }: ConfigStatusBadgeProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        configured
          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      )}
    >
      {configured ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5" />
      )}
      <span>{label || (configured ? '已配置' : '未配置')}</span>
    </div>
  );
}
