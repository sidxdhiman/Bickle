import React, { useState, useEffect } from 'react';
import { Search, Bell, User } from 'lucide-react';
import ProfileModal from './ProfileModal';
import { useNavigate } from 'react-router-dom';

const TopNav = () => {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const [showProfile, setShowProfile] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const pic = localStorage.getItem('profilePic');
    setProfilePic(pic);
  }, [showProfile]);

  return (
    <header className="h-16 border-b border-border bg-background/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Quick search..."
            className="pl-9 pr-4 py-1.5 bg-secondary border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary w-64 transition-all"
          />
        </div>
        <div className="text-sm text-muted-foreground font-medium ml-4 hidden md:block">
          {today}
        </div>
      </div>

        <div className="flex items-center gap-4">
        <button className="p-2 rounded-full hover:bg-accent transition-colors relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right hidden sm:block cursor-pointer" onClick={() => setShowProfile(true)}>
            <p className="text-sm font-semibold leading-none">Sidharth</p>
            <p className="text-xs text-muted-foreground">Pro Plan</p>
          </div>
          <div onClick={() => setShowProfile(true)} className="w-9 h-9 bg-accent rounded-full flex items-center justify-center overflow-hidden border border-border cursor-pointer hover:ring-2 ring-primary transition-all">
            {profilePic ? (
              <img src={profilePic} alt="profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
        </div>
        <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
      </div>
    </header>
  );
};

export default TopNav;
