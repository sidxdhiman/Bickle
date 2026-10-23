import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, User, Clock, LogOut, Menu } from 'lucide-react';
import ProfileModal from './ProfileModal';
import { useAccess } from '../context/AccessContext';
import { useNavMode } from '../hooks/useNavMode';

const TopNav = ({ showMenu = false, onMenuClick }) => {
  const { isGuest, expiresAt, endGuest } = useAccess();
  const [navMode] = useNavMode();

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const [showProfile, setShowProfile] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [now, setNow] = useState(Date.now());
  const profileRef = useRef(null);

  useEffect(() => {
    const pic = localStorage.getItem('profilePic');
    setProfilePic(pic);
  }, [showProfile]);

  useEffect(() => {
    if (!isGuest) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isGuest]);

  const remaining = (() => {
    if (!isGuest || !expiresAt) return null;
    const ms = new Date(expiresAt).getTime() - now;
    if (ms <= 0) return '0m 00s';
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  })();

  return (
    <div className="sticky top-0 z-30 px-3 pt-3">
      <header className="flex h-14 items-center justify-between gap-3 rounded-[18px] border border-border bg-secondary/70 px-3 shadow-lg shadow-black/5 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          {showMenu && navMode === 'sidebar' && onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open navigation"
              className="p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative flex items-center justify-center w-9 h-9 overflow-hidden">
              <div className="absolute w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_75%,hsl(var(--primary))_100%)] animate-[spin_3s_linear_infinite]" />
              <div className="relative z-10 flex items-center justify-center w-[calc(100%-4px)] h-[calc(100%-4px)] bg-secondary">
                <img src="/bickle_icon.png" alt="Bickle" className="w-full h-full object-contain p-1" />
              </div>
            </div>
            <span className="text-lg font-bold tracking-tight">Bickle</span>
          </div>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Quick search..."
              className="pl-9 pr-4 py-1.5 bg-background/60 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary w-44 lg:w-64 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-sm text-muted-foreground font-medium hidden lg:block">
            {today}
          </div>
          {isGuest ? (
            <>
              <span className="hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Clock className="w-3.5 h-3.5" />
                Guest · {remaining} left
              </span>
              <button
                onClick={endGuest}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                End session
              </button>
            </>
          ) : (
            <>
              <button className="p-2 hover:bg-accent transition-colors relative">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-primary border-2 border-secondary"></span>
              </button>
              <div ref={profileRef} className="flex items-center gap-3 pl-3 border-l border-border">
                <div className="text-right hidden sm:block cursor-pointer" onClick={() => setShowProfile(true)}>
                  <p className="text-sm font-semibold leading-none">Sidharth</p>
                  <p className="text-xs text-muted-foreground">Pro Plan</p>
                </div>
                <button onClick={() => setShowProfile(true)} className="w-9 h-9 bg-accent flex items-center justify-center overflow-hidden border border-border cursor-pointer hover:ring-2 ring-primary transition-all">
                  {profilePic ? (
                    <img src={profilePic} alt="profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-muted-foreground" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {!isGuest && <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />}
    </div>
  );
};

export default TopNav;
