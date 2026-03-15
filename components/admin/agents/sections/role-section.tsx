'use client';

import { Textarea } from '@/components/ui/textarea';

interface RoleSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export function RoleSection({ value, onChange }: RoleSectionProps) {
  return (
    <div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="描述 Agent 的角色和职责..."
        rows={4}
      />
    </div>
  );
}
