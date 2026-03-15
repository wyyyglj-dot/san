import type { ElementType, ReactNode } from 'react';
import { Loader2, Save } from 'lucide-react';
import { ConfigStatusBadge } from './config-status-badge';

interface FeatureConfigPanelProps {
  title: string;
  description: string;
  icon: ElementType;
  status?: 'healthy' | 'warning';
  children: ReactNode;
  onSave?: () => void;
  saving?: boolean;
}

export function FeatureConfigPanel({
  title,
  description,
  icon: Icon,
  status,
  children,
  onSave,
  saving
}: FeatureConfigPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/10 shrink-0">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extralight text-foreground">
                {title}
              </h1>
              {status && <ConfigStatusBadge configured={status === 'healthy'} />}
            </div>
            <p className="text-foreground/50 mt-1 font-light text-sm sm:text-base">
              {description}
            </p>
          </div>
        </div>

        {onSave && (
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 text-sm sm:text-base"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{saving ? '保存中...' : '保存'}</span>
          </button>
        )}
      </div>

      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}
