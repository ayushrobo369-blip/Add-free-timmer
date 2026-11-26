import React, { useState } from 'react';
import { Moon, Play, ShieldCheck, Sun, Trash2, Volume2, VolumeX } from 'lucide-react';
import { HistoryEntry, SoundProfile, UserPreferences } from '../types/timer';
import { playChime, primeAudioContext } from '../utils/audio';
import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
} from '../utils/notifications';
import { formatDurationReadable, formatRelativeDate } from '../utils/time';

interface HistoryViewProps {
  history: HistoryEntry[];
  preferences: UserPreferences;
  onUpdatePreferences: (patch: Partial<UserPreferences>) => void;
  onClearHistory: () => void;
  onWipeLocalData: () => Promise<void>;
  onRepeatTimer: (entry: HistoryEntry) => void;
}

const SOUND_PROFILES: { id: SoundProfile; label: string; desc: string }[] = [
  { id: 'bell', label: 'Studio Bell', desc: 'Warm two-tone harmonic chime' },
  { id: 'marimba', label: 'Soft Marimba', desc: 'Rising four-note wood tone' },
  { id: 'pulse', label: 'Digital Pulse', desc: 'Crisp triple chronometer beep' },
  { id: 'silent', label: 'Silent', desc: 'Visual alert and vibration only' },
];

