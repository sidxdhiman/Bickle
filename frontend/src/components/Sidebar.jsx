import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar as CalendarIcon,
  FileText,
  Moon,
  DollarSign,
  Timer,
  Settings,
  Globe,
  LogOut,
  X,
  Tally4
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
  { icon: Tally4, label: 'Habits', path: '/habits' },
  { icon: Timer, label: 'Focus', path: '/focus' },
  { icon: CalendarIcon, label: 'Calendar', path: '/calendar' },
  { icon: FileText, label: 'Notes', path: '/notes' },
  { icon: Moon, label: 'Sleep', path: '/sleep' },
  { icon: DollarSign, label: 'Money', path: '/money' },
  { icon: Globe, label: 'Translator', path: '/translator' },
];

const Sidebar = ({ isOpen, onClose }) => {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 h-full bg-secondary border-r border-border flex flex-col p-4 gap-8 transition-transform duration-300 md:relative md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center gap-3 px-2 py-4">
        <button
          className="md:hidden absolute top-4 right-4 p-2 rounded-full text-foreground hover:bg-accent"
          onClick={onClose}
        >
          <X className="w-6 h-6" />
        </button>
        <div className="relative flex items-center justify-center w-10 h-10 overflow-hidden">
          <div className="absolute w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_75%,hsl(var(--primary))_100%)] animate-[spin_3s_linear_infinite]" />
          <div className="relative z-10 flex items-center justify-center w-[calc(100%-4px)] h-[calc(100%-4px)] bg-secondary">
            <img src="/bickle_icon.png" alt="Bickle Icon" className="w-full h-full object-contain p-1" />
          </div>
        </div>
        <span className="text-xl font-bold tracking-tight">Bickle</span>
      </div>

      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => (
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
            onClick={onClose} // Close sidebar on nav item click
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-border flex flex-col gap-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn("flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
            isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")
          }
          onClick={onClose} // Close sidebar on nav item click
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </NavLink>
        <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive transition-all duration-200">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
