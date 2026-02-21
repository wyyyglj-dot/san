'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VideoPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/create?mode=video');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-[50vh]">
      <p className="text-foreground/50 text-sm">正在跳转...</p>
    </div>
  );
}
