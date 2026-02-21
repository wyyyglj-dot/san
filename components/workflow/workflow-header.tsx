'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Settings, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { usePreferenceOptions } from '@/hooks/use-preference-options';
import { notify } from '@/lib/toast-utils';
import { apiGet, apiPatch } from '@/lib/api-client';
import { WorkflowStepNav } from '@/components/episodes/workflow-step-nav';

interface WorkflowHeaderProps {
  projectId: string;
}

export function WorkflowHeader({ projectId }: WorkflowHeaderProps) {
  const router = useRouter();
  const { options: preferenceOptions } = usePreferenceOptions();
  const [projectName, setProjectName] = useState('加载中...');
  const [defaultStyle, setDefaultStyle] = useState<string | undefined>();
  const [defaultEra, setDefaultEra] = useState<string | undefined>();

  useEffect(() => {
    const controller = new AbortController();
    const fetchProject = async () => {
      try {
        const data = await apiGet<{ name?: string; preferences?: { defaultStyle?: string; defaultEra?: string } }>(
          `/api/projects/${encodeURIComponent(projectId)}`,
          { timeout: 0 },
        );
        if (data?.name) {
          setProjectName(data.name);
          if ((data as any).preferences) {
            setDefaultStyle((data as any).preferences.defaultStyle || undefined);
            setDefaultEra((data as any).preferences.defaultEra || undefined);
          }
        } else {
          setProjectName(`Project ${projectId}`);
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setProjectName(`Project ${projectId}`);
      }
    };
    fetchProject();
    return () => controller.abort();
  }, [projectId]);

  const handlePreferenceUpdate = async (
    key: 'defaultStyle' | 'defaultEra',
    value: string | undefined,
  ) => {
    const prevStyle = defaultStyle;
    const prevEra = defaultEra;

    if (key === 'defaultStyle') setDefaultStyle(value);
    if (key === 'defaultEra') setDefaultEra(value);

    try {
      await apiPatch(
        `/api/projects/${encodeURIComponent(projectId)}`,
        { preferences: { [key]: value ?? null } },
      );
    } catch {
      if (key === 'defaultStyle') setDefaultStyle(prevStyle);
      if (key === 'defaultEra') setDefaultEra(prevEra);
      notify.error('保存失败', '无法更新项目设置，请重试');
    }
  };

  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-card/40 px-4 backdrop-blur-md">
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-3 flex-1 min-w-0 z-10 mr-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => router.push('/projects')}
          aria-label="返回项目列表"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-foreground truncate max-w-[100px] sm:max-w-[200px] lg:max-w-none">
          {projectName}
        </span>
      </div>

      {/* Center: nav capsule (absolute centered, z-20 to stay above flex-1 z-10 siblings) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <div className="pointer-events-auto">
          <WorkflowStepNav />
        </div>
      </div>

      {/* Right: selectors + action buttons */}
      <div className="flex items-center justify-end gap-2 flex-1 z-10 ml-4">
        <div className="hidden lg:flex items-center gap-2">
          <Select
            value={defaultStyle ?? 'none'}
            onValueChange={(val) =>
              handlePreferenceUpdate('defaultStyle', val === 'none' ? undefined : val)
            }
          >
            <SelectTrigger className="w-[110px] h-9 text-sm bg-background/40 border-white/[0.05]">
              <SelectValue placeholder="画风" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">不指定</SelectItem>
              {preferenceOptions?.styles.map((style) => (
                <SelectItem key={style.slug} value={style.slug}>
                  {style.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={defaultEra ?? 'none'}
            onValueChange={(val) =>
              handlePreferenceUpdate('defaultEra', val === 'none' ? undefined : val)
            }
          >
            <SelectTrigger className="w-[110px] h-9 text-sm bg-background/40 border-white/[0.05]">
              <SelectValue placeholder="时代" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">不指定</SelectItem>
              <SelectItem value="modern">都市韩国</SelectItem>
              <SelectItem value="ancient">古代中国</SelectItem>
              <SelectItem value="medieval">中世纪</SelectItem>
            </SelectContent>
          </Select>

          <div className="h-4 w-px bg-border/50 mx-1" />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 text-muted-foreground hover:text-foreground"
          aria-label="模型配置"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 text-muted-foreground hover:text-foreground"
          aria-label="生成记录"
        >
          <History className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
