import React, { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const cssColor = (name, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  if (raw.startsWith('#') || raw.startsWith('rgb') || raw.startsWith('hsl')) return raw;
  if (raw.includes(' ')) return `hsl(${raw})`;
  return raw;
};

const Waveform = ({
  peaks = [],
  progress = 0,
  height = 64,
  restColor,
  playedColor,
  onSeek,
  className,
}) => {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [pressed, setPressed] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const width = Math.max(1, wrap.clientWidth);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const rest = restColor || cssColor('--muted-foreground', '#71717a');
    const played = playedColor || cssColor('--primary', '#8b5cf6');

    if (!peaks || peaks.length === 0) {
      ctx.fillStyle = rest;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(0, height / 2 - 0.5, width, 1);
      ctx.globalAlpha = 1;
      return;
    }

    const count = peaks.length;
    const slot = width / count;
    const barWidth = Math.max(1, slot * 0.6);
    const center = height / 2;

    for (let i = 0; i < count; i += 1) {
      const ratio = (i + 0.5) / count;
      const amplitude = Math.max(0.015, Math.min(1, peaks[i]));
      const barHeight = Math.max(2, amplitude * (height - 2));
      const x = i * slot + (slot - barWidth) / 2;
      ctx.fillStyle = ratio <= progress ? played : rest;
      ctx.fillRect(x, center - barHeight / 2, barWidth, barHeight);
    }
  }, [peaks, progress, height, restColor, playedColor]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw]);

  const seekAt = (clientX) => {
    if (!onSeek) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeek(ratio);
  };

  return (
    <div
      ref={wrapRef}
      className={cn('w-full touch-none select-none', onSeek && 'cursor-pointer', className)}
      style={{ height }}
      onPointerDown={(event) => {
        if (!onSeek) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setPressed(true);
        seekAt(event.clientX);
      }}
      onPointerMove={(event) => {
        if (pressed) seekAt(event.clientX);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      role={onSeek ? 'slider' : undefined}
      aria-label={onSeek ? 'Seek' : undefined}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
};

export default Waveform;
