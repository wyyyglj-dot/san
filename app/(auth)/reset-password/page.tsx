'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Loader2, ArrowRight, ArrowLeft, Sparkles, Mail, KeyRound } from 'lucide-react';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { useSiteConfig } from '@/components/providers/site-config-provider';
import { VerificationCodeInput } from '@/components/auth/verification-code-input';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { status } = useSession();
  const siteConfig = useSiteConfig();
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [step, setStep] = useState<'email' | 'verify' | 'password' | 'done'>('email');

  useEffect(() => {
    if (status === 'authenticated') router.replace('/image');
  }, [status, router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const sendCode = useCallback(async () => {
    setSendingCode(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'reset' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');
      setCountdown(60);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  }, [email]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }
    await sendCode();
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('密码至少需要 6 个字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }
    if (!verificationCode || verificationCode.length !== 6) {
      setError('请输入6位验证码');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, verificationCode, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '重置失败');
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : '密码重置失败');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground/50">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden text-foreground">
      <AnimatedBackground variant="auth" />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-4 animate-rise">
            <Link href="/" className="inline-block group">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-sky-500/25 to-emerald-500/25 border border-white/[0.06] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles className="w-5 h-5 text-foreground/65" />
                </div>
              </div>
              <h1 className="text-3xl font-light tracking-wider text-foreground">{siteConfig.siteName}</h1>
            </Link>
            <p className="text-foreground/40 text-sm">
              {step === 'done' ? '密码已重置' : '找回密码'}
            </p>
          </div>

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/50 uppercase tracking-wider">注册邮箱</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-input/50 border border-white/[0.06] rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/[0.1] focus:ring-2 focus:ring-ring/30 transition-colors text-sm"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={sendingCode}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {sendingCode ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />发送验证码...</>
                ) : (
                  <><Mail className="w-4 h-4" />发送验证码</>
                )}
              </button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={(e) => { e.preventDefault(); setStep('password'); }} className="space-y-5">
              <div className="flex items-center justify-center gap-2 py-3 px-5 bg-sky-500/10 border border-white/[0.06] rounded-lg">
                <Mail className="w-4 h-4 text-sky-300 shrink-0" />
                <span className="text-sm text-foreground/60">验证码已发送至 <span className="text-foreground/80">{email}</span></span>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-foreground/50 uppercase tracking-wider text-center block">邮箱验证码</label>
                <VerificationCodeInput
                  onComplete={(code) => setVerificationCode(code)}
                />
              </div>

              <button
                type="button"
                onClick={sendCode}
                disabled={sendingCode || countdown > 0}
                className="w-full text-sm text-foreground/50 hover:text-foreground/70 transition-colors disabled:opacity-40"
              >
                {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s 后可重新发送` : '重新发送验证码'}
              </button>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); }}
                  className="flex items-center justify-center gap-1 px-4 py-3.5 border border-white/[0.06] rounded-full text-foreground/60 hover:text-foreground transition-colors text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />返回
                </button>
                <button
                  type="submit"
                  disabled={verificationCode.length !== 6}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  下一步<ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/50 uppercase tracking-wider">新密码</label>
                <input
                  type="password"
                  placeholder="至少 6 个字符"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-input/50 border border-white/[0.06] rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/[0.1] focus:ring-2 focus:ring-ring/30 transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/50 uppercase tracking-wider">确认新密码</label>
                <input
                  type="password"
                  placeholder="再次输入新密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-input/50 border border-white/[0.06] rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/[0.1] focus:ring-2 focus:ring-ring/30 transition-colors text-sm"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep('verify'); setError(''); }}
                  className="flex items-center justify-center gap-1 px-4 py-3.5 border border-white/[0.06] rounded-full text-foreground/60 hover:text-foreground transition-colors text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />返回
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />重置中...</>
                  ) : (
                    <><KeyRound className="w-4 h-4" />重置密码</>
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <p className="text-sm text-emerald-300">密码已成功重置，请使用新密码登录</p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-all hover:scale-[1.02]"
              >
                前往登录<ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {step !== 'done' && (
            <div className="text-center text-sm">
              <span className="text-foreground/40">想起密码了？</span>{' '}
              <Link href="/login" className="text-foreground/65 hover:text-foreground transition-colors">
                返回登录
              </Link>
            </div>
          )}
        </div>
      </main>

      <footer className="relative z-10 py-6 text-center">
        <p className="text-xs text-foreground/30">{siteConfig.copyright}</p>
      </footer>
    </div>
  );
}
