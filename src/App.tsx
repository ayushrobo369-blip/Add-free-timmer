import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  History,
  Hourglass,
  Moon,
  Plus,
  Sun,
  Timer as StopwatchIcon,
} from 'lucide-react';
import { HistoryView } from './components/HistoryView';
import { IntervalsView } from './components/IntervalsView';
import { KeypadSheet } from './components/KeypadSheet';
import { StopwatchView } from './components/StopwatchView';
import { TimerView } from './components/TimerView';
import {
  AppTab,
  HistoryEntry,
  IntervalRoutine,
  PresetDuration,
  TimerItem,
  UserPreferences,
} from './types/timer';
import { playChime, playTick, primeAudioContext, triggerHaptic } from './utils/audio';
import { sendLocalCompletionNotification } from './utils/notifications';
import { loadSecureLocal, saveSecureLocal, wipeAllLocalData } from './utils/storage';
import { formatDuration, formatDurationReadable } from './utils/time';
import {
  clampTimerMs,
  LIMITS,
  sanitizeHistory,
  sanitizeLabel,
  sanitizePreferences,
  sanitizeRoutines,
  sanitizeTimers,
} from './utils/validation';

const STORAGE_KEYS = {
  timers: 'cadence_timers_v1',
  routines: 'cadence_routines_v1',
  history: 'cadence_history_v1',
  prefs: 'cadence_prefs_v1',
};

const DEFAULT_PRESETS: PresetDuration[] = [
  { id: 'p-1m', label: 'Tea Steep', seconds: 180 },
  { id: 'p-5m', label: 'Quick Reset', seconds: 300 },
  { id: 'p-10m', label: 'Short Break', seconds: 600 },
  { id: 'p-15m', label: 'Sprint', seconds: 900 },
  { id: 'p-25m', label: 'Pomodoro', seconds: 1500 },
  { id: 'p-45m', label: 'Deep Focus', seconds: 2700 },
];

const DEFAULT_ROUTINES: IntervalRoutine[] = [
  {
    id: 'r-pomodoro',
    name: 'Classic Pomodoro',
    prepSeconds: 5,
    workSeconds: 1500,
    restSeconds: 300,
    rounds: 4,
    category: 'Focus',
  },
  {
    id: 'r-tabata',
    name: 'HIIT Tabata',
    prepSeconds: 10,
    workSeconds: 20,
    restSeconds: 10,
    rounds: 8,
    category: 'Training',
  },
  {
    id: 'r-emom',
    name: '45/15 Conditioning',
    prepSeconds: 5,
    workSeconds: 45,
    restSeconds: 15,
    rounds: 6,
    category: 'Training',
  },
  {
    id: 'r-breath',
    name: 'Box Breathing',
    prepSeconds: 3,
    workSeconds: 4,
    restSeconds: 4,
    rounds: 6,
    category: 'Recovery',
  },
];

function createDefaultTimers(): TimerItem[] {
  return [
    {
      id: 'timer-default-1',
      label: 'Focus Session',
      totalMs: 25 * 60 * 1000,
      remainingMs: 25 * 60 * 1000,
      status: 'idle',
      targetEndTime: null,
      createdAt: Date.now(),
    },
  ];
}

