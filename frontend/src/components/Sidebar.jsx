import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Settings, LogOut, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PAGES } from '../config/pages';
import { useAccess } from '../context/AccessContext';
import { useChatUnread } from '../hooks/useChatUnread';
import { clearSearchIndex } from '../utils/searchIndex';
import { endActiveProfile } from '../utils/profileState';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Sidebar = ({ isOpen, onClose }) => {
  const { isGuest, allowedPages, endGuest } = useAccess();
  const chatUnread = useChatUnread();
  const navigate = useNavigate();
  const navItems = PAGES.filter((page) => allowedPages.includes(page.key));

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('backendToken');
    localStorage.removeItem('authUnlocked');
    endActiveProfile();
    clearSearchIndex().catch(() => {});
    onClose?.();
    navigate('/');
    setTimeout(() => window.location.reload(), 50);
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 h-full bg-secondary border-r border-border flex flex-col p-4 gap-8 transition-transform duration-300 md:relative md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <button
        className="md:hidden absolute top-4 right-4 p-2 text-foreground hover:bg-accent"
        onClick={onClose}
        aria-label="Close navigation"
      >
        <X className="w-6 h-6" />
      </button>

      <nav className="flex-1 flex flex-col gap-2 overflow-y-auto mt-10 md:mt-2">
        {navItems.length === 0 ? (
          <p className="text-sm text-muted-foreground px-2">No modules are available for this session.</p>
        ) : (
          navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
              onClick={onClose}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium flex-1">{item.label}</span>
              {item.key === 'chat' && chatUnread > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </NavLink>
          ))
        )}
      </nav>

      <div className="mt-auto pt-4 border-t border-border flex flex-col gap-2">
        {!isGuest && (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn("flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")
            }
            onClick={onClose}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </NavLink>
        )}
        {isGuest ? (
          <button
            onClick={endGuest}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Leave session</span>
          </button>
        ) : (
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
