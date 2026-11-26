export type AppTab = 'timer' | 'stopwatch' | 'intervals' | 'history';

export type SoundProfile = 'bell' | 'marimba' | 'pulse' | 'silent';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface TimerItem {
  id: string;
  label: string;
  totalMs: number;
  remainingMs: number;
  status: TimerStatus;
  /** Timestamp (Date.now()) when this timer will finish if currently running */
  targetEndTime: number | null;
  createdAt: number;
}

export interface PresetDuration {
  id: string;
  label: string;
  seconds: number;
}

export interface LapEntry {
  id: string;
  lapNumber: number;
  splitMs: number;
  totalMs: number;
}

export interface IntervalRoutine {
  id: string;
  name: string;
  prepSeconds: number;
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  category: string;
}

export type IntervalPhaseType = 'prep' | 'work' | 'rest';

export interface HistoryEntry {
  id: string;
  kind: 'timer' | 'stopwatch' | 'interval';
  label: string;
  durationMs: number;
  completedAt: number;
  detail?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  soundProfile: SoundProfile;
  tickSound: boolean;
  haptics: boolean;
  notificationsEnabled: boolean;
}
