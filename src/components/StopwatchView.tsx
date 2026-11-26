import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookmarkPlus, Flag, Pause, Play, RotateCcw } from 'lucide-react';
import { LapEntry } from '../types/timer';
import { triggerHaptic } from '../utils/audio';
import { formatStopwatch } from '../utils/time';

interface StopwatchViewProps {
  hapticsEnabled: boolean;
  onSaveRun: (durationMs: number, lapCount: number) => void;
}

export function StopwatchView({ hapticsEnabled, onSaveRun }: StopwatchViewProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [laps, setLaps] = useState<LapEntry[]>([]);
  const [savedNotice, setSavedNotice] = useState(false);

  const accumulatedRef = useRef(0);
  const startPerfRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      return;
    }

    startPerfRef.current = performance.now();

    const tick = () => {
      if (startPerfRef.current !== null) {
        setElapsedMs(accumulatedRef.current + (performance.now() - startPerfRef.current));
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning]);

  const handleToggle = () => {
    triggerHaptic(hapticsEnabled, 12);
    setSavedNotice(false);
    if (isRunning) {
      if (startPerfRef.current !== null) {
        accumulatedRef.current += performance.now() - startPerfRef.current;
        setElapsedMs(accumulatedRef.current);
      }
      startPerfRef.current = null;
      setIsRunning(false);
    } else {
      setIsRunning(true);
    }
  };

  const handleLap = () => {
    if (!isRunning && elapsedMs === 0) return;
    triggerHaptic(hapticsEnabled, 10);
    const prevTotal = laps.length > 0 ? laps[0].totalMs : 0;
    const splitMs = Math.max(0, elapsedMs - prevTotal);
    const nextLap: LapEntry = {
      id: `lap-${Date.now()}-${laps.length + 1}`,
      lapNumber: laps.length + 1,
      splitMs,
      totalMs: elapsedMs,
    };
    setLaps((prev) => [nextLap, ...prev]);
  };

  const handleReset = () => {
    triggerHaptic(hapticsEnabled, 15);
    setIsRunning(false);
    accumulatedRef.current = 0;
    startPerfRef.current = null;
    setElapsedMs(0);
    setLaps([]);
    setSavedNotice(false);
  };

  const handleSave = () => {
    if (elapsedMs <= 0) return;
    onSaveRun(elapsedMs, laps.length);
    triggerHaptic(hapticsEnabled, [10, 40, 10]);
    setSavedNotice(true);
  };

  const currentLapMs = useMemo(() => {
    const prevTotal = laps.length > 0 ? laps[0].totalMs : 0;
    return Math.max(0, elapsedMs - prevTotal);
  }, [elapsedMs, laps]);

  const { fastestId, slowestId } = useMemo(() => {
    if (laps.length < 2) return { fastestId: null, slowestId: null };
    let fast = laps[0];
    let slow = laps[0];
    for (const lap of laps) {
      if (lap.splitMs < fast.splitMs) fast = lap;
      if (lap.splitMs > slow.splitMs) slow = lap;
    }
    return { fastestId: fast.id, slowestId: slow.id };
  }, [laps]);

  const formattedTotal = formatStopwatch(elapsedMs);
  const formattedLap = formatStopwatch(currentLapMs);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Stopwatch Display */}
      <section className="lg:col-span-7 bg-white dark:bg-[#191B1F] rounded-3xl border border-[#E5E5E0] dark:border-[#272A30] p-6 sm:p-10 flex flex-col items-center">
        <div className="w-full flex items-center justify-between text-xs text-[#6E7077] dark:text-[#8E95A2] mb-6">
          <span>Stopwatch</span>
          <span>
            {laps.length === 0
              ? 'No laps recorded'
              : `${laps.length} ${laps.length === 1 ? 'lap' : 'laps'}`}
          </span>
        </div>

        {/* High-legibility tabular readout */}
        <div className="py-8 sm:py-12 text-center select-none">
          <div className="font-mono-tabular font-semibold tracking-tight text-[#141517] dark:text-white leading-none flex items-baseline justify-center">
            <span className="text-[3.5rem] sm:text-[4.75rem]">{formattedTotal.main}</span>
            <span className="text-[2rem] sm:text-[2.5rem] text-[#E84A27] ml-1">
              .{formattedTotal.centis}
            </span>
          </div>

          <div className="mt-4 text-sm text-[#6E7077] dark:text-[#8E95A2] font-mono-tabular">
            <span>Current lap </span>
            <span className="text-[#141517] dark:text-[#E5E7EB] font-medium">
              {formattedLap.main}.{formattedLap.centis}
            </span>
          </div>
        </div>

        {/* Thumb-zone action controls */}
        <div className="w-full max-w-sm mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={isRunning ? handleLap : handleReset}
            disabled={!isRunning && elapsedMs === 0}
            className="min-h-[52px] px-5 rounded-2xl bg-[#F5F5F3] dark:bg-[#23262C] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] disabled:opacity-35 disabled:cursor-not-allowed text-[#141517] dark:text-white text-sm font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.97] whitespace-nowrap shrink-0"
          >
            {isRunning ? (
              <>
                <Flag className="w-4 h-4" />
                <span>Lap</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleToggle}
            className={`flex-1 min-h-[52px] px-6 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap ${
              isRunning
                ? 'bg-[#141517] dark:bg-white text-white dark:text-[#141517] hover:opacity-90'
                : 'bg-[#E84A27] hover:bg-[#D43E1D] text-white shadow-sm'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{elapsedMs > 0 ? 'Resume' : 'Start'}</span>
              </>
            )}
          </button>
        </div>

        {!isRunning && elapsedMs > 0 && (
          <button
            type="button"
            onClick={handleSave}
            disabled={savedNotice}
            className="mt-4 min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-[#5E6066] dark:text-[#9CA3AF] hover:text-[#141517] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05] flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <BookmarkPlus className="w-4 h-4" />
            <span>{savedNotice ? 'Saved to History' : 'Save run to History'}</span>
          </button>
        )}
      </section>

      {/* Lap Splits Column */}
      <section className="lg:col-span-5 bg-white dark:bg-[#191B1F] rounded-3xl border border-[#E5E5E0] dark:border-[#272A30] p-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#EFEFEA] dark:border-[#25282F]">
          <h2 className="text-sm font-semibold text-[#141517] dark:text-white">
            Lap Splits
          </h2>
          <span className="text-xs text-[#6E7077] dark:text-[#8E95A2]">
            Split · Total
          </span>
        </div>

        {laps.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[#6E7077] dark:text-[#8E95A2]">
              Start the stopwatch and tap Lap to record splits.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EFEFEA] dark:divide-[#25282F] max-h-[380px] overflow-y-auto">
            {laps.map((lap) => {
              const split = formatStopwatch(lap.splitMs);
              const total = formatStopwatch(lap.totalMs);
              const isFastest = lap.id === fastestId;
              const isSlowest = lap.id === slowestId;

              return (
                <div
                  key={lap.id}
                  className="py-3 flex items-center justify-between gap-4 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono-tabular text-xs font-medium text-[#6E7077] dark:text-[#8E95A2] w-12 shrink-0">
                      Lap {String(lap.lapNumber).padStart(2, '0')}
                    </span>
                    {isFastest && (
                      <span className="text-xs font-medium text-[#16A34A] dark:text-[#4ADE80]">
                        Fastest
                      </span>
                    )}
                    {isSlowest && (
                      <span className="text-xs font-medium text-[#E84A27]">
                        Slowest
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-4 font-mono-tabular shrink-0">
                    <span
                      className={`font-semibold ${
                        isFastest
                          ? 'text-[#16A34A] dark:text-[#4ADE80]'
                          : isSlowest
                          ? 'text-[#E84A27]'
                          : 'text-[#141517] dark:text-white'
                      }`}
                    >
                      {split.main}.{split.centis}
                    </span>
                    <span className="text-xs text-[#6E7077] dark:text-[#8E95A2]">
                      {total.main}.{total.centis}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
