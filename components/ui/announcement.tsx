'use client';

import { useState, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface Announcement {
  title: string;
  content: string;
  updatedAt: number;
}

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const data = await apiGet<Announcement>('/api/announcement');
        if (data) {
          const dismissedAt = localStorage.getItem('announcement_dismissed_at');
          if (dismissedAt && Number(dismissedAt) >= data.updatedAt) {
            return;
          }
          setAnnouncement(data);
        }
      } catch (err) {
        console.error('Failed to fetch announcement:', err);
      }
    };

    fetchAnnouncement();
  }, []);

  const handleDismiss = () => {
    if (announcement) {
      localStorage.setItem('announcement_dismissed_at', String(announcement.updatedAt));
    }
    setDismissed(true);
  };

  if (!announcement || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-sky-500/10 to-emerald-500/10 border border-white/[0.06] rounded-2xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-sky-500/15 rounded-lg flex items-center justify-center shrink-0">
          <Megaphone className="w-4 h-4 text-sky-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground mb-1">{announcement.title}</h3>
          <div
            className="text-sm text-foreground/55 prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: announcement.content }}
          />
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 text-foreground/40 hover:text-foreground/55 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
