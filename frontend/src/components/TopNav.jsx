import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, User, Clock, LogOut } from 'lucide-react';
import ProfileModal from './ProfileModal';
import { useAccess } from '../context/AccessContext';

const TopNav = () => {
  const { isGuest, expiresAt, endGuest } = useAccess();

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
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4 w-full md:w-auto">
        <div className="relative flex-1 md:flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Quick search..."
            className="pl-9 pr-4 py-1.5 bg-secondary border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full md:w-64 transition-all"
          />
        </div>
        <div className="text-sm text-muted-foreground font-medium hidden md:block">
          {today}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isGuest ? (
          <>
            <span className="hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Clock className="w-3.5 h-3.5" />
              Guest · {remaining} left
            </span>
            <button
              onClick={endGuest}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              End session
            </button>
          </>
        ) : (
          <>
            <button className="p-2 rounded-full hover:bg-accent transition-colors relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
            </button>
            <div ref={profileRef} className="relative flex items-center gap-3 pl-4 border-l border-border">
              <div className="text-right hidden sm:block cursor-pointer" onClick={() => setShowProfile(true)}>
                <p className="text-sm font-semibold leading-none">Sidharth</p>
                <p className="text-xs text-muted-foreground">Pro Plan</p>
              </div>
              <button onClick={() => setShowProfile(true)} className="w-9 h-9 bg-accent rounded-full flex items-center justify-center overflow-hidden border border-border cursor-pointer hover:ring-2 ring-primary transition-all">
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

      {!isGuest && <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />}
    </header>
  );
};

export default TopNav;
