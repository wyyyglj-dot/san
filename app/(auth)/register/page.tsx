'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowRight, ArrowLeft, Gift, Sparkles, Mail } from 'lucide-react';
import { Captcha } from '@/components/ui/captcha';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { useSiteConfig } from '@/components/providers/site-config-provider';
import { VerificationCodeInput } from '@/components/auth/verification-code-input';

export default function RegisterPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const siteConfig = useSiteConfig();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  // step: 'form' = basic info, 'verify' = email verification code
  const [step, setStep] = useState<'form' | 'verify'>('form');

  const defaultBalance = siteConfig.defaultBalance;
  const smtpEnabled = siteConfig.smtpEnabled;

  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.replace('/image');
    }
  }, [status, session, router]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleCaptchaChange = useCallback((id: string, code: string) => {
    setCaptchaId(id);
    setCaptchaCode(code);
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground/50">加载中...</div>
      </div>
    );
  }

  if (status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground/50">正在跳转...</div>
      </div>
    );
  }

  const validateForm = () => {
    if (password !== confirmPassword) {
      setError('两次密码输入不一致');
      return false;
    }
    if (password.length < 6) {
      setError('密码至少需要 6 个字符');
      return false;
    }
    if (!captchaCode || captchaCode.length !== 4) {
      setError('请输入4位验证码');
      return false;
    }
    return true;
  };

  const verifyCaptcha = async () => {
    const captchaRes = await fetch('/api/captcha/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: captchaId, code: captchaCode }),
    });
    const captchaData = await captchaRes.json();
    if (!captchaData.success) {
      setError('验证码错误');
      handleCaptchaChange('', '');
      return false;
    }
    return true;
  };

  const sendVerificationCode = async () => {
    setSendingCode(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'register' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发送失败');
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  };

  // Step 1 submit: validate form, verify captcha, then either send code or register directly
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (!(await verifyCaptcha())) return;

      if (smtpEnabled) {
        // Send verification code and move to step 2
        await sendVerificationCode();
        setStep('verify');
      } else {
        // No SMTP, register directly
        await doRegister();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const doRegister = async (code?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password,
        ...(code ? { verificationCode: code } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '注册失败');
    router.push('/login?registered=true');
  };

  // Step 2 submit: verify email code and register
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!verificationCode || verificationCode.length !== 6) {
      setError('请输入6位邮箱验证码');
      return;
    }
    setLoading(true);
    try {
      await doRegister(verificationCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden text-foreground">
      <AnimatedBackground variant="auth" />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-sm space-y-6">
          {/* Logo */}
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
              {step === 'form' ? '创建账号，开启创作之旅' : '验证您的邮箱'}
            </p>
          </div>

          {/* Bonus hint */}
          {step === 'form' && (
            <div className="flex items-center justify-center gap-2 py-2.5 px-5 bg-gradient-to-r from-sky-500/10 to-emerald-500/10 border border-white/[0.06] rounded-full mx-auto w-fit backdrop-blur-sm">
              <Gift className="w-4 h-4 text-sky-300" />
              <span className="text-sm text-foreground/55">新用户赠送 <span className="text-foreground font-medium">{defaultBalance}</span> 积分</span>
            </div>
          )}

          {step === 'form' ? (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/50 uppercase tracking-wider">昵称</label>
                <input
                  type="text"
                  placeholder="您的昵称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-input/50 border border-white/[0.06] rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/[0.1] focus:ring-2 focus:ring-ring/30 transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/50 uppercase tracking-wider">邮箱</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-input/50 border border-white/[0.06] rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/[0.1] focus:ring-2 focus:ring-ring/30 transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/50 uppercase tracking-wider">密码</label>
                <input
                  type="password"
                  placeholder="至少 6 个字符"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-input/50 border border-white/[0.06] rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/[0.1] focus:ring-2 focus:ring-ring/30 transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-foreground/50 uppercase tracking-wider">确认密码</label>
                <input
                  type="password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-input/50 border border-white/[0.06] rounded-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/[0.1] focus:ring-2 focus:ring-ring/30 transition-colors text-sm"
                />
              </div>

              <Captcha onCaptchaChange={handleCaptchaChange} />

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {smtpEnabled ? '发送验证码...' : '注册中...'}
                  </>
                ) : (
                  <>
                    {smtpEnabled ? '下一步' : '创建账号'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifySubmit} className="space-y-5">
              <div className="flex items-center justify-center gap-2 py-3 px-5 bg-sky-500/10 border border-white/[0.06] rounded-lg">
                <Mail className="w-4 h-4 text-sky-300 shrink-0" />
                <span className="text-sm text-foreground/60">验证码已发送至 <span className="text-foreground/80">{email}</span></span>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-foreground/50 uppercase tracking-wider text-center block">邮箱验证码</label>
                <VerificationCodeInput
                  onComplete={(code) => setVerificationCode(code)}
                  disabled={loading}
                />
              </div>

              <button
                type="button"
                onClick={sendVerificationCode}
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
                  onClick={() => { setStep('form'); setError(''); setVerificationCode(''); }}
                  className="flex items-center justify-center gap-1 px-4 py-3.5 border border-white/[0.06] rounded-full text-foreground/60 hover:text-foreground transition-colors text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  返回
                </button>
                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      注册中...
                    </>
                  ) : (
                    <>
                      创建账号
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="text-center text-sm">
            <span className="text-foreground/40">已有账号？</span>{' '}
            <Link href="/login" className="text-foreground/65 hover:text-foreground transition-colors">
              立即登录
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-6 text-center">
        <p className="text-xs text-foreground/30">{siteConfig.copyright}</p>
      </footer>
    </div>
  );
}