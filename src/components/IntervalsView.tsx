import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react';
import { IntervalPhaseType, IntervalRoutine, SoundProfile } from '../types/timer';
import { playPhaseCue, primeAudioContext, triggerHaptic } from '../utils/audio';
import { formatDuration, formatDurationReadable } from '../utils/time';
import { clampInt, LIMITS, sanitizeLabel } from '../utils/validation';

interface IntervalsViewProps {
  routines: IntervalRoutine[];
  soundProfile: SoundProfile;
  hapticsEnabled: boolean;
  onAddRoutine: (routine: IntervalRoutine) => void;
  onDeleteRoutine: (id: string) => void;
  onCompleteRoutine: (routine: IntervalRoutine, totalMs: number) => void;
}

interface PhaseStep {
  type: IntervalPhaseType;
  label: string;
  durationSec: number;
  round: number;
}

function buildSteps(routine: IntervalRoutine): PhaseStep[] {
  const steps: PhaseStep[] = [];
  const prepSec = clampInt(routine.prepSeconds, LIMITS.MIN_PREP_SEC, LIMITS.MAX_PREP_SEC, 0);
  const workSec = clampInt(routine.workSeconds, LIMITS.MIN_WORK_SEC, LIMITS.MAX_WORK_SEC, 20);
  const restSec = clampInt(routine.restSeconds, LIMITS.MIN_REST_SEC, LIMITS.MAX_REST_SEC, 10);
  const safeRounds = clampInt(routine.rounds, LIMITS.MIN_ROUNDS, LIMITS.MAX_ROUNDS, 1);

  if (prepSec > 0) {
    steps.push({
      type: 'prep',
      label: 'Get Ready',
      durationSec: prepSec,
      round: 1,
    });
  }
  for (let r = 1; r <= safeRounds; r++) {
    steps.push({
      type: 'work',
      label: 'Work',
      durationSec: workSec,
      round: r,
    });
    if (restSec > 0 && r < safeRounds) {
      steps.push({
        type: 'rest',
        label: 'Rest',
        durationSec: restSec,
        round: r,
      });
    }
  }
  return steps;
}

