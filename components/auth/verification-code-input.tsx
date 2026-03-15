'use client';

import { useState, useRef, useCallback, KeyboardEvent, ClipboardEvent } from 'react';

interface VerificationCodeInputProps {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
}

export function VerificationCodeInput({
  length = 6,
  onComplete,
  disabled = false,
}: VerificationCodeInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < length) {
      inputsRef.current[index]?.focus();
    }
  }, [length]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;

      const newValues = [...values];
      newValues[index] = value.slice(-1);
      setValues(newValues);

      if (value && index < length - 1) {
        focusInput(index + 1);
      }

      const code = newValues.join('');
      if (code.length === length && newValues.every((v) => v !== '')) {
        onComplete(code);
      }
    },
    [values, length, focusInput, onComplete]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !values[index] && index > 0) {
        focusInput(index - 1);
      }
    },
    [values, focusInput]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (!pasted) return;

      const newValues = [...values];
      for (let i = 0; i < pasted.length; i++) {
        newValues[i] = pasted[i];
      }
      setValues(newValues);
      focusInput(Math.min(pasted.length, length - 1));

      if (pasted.length === length) {
        onComplete(pasted);
      }
    },
    [values, length, focusInput, onComplete]
  );

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={values[i]}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className="w-10 h-12 text-center text-lg font-mono bg-input/50 border border-white/[0.06] rounded-lg text-foreground focus:outline-none focus:border-white/[0.1] focus:ring-2 focus:ring-ring/30 transition-colors disabled:opacity-50"
          aria-label={`验证码第 ${i + 1} 位`}
        />
      ))}
    </div>
  );
}