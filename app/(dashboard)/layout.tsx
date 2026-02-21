import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSystemConfig } from '@/lib/db';
import { isPageDisabled } from '@/lib/page-registry';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DashboardBackgroundWrapper } from '@/components/ui/dashboard-background-wrapper';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  // 服务端访问控制：检查页面可见性
  const userRole = session.user?.role || 'user';
  const isAdmin = userRole === 'admin' || userRole === 'moderator';

  if (!isAdmin) {
    const headersList = headers();
    const pathname = headersList.get('x-pathname') || '';

    // 如果无法从 header 获取路径，尝试从 referer 解析
    if (pathname) {
      const config = await getSystemConfig();
      const disabledPages = config.disabledPages ?? [];

      if (isPageDisabled(pathname, disabledPages)) {
        redirect('/create');
      }
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <DashboardBackgroundWrapper />
      <DashboardShell user={session.user}>{children}</DashboardShell>
    </div>
  );
}
