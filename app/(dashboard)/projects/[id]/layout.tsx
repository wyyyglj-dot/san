import type { ReactNode } from 'react';
import { WorkflowShell } from '@/components/workflow/workflow-shell';

interface ProjectWorkflowLayoutProps {
  children: ReactNode;
  params: { id: string };
}

export default function ProjectWorkflowLayout({
  children,
  params,
}: ProjectWorkflowLayoutProps) {
  return <WorkflowShell projectId={params.id}>{children}</WorkflowShell>;
}