export function IntervalsView({
  routines,
  soundProfile,
  hapticsEnabled,
  onAddRoutine,
  onDeleteRoutine,
  onCompleteRoutine,
}: IntervalsViewProps) {
  const [selectedId, setSelectedId] = useState<string>(routines[0]?.id || '');
  const selectedRoutine = useMemo(
    () => routines.find((r) => r.id === selectedId) || routines[0],
    [routines, selectedId]
  );

  const steps = useMemo(
    () => (selectedRoutine ? buildSteps(selectedRoutine) : []),
    [selectedRoutine]
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(() =>
    steps[0] ? steps[0].durationSec * 1000 : 0
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Create Routine Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWork, setNewWork] = useState(40);
  const [newRest, setNewRest] = useState(20);
  const [newPrep, setNewPrep] = useState(5);
  const [newRounds, setNewRounds] = useState(6);

  const endTimestampRef = useRef<number | null>(null);

  // Reset when switching routine
  const selectRoutine = (id: string) => {
    const nextRoutine = routines.find((r) => r.id === id);
    if (!nextRoutine) return;
    const nextSteps = buildSteps(nextRoutine);
    setSelectedId(id);
    setIsRunning(false);
    setIsCompleted(false);
    setStepIndex(0);
    setRemainingMs(nextSteps[0] ? nextSteps[0].durationSec * 1000 : 0);
    endTimestampRef.current = null;
  };

  useEffect(() => {
    if (!isRunning || steps.length === 0) return;

    endTimestampRef.current = Date.now() + remainingMs;

    const interval = window.setInterval(() => {
      if (endTimestampRef.current === null) return;
      const diff = endTimestampRef.current - Date.now();
      if (diff <= 0) {
        if (stepIndex + 1 < steps.length) {
          const nextIdx = stepIndex + 1;
          const nextStep = steps[nextIdx];
          const nextMs = nextStep.durationSec * 1000;
          endTimestampRef.current = Date.now() + nextMs;
          setStepIndex(nextIdx);
          setRemainingMs(nextMs);
          playPhaseCue(nextStep.type === 'work' ? 'work' : 'rest', soundProfile);
          triggerHaptic(hapticsEnabled, [20, 40, 20]);
        } else {
          setIsRunning(false);
          setIsCompleted(true);
          setRemainingMs(0);
          endTimestampRef.current = null;
          playPhaseCue('complete', soundProfile);
          triggerHaptic(hapticsEnabled, [40, 60, 40, 60, 80]);
          if (selectedRoutine) {
            const totalMs =
              steps.reduce((acc, s) => acc + s.durationSec, 0) * 1000;
            onCompleteRoutine(selectedRoutine, totalMs);
          }
        }
      } else {
        setRemainingMs(diff);
      }
    }, 80);

    return () => window.clearInterval(interval);
  }, [isRunning, stepIndex, steps, soundProfile, hapticsEnabled, selectedRoutine, onCompleteRoutine]);

  const currentStep = steps[stepIndex];
  const nextStep = steps[stepIndex + 1];

  const handleToggle = () => {
    primeAudioContext();
    triggerHaptic(hapticsEnabled, 12);
    if (isCompleted) {
      handleReset();
      return;
    }
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    triggerHaptic(hapticsEnabled, 12);
    setIsRunning(false);
    setIsCompleted(false);
    setStepIndex(0);
    setRemainingMs(steps[0] ? steps[0].durationSec * 1000 : 0);
    endTimestampRef.current = null;
  };

  const handleJumpStep = (delta: number) => {
    const targetIdx = Math.max(0, Math.min(steps.length - 1, stepIndex + delta));
    const targetStep = steps[targetIdx];
    if (!targetStep) return;
    triggerHaptic(hapticsEnabled, 10);
    const nextMs = targetStep.durationSec * 1000;
    setStepIndex(targetIdx);
    setRemainingMs(nextMs);
    setIsCompleted(false);
    if (isRunning) {
      endTimestampRef.current = Date.now() + nextMs;
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const routine: IntervalRoutine = {
      id: `routine-${Date.now()}`,
      name: sanitizeLabel(newName, 'Custom Routine'),
      prepSeconds: clampInt(newPrep, LIMITS.MIN_PREP_SEC, LIMITS.MAX_PREP_SEC, 5),
      workSeconds: clampInt(newWork, LIMITS.MIN_WORK_SEC, LIMITS.MAX_WORK_SEC, 40),
      restSeconds: clampInt(newRest, LIMITS.MIN_REST_SEC, LIMITS.MAX_REST_SEC, 20),
      rounds: clampInt(newRounds, LIMITS.MIN_ROUNDS, LIMITS.MAX_ROUNDS, 6),
      category: 'Custom',
    };
    onAddRoutine(routine);
    setShowCreateModal(false);
    setNewName('');
    setSelectedId(routine.id);
    const nextSteps = buildSteps(routine);
    setIsRunning(false);
    setIsCompleted(false);
    setStepIndex(0);
    setRemainingMs(nextSteps[0] ? nextSteps[0].durationSec * 1000 : 0);
  };

  if (!selectedRoutine || !currentStep) return null;

  const stepTotalMs = currentStep.durationSec * 1000;
  const progress = stepTotalMs > 0 ? Math.max(0, Math.min(1, remainingMs / stepTotalMs)) : 0;
  const radius = 112;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const phaseStrokeColor = isCompleted
    ? '#16A34A'
    : currentStep.type === 'work'
    ? '#E84A27'
    : currentStep.type === 'rest'
    ? '#0F766E'
    : '#6E7077';

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Active Interval Runner */}
        <section className="lg:col-span-7 bg-white dark:bg-[#191B1F] rounded-3xl border border-[#E5E5E0] dark:border-[#272A30] p-5 sm:p-8 flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-xs text-[#6E7077] dark:text-[#8E95A2] mb-4">
            <span className="font-medium text-[#141517] dark:text-white truncate">
              {selectedRoutine.name}
            </span>
            <span className="shrink-0 font-mono-tabular">
              Round {currentStep.round} of {selectedRoutine.rounds}
            </span>
          </div>

          {/* Phase Dial */}
          <div className="relative w-full max-w-[270px] aspect-square flex items-center justify-center my-2">
            <svg viewBox="0 0 260 260" className="w-full h-full">
              <circle
                cx={130}
                cy={130}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={8}
                className="text-[#E6E6E1] dark:text-[#23262C]"
              />
              <circle
                cx={130}
                cy={130}
                r={radius}
                fill="none"
                stroke={phaseStrokeColor}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 130 130)"
                className="transition-[stroke-dashoffset] duration-100 ease-linear"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <span
                className="text-xs font-semibold tracking-wide uppercase"
                style={{ color: phaseStrokeColor }}
              >
                {isCompleted ? 'Complete' : currentStep.label}
              </span>
              <span className="font-mono-tabular text-5xl font-semibold text-[#141517] dark:text-white my-1.5 leading-none">
                {formatDuration(remainingMs)}
              </span>
              <span className="text-xs text-[#6E7077] dark:text-[#8E95A2] truncate max-w-[170px]">
                {isCompleted
                  ? `${selectedRoutine.rounds} rounds finished`
                  : nextStep
                  ? `Next: ${nextStep.label} (${formatDurationReadable(nextStep.durationSec * 1000)})`
                  : 'Final phase'}
              </span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="w-full max-w-sm mt-5 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleJumpStep(-1)}
              disabled={stepIndex === 0}
              aria-label="Previous phase"
              className="min-h-[52px] min-w-[48px] px-3 rounded-2xl bg-[#F5F5F3] dark:bg-[#23262C] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] disabled:opacity-35 text-[#141517] dark:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToggle}
              className={`flex-1 min-h-[52px] px-5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap ${
                isRunning
                  ? 'bg-[#141517] dark:bg-white text-white dark:text-[#141517]'
                  : 'bg-[#E84A27] hover:bg-[#D43E1D] text-white'
              }`}
            >
              {isCompleted ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Restart</span>
                </>
              ) : isRunning ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>{stepIndex > 0 || remainingMs < stepTotalMs ? 'Resume' : 'Start Routine'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleJumpStep(1)}
              disabled={stepIndex >= steps.length - 1}
              aria-label="Next phase"
              className="min-h-[52px] min-w-[48px] px-3 rounded-2xl bg-[#F5F5F3] dark:bg-[#23262C] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] disabled:opacity-35 text-[#141517] dark:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              aria-label="Reset interval routine"
              className="min-h-[52px] min-w-[48px] px-3 rounded-2xl bg-[#F5F5F3] dark:bg-[#23262C] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] text-[#141517] dark:text-white flex items-center justify-center transition-colors shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Routine Selector Library */}
        <section className="lg:col-span-5 bg-white dark:bg-[#191B1F] rounded-3xl border border-[#E5E5E0] dark:border-[#272A30] p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#141517] dark:text-white">
              Interval Routines
            </h2>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium text-[#E84A27] hover:bg-[#E84A27]/10 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create</span>
            </button>
          </div>

          <div className="divide-y divide-[#EFEFEA] dark:divide-[#25282F]">
            {routines.map((routine) => {
              const isSelected = routine.id === selectedRoutine.id;
              const totalRoutineSec =
                routine.prepSeconds +
                routine.rounds * routine.workSeconds +
                Math.max(0, routine.rounds - 1) * routine.restSeconds;

              return (
                <div
                  key={routine.id}
                  className={`py-2.5 flex items-center justify-between gap-2 rounded-xl px-2 -mx-2 transition-colors ${
                    isSelected ? 'bg-[#F5F5F3] dark:bg-[#23262C]' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectRoutine(routine.id)}
                    className="flex-1 min-w-0 text-left py-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E84A27]"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-[#141517] dark:text-white truncate">
                        {routine.name}
                      </span>
                      <span className="font-mono-tabular text-xs font-medium text-[#5E6066] dark:text-[#9CA3AF] shrink-0">
                        {formatDurationReadable(totalRoutineSec * 1000)}
                      </span>
                    </div>
                    <p className="text-xs text-[#6E7077] dark:text-[#8E95A2] mt-0.5 truncate">
                      {formatDurationReadable(routine.workSeconds * 1000)} work
                      {routine.restSeconds > 0
                        ? ` · ${formatDurationReadable(routine.restSeconds * 1000)} rest`
                        : ''}
                      {` · ${routine.rounds} rounds`}
                    </p>
                  </button>

                  {routine.category === 'Custom' && (
                    <button
                      type="button"
                      onClick={() => onDeleteRoutine(routine.id)}
                      aria-label={`Delete ${routine.name}`}
                      className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-red-500/10 text-[#787B82] hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center shrink-0 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Create Routine Bottom Sheet / Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowCreateModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Create interval routine"
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-[#191B1F] rounded-t-3xl sm:rounded-3xl border border-[#E5E5E0] dark:border-[#272A30] shadow-2xl p-5 sm:p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden pb-3 flex justify-center">
              <div className="w-10 h-1.5 rounded-full bg-[#D4D4CE] dark:bg-[#353942]" />
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#141517] dark:text-white">
                  New Interval Routine
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  aria-label="Close modal"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5E6066] dark:text-[#9CA3AF]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label
                  htmlFor="routine-name"
                  className="block text-xs font-medium text-[#5E6066] dark:text-[#9CA3AF] mb-1.5"
                >
                  Routine Name
                </label>
                <input
                  id="routine-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Kettlebell EMOM"
                  maxLength={32}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F5F5F3] dark:bg-[#101113] border border-[#E5E5E0] dark:border-[#272A30] text-sm text-[#141517] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E84A27]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="routine-work"
                    className="block text-xs font-medium text-[#5E6066] dark:text-[#9CA3AF] mb-1.5"
                  >
                    Work (5–3600s)
                  </label>
                  <input
                    id="routine-work"
                    type="number"
                    min={LIMITS.MIN_WORK_SEC}
                    max={LIMITS.MAX_WORK_SEC}
                    value={newWork}
                    onChange={(e) =>
                      setNewWork(
                        clampInt(Number(e.target.value), LIMITS.MIN_WORK_SEC, LIMITS.MAX_WORK_SEC, 40)
                      )
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F5F5F3] dark:bg-[#101113] border border-[#E5E5E0] dark:border-[#272A30] font-mono-tabular text-sm text-[#141517] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E84A27]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="routine-rest"
                    className="block text-xs font-medium text-[#5E6066] dark:text-[#9CA3AF] mb-1.5"
                  >
                    Rest (0–1800s)
                  </label>
                  <input
                    id="routine-rest"
                    type="number"
                    min={LIMITS.MIN_REST_SEC}
                    max={LIMITS.MAX_REST_SEC}
                    value={newRest}
                    onChange={(e) =>
                      setNewRest(
                        clampInt(Number(e.target.value), LIMITS.MIN_REST_SEC, LIMITS.MAX_REST_SEC, 20)
                      )
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F5F5F3] dark:bg-[#101113] border border-[#E5E5E0] dark:border-[#272A30] font-mono-tabular text-sm text-[#141517] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E84A27]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="routine-rounds"
                    className="block text-xs font-medium text-[#5E6066] dark:text-[#9CA3AF] mb-1.5"
                  >
                    Rounds (1–50)
                  </label>
                  <input
                    id="routine-rounds"
                    type="number"
                    min={LIMITS.MIN_ROUNDS}
                    max={LIMITS.MAX_ROUNDS}
                    value={newRounds}
                    onChange={(e) =>
                      setNewRounds(
                        clampInt(Number(e.target.value), LIMITS.MIN_ROUNDS, LIMITS.MAX_ROUNDS, 6)
                      )
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F5F5F3] dark:bg-[#101113] border border-[#E5E5E0] dark:border-[#272A30] font-mono-tabular text-sm text-[#141517] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E84A27]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="routine-prep"
                    className="block text-xs font-medium text-[#5E6066] dark:text-[#9CA3AF] mb-1.5"
                  >
                    Prep (0–60s)
                  </label>
                  <input
                    id="routine-prep"
                    type="number"
                    min={LIMITS.MIN_PREP_SEC}
                    max={LIMITS.MAX_PREP_SEC}
                    value={newPrep}
                    onChange={(e) =>
                      setNewPrep(
                        clampInt(Number(e.target.value), LIMITS.MIN_PREP_SEC, LIMITS.MAX_PREP_SEC, 5)
                      )
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F5F5F3] dark:bg-[#101113] border border-[#E5E5E0] dark:border-[#272A30] font-mono-tabular text-sm text-[#141517] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E84A27]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] rounded-2xl bg-[#E84A27] hover:bg-[#D43E1D] text-white font-semibold text-sm transition-colors whitespace-nowrap"
              >
                Save Routine
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
