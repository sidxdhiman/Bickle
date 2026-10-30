import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Clock, CheckCircle2, LogOut, X, Paperclip } from 'lucide-react';
import { PAGES } from '../config/pages';

const formatRemaining = (expiresAt) => {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '0m 00s';
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

const GuestWelcomeModal = ({ allowedPages, sharedItems = [], expiresAt, onClose, onEnd }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const granted = PAGES.filter((page) => allowedPages.includes(page.key));

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-background border border-border w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">You&apos;ve been granted access</h2>
              <p className="text-xs text-muted-foreground">You&apos;re viewing this workspace as a guest</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          <div className="p-3 rounded-lg bg-secondary/40 border border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" /> Access ends in
            </span>
            <span className="text-sm font-semibold">{formatRemaining(expiresAt, now)}</span>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">What you can access</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {granted.map((page) => (
                <div key={page.key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/30">
                  <page.icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm">{page.label}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Everything else stays hidden and locked. Please use this access responsibly and only for what it was shared for.
            </p>
          </div>

          {sharedItems.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Shared with you</p>
              <div className="space-y-1">
                {sharedItems.slice(0, 8).map((item, idx) => (
                  <div
                    key={`${item.itemId}-${idx}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/25 bg-primary/5 text-sm"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="flex-1 truncate">{item.title || 'Shared item'}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {PAGES.find((page) => page.key === item.page)?.label || item.page}
                    </span>
                  </div>
                ))}
                {sharedItems.length > 8 && (
                  <p className="text-xs text-muted-foreground">+{sharedItems.length - 8} more inside</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 p-5 sm:p-6 border-t border-border">
          <button
            onClick={onEnd}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            End session
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-semibold"
          >
            Got it, continue
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GuestWelcomeModal;
