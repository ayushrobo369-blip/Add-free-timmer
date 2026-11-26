import React, { useEffect, useState } from 'react';
import { Delete, X } from 'lucide-react';
import { keypadDigitsToMs, msToKeypadDigits } from '../utils/time';
import { clampTimerMs, LIMITS, sanitizeLabel } from '../utils/validation';

interface KeypadSheetProps {
  isOpen: boolean;
  initialMs: number;
  initialLabel: string;
  mode: 'edit' | 'create';
  onClose: () => void;
  onConfirm: (durationMs: number, label: string) => void;
}

export function KeypadSheet({
  isOpen,
  initialMs,
  initialLabel,
  mode,
  onClose,
  onConfirm,
}: KeypadSheetProps) {
  const [digits, setDigits] = useState('');
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDigits(mode === 'create' ? '0500' : msToKeypadDigits(initialMs));
      setLabel(initialLabel);
    }
  }, [isOpen, initialMs, initialLabel, mode]);

  if (!isOpen) return null;

  const padded = digits.padStart(6, '0').slice(-6);
  const hh = padded.slice(0, 2);
  const mm = padded.slice(2, 4);
  const ss = padded.slice(4, 6);
  const computedMs = keypadDigitsToMs(digits);

  const pushDigit = (d: string) => {
    const clean = d.replace(/\D/g, '');
    if (!clean) return;
    setDigits((prev) => {
      const next = (prev + clean).replace(/^0+/, '');
      return next.slice(-6);
    });
  };

  const handleBackspace = () => {
    setDigits((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setDigits('');
  };

  const handleQuickAdd = (addSeconds: number) => {
    const nextMs = Math.min(LIMITS.MAX_TIMER_MS, Math.max(0, computedMs + addSeconds * 1000));
    setDigits(msToKeypadDigits(nextMs));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (computedMs < LIMITS.MIN_TIMER_MS) return;
    onConfirm(clampTimerMs(computedMs), sanitizeLabel(label, 'Timer'));
    onClose();
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? 'Create new timer' : 'Edit timer duration'}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-[#191B1F] rounded-t-3xl sm:rounded-3xl border border-[#E5E5E0] dark:border-[#272A30] shadow-2xl overflow-hidden pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-[#D4D4CE] dark:bg-[#353942]" />
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#141517] dark:text-white">
              {mode === 'create' ? 'New Timer' : 'Set Duration'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5E6066] dark:text-[#9CA3AF] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              aria-label="Close duration keypad"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Label input */}
          <div>
            <label htmlFor="timer-label-input" className="sr-only">
              Timer label
            </label>
            <input
              id="timer-label-input"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={32}
              placeholder="Timer label (e.g. Espresso, Focus)"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F5F5F3] dark:bg-[#101113] border border-[#E5E5E0] dark:border-[#272A30] text-sm text-[#141517] dark:text-white placeholder:text-[#888B91] focus:outline-none focus:ring-2 focus:ring-[#E84A27]"
            />
          </div>

          {/* HH:MM:SS Digital Display */}
          <div className="flex items-baseline justify-center gap-2 py-2 border-y border-[#ECECE7] dark:border-[#25282F]">
            <div className="text-center">
              <span className="font-mono-tabular text-4xl font-semibold text-[#141517] dark:text-white">
                {hh}
              </span>
              <span className="text-xs text-[#787B82] ml-0.5">h</span>
            </div>
            <span className="font-mono-tabular text-3xl text-[#A1A3A8]">:</span>
            <div className="text-center">
              <span className="font-mono-tabular text-4xl font-semibold text-[#141517] dark:text-white">
                {mm}
              </span>
              <span className="text-xs text-[#787B82] ml-0.5">m</span>
            </div>
            <span className="font-mono-tabular text-3xl text-[#A1A3A8]">:</span>
            <div className="text-center">
              <span className="font-mono-tabular text-4xl font-semibold text-[#E84A27]">
                {ss}
              </span>
              <span className="text-xs text-[#787B82] ml-0.5">s</span>
            </div>
          </div>

          {/* Quick increment buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '+30s', sec: 30 },
              { label: '+1m', sec: 60 },
              { label: '+5m', sec: 300 },
              { label: 'Clear', sec: -1 },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => (item.sec === -1 ? handleClear() : handleQuickAdd(item.sec))}
                className="min-h-[44px] rounded-xl bg-[#F5F5F3] dark:bg-[#23262C] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] text-xs font-medium text-[#141517] dark:text-[#E5E7EB] transition-colors whitespace-nowrap shrink-0"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {keys.map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => pushDigit(digit)}
                className="min-h-[52px] rounded-2xl bg-[#F5F5F3] dark:bg-[#23262C] active:scale-[0.97] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] font-mono-tabular text-xl font-medium text-[#141517] dark:text-white transition-all"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => pushDigit('00')}
              className="min-h-[52px] rounded-2xl bg-[#F5F5F3] dark:bg-[#23262C] active:scale-[0.97] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] font-mono-tabular text-lg font-medium text-[#141517] dark:text-white transition-all"
            >
              00
            </button>
            <button
              type="button"
              onClick={() => pushDigit('0')}
              className="min-h-[52px] rounded-2xl bg-[#F5F5F3] dark:bg-[#23262C] active:scale-[0.97] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] font-mono-tabular text-xl font-medium text-[#141517] dark:text-white transition-all"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="min-h-[52px] rounded-2xl bg-[#F5F5F3] dark:bg-[#23262C] active:scale-[0.97] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] flex items-center justify-center text-[#5E6066] dark:text-[#9CA3AF] transition-all"
              aria-label="Backspace digit"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <button
            type="submit"
            disabled={computedMs <= 0}
            className="w-full min-h-[48px] rounded-2xl bg-[#E84A27] hover:bg-[#D43E1D] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors active:scale-[0.99] whitespace-nowrap"
          >
            {mode === 'create' ? 'Add Timer' : 'Set Timer'}
          </button>
        </form>
      </div>
    </div>
  );
}