const DEFAULT_PREFS: UserPreferences = {
  theme: 'light',
  soundProfile: 'bell',
  tickSound: false,
  haptics: true,
  notificationsEnabled: false,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('timer');
  const [storageReady, setStorageReady] = useState(false);

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFS);
  const [timers, setTimers] = useState<TimerItem[]>(createDefaultTimers);
  const [activeTimerId, setActiveTimerId] = useState<string>('timer-default-1');
  const [routines, setRoutines] = useState<IntervalRoutine[]>(DEFAULT_ROUTINES);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [keypadState, setKeypadState] = useState<{
    open: boolean;
    mode: 'edit' | 'create';
  }>({ open: false, mode: 'edit' });

  const lastTickSecondRef = useRef<Record<string, number>>({});

  // Hydrate encrypted local storage on mount with strict schema validation
  useEffect(() => {
    let active = true;
    (async () => {
      const [loadedPrefs, loadedTimers, loadedRoutines, loadedHistory] =
        await Promise.all([
          loadSecureLocal(
            STORAGE_KEYS.prefs,
            (raw) => sanitizePreferences(raw, DEFAULT_PREFS),
            DEFAULT_PREFS
          ),
          loadSecureLocal(
            STORAGE_KEYS.timers,
            (raw) => sanitizeTimers(raw, createDefaultTimers()),
            createDefaultTimers()
          ),
          loadSecureLocal(
            STORAGE_KEYS.routines,
            (raw) => sanitizeRoutines(raw, DEFAULT_ROUTINES),
            DEFAULT_ROUTINES
          ),
          loadSecureLocal(
            STORAGE_KEYS.history,
            (raw) => sanitizeHistory(raw),
            []
          ),
        ]);

      if (!active) return;
      setPreferences(loadedPrefs);
      setTimers(loadedTimers);
      setActiveTimerId(loadedTimers[0]?.id || 'timer-default-1');
      setRoutines(loadedRoutines);
      setHistory(loadedHistory);
      setStorageReady(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  // Sync dark mode class on <html> and persist encrypted preferences
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (storageReady) {
      void saveSecureLocal(STORAGE_KEYS.prefs, preferences);
    }
  }, [preferences, storageReady]);

  useEffect(() => {
    if (storageReady) {
      void saveSecureLocal(STORAGE_KEYS.timers, timers);
    }
  }, [timers, storageReady]);

  useEffect(() => {
    if (storageReady) {
      void saveSecureLocal(STORAGE_KEYS.routines, routines);
    }
  }, [routines, storageReady]);

  useEffect(() => {
    if (storageReady) {
      void saveSecureLocal(STORAGE_KEYS.history, history);
    }
  }, [history, storageReady]);

  const appendHistory = useCallback((entry: Omit<HistoryEntry, 'id' | 'completedAt'>) => {
    const record: HistoryEntry = {
      ...entry,
      label: sanitizeLabel(entry.label, 'Session'),
      durationMs: Math.max(0, Math.min(LIMITS.MAX_TIMER_MS, Math.round(entry.durationMs))),
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      completedAt: Date.now(),
    };
    setHistory((prev) => [record, ...prev].slice(0, LIMITS.MAX_HISTORY));
  }, []);

  // Central high-accuracy timer ticker
  useEffect(() => {
    const hasRunning = timers.some((t) => t.status === 'running');
    if (!hasRunning) return;

    const id = window.setInterval(() => {
      const now = Date.now();
      const finishedTimers: TimerItem[] = [];

      setTimers((prev) =>
        prev.map((timer) => {
          if (timer.status !== 'running' || timer.targetEndTime === null) {
            return timer;
          }
          const nextRemaining = timer.targetEndTime - now;
          if (nextRemaining <= 0) {
            finishedTimers.push(timer);
            delete lastTickSecondRef.current[timer.id];
            return {
              ...timer,
              remainingMs: 0,
              status: 'completed',
              targetEndTime: null,
            };
          }

          if (preferences.tickSound) {
            const sec = Math.ceil(nextRemaining / 1000);
            if (lastTickSecondRef.current[timer.id] !== sec) {
              lastTickSecondRef.current[timer.id] = sec;
              playTick();
            }
          }

          return {
            ...timer,
            remainingMs: nextRemaining,
          };
        })
      );

      if (finishedTimers.length > 0) {
        playChime(preferences.soundProfile);
        triggerHaptic(preferences.haptics, [60, 80, 60, 80, 120]);
        finishedTimers.forEach((finished) => {
          if (preferences.notificationsEnabled) {
            sendLocalCompletionNotification(
              `${finished.label} finished`,
              `${formatDurationReadable(finished.totalMs)} timer complete`
            );
          }
          appendHistory({
            kind: 'timer',
            label: finished.label,
            durationMs: finished.totalMs,
          });
        });
      }
    }, 100);

    return () => window.clearInterval(id);
  }, [
    timers,
    preferences.soundProfile,
    preferences.tickSound,
    preferences.haptics,
    preferences.notificationsEnabled,
    appendHistory,
  ]);

  // Update browser tab title when active timer is running
  useEffect(() => {
    const active = timers.find((t) => t.id === activeTimerId) || timers[0];
    const running = timers.find((t) => t.status === 'running');
    const display = active?.status === 'running' ? active : running;
    if (display) {
      document.title = `${formatDuration(display.remainingMs)} · ${display.label}`;
    } else {
      document.title = 'Cadence Timer';
    }
  }, [timers, activeTimerId]);

  const handleStartPause = (id: string) => {
    primeAudioContext();
    triggerHaptic(preferences.haptics, 12);
    const now = Date.now();

    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (t.status === 'running') {
          const remaining = t.targetEndTime ? Math.max(0, t.targetEndTime - now) : t.remainingMs;
          return {
            ...t,
            status: 'paused',
            remainingMs: remaining,
            targetEndTime: null,
          };
        }
        const baseRemaining = clampTimerMs(t.remainingMs > 0 ? t.remainingMs : t.totalMs, t.totalMs);
        return {
          ...t,
          status: 'running',
          remainingMs: baseRemaining,
          targetEndTime: now + baseRemaining,
        };
      })
    );
  };

  const handleReset = (id: string) => {
    triggerHaptic(preferences.haptics, 10);
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'idle',
              remainingMs: t.totalMs,
              targetEndTime: null,
            }
          : t
      )
    );
  };

  const handleAdjustTime = (id: string, deltaMs: number) => {
    if (!Number.isFinite(deltaMs)) return;
    triggerHaptic(preferences.haptics, 8);
    const now = Date.now();
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const currentRemaining =
          t.status === 'running' && t.targetEndTime
            ? Math.max(0, t.targetEndTime - now)
            : t.remainingMs;
        const nextRemaining = clampTimerMs(currentRemaining + deltaMs, currentRemaining);
        const nextTotal =
          t.status === 'idle' ? nextRemaining : Math.max(t.totalMs, nextRemaining);

        return {
          ...t,
          totalMs: nextTotal,
          remainingMs: nextRemaining,
          status: t.status === 'completed' ? 'paused' : t.status,
          targetEndTime: t.status === 'running' ? now + nextRemaining : null,
        };
      })
    );
  };

  const handleScrubMinutes = (id: string, newTotalMs: number) => {
    const safeTotal = clampTimerMs(newTotalMs);
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          totalMs: safeTotal,
          remainingMs: safeTotal,
          status: 'idle',
          targetEndTime: null,
        };
      })
    );
  };

  const handleDismissCompleted = (id: string) => {
    triggerHaptic(preferences.haptics, 10);
    handleReset(id);
  };

  const handleSnoozeCompleted = (id: string, extraMs: number) => {
    primeAudioContext();
    triggerHaptic(preferences.haptics, 12);
    const safeExtra = clampTimerMs(extraMs, 60_000);
    const now = Date.now();
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              remainingMs: safeExtra,
              status: 'running',
              targetEndTime: now + safeExtra,
            }
          : t
      )
    );
  };

  const handleDeleteTimer = (id: string) => {
    setTimers((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((t) => t.id !== id);
      if (activeTimerId === id && filtered[0]) {
        setActiveTimerId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleApplyPreset = (seconds: number, label: string) => {
    triggerHaptic(preferences.haptics, 10);
    const ms = clampTimerMs(seconds * 1000);
    const safeLabel = sanitizeLabel(label, 'Timer');
    setTimers((prev) =>
      prev.map((t) =>
        t.id === activeTimerId
          ? {
              ...t,
              label: safeLabel,
              totalMs: ms,
              remainingMs: ms,
              status: 'idle',
              targetEndTime: null,
            }
          : t
      )
    );
  };

  const handleKeypadConfirm = (durationMs: number, label: string) => {
    triggerHaptic(preferences.haptics, 12);
    const safeDuration = clampTimerMs(durationMs);
    const safeLabel = sanitizeLabel(label, 'Timer');
    if (keypadState.mode === 'create') {
      const created: TimerItem = {
        id: `timer-${Date.now()}`,
        label: safeLabel,
        totalMs: safeDuration,
        remainingMs: safeDuration,
        status: 'idle',
        targetEndTime: null,
        createdAt: Date.now(),
      };
      setTimers((prev) => [created, ...prev].slice(0, LIMITS.MAX_TIMERS));
      setActiveTimerId(created.id);
      setActiveTab('timer');
    } else {
      setTimers((prev) =>
        prev.map((t) =>
          t.id === activeTimerId
            ? {
                ...t,
                label: safeLabel,
                totalMs: safeDuration,
                remainingMs: safeDuration,
                status: 'idle',
                targetEndTime: null,
              }
            : t
        )
      );
    }
  };

  const handleRepeatTimer = (entry: HistoryEntry) => {
    const safeDuration = clampTimerMs(entry.durationMs);
    const newTimer: TimerItem = {
      id: `timer-${Date.now()}`,
      label: sanitizeLabel(entry.label, 'Timer'),
      totalMs: safeDuration,
      remainingMs: safeDuration,
      status: 'idle',
      targetEndTime: null,
      createdAt: Date.now(),
    };
    setTimers((prev) => [newTimer, ...prev].slice(0, LIMITS.MAX_TIMERS));
    setActiveTimerId(newTimer.id);
    setActiveTab('timer');
  };

  const handleWipeLocalData = async () => {
    await wipeAllLocalData(Object.values(STORAGE_KEYS));
    const resetTimers = createDefaultTimers();
    setTimers(resetTimers);
    setActiveTimerId(resetTimers[0].id);
    setRoutines(DEFAULT_ROUTINES);
    setHistory([]);
    setPreferences(DEFAULT_PREFS);
  };

  const activeTimer = timers.find((t) => t.id === activeTimerId) || timers[0];
  const runningCount = timers.filter((t) => t.status === 'running').length;

  const navItems: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'timer', label: 'Timer', icon: Hourglass },
    { id: 'stopwatch', label: 'Stopwatch', icon: StopwatchIcon },
    { id: 'intervals', label: 'Intervals', icon: Activity },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F3] dark:bg-[#101113] text-[#141517] dark:text-[#F3F4F6] transition-colors">
      {/* Desktop 3-Zone Top Bar */}
      <header className="hidden lg:block sticky top-0 z-30 bg-[#F5F5F3]/90 dark:bg-[#101113]/90 backdrop-blur-md border-b border-[#E5E5E0] dark:border-[#23262C]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('timer')}
            className="font-display text-lg font-bold tracking-tight text-[#141517] dark:text-white whitespace-nowrap shrink-0"
          >
            Cadence
          </button>

          <nav className="flex items-center gap-6" aria-label="Primary navigation">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[40px] px-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    isActive
                      ? 'text-[#141517] dark:text-white border-[#E84A27]'
                      : 'text-[#6E7077] dark:text-[#8E95A2] border-transparent hover:text-[#141517] dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setKeypadState({ open: true, mode: 'create' })}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#141517] dark:bg-white text-white dark:text-[#141517] text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 transition-opacity whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Timer</span>
          </button>
        </div>
      </header>

      {/* Mobile Non-Sticky Top Bar */}
      <header className="lg:hidden px-4 pt-4 pb-2 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-[#141517] dark:text-white">
            Cadence
          </h1>
          <p className="text-xs text-[#6E7077] dark:text-[#8E95A2]">
            {runningCount > 0
              ? `${runningCount} active ${runningCount === 1 ? 'timer' : 'timers'}`
              : navItems.find((n) => n.id === activeTab)?.label}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setPreferences((p) => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' }))
          }
          aria-label="Toggle light or dark theme"
          className="min-h-[44px] min-w-[44px] rounded-2xl bg-white dark:bg-[#191B1F] border border-[#E5E5E0] dark:border-[#272A30] flex items-center justify-center text-[#141517] dark:text-white transition-colors"
        >
          {preferences.theme === 'light' ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </button>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-2 pb-24 lg:py-8">
        {activeTab === 'timer' && (
          <TimerView
            timers={timers}
            activeTimerId={activeTimer?.id || ''}
            presets={DEFAULT_PRESETS}
            onSelectTimer={setActiveTimerId}
            onStartPause={handleStartPause}
            onReset={handleReset}
            onAdjustTime={handleAdjustTime}
            onScrubMinutes={handleScrubMinutes}
            onDismissCompleted={handleDismissCompleted}
            onSnoozeCompleted={handleSnoozeCompleted}
            onDeleteTimer={handleDeleteTimer}
            onApplyPreset={handleApplyPreset}
            onOpenEditModal={() => setKeypadState({ open: true, mode: 'edit' })}
            onOpenCreateModal={() => setKeypadState({ open: true, mode: 'create' })}
          />
        )}

        {activeTab === 'stopwatch' && (
          <StopwatchView
            hapticsEnabled={preferences.haptics}
            onSaveRun={(durationMs, lapCount) =>
              appendHistory({
                kind: 'stopwatch',
                label: 'Stopwatch Run',
                durationMs,
                detail: lapCount > 0 ? `${lapCount} laps` : undefined,
              })
            }
          />
        )}

        {activeTab === 'intervals' && (
          <IntervalsView
            routines={routines}
            soundProfile={preferences.soundProfile}
            hapticsEnabled={preferences.haptics}
            onAddRoutine={(routine) =>
              setRoutines((prev) => [routine, ...prev].slice(0, LIMITS.MAX_ROUTINES))
            }
            onDeleteRoutine={(id) =>
              setRoutines((prev) => prev.filter((r) => r.id !== id))
            }
            onCompleteRoutine={(routine, totalMs) => {
              if (preferences.notificationsEnabled) {
                sendLocalCompletionNotification(
                  `${routine.name} complete`,
                  `${routine.rounds} rounds finished`
                );
              }
              appendHistory({
                kind: 'interval',
                label: routine.name,
                durationMs: totalMs,
                detail: `${routine.rounds} rounds`,
              });
            }}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            history={history}
            preferences={preferences}
            onUpdatePreferences={(patch) =>
              setPreferences((prev) => ({ ...prev, ...patch }))
            }
            onClearHistory={() => setHistory([])}
            onWipeLocalData={handleWipeLocalData}
            onRepeatTimer={handleRepeatTimer}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#191B1F]/95 backdrop-blur-md border-t border-[#E5E5E0] dark:border-[#272A30] pb-safe"
      >
        <div className="grid grid-cols-4 h-16 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerHaptic(preferences.haptics, 6);
                  setActiveTab(item.id);
                }}
                className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
                  isActive
                    ? 'text-[#E84A27]'
                    : 'text-[#6E7077] dark:text-[#8E95A2] hover:text-[#141517] dark:hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Keypad Sheet for Editing / Creating Timers */}
      <KeypadSheet
        isOpen={keypadState.open}
        mode={keypadState.mode}
        initialMs={activeTimer ? activeTimer.totalMs : 300_000}
        initialLabel={
          keypadState.mode === 'create'
            ? ''
            : activeTimer?.label || 'Timer'
        }
        onClose={() => setKeypadState((s) => ({ ...s, open: false }))}
        onConfirm={handleKeypadConfirm}
      />
    </div>
  );
}
