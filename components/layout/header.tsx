'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { LogOut, Settings, Menu, X, Video, Image, History, Shield, FolderKanban, Sparkles } from 'lucide-react';
import type { SafeUser } from '@/types';
import { cn } from '@/lib/utils';
import { useSiteConfig } from '@/components/providers/site-config-provider';

interface HeaderProps {
  user: SafeUser;
}

export function Header({ user }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const siteConfig = useSiteConfig();

  const navItems = [
    { href: '/create', icon: Sparkles, label: 'AI 创作' },
    { href: '/projects', icon: FolderKanban, label: '项目管理' },
    { href: '/history', icon: History, label: '历史' },
    { href: '/settings', icon: Settings, label: '设置' },
  ];

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-14 bg-card/50 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.03)] z-50">
        <div className="h-full px-4 lg:px-6 flex items-center justify-between">
          {/* Mobile Menu Button */}
          <button 
            className="lg:hidden p-2 hover:bg-foreground/5 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-foreground/70" /> : <Menu className="w-5 h-5 text-foreground/70" />}
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 border border-white/[0.06] bg-card/40 rounded-lg flex items-center justify-center">
              <span className="text-sm font-light text-foreground/60">{siteConfig.siteName.charAt(0)}</span>
            </div>
            <span className="font-light text-lg tracking-wider text-foreground/70 hidden sm:block">{siteConfig.siteName}</span>
          </Link>

          {/* User Info */}
          <div className="flex items-center gap-3">
            {/* User Menu */}
            <div className="flex items-center gap-1">
              {(user.role === 'admin' || user.role === 'moderator') && (
                <Link 
                  href="/admin"
                  className="p-2 hover:bg-foreground/5 rounded-lg transition-colors"
                >
                  <Shield className="w-4 h-4 text-foreground/45" />
                </Link>
              )}
              <button
                className="p-2 hover:bg-foreground/5 rounded-lg transition-colors"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                <LogOut className="w-4 h-4 text-foreground/45" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <nav className="fixed top-14 left-0 bottom-0 w-72 bg-card/85 border-r border-white/[0.06] p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all border border-transparent',
                  pathname === item.href
                    ? 'bg-white/[0.08] text-foreground border-white/[0.06]'
                    : 'text-foreground/60 hover:bg-white/[0.04] hover:text-foreground/65'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm">{item.label}</span>
              </Link>
            ))}
            {(user.role === 'admin' || user.role === 'moderator') && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all border border-transparent',
                  pathname === '/admin'
                    ? 'bg-white/[0.08] text-foreground border-white/[0.06]'
                    : 'text-foreground/60 hover:bg-white/[0.04] hover:text-foreground/65'
                )}
              >
                <Shield className="w-5 h-5" />
                <span className="text-sm">管理面板</span>
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
