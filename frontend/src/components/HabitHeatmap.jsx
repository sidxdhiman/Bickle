import React, { useMemo } from 'react';
import { CalendarDays, Grid3X3 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const WEEKS = 26;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const toDayKey = (d) => {
  const date = new Date(d);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

export const isCompletedOn = (completedDates, target) => {
  const key = toDayKey(target);
  return (completedDates || []).some((d) => toDayKey(d) === key);
};

// Last 30 days as a compact strip (oldest → newest, right edge = today)
export const MiniStrip = ({ completedDates }) => {
  const cells = useMemo(() => {
    const set = new Set((completedDates || []).map(toDayKey));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      out.push({ key: toDayKey(d), done: set.has(toDayKey(d)) });
    }
    return out;
  }, [completedDates]);

  return (
    <div className="hidden sm:flex items-end gap-[2px]" title="Last 30 days">
      {cells.map((cell) => (
        <div
          key={cell.key}
          className={cn(
            'w-1.5 h-4 rounded-[2px]',
            cell.done ? 'bg-green-500/70' : 'bg-muted'
          )}
        />
      ))}
    </div>
  );
};

// GitHub-style contribution grid: one cell per day, intensity = how many of
// your habits were completed that day (relative to your active habit count).
export const HabitHeatmap = ({ habits }) => {
  const { days, monthLabels, totalCompletions } = useMemo(() => {
    const counts = new Map();
    for (const habit of habits) {
      for (const d of habit.completedDates || []) {
        const key = toDayKey(d);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start far enough back to cover WEEKS full week-columns, aligned to Monday
    const start = new Date(today);
    start.setDate(start.getDate() - (WEEKS * 7 - 1));
    const backToMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - backToMonday);

    const days = [];
    const cursor = new Date(start);
    while (cursor <= today) {
      days.push({ date: new Date(cursor), count: counts.get(toDayKey(cursor)) || 0, future: false });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Pad the remaining days of the current week so the last column is full
    const isoDow = (today.getDay() + 6) % 7; // Mon = 0 … Sun = 6
    for (let i = isoDow + 1; i <= 6; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      days.push({ date: d, count: 0, future: true });
    }

    // Month labels per week-column (shown when the column starts a new month)
    const monthLabels = [];
    for (let i = 0; i < days.length; i += 7) {
      const first = days[i].date;
      const prev = i >= 7 ? days[i - 7].date : null;
      monthLabels.push(!prev || prev.getMonth() !== first.getMonth() ? MONTH_NAMES[first.getMonth()] : '');
    }

    const totalCompletions = [...counts.values()].reduce((a, b) => a + b, 0);
    return { days, monthLabels, totalCompletions };
  }, [habits]);

  const totalHabits = Math.max(habits.length, 1);

  const levelClass = (count) => {
    if (count <= 0) return 'bg-muted';
    const level = Math.min(4, Math.max(1, Math.ceil((count / totalHabits) * 4)));
    return ['bg-green-500/25', 'bg-green-500/45', 'bg-green-500/65', 'bg-green-500/90'][level - 1];
  };

  const tooltipFor = (day) => {
    const dateStr = day.date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    if (day.count === 0) return `${dateStr} — no habits completed`;
    return `${dateStr} — ${day.count} habit${day.count === 1 ? '' : 's'} completed`;
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-secondary border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <Grid3X3 className="w-4 h-4 sm:w-5 sm:h-5" />
          Activity
        </h3>
        <p className="text-xs text-muted-foreground">
          {totalCompletions} completion{totalCompletions === 1 ? '' : 's'} in the last {WEEKS} weeks
        </p>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Each square is a day, shaded by how many habits you finished.
      </p>

      <div className="flex gap-2">
        <div className="flex flex-col gap-[3px] pt-[20px] text-[10px] text-muted-foreground shrink-0">
          {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((label, i) => (
            <span key={i} className="h-3 flex items-center leading-3 w-6 text-right pr-0.5">
              {label}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto pb-1 -mb-1">
          <div className="w-max">
            <div className="flex gap-[3px] mb-1 h-4 text-[10px] text-muted-foreground">
              {monthLabels.map((m, i) => (
                <span key={i} className="w-3 shrink-0 leading-4">
                  {m}
                </span>
              ))}
            </div>
            <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
              {days.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-3 h-3 rounded-[2px]',
                    day.future ? 'bg-transparent' : levelClass(day.count)
                  )}
                  title={day.future ? undefined : tooltipFor(day)}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5 mt-3 text-[10px] text-muted-foreground">
              <span>Less</span>
              <span className="w-3 h-3 rounded-[2px] bg-muted" />
              <span className="w-3 h-3 rounded-[2px] bg-green-500/25" />
              <span className="w-3 h-3 rounded-[2px] bg-green-500/45" />
              <span className="w-3 h-3 rounded-[2px] bg-green-500/65" />
              <span className="w-3 h-3 rounded-[2px] bg-green-500/90" />
              <span>More</span>
            </div>
          </div>
        </div>
      </div>

      {totalCompletions === 0 && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="w-3.5 h-3.5" />
          Complete a habit above to start filling in your activity map.
        </div>
      )}
    </div>
  );
};

export default HabitHeatmap;