export function HistoryView({
  history,
  preferences,
  onUpdatePreferences,
  onClearHistory,
  onWipeLocalData,
  onRepeatTimer,
}: HistoryViewProps) {
  const [confirmErase, setConfirmErase] = useState(false);
  const [notifDeniedHint, setNotifDeniedHint] = useState(false);

  const handleSelectSound = (profile: SoundProfile) => {
    primeAudioContext();
    onUpdatePreferences({ soundProfile: profile });
    if (profile !== 'silent') {
      playChime(profile);
    }
  };

  const handleToggleNotifications = async (checked: boolean) => {
    setNotifDeniedHint(false);
    if (!checked) {
      onUpdatePreferences({ notificationsEnabled: false });
      return;
    }
    const granted = await requestNotificationPermission();
    if (granted) {
      onUpdatePreferences({ notificationsEnabled: true });
    } else {
      onUpdatePreferences({ notificationsEnabled: false });
      setNotifDeniedHint(true);
    }
  };

  const handleConfirmErase = async () => {
    await onWipeLocalData();
    setConfirmErase(false);
  };

  const notificationSupported = isNotificationSupported();
  const permissionStatus = getNotificationPermission();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Recent Sessions Log */}
      <section className="lg:col-span-7 bg-white dark:bg-[#191B1F] rounded-3xl border border-[#E5E5E0] dark:border-[#272A30] p-5 sm:p-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#EFEFEA] dark:border-[#25282F]">
          <div>
            <h2 className="text-base font-semibold text-[#141517] dark:text-white">
              Session History
            </h2>
            <p className="text-xs text-[#6E7077] dark:text-[#8E95A2] mt-0.5">
              {history.length === 0
                ? 'No completed sessions yet'
                : `${history.length} completed ${history.length === 1 ? 'session' : 'sessions'}`}
            </p>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-medium text-[#6E7077] dark:text-[#9CA3AF] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[#6E7077] dark:text-[#8E95A2]">
              Completed timers, interval routines, and saved stopwatch runs appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EFEFEA] dark:divide-[#25282F]">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-[#141517] dark:text-white truncate">
                      {entry.label}
                    </span>
                    <span className="text-xs text-[#6E7077] dark:text-[#8E95A2] capitalize shrink-0">
                      · {entry.kind}
                    </span>
                  </div>
                  <p className="text-xs text-[#6E7077] dark:text-[#8E95A2] mt-0.5">
                    {formatRelativeDate(entry.completedAt)}
                    {entry.detail ? ` · ${entry.detail}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono-tabular text-sm font-semibold text-[#141517] dark:text-white">
                    {formatDurationReadable(entry.durationMs)}
                  </span>
                  {entry.kind === 'timer' && (
                    <button
                      type="button"
                      onClick={() => onRepeatTimer(entry)}
                      aria-label={`Run ${entry.label} again`}
                      className="min-h-[44px] min-w-[44px] rounded-xl bg-[#F5F5F3] dark:bg-[#23262C] hover:bg-[#EAEAE5] dark:hover:bg-[#2D3139] text-[#141517] dark:text-white flex items-center justify-center transition-colors"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Audio, Permissions & Privacy Settings */}
      <section className="lg:col-span-5 bg-white dark:bg-[#191B1F] rounded-3xl border border-[#E5E5E0] dark:border-[#272A30] p-5 sm:p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-[#141517] dark:text-white mb-3">
            Appearance
          </h2>
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F5F5F3] dark:bg-[#101113] rounded-2xl">
            <button
              type="button"
              onClick={() => onUpdatePreferences({ theme: 'light' })}
              className={`min-h-[44px] rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                preferences.theme === 'light'
                  ? 'bg-white text-[#141517] shadow-sm'
                  : 'text-[#6E7077] dark:text-[#8E95A2] hover:text-[#141517] dark:hover:text-white'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdatePreferences({ theme: 'dark' })}
              className={`min-h-[44px] rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
                preferences.theme === 'dark'
                  ? 'bg-[#23262C] text-white shadow-sm'
                  : 'text-[#6E7077] dark:text-[#8E95A2] hover:text-[#141517] dark:hover:text-white'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Dark</span>
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-[#141517] dark:text-white">
              Alert Chime
            </h2>
            <span className="text-xs text-[#6E7077] dark:text-[#8E95A2]">
              Tap to preview
            </span>
          </div>
          <div className="space-y-2">
            {SOUND_PROFILES.map((item) => {
              const selected = preferences.soundProfile === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSound(item.id)}
                  className={`w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors ${
                    selected
                      ? 'border-[#E84A27] bg-[#E84A27]/[0.06] dark:bg-[#E84A27]/10'
                      : 'border-[#E5E5E0] dark:border-[#272A30] hover:bg-[#F5F5F3] dark:hover:bg-[#23262C]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#141517] dark:text-white">
                      {item.label}
                    </p>
                    <p className="text-xs text-[#6E7077] dark:text-[#8E95A2] truncate">
                      {item.desc}
                    </p>
                  </div>
                  <div className="shrink-0 text-[#6E7077] dark:text-[#8E95A2]">
                    {item.id === 'silent' ? (
                      <VolumeX className={`w-4 h-4 ${selected ? 'text-[#E84A27]' : ''}`} />
                    ) : (
                      <Volume2 className={`w-4 h-4 ${selected ? 'text-[#E84A27]' : ''}`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-[#EFEFEA] dark:border-[#25282F] space-y-2">
          <label className="flex items-center justify-between min-h-[44px] cursor-pointer">
            <span className="text-sm font-medium text-[#141517] dark:text-white">
              Mechanical second tick
            </span>
            <input
              type="checkbox"
              checked={preferences.tickSound}
              onChange={(e) => onUpdatePreferences({ tickSound: e.target.checked })}
              className="w-5 h-5 accent-[#E84A27] rounded cursor-pointer"
            />
          </label>
          <label className="flex items-center justify-between min-h-[44px] cursor-pointer">
            <span className="text-sm font-medium text-[#141517] dark:text-white">
              Mobile haptic vibration
            </span>
            <input
              type="checkbox"
              checked={preferences.haptics}
              onChange={(e) => onUpdatePreferences({ haptics: e.target.checked })}
              className="w-5 h-5 accent-[#E84A27] rounded cursor-pointer"
            />
          </label>
          {notificationSupported && (
            <div>
              <label className="flex items-center justify-between min-h-[44px] cursor-pointer">
                <span className="text-sm font-medium text-[#141517] dark:text-white">
                  Completion notifications
                </span>
                <input
                  type="checkbox"
                  checked={preferences.notificationsEnabled && permissionStatus === 'granted'}
                  onChange={(e) => handleToggleNotifications(e.target.checked)}
                  className="w-5 h-5 accent-[#E84A27] rounded cursor-pointer"
                />
              </label>
              {notifDeniedHint && (
                <p className="text-xs text-[#E84A27] mt-1">
                  Notification permission was denied in your browser settings.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Local Storage Privacy Controls */}
        <div className="pt-4 border-t border-[#EFEFEA] dark:border-[#25282F] space-y-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#16A34A] dark:text-[#4ADE80] mt-0.5 shrink-0" />
            <div className="text-xs text-[#6E7077] dark:text-[#8E95A2] leading-relaxed">
              Timers, routines, and history stay strictly on this device in encrypted local storage. Zero accounts or network tracking.
            </div>
          </div>

          {!confirmErase ? (
            <button
              type="button"
              onClick={() => setConfirmErase(true)}
              className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#E5E5E0] dark:border-[#272A30] text-xs font-medium text-[#5E6066] dark:text-[#9CA3AF] hover:text-red-600 dark:hover:text-red-400 hover:border-red-500/30 transition-colors whitespace-nowrap"
            >
              Erase all local data
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmErase(false)}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-[#F5F5F3] dark:bg-[#23262C] text-xs font-medium text-[#141517] dark:text-white whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmErase}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold whitespace-nowrap"
              >
                Confirm Erase
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
