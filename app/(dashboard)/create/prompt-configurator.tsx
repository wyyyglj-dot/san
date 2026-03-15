'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect } from 'react';
import { Upload, Wand2, Loader2, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaType, CharacterCard } from './types';
import { OmniReferencePanel, type OmniSubject } from './omni-reference-panel';

interface PromptConfiguratorProps {
  mediaType: MediaType;
  prompt: string;
  onPromptChange: (value: string) => void;
  files: Array<{ file: File; preview: string }>;
  showFileUpload: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  promptTextareaRef: React.RefObject<HTMLTextAreaElement>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFiles: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  enhancing: boolean;
  onEnhance: () => void;
  characterCards: CharacterCard[];
  showCharacterMenu: boolean;
  onShowCharacterMenu: (show: boolean) => void;
  onAddCharacter: (name: string) => void;
  onPromptInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>, setter: (v: string) => void) => void;
  isOmniReference?: boolean;
  omniSubjects?: OmniSubject[];
  onOmniSubjectsChange?: (subjects: OmniSubject[]) => void;
}

const MIN_TEXTAREA_HEIGHT = 72;
const MAX_TEXTAREA_HEIGHT = 200;

export function PromptConfigurator({
  mediaType,
  prompt,
  onPromptChange,
  files,
  showFileUpload,
  fileInputRef,
  promptTextareaRef,
  onFileUpload,
  onClearFiles,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragging,
  enhancing,
  onEnhance,
  characterCards,
  showCharacterMenu,
  onShowCharacterMenu,
  onAddCharacter,
  onPromptInputChange,
  isOmniReference,
  omniSubjects,
  onOmniSubjectsChange,
}: PromptConfiguratorProps) {
  const canEnhance = prompt.trim();

  const adjustPromptTextareaHeight = useCallback((textarea?: HTMLTextAreaElement | null) => {
    const target = textarea ?? promptTextareaRef.current;
    if (!target) return;

    target.style.height = 'auto';
    const nextHeight = Math.min(target.scrollHeight, MAX_TEXTAREA_HEIGHT);
    target.style.height = `${Math.max(nextHeight, MIN_TEXTAREA_HEIGHT)}px`;
    target.style.overflowY = target.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, [promptTextareaRef]);

  useEffect(() => {
    if (!isOmniReference) {
      adjustPromptTextareaHeight();
    }
  }, [adjustPromptTextareaHeight, isOmniReference, prompt]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (mediaType === 'video') {
      onPromptInputChange(e, onPromptChange);
    } else {
      onPromptChange(e.target.value);
    }

    adjustPromptTextareaHeight(e.currentTarget);
  };

  return (
    <>
      {isOmniReference && omniSubjects && onOmniSubjectsChange ? (
        <OmniReferencePanel
          prompt={prompt}
          onPromptChange={onPromptChange}
          subjects={omniSubjects}
          onSubjectsChange={onOmniSubjectsChange}
          promptTextareaRef={promptTextareaRef}
          enhancing={enhancing}
          onEnhance={onEnhance}
        />
      ) : (
        <div className="flex items-start gap-3 min-h-[72px] max-h-[200px] px-4 pt-4">
          {showFileUpload && (
            <div
              role="button"
              tabIndex={0}
              aria-label="上传参考图片"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={cn(
                'relative w-24 h-[72px] shrink-0 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-all overflow-hidden',
                isDragging
                  ? 'border-sky-500 bg-sky-500/10'
                  : files.length > 0
                    ? 'border-solid border-white/[0.05]'
                    : 'border-white/[0.06] hover:border-white/[0.1] hover:bg-card/40'
              )}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                accept="image/*"
                onChange={onFileUpload}
              />
              {files.length > 0 ? (
                <>
                  <img src={files[0].preview} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={(e) => { e.stopPropagation(); onClearFiles(); }}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                    aria-label="清除参考图"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {files.length > 1 && (
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white">
                      +{files.length - 1}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-foreground/40" />
                  <span className="text-[10px] text-foreground/40 text-center leading-tight">
                    上传/拖入<br />参考图
                  </span>
                </>
              )}
            </div>
          )}

          <div className="relative flex-1 min-h-[72px] max-h-[200px]">
            <textarea
              ref={promptTextareaRef}
              value={prompt}
              onChange={handleTextareaChange}
              placeholder={mediaType === 'image' ? '描述你想要生成的图像...' : '描述视频动态，或拖入图片生成图生视频... 输入 @ 引用角色卡'}
              className="w-full min-h-[72px] max-h-[200px] px-3 py-2 pr-16 bg-input/70 border border-white/[0.06] rounded-lg resize-none overflow-y-hidden text-sm focus:outline-none focus:border-white/[0.1] focus:ring-2 focus:ring-ring/30"
            />

            {mediaType === 'video' && showCharacterMenu && characterCards.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-64 max-h-48 overflow-auto bg-card border border-white/[0.06] rounded-lg shadow-lg z-20">
                <div className="p-2 border-b border-white/[0.06] text-xs text-foreground/40">选择角色卡</div>
                {characterCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => onAddCharacter(card.characterName)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-card/80 transition-colors text-left"
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/20 to-sky-500/20 shrink-0">
                      {card.avatarUrl ? (
                        <img src={card.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-3 h-3 text-emerald-300/60" />
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-foreground">@{card.characterName}</span>
                  </button>
                ))}
                <button onClick={() => onShowCharacterMenu(false)} className="w-full px-3 py-2 text-xs text-foreground/40 hover:bg-card/80 border-t border-white/[0.06]">关闭</button>
              </div>
            )}

            <button
              type="button"
              onClick={onEnhance}
              disabled={enhancing || !canEnhance}
              className={cn(
                'absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-xs transition-all',
                enhancing || !canEnhance
                  ? 'text-foreground/30 cursor-not-allowed'
                  : 'text-sky-400 hover:text-sky-300 hover:bg-sky-500/10'
              )}
            >
              {enhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              <span>增强</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
