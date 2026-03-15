import type { ElementType, ReactNode } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminPageLayoutProps {
  title: string;
  description?: string;
  icon: ElementType;
  saving?: boolean;
  onSave?: () => void;
  children: ReactNode;
  rightElement?: ReactNode;
}

export function AdminPageLayout({
  title,
  description,
  icon: Icon,
  saving,
  onSave,
  children,
  rightElement,
}: AdminPageLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/10 shrink-0">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extralight text-foreground">{title}</h1>
            {description && (
              <p className="text-foreground/50 mt-1 font-light text-sm sm:text-base">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rightElement}
          {onSave && (
            <Button onClick={onSave} disabled={saving} className="min-w-[80px]" aria-busy={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> : <Save className="w-4 h-4 mr-2" />}
              {saving ? '保存中' : '保存'}
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
