'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, X, ImageIcon, VideoIcon, Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OmniSubject {
  id: string;
  type: 'image' | 'video';
  name: string;
  tag: string;
  file: { data: string; mimeType: string; preview: string } | null;
}

interface OmniReferencePanelProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  subjects: OmniSubject[];
  onSubjectsChange: (subjects: OmniSubject[]) => void;
  promptTextareaRef: React.RefObject<HTMLTextAreaElement>;
  enhancing: boolean;
  onEnhance: () => void;
}

let subjectCounter = 0;

function generateId() {
  return `omni_${Date.now()}_${++subjectCounter}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGES = 9;
const MAX_VIDEOS = 3;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const MIN_TEXTAREA_HEIGHT = 72;
const MAX_TEXTAREA_HEIGHT = 200;

export function OmniReferencePanel({
  prompt, onPromptChange, subjects, onSubjectsChange,
  promptTextareaRef, enhancing, onEnhance,
}: OmniReferencePanelProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<'image' | 'video'>('image');

  const imageCount = subjects.filter(s => s.type === 'image').length;
  const videoCount = subjects.filter(s => s.type === 'video').length;

  const adjustPromptTextareaHeight = useCallback((textarea?: HTMLTextAreaElement | null) => {
    const target = textarea ?? promptTextareaRef.current;
    if (!target) return;
    target.style.height = 'auto';
    const nextHeight = Math.min(target.scrollHeight, MAX_TEXTAREA_HEIGHT);
    target.style.height = `${Math.max(nextHeight, MIN_TEXTAREA_HEIGHT)}px`;
    target.style.overflowY = target.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, [promptTextareaRef]);

  useEffect(() => {
    adjustPromptTextareaHeight();
  }, [adjustPromptTextareaHeight, prompt]);

  const addSubject = useCallback((type: 'image' | 'video') => {
    setShowAddMenu(false);
    pendingTypeRef.current = type;
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'image' ? 'image/*' : 'video/*';
      fileInputRef.current.click();
    }
  }, []);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const type = pendingTypeRef.current;
    const maxSize = type === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      alert(`文件过大，${type === 'image' ? '图片' : '视频'}最大 ${maxSize / 1024 / 1024}MB`);
      return;
    }

    const data = await fileToBase64(file);
    const preview = URL.createObjectURL(file);
    const count = subjects.filter(s => s.type === type).length + 1;
    const name = type === 'image' ? `图片${count}` : `视频${count}`;
    const emoji = type === 'image' ? '🖼️' : '🎬';

    const newSubject: OmniSubject = {
      id: generateId(),
      type,
      name,
      tag: `${emoji}${name}`,
      file: { data, mimeType: file.type, preview },
    };
    onSubjectsChange([...subjects, newSubject]);
  }, [subjects, onSubjectsChange]);

  const removeSubject = useCallback((id: string) => {
    const subject = subjects.find(s => s.id === id);
    if (subject?.file?.preview) URL.revokeObjectURL(subject.file.preview);
    const updated = subjects.filter(s => s.id !== id);
    onSubjectsChange(updated);
    if (subject) {
      onPromptChange(prompt.replaceAll(subject.tag, '').replace(/\s{2,}/g, ' ').trim());
    }
  }, [subjects, onSubjectsChange, prompt, onPromptChange]);

  const insertTag = useCallback((tag: string) => {
    const textarea = promptTextareaRef.current;
    if (!textarea) {
      onPromptChange(prompt + (prompt ? ' ' : '') + tag + ' ');
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = prompt.slice(0, start);
    const after = prompt.slice(end);
    const space = before && !before.endsWith(' ') ? ' ' : '';
    const newPrompt = before + space + tag + ' ' + after;
    onPromptChange(newPrompt);
    requestAnimationFrame(() => {
      const pos = start + space.length + tag.length + 1;
      textarea.setSelectionRange(pos, pos);
      textarea.focus();
    });
  }, [prompt, onPromptChange, promptTextareaRef]);

  const canEnhance = prompt.trim().length > 0;

  return (
    <div className="space-y-3 px-4 pt-4">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

      {/* Prompt textarea */}
      <div className="relative">
        <textarea
          ref={promptTextareaRef}
          value={prompt}
          onChange={(e) => {
            onPromptChange(e.target.value);
            adjustPromptTextareaHeight(e.currentTarget);
          }}
          placeholder="描述视频内容，点击素材标签插入引用，如：🖼️图片1 在公园里奔跑..."
          className="w-full min-h-[72px] max-h-[200px] px-3 py-2 pr-16 bg-input/70 border border-white/[0.06] rounded-lg resize-none overflow-y-hidden text-sm focus:outline-none focus:border-white/[0.1] focus:ring-2 focus:ring-ring/30"
        />
        <button
          onClick={onEnhance}
          disabled={!canEnhance || enhancing}
          className={cn(
            'absolute right-2 top-2 p-1.5 rounded-lg transition-all',
            canEnhance && !enhancing
              ? 'text-sky-400 hover:bg-sky-500/10'
              : 'text-foreground/20 cursor-not-allowed'
          )}
          title="AI 优化提示词"
        >
          {enhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Subject list */}
      <div className="flex flex-wrap gap-2">
        {subjects.map((subject) => (
          <div
            key={subject.id}
            className="group relative flex items-center gap-1.5 px-2 py-1.5 bg-card/60 border border-white/[0.06] rounded-lg cursor-pointer hover:border-sky-500/30 transition-all"
            onClick={() => insertTag(subject.tag)}
            title={`点击插入 ${subject.tag} 到提示词`}
          >
            {subject.file ? (
              <div className="w-8 h-8 rounded overflow-hidden shrink-0">
                {subject.type === 'video' ? (
                  <video src={subject.file.preview} className="w-full h-full object-cover" />
                ) : (
                  <img src={subject.file.preview} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            ) : (
              <div className="w-8 h-8 rounded bg-white/[0.04] flex items-center justify-center">
                {subject.type === 'image' ? (
                  <ImageIcon className="w-4 h-4 text-foreground/30" />
                ) : (
                  <VideoIcon className="w-4 h-4 text-foreground/30" />
                )}
              </div>
            )}
            <span className="text-xs text-foreground/70">{subject.tag}</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeSubject(subject.id); }}
              className="opacity-0 group-hover:opacity-100 absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 transition-all"
              aria-label={`删除${subject.name}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}

        {/* Add button */}
        {(imageCount < MAX_IMAGES || videoCount < MAX_VIDEOS) && (
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-white/[0.1] rounded-lg text-xs text-foreground/50 hover:text-foreground/70 hover:border-white/[0.15] transition-all h-[44px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加素材</span>
            </button>
            {showAddMenu && (
              <div className="absolute bottom-full left-0 mb-1 bg-card border border-white/[0.06] rounded-lg shadow-lg z-20 overflow-hidden">
                {imageCount < MAX_IMAGES && (
                  <button
                    onClick={() => addSubject('image')}
                    className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.04] transition-colors w-full text-left"
                  >
                    <ImageIcon className="w-4 h-4 text-sky-400" />
                    <span className="text-sm">添加图片</span>
                    <span className="text-xs text-foreground/30 ml-auto">{imageCount}/{MAX_IMAGES}</span>
                  </button>
                )}
                {videoCount < MAX_VIDEOS && (
                  <button
                    onClick={() => addSubject('video')}
                    className="flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.04] transition-colors w-full text-left"
                  >
                    <VideoIcon className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm">添加视频</span>
                    <span className="text-xs text-foreground/30 ml-auto">{videoCount}/{MAX_VIDEOS}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
