'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, UserPlus, Upload, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { notify } from '@/lib/toast-utils';
import { ProjectList } from '@/components/projects/project-list';
import { MemberList } from '@/components/projects/member-list';
import { CreateProjectModal } from '@/components/projects/create-project-modal';
import { InviteMemberModal } from '@/components/projects/invite-member-modal';
import type { ComicProject, ProjectMember, ProjectPreferences } from '@/lib/db-comic';

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState('works');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [projects, setProjects] = useState<ComicProject[]>([]);
  const [trashProjects, setTrashProjects] = useState<ComicProject[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<ComicProject | undefined>(undefined);
  const [editingPreferences, setEditingPreferences] = useState<ProjectPreferences | undefined>(undefined);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleImport = () => {
    notify.info("功能开发中", "项目导入功能即将上线，敬请期待。");
  };

  const handleExport = () => {
    notify.info("功能开发中", "项目导出功能即将上线，敬请期待。");
  };

  const fetchProjects = useCallback(async () => {
    try {
      const [activeRes, trashRes] = await Promise.all([
        fetch('/api/projects?status=active'),
        fetch('/api/projects?status=trash'),
      ]);

      if (activeRes.ok) {
        const data = await activeRes.json();
        setProjects(data.data || []);
      }
      if (trashRes.ok) {
        const data = await trashRes.json();
        setTrashProjects(data.data || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) fetchProjects();
  };

  const handleRestore = async (id: string) => {
    const res = await fetch(`/api/projects/${id}/restore`, { method: 'POST' });
    if (res.ok) fetchProjects();
  };

  const handlePurge = async (id: string) => {
    const res = await fetch(`/api/projects/${id}/purge`, { method: 'DELETE' });
    if (res.ok) fetchProjects();
  };

  const handleDuplicate = async (id: string) => {
    const res = await fetch(`/api/projects/${id}/duplicate`, { method: 'POST' });
    if (res.ok) fetchProjects();
  };

  const handleEdit = async (id: string) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setEditingProject(json.data);
          setEditingPreferences(json.preferences);
          setIsCreateModalOpen(true);
        }
      } else {
        notify.error('获取项目详情失败');
      }
    } catch {
      notify.error('获取项目详情失败');
    }
  };

  const filteredProjects = searchQuery
    ? projects.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : projects;

  const filteredTrash = searchQuery
    ? trashProjects.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : trashProjects;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extralight text-foreground">项目管理</h1>
          <p className="text-foreground/50 mt-1 font-light">管理您的漫剧作品和团队</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList>
              <TabsTrigger value="works">作品</TabsTrigger>
              <TabsTrigger value="members">成员管理</TabsTrigger>
              <TabsTrigger value="trash">回收站</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card/40"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'members' ? (
            <Button
              variant="outline"
              className="gap-2 bg-card/40 border-white/[0.06]"
              onClick={() => setIsInviteModalOpen(true)}
            >
              <UserPlus className="w-4 h-4" />
              邀请成员
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="gap-2 bg-card/40 border-white/[0.06]"
                onClick={handleImport}
              >
                <Upload className="w-4 h-4" />
                导入项目
              </Button>
              <Button
                variant="outline"
                className="gap-2 bg-card/40 border-white/[0.06]"
                onClick={handleExport}
              >
                <Download className="w-4 h-4" />
                导出项目
              </Button>
              <Button
                className="gap-2 bg-brand/10 text-brand border border-brand/50 hover:bg-brand hover:text-primary-foreground transition-all"
                onClick={() => {
                  if (closeTimeoutRef.current) {
                    clearTimeout(closeTimeoutRef.current);
                    closeTimeoutRef.current = null;
                  }
                  setEditingProject(undefined);
                  setEditingPreferences(undefined);
                  setIsCreateModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                创建作品
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="bg-card/40 border border-white/[0.06] border-t-brand/30 rounded-2xl overflow-hidden backdrop-blur-sm min-h-[500px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'works' && (
              <ProjectList
                projects={filteredProjects}
                type="active"
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onEdit={handleEdit}
              />
            )}
            {activeTab === 'members' && (
              <MemberList members={members} isOwner />
            )}
            {activeTab === 'trash' && (
              <ProjectList
                projects={filteredTrash}
                type="trash"
                onRestore={handleRestore}
                onPurge={handlePurge}
              />
            )}
          </>
        )}
      </div>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
          }
          closeTimeoutRef.current = setTimeout(() => {
            setEditingProject(undefined);
            setEditingPreferences(undefined);
            closeTimeoutRef.current = null;
          }, 300);
        }}
        onCreated={fetchProjects}
        mode={editingProject ? 'edit' : 'create'}
        initialProject={editingProject}
        initialPreferences={editingPreferences}
      />
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}
