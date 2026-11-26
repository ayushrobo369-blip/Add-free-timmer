import {
  HistoryEntry,
  IntervalRoutine,
  SoundProfile,
  TimerItem,
  TimerStatus,
  UserPreferences,
} from '../types/timer';

export const LIMITS = {
  MIN_TIMER_MS: 1_000,
  MAX_TIMER_MS: 99 * 3600 * 1000,
  MIN_WORK_SEC: 5,
  MAX_WORK_SEC: 3600,
  MIN_REST_SEC: 0,
  MAX_REST_SEC: 1800,
  MIN_PREP_SEC: 0,
  MAX_PREP_SEC: 60,
  MIN_ROUNDS: 1,
  MAX_ROUNDS: 50,
  MAX_LABEL_LENGTH: 32,
  MAX_TIMERS: 20,
  MAX_ROUTINES: 30,
  MAX_HISTORY: 50,
} as const;

export function clampFiniteNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const num = clampFiniteNumber(value, min, max, fallback);
  return Math.round(num);
}

export function clampTimerMs(value: unknown, fallback = 300_000): number {
  return clampInt(value, LIMITS.MIN_TIMER_MS, LIMITS.MAX_TIMER_MS, fallback);
}

export function sanitizeLabel(value: unknown, fallback = 'Timer'): string {
  if (typeof value !== 'string') return fallback;
  // Strip ASCII control characters and collapse surrounding whitespace
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, LIMITS.MAX_LABEL_LENGTH);
}

const VALID_STATUSES: ReadonlySet<TimerStatus> = new Set([
  'idle',
  'running',
  'paused',
  'completed',
]);

const VALID_SOUNDS: ReadonlySet<SoundProfile> = new Set([
  'bell',
  'marimba',
  'pulse',
  'silent',
]);

export function sanitizeTimers(raw: unknown, fallback: TimerItem[]): TimerItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback;

  const now = Date.now();
  const valid: TimerItem[] = [];

  for (const item of raw.slice(0, LIMITS.MAX_TIMERS)) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const totalMs = clampTimerMs(obj.totalMs, 25 * 60 * 1000);
    const status: TimerStatus =
      typeof obj.status === 'string' && VALID_STATUSES.has(obj.status as TimerStatus)
        ? (obj.status as TimerStatus)
        : 'idle';

    const rawRemaining =
      typeof obj.remainingMs === 'number' && Number.isFinite(obj.remainingMs)
        ? obj.remainingMs
        : totalMs;
    const remainingMs = Math.min(LIMITS.MAX_TIMER_MS, Math.max(0, rawRemaining));

    const targetEndTime =
      status === 'running' &&
      typeof obj.targetEndTime === 'number' &&
      Number.isFinite(obj.targetEndTime)
        ? Math.min(now + LIMITS.MAX_TIMER_MS, obj.targetEndTime)
        : null;

    valid.push({
      id: typeof obj.id === 'string' && obj.id.length <= 64 ? obj.id : `timer-${now}-${valid.length}`,
      label: sanitizeLabel(obj.label, 'Timer'),
      totalMs,
      remainingMs: status === 'idle' ? totalMs : remainingMs,
      status: status === 'running' && targetEndTime === null ? 'paused' : status,
      targetEndTime,
      createdAt:
        typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt)
          ? obj.createdAt
          : now,
    });
  }

  return valid.length > 0 ? valid : fallback;
}

export function sanitizeRoutines(
  raw: unknown,
  fallback: IntervalRoutine[]
): IntervalRoutine[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback;

  const valid: IntervalRoutine[] = [];
  for (const item of raw.slice(0, LIMITS.MAX_ROUTINES)) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    valid.push({
      id:
        typeof obj.id === 'string' && obj.id.length <= 64
          ? obj.id
          : `routine-${valid.length}`,
      name: sanitizeLabel(obj.name, 'Custom Routine'),
      prepSeconds: clampInt(obj.prepSeconds, LIMITS.MIN_PREP_SEC, LIMITS.MAX_PREP_SEC, 5),
      workSeconds: clampInt(obj.workSeconds, LIMITS.MIN_WORK_SEC, LIMITS.MAX_WORK_SEC, 40),
      restSeconds: clampInt(obj.restSeconds, LIMITS.MIN_REST_SEC, LIMITS.MAX_REST_SEC, 20),
      rounds: clampInt(obj.rounds, LIMITS.MIN_ROUNDS, LIMITS.MAX_ROUNDS, 4),
      category: sanitizeLabel(obj.category, 'Custom'),
    });
  }

  return valid.length > 0 ? valid : fallback;
}

export function sanitizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];

  const valid: HistoryEntry[] = [];
  for (const item of raw.slice(0, LIMITS.MAX_HISTORY)) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const kind =
      obj.kind === 'timer' || obj.kind === 'stopwatch' || obj.kind === 'interval'
        ? obj.kind
        : null;
    if (!kind) continue;

    valid.push({
      id:
        typeof obj.id === 'string' && obj.id.length <= 64
          ? obj.id
          : `hist-${valid.length}`,
      kind,
      label: sanitizeLabel(obj.label, 'Session'),
      durationMs: clampInt(obj.durationMs, 0, LIMITS.MAX_TIMER_MS, 0),
      completedAt:
        typeof obj.completedAt === 'number' && Number.isFinite(obj.completedAt)
          ? obj.completedAt
          : Date.now(),
      detail: typeof obj.detail === 'string' ? sanitizeLabel(obj.detail, '') : undefined,
    });
  }

  return valid;
}

export function sanitizePreferences(
  raw: unknown,
  fallback: UserPreferences
): UserPreferences {
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  return {
    theme: obj.theme === 'dark' || obj.theme === 'light' ? obj.theme : fallback.theme,
    soundProfile:
      typeof obj.soundProfile === 'string' && VALID_SOUNDS.has(obj.soundProfile as SoundProfile)
        ? (obj.soundProfile as SoundProfile)
        : fallback.soundProfile,
    tickSound: typeof obj.tickSound === 'boolean' ? obj.tickSound : fallback.tickSound,
    haptics: typeof obj.haptics === 'boolean' ? obj.haptics : fallback.haptics,
    notificationsEnabled:
      typeof obj.notificationsEnabled === 'boolean'
        ? obj.notificationsEnabled
        : fallback.notificationsEnabled,
  };
}
