import { LIMITS } from './validation';

export function formatDuration(ms: number): string {
  const safeMs = Number.isFinite(ms) ? ms : 0;
  const clamped = Math.max(0, Math.min(LIMITS.MAX_TIMER_MS, Math.ceil(safeMs / 1000) * 1000)) / 1000;
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDurationReadable(ms: number): string {
  const safeMs = Number.isFinite(ms) ? ms : 0;
  const totalSec = Math.round(Math.max(0, Math.min(LIMITS.MAX_TIMER_MS, safeMs)) / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

export function formatStopwatch(ms: number): { main: string; centis: string } {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalCentis = Math.floor(safe / 10);
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const main =
    hours > 0
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    main,
    centis: String(centis).padStart(2, '0'),
  };
}

export function formatClockEndTime(targetEndTime: number | null, remainingMs: number): string {
  const safeRemaining = Number.isFinite(remainingMs) ? Math.max(0, remainingMs) : 0;
  const target =
    targetEndTime !== null && Number.isFinite(targetEndTime)
      ? targetEndTime
      : Date.now() + safeRemaining;
  const date = new Date(target);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatRelativeDate(timestamp: number): string {
  const safeTs = Number.isFinite(timestamp) ? timestamp : Date.now();
  const date = new Date(safeTs);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) {
    return `Today · ${timeStr}`;
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${timeStr}`;
}

export function keypadDigitsToMs(digits: string): number {
  const numericOnly = digits.replace(/\D/g, '');
  if (!numericOnly) return 0;
  const padded = numericOnly.padStart(6, '0').slice(-6);
  const hours = Math.min(99, parseInt(padded.slice(0, 2), 10) || 0);
  const minutes = parseInt(padded.slice(2, 4), 10) || 0;
  const seconds = parseInt(padded.slice(4, 6), 10) || 0;
  const ms = (hours * 3600 + minutes * 60 + seconds) * 1000;
  return Math.min(LIMITS.MAX_TIMER_MS, Math.max(0, ms));
}

export function msToKeypadDigits(ms: number): string {
  const safeMs = Number.isFinite(ms) ? Math.max(0, Math.min(LIMITS.MAX_TIMER_MS, ms)) : 0;
  const totalSec = Math.round(safeMs / 1000);
  const hours = Math.min(99, Math.floor(totalSec / 3600));
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const raw = `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}${String(seconds).padStart(2, '0')}`;
  return raw.replace(/^0+/, '') || '';
}
