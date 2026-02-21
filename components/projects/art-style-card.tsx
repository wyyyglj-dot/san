'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SafeArtStyle } from '@/types';

interface ArtStyleCardProps {
  style: SafeArtStyle;
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export function ArtStyleCard({
  style,
  isSelected,
  onSelect,
  disabled,
}: ArtStyleCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'group relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50 disabled:cursor-not-allowed',
        isSelected
          ? 'border-brand ring-2 ring-brand/20'
          : 'border-transparent hover:border-brand/40'
      )}
    >
      <div className="relative w-full h-full bg-muted">
        {imageError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <ImageOff className="w-6 h-6 text-muted-foreground" />
          </div>
        ) : (
          <Image
            src={style.coverImageUrl}
            alt={style.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 33vw"
            onError={() => setImageError(true)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
      </div>

      {isSelected && (
        <div className="absolute top-2 right-2 bg-brand text-white rounded-full p-0.5 z-20 shadow-md">
          <Check className="w-3.5 h-3.5" />
        </div>
      )}

      <div className="absolute bottom-0 left-0 w-full p-2.5 z-10">
        <h3 className="text-sm font-bold text-white truncate drop-shadow-md">{style.name}</h3>
      </div>
    </button>
  );
}
