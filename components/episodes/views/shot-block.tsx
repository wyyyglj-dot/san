'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ShotBlockProps {
  index: number;
  text: string;
  onChange: (text: string) => void;
  onEnter: (cursorPos: number) => void;
  onBackspaceAtStart: () => void;
  onArrowUp: () => void;
  onArrowDown: () => void;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
  disabled?: boolean;
}

export const ShotBlock = React.memo(function ShotBlock({
  index,
  text,
  onChange,
  onEnter,
  onBackspaceAtStart,
  onArrowUp,
  onArrowDown,
  textareaRef,
  disabled,
}: ShotBlockProps) {
  const isComposing = React.useRef(false);
  const internalRef = React.useRef<HTMLTextAreaElement | null>(null);

  const setRef = React.useCallback(
    (el: HTMLTextAreaElement | null) => {
      internalRef.current = el;
      textareaRef(el);
    },
    [textareaRef],
  );

  const adjustHeight = React.useCallback(() => {
    const ta = internalRef.current;
    if (ta) {
      ta.style.height = '0px';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, []);

  React.useLayoutEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposing.current) return;

    const ta = e.currentTarget;
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnter(ta.selectionStart);
    } else if (
      e.key === 'Backspace' &&
      ta.selectionStart === 0 &&
      ta.selectionEnd === 0
    ) {
      e.preventDefault();
      onBackspaceAtStart();
    } else if (e.key === 'ArrowUp' && ta.selectionStart === 0 && ta.selectionStart === ta.selectionEnd) {
      e.preventDefault();
      onArrowUp();
    } else if (
      e.key === 'ArrowDown' &&
      ta.selectionStart === ta.value.length &&
      ta.selectionStart === ta.selectionEnd
    ) {
      e.preventDefault();
      onArrowDown();
    }
  };

  return (
    <li className="flex gap-4 p-4 hover:bg-accent/5 transition-colors group relative focus-within:bg-accent/[0.03]">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand scale-y-0 group-focus-within:scale-y-100 transition-transform origin-center" />
      <span
        className={cn(
          'shrink-0 text-xs font-mono select-none pt-1 w-12 transition-colors',
          'text-foreground/40 group-focus-within:text-brand/70',
        )}
      >
        分镜 {index + 1}
      </span>
      <textarea
        ref={setRef}
        value={text}
        disabled={disabled}
        aria-label={`分镜 ${index + 1}`}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => {
          isComposing.current = true;
        }}
        onCompositionEnd={() => {
          isComposing.current = false;
        }}
        rows={1}
        className={cn(
          'flex-1 bg-transparent border-none focus:ring-0 p-0',
          'text-sm leading-relaxed text-foreground resize-none',
          'min-h-[1.5rem] overflow-hidden placeholder:text-foreground/20',
          'outline-none focus:ring-1 focus:ring-brand/30 rounded px-2 py-1',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        placeholder="输入分镜描述..."
      />
    </li>
  );
});
