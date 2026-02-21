'use client';

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EpisodeStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
}

export function EpisodeStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled,
  className,
}: EpisodeStepperProps) {
  const handleDecrease = () => {
    if (min !== undefined && value <= min) return;
    onChange(value - 1);
  };

  const handleIncrease = () => {
    if (max !== undefined && value >= max) return;
    onChange(value + 1);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1 bg-card/40 rounded-lg border border-white/[0.04]',
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:bg-background/80"
        onClick={handleDecrease}
        disabled={disabled || (min !== undefined && value <= min)}
        aria-label="减少剧集序号"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span className="w-12 text-center font-mono text-lg tabular-nums">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:bg-background/80"
        onClick={handleIncrease}
        disabled={disabled || (max !== undefined && value >= max)}
        aria-label="增加剧集序号"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
