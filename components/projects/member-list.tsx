'use client';

import { Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProjectMember } from '@/lib/db-comic';
import { formatTimestamp } from '@/lib/date-utils';

interface MemberListProps {
  members: ProjectMember[];
  isOwner?: boolean;
  onRemove?: (userId: string) => void;
}

export function MemberList({ members, isOwner, onRemove }: MemberListProps) {
  if (!members || members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-card/40 rounded-full flex items-center justify-center mb-4 border border-white/[0.06]">
          <User className="w-8 h-8 text-foreground/30" />
        </div>
        <h3 className="text-lg font-medium text-foreground">暂无成员</h3>
        <p className="text-foreground/40 mt-1 max-w-sm">
          邀请团队成员一起协作创作漫剧作品
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/[0.05]">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center justify-between p-4 hover:bg-card/40 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-accent/50 flex items-center justify-center overflow-hidden">
              <User className="w-5 h-5 text-foreground/60" />
            </div>
            <div>
              <div className="font-medium text-foreground">{member.userId}</div>
              <div className="text-xs text-foreground/40">
                加入于 {formatTimestamp(member.createdAt)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs bg-accent/50 px-2 py-1 rounded text-foreground/55">
              {member.role}
            </span>
            {isOwner && (
              <Button
                variant="ghost"
                size="icon"
                className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                onClick={() => onRemove?.(member.userId)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
