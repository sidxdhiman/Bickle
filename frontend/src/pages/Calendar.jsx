import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  MapPin
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const CalendarPage = () => {
  const [view, setView] = useState('month'); // 'month', 'week', 'day'
  const [currentDate, setCurrentDate] = useState(new Date());

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Mocking a month grid
  const generateMonthDays = () => {
    const daysInMonth = 31;
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  const mockEvents = [
    { id: 1, title: 'Project Sync', start: 12, color: '#6366f1', time: '10:00 AM' },
    { id: 2, title: 'Design Review', start: 15, color: '#f59e0b', time: '2:00 PM' },
    { id: 3, title: 'Client Call', start: 20, color: '#ef4444', time: '11:30 AM' },
  ];

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <div className="flex bg-secondary p-1 rounded-lg border border-border">
            {['month', 'week', 'day'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 text-xs rounded-md transition-all capitalize",
                  view === v ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-1.5">
            <button className="p-1 hover:bg-accent rounded transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button className="p-1 hover:bg-accent rounded transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </div>
      </header>

      <div className="flex-1 bg-secondary/50 border border-border rounded-2xl overflow-hidden flex flex-col">
        {view === 'month' ? (
          <div className="flex-1 flex flex-col">
            <div className="grid grid-cols-7 border-b border-border">
              {days.map(day => (
                <div key={day} className="p-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r border-border last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1">
              {generateMonthDays().map(day => (
                <div key={day} className="border-r border-b border-border p-2 min-h-[120px] hover:bg-accent/30 transition-colors group relative">
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {day}
                  </span>
                  <div className="mt-2 space-y-1">
                    {mockEvents.filter(e => e.start === day).map(event => (
                      <div
                        key={event.id}
                        style={{ backgroundColor: event.color }}
                        className="px-2 py-0.5 rounded text-[10px] text-white font-medium truncate cursor-pointer hover:brightness-110 transition-all"
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground italic">
            {view.toUpperCase()} view implementation coming soon...
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarPage;
