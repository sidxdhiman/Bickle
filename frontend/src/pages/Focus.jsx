import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  Play, Pause, RotateCcw, SkipForward, Settings, X,
  CheckCircle2, Circle, Coffee, Brain, Timer, Volume2, VolumeX
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const MODES = {
  focus: { label: 'Focus', defaultMinutes: 25, color: 'hsl(var(--primary))' },
  shortBreak: { label: 'Short Break', defaultMinutes: 5, color: '#10b981' },
  longBreak: { label: 'Long Break', defaultMinutes: 15, color: '#3b82f6' },
};

const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
};


// Tiny beep using Web Audio API
function playBeep(type = 'end') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    if (type === 'end') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (_) {}
}


// Settings modal
const SettingsModal = ({ isOpen, onClose, settings, onSave }) => {
  const [form, setForm] = useState(settings);

  useEffect(() => { if (isOpen) setForm(settings); }, [isOpen, settings]);

  if (!isOpen) return null;

  const field = (label, key, min, max) => (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-2">{label}</label>
      <input
        type="number" min={min} max={max}
        value={form[key]}
        onChange={e => setForm(prev => ({ ...prev, [key]: Math.max(min, Math.min(max, Number(e.target.value))) }))}
        className="w-full px-3 py-2 bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );

  const toggle = (label, key) => (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <button
        type="button"
        onClick={() => setForm(prev => ({ ...prev, [key]: !prev[key] }))}
        className={cn('relative w-11 h-6 transition-colors', form[key] ? 'bg-primary' : 'bg-secondary border border-border')}
      >
        <span className={cn('absolute top-0.5 w-5 h-5 bg-white transition-transform', form[key] ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">Timer Settings</h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {field('Focus Duration (min)', 'focusMinutes', 1, 120)}
          {field('Short Break (min)', 'shortBreakMinutes', 1, 60)}
          {field('Long Break (min)', 'longBreakMinutes', 1, 120)}
          {field('Sessions Until Long Break', 'sessionsUntilLongBreak', 1, 10)}
          <div className="pt-2 space-y-3 border-t border-border">
            {toggle('Auto-start Breaks', 'autoStartBreaks')}
            {toggle('Auto-start Focus', 'autoStartFocus')}
            {toggle('Sound Notifications', 'soundEnabled')}
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 bg-secondary text-secondary-foreground py-2 text-sm font-medium hover:bg-secondary/80 transition-colors">Cancel</button>
          <button onClick={() => { onSave(form); onClose(); }} className="flex-1 bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
};


const Focus = () => {
  const [mode, setMode] = useState('focus');
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('bickle-pomodoro-settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });
  const [secondsLeft, setSecondsLeft] = useState(settings.focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [totalFocusSeconds, setTotalFocusSeconds] = useState(0);

  const intervalRef = useRef(null);
  const modeRef = useRef(mode);
  const settingsRef = useRef(settings);
  modeRef.current = mode;
  settingsRef.current = settings;

  // Fetch tasks on mount
  useEffect(() => {
    axios.get('/tasks').then(res => {
      setTasks(res.data.filter(t => t.status !== 'completed'));
    }).catch(() => {});
  }, []);

  // Duration for current mode
  const getDuration = useCallback((m, s) => {
    if (m === 'focus') return s.focusMinutes * 60;
    if (m === 'shortBreak') return s.shortBreakMinutes * 60;
    return s.longBreakMinutes * 60;
  }, []);

  // Reset timer when mode or settings change (but not while running)
  useEffect(() => {
    if (!isRunning) {
      setSecondsLeft(getDuration(mode, settings));
    }
  }, [mode, settings, getDuration]);

  // Advance to next mode after session ends
  const advanceMode = useCallback(() => {
    const s = settingsRef.current;
    const currentMode = modeRef.current;
    if (currentMode === 'focus') {
      const newCount = sessionCount + 1;
      setSessionCount(newCount);
      setCompletedSessions(prev => [...prev, { id: Date.now(), mode: 'focus' }]);
      const nextMode = newCount % s.sessionsUntilLongBreak === 0 ? 'longBreak' : 'shortBreak';
      setMode(nextMode);
      setSecondsLeft(getDuration(nextMode, s));
      if (s.soundEnabled) playBeep('end');
      if (s.autoStartBreaks) setIsRunning(true); else setIsRunning(false);
    } else {
      setCompletedSessions(prev => [...prev, { id: Date.now(), mode: currentMode }]);
      setMode('focus');
      setSecondsLeft(getDuration('focus', s));
      if (s.soundEnabled) playBeep('end');
      if (s.autoStartFocus) setIsRunning(true); else setIsRunning(false);
    }
  }, [sessionCount, getDuration]);


  // Countdown tick
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            advanceMode();
            return 0;
          }
          if (modeRef.current === 'focus') {
            setTotalFocusSeconds(t => t + 1);
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, advanceMode]);

  // Update document title
  useEffect(() => {
    const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const secs = String(secondsLeft % 60).padStart(2, '0');
    document.title = isRunning ? `${mins}:${secs} — ${MODES[mode].label} | Bickle` : 'Focus | Bickle';
    return () => { document.title = 'Bickle'; };
  }, [secondsLeft, isRunning, mode]);

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('bickle-pomodoro-settings', JSON.stringify(newSettings));
    setIsRunning(false);
    setSecondsLeft(getDuration(mode, newSettings));
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft(getDuration(mode, settings));
  };

  const handleSkip = () => {
    setIsRunning(false);
    advanceMode();
  };

  const handleModeSwitch = (newMode) => {
    setIsRunning(false);
    setMode(newMode);
    setSecondsLeft(getDuration(newMode, settings));
  };

  const handleToggleTask = async (task) => {
    try {
      const newStatus = task.status === 'completed' ? 'todo' : 'completed';
      await axios.put(`/tasks/${task._id}`, { status: newStatus });
      setTasks(prev => newStatus === 'completed'
        ? prev.filter(t => t._id !== task._id)
        : prev.map(t => t._id === task._id ? { ...t, status: newStatus } : t)
      );
      if (selectedTaskId === task._id && newStatus === 'completed') setSelectedTaskId(null);
    } catch (_) {}
  };

  const totalDuration = getDuration(mode, settings);
  const progress = totalDuration > 0 ? (totalDuration - secondsLeft) / totalDuration : 0;
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  // SVG ring
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);
  const modeColor = MODES[mode].color;

  const focusMinutesTotal = Math.floor(totalFocusSeconds / 60);
  const selectedTask = tasks.find(t => t._id === selectedTaskId);


  return (
    <div className="h-full flex flex-col gap-6">
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Focus Timer</h1>
          <p className="text-muted-foreground">Stay in the zone with Pomodoro technique</p>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Timer settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">

        {/* Timer column */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Mode tabs */}
          <div className="flex gap-1 bg-secondary border border-border p-1">
            {Object.entries(MODES).map(([key, val]) => (
              <button
                key={key}
                onClick={() => handleModeSwitch(key)}
                className={cn(
                  'flex-1 py-2 text-sm font-medium transition-all',
                  mode === key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {val.label}
              </button>
            ))}
          </div>

          {/* Timer ring */}
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="relative">
              <svg width="220" height="220" viewBox="0 0 220 220">
                {/* Track */}
                <circle cx="110" cy="110" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                {/* Progress */}
                <circle
                  cx="110" cy="110" r={radius}
                  fill="none"
                  stroke={modeColor}
                  strokeWidth="8"
                  strokeLinecap="butt"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 110 110)"
                  style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                />
              </svg>
              {/* Time display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold tabular-nums tracking-tight">{mins}:{secs}</span>
                <span className="text-sm text-muted-foreground mt-1 font-medium">{MODES[mode].label}</span>
                {selectedTask && (
                  <span className="text-xs text-muted-foreground mt-1 max-w-[140px] text-center truncate" title={selectedTask.title}>
                    {selectedTask.title}
                  </span>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleReset}
                className="p-3 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Reset"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsRunning(r => !r)}
                className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors"
              >
                {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                {isRunning ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={handleSkip}
                className="p-3 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Skip to next"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Session dots + stats */}
          <div className="bg-secondary border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Session Progress</span>
              <span className="text-sm text-muted-foreground">{sessionCount} focus sessions</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: settings.sessionsUntilLongBreak }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-8 h-8 flex items-center justify-center border transition-all',
                    i < (sessionCount % settings.sessionsUntilLongBreak || (sessionCount > 0 && sessionCount % settings.sessionsUntilLongBreak === 0 ? settings.sessionsUntilLongBreak : 0))
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  <Brain className="w-4 h-4" />
                </div>
              ))}
              <div className="w-8 h-8 flex items-center justify-center border border-dashed border-border text-muted-foreground" title="Long break">
                <Coffee className="w-4 h-4" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
              <div className="text-center">
                <p className="text-2xl font-bold">{sessionCount}</p>
                <p className="text-xs text-muted-foreground">Sessions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{focusMinutesTotal}</p>
                <p className="text-xs text-muted-foreground">Focus min</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{Math.floor(sessionCount / settings.sessionsUntilLongBreak)}</p>
                <p className="text-xs text-muted-foreground">Long breaks</p>
              </div>
            </div>
          </div>
        </div>


        {/* Task sidebar */}
        <div className="flex flex-col gap-4 min-h-0">
          <div className="bg-secondary border border-border p-5 flex flex-col gap-4 flex-1 min-h-0">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Focus On</h2>
            </div>

            {selectedTask ? (
              <div className="p-3 bg-primary/10 border border-primary/30">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{selectedTask.title}</p>
                  <button
                    onClick={() => setSelectedTaskId(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {selectedTask.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{selectedTask.description}</p>
                )}
                <span className={cn(
                  'inline-block mt-2 px-2 py-0.5 text-[10px] font-bold uppercase border',
                  selectedTask.priority === 'high' ? 'text-red-500 border-red-500/30 bg-red-500/10' :
                  selectedTask.priority === 'medium' ? 'text-orange-500 border-orange-500/30 bg-orange-500/10' :
                  'text-blue-500 border-blue-500/30 bg-blue-500/10'
                )}>
                  {selectedTask.priority}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Pick a task below to focus on.</p>
            )}

            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Your Tasks</p>
              <div className="space-y-2 overflow-y-auto max-h-64 pr-1">
                {tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No pending tasks.</p>
                )}
                {tasks.map(task => (
                  <div
                    key={task._id}
                    onClick={() => setSelectedTaskId(task._id === selectedTaskId ? null : task._id)}
                    className={cn(
                      'flex items-start gap-3 p-3 border cursor-pointer transition-all group',
                      task._id === selectedTaskId
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    )}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); handleToggleTask(task); }}
                      className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
                    >
                      <Circle className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <span className={cn(
                        'text-[10px] font-bold uppercase',
                        task.priority === 'high' ? 'text-red-500' :
                        task.priority === 'medium' ? 'text-orange-500' : 'text-blue-500'
                      )}>
                        {task.priority}
                      </span>
                    </div>
                    {task._id === selectedTaskId && (
                      <div className="w-2 h-2 bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sound toggle quick access */}
          <button
            onClick={() => handleSaveSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
            className={cn(
              'flex items-center gap-2 px-4 py-3 border text-sm font-medium transition-all',
              settings.soundEnabled
                ? 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            Sound {settings.soundEnabled ? 'On' : 'Off'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Focus;
