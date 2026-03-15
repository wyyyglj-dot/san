import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ConfigSectionProps {
  title: string;
  description?: string;
  icon?: ElementType;
  children: ReactNode;
  className?: string;
}

export function ConfigSection({
  title,
  description,
  icon: Icon,
  children,
  className
}: ConfigSectionProps) {
  return (
    <div className={cn(
      "bg-card/40 border border-white/[0.06] rounded-xl overflow-hidden",
      className
    )}>
      <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
        {Icon && (
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        )}
        <div>
          <h2 className="font-medium text-foreground">{title}</h2>
          {description && (
            <p className="text-xs text-foreground/40 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="p-4 space-y-4">
        {children}
      </div>
    </div>
  );
}
