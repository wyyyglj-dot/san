'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedBackgroundProps {
  variant?: 'home' | 'auth';
}

export function AnimatedBackground({ variant = 'home' }: AnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // 检测用户是否偏好减少动画
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // 粒子动画 - 性能优化版
  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationId: number;
    let isVisible = true;
    let particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
    }> = [];

    // 页面不可见时暂停动画
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        lastTime = performance.now();
        animationId = requestAnimationFrame(animate);
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      // 减少粒子数量
      const particleCount = Math.min(Math.floor((window.innerWidth * window.innerHeight) / 30000), 40);
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: Math.random() * 1.5 + 0.5,
          speedX: (Math.random() - 0.5) * 0.2,
          speedY: (Math.random() - 0.5) * 0.2,
          opacity: Math.random() * 0.4 + 0.1,
        });
      }
    };

    let lastTime = 0;
    const targetFPS = 24; // 降低帧率
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      if (!isVisible) return;
      
      animationId = requestAnimationFrame(animate);

      const deltaTime = currentTime - lastTime;
      if (deltaTime < frameInterval) return;
      lastTime = currentTime - (deltaTime % frameInterval);

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // 批量绘制粒子
      particles.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < 0) particle.x = window.innerWidth;
        if (particle.x > window.innerWidth) particle.x = 0;
        if (particle.y < 0) particle.y = window.innerHeight;
        if (particle.y > window.innerHeight) particle.y = 0;

        ctx.globalAlpha = particle.opacity;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    resize();
    requestAnimationFrame(animate);

    // 防抖处理 resize
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 200);
    };

    window.addEventListener('resize', debouncedResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationId);
      clearTimeout(resizeTimeout);
    };
  }, [prefersReducedMotion]);

  // 渐变球样式 - GPU 加速
  const blobStyle = {
    willChange: 'transform',
    backfaceVisibility: 'hidden' as const,
  };

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/70 to-background/95" />

      {/* 渐变球 - 有动画或静态 */}
      {!prefersReducedMotion ? (
        <>
          {/* Glow A */}
          <div 
            className="absolute w-[500px] h-[500px] rounded-full opacity-25 blur-[100px] animate-blob"
            style={{
              ...blobStyle,
              background: 'radial-gradient(circle, hsl(var(--glow-a) / 0.35) 0%, transparent 70%)',
              top: variant === 'home' ? '10%' : '20%',
              left: variant === 'home' ? '10%' : '-10%',
              animationDelay: '0s',
            }}
          />

          {/* Glow B */}
          <div 
            className="absolute w-[400px] h-[400px] rounded-full opacity-20 blur-[80px] animate-blob"
            style={{
              ...blobStyle,
              background: 'radial-gradient(circle, hsl(var(--glow-b) / 0.35) 0%, transparent 70%)',
              top: variant === 'home' ? '50%' : '60%',
              right: variant === 'home' ? '5%' : '-5%',
              animationDelay: '2s',
            }}
          />

          {/* Soft neutral glow */}
          <div 
            className="absolute w-[350px] h-[350px] rounded-full opacity-15 blur-[70px] animate-blob"
            style={{
              ...blobStyle,
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.16) 0%, transparent 70%)',
              bottom: variant === 'home' ? '10%' : '5%',
              left: variant === 'home' ? '30%' : '60%',
              animationDelay: '4s',
            }}
          />
        </>
      ) : (
        <>
          {/* Static glows */}
          <div 
            className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-[100px]"
            style={{
              background: 'radial-gradient(circle, hsl(var(--glow-a) / 0.35) 0%, transparent 70%)',
              top: variant === 'home' ? '10%' : '20%',
              left: variant === 'home' ? '10%' : '-10%',
            }}
          />
          <div 
            className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-[80px]"
            style={{
              background: 'radial-gradient(circle, hsl(var(--glow-b) / 0.35) 0%, transparent 70%)',
              top: variant === 'home' ? '50%' : '60%',
              right: variant === 'home' ? '5%' : '-5%',
            }}
          />
        </>
      )}

      {/* 粒子画布 - 仅非减少动画模式 */}
      {!prefersReducedMotion && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 opacity-50"
        />
      )}

      {/* Top halo */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20"
        style={{
          background: 'radial-gradient(ellipse at center top, rgba(255,255,255,0.18) 0%, transparent 60%)',
        }}
      />

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
