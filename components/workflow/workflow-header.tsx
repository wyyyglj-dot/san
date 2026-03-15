'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, History, Settings } from 'lucide-react';
import { WorkflowStepNav } from '@/components/episodes/workflow-step-nav';
import { ProjectPreferencesDialog } from '@/components/projects/project-preferences-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiGet } from '@/lib/api-client';

interface WorkflowHeaderProps {
  projectId: string;
}

export function WorkflowHeader({ projectId }: WorkflowHeaderProps) {
  const router = useRouter();
  const [projectName, setProjectName] = useState('加载中...');
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchProject = async () => {
      try {
        const data = await apiGet<{ name?: string }>(
          `/api/projects/${encodeURIComponent(projectId)}`,
          { timeout: 0 },
        );

        if (cancelled) return;

        if (data?.name) {
          setProjectName(data.name);
        } else {
          setProjectName(`Project ${projectId}`);
        }
      } catch {
        if (!cancelled) {
          setProjectName(`Project ${projectId}`);
        }
      }
    };

    void fetchProject();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <>
      <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-card/40 px-4 backdrop-blur-md">
        <div className="z-10 mr-4 flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/projects')}
            aria-label="返回项目列表"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="max-w-[100px] truncate text-sm font-medium text-foreground sm:max-w-[200px] lg:max-w-none">
            {projectName}
          </span>
        </div>

        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="pointer-events-auto">
            <WorkflowStepNav />
          </div>
        </div>

        <div className="z-10 ml-4 flex flex-1 items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-2 text-muted-foreground hover:text-foreground"
                aria-label="项目默认配置"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-card/85 backdrop-blur-xl border-white/[0.06]"
            >
              <DropdownMenuItem onSelect={() => setIsPreferencesOpen(true)}>
                项目默认配置
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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

      <ProjectPreferencesDialog
        projectId={projectId}
        open={isPreferencesOpen}
        onOpenChange={setIsPreferencesOpen}
      />
    </>
  );
}
