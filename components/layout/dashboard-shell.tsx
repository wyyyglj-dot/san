'use client';

import { usePathname } from 'next/navigation';
import type { SafeUser } from '@/types';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { AnnouncementBanner } from '@/components/ui/announcement';

interface DashboardShellProps {
  user: SafeUser;
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const pathname = usePathname();
  const isWorkflowPage = pathname?.match(/\/projects\/[^/]+\/(episodes|assets|production)/);
  const isFullWidthPage = !!isWorkflowPage;

  return (
    <>
      {!isFullWidthPage && <Header user={user} />}
      <div className="flex relative z-10 min-h-screen">
        {isFullWidthPage ? (
          null
        ) : (
          <Sidebar user={user} />
        )}
        <main
          className={cn(
            'flex-1 min-w-0',
            isFullWidthPage
              ? 'ml-0 p-0 h-screen overflow-hidden'
              : 'lg:ml-[var(--sidebar-width)] p-6 lg:p-8 mt-14'
          )}
        >
          {!isFullWidthPage && <AnnouncementBanner />}
          {children}
        </main>
      </div>
    </>
  );
}
