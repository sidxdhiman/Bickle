import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, MessageSquare, AlertTriangle, CheckCircle2, CalendarClock, Tally4, CheckCheck } from 'lucide-react';
import useNotifications from '../hooks/useNotifications';

const GROUP_ICONS = {
  chat: MessageSquare,
  tasks: AlertTriangle,
  events: CalendarClock,
  habits: Tally4,
};

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { groups, total, dismissibleIds, dismiss, dismissAll, refreshNow } = useNotifications();
  const navigate = useNavigate();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) refreshNow();
  };

  const goTo = (to) => {
    setOpen(false);
    navigate(to);
  };

  const onItemKeyDown = (event, to) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      goTo(to);
    }
  };

  const badgeLabel = total > 99 ? '99+' : total;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={total > 0 ? `Notifications, ${total} new` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        className="p-2 rounded-lg hover:bg-accent transition-colors relative"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-secondary">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-secondary/95 shadow-xl shadow-black/10 backdrop-blur-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            {dismissibleIds.length > 0 && (
              <button
                type="button"
                onClick={() => dismissAll(dismissibleIds)}
                className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-[min(28rem,60vh)] overflow-y-auto overscroll-contain py-1.5">
            {groups.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-6 h-6 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm font-medium">You're all caught up</p>
                <p className="text-xs text-muted-foreground mt-0.5">New reminders will show up here</p>
              </div>
            ) : groups.map((group) => {
              const GroupIcon = GROUP_ICONS[group.key];
              return (
                <div key={group.key} className="mb-1 last:mb-0">
                  <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => goTo(item.to)}
                      onKeyDown={(event) => onItemKeyDown(event, item.to)}
                      className="group flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/70 focus:outline-none focus:bg-accent/70 transition-colors"
                    >
                      <span
                        className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                          item.urgent ? 'bg-red-500/15 text-red-500' : 'bg-accent text-muted-foreground'
                        }`}
                      >
                        <GroupIcon className="w-3.5 h-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug truncate">{item.title}</span>
                        <span className="block text-xs text-muted-foreground leading-snug truncate">{item.subtitle}</span>
                      </span>
                      {item.dismissible !== false && (
                        <button
                          type="button"
                          aria-label={`Dismiss ${item.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            dismiss(item.id);
                          }}
                          className="shrink-0 p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-accent hover:text-foreground transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
