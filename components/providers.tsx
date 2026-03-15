'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/toaster';
import { SiteConfigProvider, ExtendedSiteConfig } from '@/components/providers/site-config-provider';
import { DebugProvider } from '@/components/providers/debug-provider';
import { DebugTrigger } from '@/components/admin/debug-trigger';
import { DebugLogViewer } from '@/components/admin/debug-log-viewer';
import { QueryProvider } from '@/components/providers/query-provider';

interface ProvidersProps {
  children: React.ReactNode;
  initialSiteConfig?: ExtendedSiteConfig;
}

export function Providers({ children, initialSiteConfig }: ProvidersProps) {
  return (
    <QueryProvider>
      <SessionProvider>
        <DebugProvider>
          <SiteConfigProvider initialConfig={initialSiteConfig}>
            {children}
            <Toaster />
          </SiteConfigProvider>
          <DebugTrigger />
          <DebugLogViewer />
        </DebugProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
