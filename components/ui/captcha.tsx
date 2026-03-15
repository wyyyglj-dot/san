'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface CaptchaProps {
  onCaptchaChange: (id: string, code: string) => void;
}

export function Captcha({ onCaptchaChange }: CaptchaProps) {
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 使用 ref 存储回调和状态，完全避免依赖问题
  const callbackRef = useRef(onCaptchaChange);
  const captchaIdRef = useRef('');
  const fetchingRef = useRef(false);
  const mountedRef = useRef(false);
  
  // 更新回调引用
  useEffect(() => {
    callbackRef.current = onCaptchaChange;
  }, [onCaptchaChange]);

  const refreshCaptcha = async () => {
    // 防止并发请求
    if (fetchingRef.current || loading) return;
    fetchingRef.current = true;
    setLoading(true);

    try {
      const data = await apiGet<{ id: string; svg: string }>('/api/captcha', { cache: 'no-store' });

      // 如果组件已卸载，不进行后续操作
      if (!mountedRef.current) return;

      setCaptchaId(data.id);
      captchaIdRef.current = data.id;
      setCaptchaSvg(data.svg);
      setCaptchaCode('');
      callbackRef.current(data.id, '');
    } catch (error) {
      console.error('Failed to load captcha:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  };

  // 组件挂载时加载验证码，卸载时标记为未挂载
  useEffect(() => {
    mountedRef.current = true;

    // 加载验证码
    refreshCaptcha();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCodeChange = (code: string) => {
    setCaptchaCode(code);
    callbackRef.current(captchaIdRef.current, code);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-foreground/45 uppercase tracking-wider">验证码</label>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="请输入验证码"
          value={captchaCode}
          onChange={(e) => handleCodeChange(e.target.value.toUpperCase())}
          maxLength={4}
          required
          className="flex-1 px-4 py-3 bg-input/50 border border-white/[0.06] rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/[0.1] focus:ring-2 focus:ring-ring/30 transition-colors backdrop-blur-sm uppercase tracking-widest"
        />
        <div className="flex items-center gap-2">
          <div
            className="h-[46px] w-[120px] rounded-xl overflow-hidden border border-white/[0.06] cursor-pointer bg-card/65"
            onClick={refreshCaptcha}
            dangerouslySetInnerHTML={{ __html: captchaSvg }}
          />
          <button
            type="button"
            onClick={refreshCaptcha}
            disabled={loading}
            className="p-3 bg-card/40 border border-white/[0.06] rounded-xl hover:bg-card/60 transition-colors disabled:opacity-50"
            title="刷新验证码"
          >
            <RefreshCw className={`w-5 h-5 text-foreground/45 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
