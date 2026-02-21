'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { SiteConfig } from '@/types';
import { apiGet } from '@/lib/api-client';

// Extended config that includes runtime settings
export interface ExtendedSiteConfig extends SiteConfig {
  defaultBalance: number;
  disabledPages: string[];
  smtpEnabled: boolean;
}

const defaultSiteConfig: ExtendedSiteConfig = {
  siteName: 'SANHUB',
  siteTagline: 'Let Imagination Come Alive',
  siteDescription: '「SANHUB」是专为 AI 创作打造的一站式平台',
  siteSubDescription: '我们融合了 Sora 视频生成、Gemini 图像创作与多模型 AI 对话。在这里，技术壁垒已然消融，你唯一的使命就是释放纯粹的想象。',
  contactEmail: 'support@sanhub.com',
  copyright: 'Copyright © 2025 SANHUB',
  poweredBy: 'Powered by OpenAI Sora & Google Gemini',
  defaultBalance: 100,
  disabledPages: [],
  smtpEnabled: false,
};

interface SiteConfigContextType {
  config: ExtendedSiteConfig;
  refreshConfig: () => Promise<void>;
}

const SiteConfigContext = createContext<SiteConfigContextType>({
  config: defaultSiteConfig,
  refreshConfig: async () => {},
});

export function useSiteConfig() {
  const { config } = useContext(SiteConfigContext);
  return config;
}

export function useSiteConfigRefresh() {
  const { refreshConfig } = useContext(SiteConfigContext);
  return refreshConfig;
}

interface SiteConfigProviderProps {
  children: ReactNode;
  initialConfig?: ExtendedSiteConfig;
}

export function SiteConfigProvider({ children, initialConfig }: SiteConfigProviderProps) {
  const [config, setConfig] = useState<ExtendedSiteConfig>(initialConfig || defaultSiteConfig);

  const fetchConfig = useCallback(async () => {
    try {
      const data = await apiGet<ExtendedSiteConfig>('/api/site-config', { cache: 'no-store' });
      if (data) {
        setConfig({
          ...data,
          defaultBalance: data.defaultBalance ?? 100,
          disabledPages: data.disabledPages ?? [],
          smtpEnabled: data.smtpEnabled ?? false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch site config:', error);
    }
  }, []);

  return (
    <SiteConfigContext.Provider value={{ config, refreshConfig: fetchConfig }}>
      {children}
    </SiteConfigContext.Provider>
  );
}
