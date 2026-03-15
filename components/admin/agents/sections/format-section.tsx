'use client';

import { Textarea } from '@/components/ui/textarea';

interface FormatSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export function FormatSection({ value, onChange }: FormatSectionProps) {
  return (
    <div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="描述期望的输出格式..."
        rows={4}
      />
    </div>
  );
}
