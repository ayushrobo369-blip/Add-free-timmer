import React from 'react';
import {
  BellOff,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { PresetDuration, TimerItem } from '../types/timer';
import { formatDuration, formatDurationReadable } from '../utils/time';
import { TimerDial } from './TimerDial';

interface TimerViewProps {
  timers: TimerItem[];
  activeTimerId: string;
  presets: PresetDuration[];
  onSelectTimer: (id: string) => void;
  onStartPause: (id: string) => void;
  onReset: (id: string) => void;
  onAdjustTime: (id: string, deltaMs: number) => void;
  onScrubMinutes: (id: string, newTotalMs: number) => void;
  onDismissCompleted: (id: string) => void;
  onSnoozeCompleted: (id: string, extraMs: number) => void;
  onDeleteTimer: (id: string) => void;
  onApplyPreset: (seconds: number, label: string) => void;
  onOpenEditModal: () => void;
  onOpenCreateModal: () => void;
}

export function TimerView({
  timers,
  activeTimerId,
  presets,
  onSelectTimer,
  onStartPause,
  onReset,
  onAdjustTime,
  onScrubMinutes,
  onDismissCompleted,
  onSnoozeCompleted,
  onDeleteTimer,
  onApplyPreset,
  onOpenEditModal,
  onOpenCreateModal,
}: TimerViewProps) {
  const activeTimer = timers.find((t) => t.id === activeTimerId) || timers[0];
  const completedTimers = timers.filter((t) => t.status === 'completed');

  if (!activeTimer) return null;

  const isRunning = activeTimer.status === 'running';
  const isCompleted = activeTimer.status === 'completed';
  const canReset =
    activeTimer.status !== 'idle' || activeTimer.remainingMs !== activeTimer.totalMs;

  return (
    <div className="space-y-6">
      {/* Completion Alert Banner */}
      {completedTimers.length > 0 && (
        <div
          role="alert"
          className="rounded-2xl bg-[#141517] dark:bg-white text-white dark:text-[#141517] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {completedTimers[0].label} finished
            </p>
            <p className="text-xs opacity-75">
              {formatDurationReadable(completedTimers[0].totalMs)} timer complete
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onSnoozeCompleted(completedTimers[0].id, 60_000)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white/15 dark:bg-black/10 hover:bg-white/25 dark:hover:bg-black/20 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            >
              +1 min
            </button>
            <button
              type="button"
              onClick={() => onDismissCompleted(completedTimers[0].id)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#E84A27] hover:bg-[#D43E1D] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <BellOff className="w-4 h-4" />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Primary Dial Column */}
        <section className="lg:col-span-7 bg-white dark:bg-[#191B1F] rounded-3xl border border-[#E5E5E0] dark:border-[#272A30] p-5 sm:p-8 flex flex-col items-center">
          <TimerDial
            label={activeTimer.label}
            totalMs={activeTimer.totalMs}
            remainingMs={activeTimer.remainingMs}
            status={activeTimer.status}
            targetEndTime={activeTimer.targetEndTime}
            onEditTime={onOpenEditModal}
            onScrubMinutes={(newMs) => onScrubMinutes(activeTimer.id, newMs)}
          />

          {/* Fine-tune increment controls */}
          <div className="w-full max-w-sm mt-5 grid grid-cols-4 gap-2">
            {[
              { label: '-1m', delta: -60_000 },
              { label: '+30s', delta: 30_000 },
              { label: '+1m', delta: 60_000 },
              { label: '+5m', delta: 300_000 },
            ].map((btn) => (
              <button
                key={btn.label}
                type="button"
                onClick={() => onAdjustTime(activeTimer.id, btn.delta)}
                className="min-h-[44px] rounded-xl bg-[#F5F5F3] dark:bg-[#23262C] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] active:scale-[0.97] text-xs font-mono-tabular font-medium text-[#141517] dark:text-[#E5E7EB] transition-all whitespace-nowrap shrink-0"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Primary Thumb-Zone Transport Controls */}
          <div className="w-full max-w-sm mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onReset(activeTimer.id)}
              disabled={!canReset}
              aria-label="Reset timer"
              className="min-h-[52px] min-w-[52px] px-4 rounded-2xl bg-[#F5F5F3] dark:bg-[#23262C] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] disabled:opacity-35 disabled:cursor-not-allowed text-[#141517] dark:text-white flex items-center justify-center transition-colors active:scale-[0.97] shrink-0"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() =>
                isCompleted
                  ? onDismissCompleted(activeTimer.id)
                  : onStartPause(activeTimer.id)
              }
              className={`flex-1 min-h-[52px] px-6 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap ${
                isRunning
                  ? 'bg-[#141517] dark:bg-white text-white dark:text-[#141517] hover:opacity-90'
                  : 'bg-[#E84A27] hover:bg-[#D43E1D] text-white shadow-sm'
              }`}
            >
              {isCompleted ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </>
              ) : isRunning ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>{activeTimer.status === 'paused' ? 'Resume' : 'Start'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenCreateModal}
              aria-label="Add another timer"
              className="min-h-[52px] min-w-[52px] px-4 rounded-2xl bg-[#F5F5F3] dark:bg-[#23262C] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] text-[#141517] dark:text-white flex items-center justify-center transition-colors active:scale-[0.97] shrink-0"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </section>

        {/* Secondary Column: Multi-Timers & Quick Presets */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Timers List */}
          <section className="bg-white dark:bg-[#191B1F] rounded-3xl border border-[#E5E5E0] dark:border-[#272A30] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#141517] dark:text-white">
                Timers
              </h2>
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium text-[#E84A27] hover:bg-[#E84A27]/10 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Timer</span>
              </button>
            </div>

            <div className="divide-y divide-[#EFEFEA] dark:divide-[#25282F]">
              {timers.map((timer) => {
                const isSelected = timer.id === activeTimer.id;
                const running = timer.status === 'running';
                const done = timer.status === 'completed';

                return (
                  <div
                    key={timer.id}
                    className={`py-2.5 flex items-center justify-between gap-3 rounded-xl px-2 -mx-2 transition-colors ${
                      isSelected ? 'bg-[#F5F5F3] dark:bg-[#23262C]' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTimer(timer.id)}
                      className="flex-1 min-w-0 text-left py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E84A27] rounded-lg"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-[#141517] dark:text-white truncate">
                          {timer.label}
                        </span>
                        <span
                          className={`font-mono-tabular text-base font-semibold shrink-0 ${
                            done
                              ? 'text-[#16A34A] dark:text-[#4ADE80]'
                              : running
                              ? 'text-[#E84A27]'
                              : 'text-[#141517] dark:text-[#E5E7EB]'
                          }`}
                        >
                          {formatDuration(timer.remainingMs)}
                        </span>
                      </div>
                      <p className="text-xs text-[#6E7077] dark:text-[#8E95A2] mt-0.5">
                        {formatDurationReadable(timer.totalMs)}
                        <span aria-hidden="true"> · </span>
                        <span className="capitalize">{timer.status}</span>
                      </p>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          done ? onDismissCompleted(timer.id) : onStartPause(timer.id)
                        }
                        aria-label={running ? `Pause ${timer.label}` : `Start ${timer.label}`}
                        className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-black/[0.05] dark:hover:bg-white/[0.07] flex items-center justify-center text-[#141517] dark:text-white transition-colors"
                      >
                        {running ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : done ? (
                          <RotateCcw className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 fill-current" />
                        )}
                      </button>
                      {timers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteTimer(timer.id)}
                          aria-label={`Delete ${timer.label}`}
                          className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-red-500/10 text-[#787B82] hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Quick Presets */}
          <section className="bg-white dark:bg-[#191B1F] rounded-3xl border border-[#E5E5E0] dark:border-[#272A30] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#141517] dark:text-white">
                Quick Presets
              </h2>
              <span className="text-xs text-[#6E7077] dark:text-[#8E95A2]">
                Tap to load
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyPreset(preset.seconds, preset.label)}
                  className="min-h-[52px] px-3.5 py-2.5 rounded-2xl bg-[#F5F5F3] dark:bg-[#23262C] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] active:scale-[0.98] text-left transition-all flex flex-col justify-center"
                >
                  <span className="font-mono-tabular text-sm font-semibold text-[#141517] dark:text-white">
                    {formatDurationReadable(preset.seconds * 1000)}
                  </span>
                  <span className="text-xs text-[#6E7077] dark:text-[#8E95A2] truncate">
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
