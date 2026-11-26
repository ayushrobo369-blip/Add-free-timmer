import React, { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { TimerStatus } from '../types/timer';
import { formatClockEndTime, formatDuration } from '../utils/time';

interface TimerDialProps {
  label: string;
  totalMs: number;
  remainingMs: number;
  status: TimerStatus;
  targetEndTime: number | null;
  onEditTime: () => void;
  onScrubMinutes: (newTotalMs: number) => void;
}

export function TimerDial({
  label,
  totalMs,
  remainingMs,
  status,
  targetEndTime,
  onEditTime,
  onScrubMinutes,
}: TimerDialProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const size = 300;
  const center = size / 2;
  const radius = 126;
  const circumference = 2 * Math.PI * radius;

  const progress = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const canScrub = status === 'idle' || status === 'paused';

  const handlePointerToDuration = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;

    const fraction = angle / (Math.PI * 2);
    // Snap to 1-minute increments up to 60 minutes (min 1 minute)
    const minutes = Math.max(1, Math.min(60, Math.round(fraction * 60) || 60));
    onScrubMinutes(minutes * 60 * 1000);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!canScrub) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    const outerLimit = rect.width * 0.52;
    const innerLimit = rect.width * 0.31;

    // Only scrub when grabbing near the outer dial ring so center taps open keypad cleanly
    if (dist >= innerLimit && dist <= outerLimit) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      handlePointerToDuration(e.clientX, e.clientY);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || !canScrub) return;
    handlePointerToDuration(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDragging) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
    }
  };

  // Indicator dot position along the arc
  const activeAngle = progress * Math.PI * 2 - Math.PI / 2;
  const knobX = center + radius * Math.cos(activeAngle);
  const knobY = center + radius * Math.sin(activeAngle);

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const isMajor = i % 5 === 0;
    const rOuter = 142;
    const rInner = isMajor ? 134 : 137;
    return {
      x1: center + rInner * Math.cos(angle),
      y1: center + rInner * Math.sin(angle),
      x2: center + rOuter * Math.cos(angle),
      y2: center + rOuter * Math.sin(angle),
      isMajor,
    };
  });

  const formatted = formatDuration(remainingMs);
  const hasHours = formatted.length > 5;

  return (
    <div className="relative flex items-center justify-center select-none w-full max-w-[320px] sm:max-w-[340px] mx-auto aspect-square">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size} ${size}`}
        className={`w-full h-full touch-none ${canScrub ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="Timer circular dial"
      >
        {/* Radial precision ticks */}
        {ticks.map((tick, idx) => (
          <line
            key={idx}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke="currentColor"
            strokeWidth={tick.isMajor ? 1.5 : 1}
            className={
              tick.isMajor
                ? 'text-[#B5B5AE] dark:text-[#4B505B]'
                : 'text-[#DCDCD6] dark:text-[#2A2D34]'
            }
          />
        ))}

        {/* Track circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={8}
          className="text-[#E6E6E1] dark:text-[#23262C]"
        />

        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={status === 'completed' ? '#16A34A' : '#E84A27'}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${center} ${center})`}
          className={isDragging ? '' : 'transition-[stroke-dashoffset] duration-150 ease-out'}
        />

        {/* Subtle tactile handle knob on active ring */}
        {totalMs > 0 && progress > 0 && (
          <circle
            cx={knobX}
            cy={knobY}
            r={isDragging ? 7 : 5}
            fill="#FFFFFF"
            stroke={status === 'completed' ? '#16A34A' : '#E84A27'}
            strokeWidth={3}
          />
        )}
      </svg>

      {/* Center Readout & Tap-to-Edit Button */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-10 text-center">
        <button
          type="button"
          onClick={onEditTime}
          className="pointer-events-auto group flex items-center gap-1.5 min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium text-[#5E6066] dark:text-[#9CA3AF] hover:text-[#141517] dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E84A27]"
          aria-label="Edit timer label and duration"
        >
          <span className="truncate max-w-[150px]">{label || 'Timer'}</span>
          <Pencil className="w-3 h-3 opacity-60 group-hover:opacity-100 shrink-0" />
        </button>

        <button
          type="button"
          onClick={onEditTime}
          className="pointer-events-auto my-0.5 px-3 py-1 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E84A27]"
          aria-label={`Current time ${formatted}. Tap to edit duration.`}
        >
          <span
            className={`font-mono-tabular font-semibold tracking-tight text-[#141517] dark:text-[#F8F9FA] block leading-none ${
              hasHours ? 'text-[2.5rem] sm:text-[2.75rem]' : 'text-[3.25rem] sm:text-[3.5rem]'
            }`}
          >
            {formatted}
          </span>
        </button>

        <div className="mt-1.5 text-xs text-[#6E7077] dark:text-[#8E95A2] min-h-[18px]">
          {status === 'running' && (
            <span>Ends at {formatClockEndTime(targetEndTime, remainingMs)}</span>
          )}
          {status === 'paused' && <span>Paused · Tap digits to edit</span>}
          {status === 'idle' && <span>Tap digits or drag ring</span>}
          {status === 'completed' && (
            <span className="font-medium text-[#16A34A] dark:text-[#4ADE80]">Time complete</span>
          )}
        </div>
      </div>
    </div>
  );
}
