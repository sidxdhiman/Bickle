import {
  LayoutDashboard,
  CheckSquare,
  Calendar as CalendarIcon,
  FileText,
  Moon,
  DollarSign,
  Timer,
  Globe,
  Tally4,
  PenTool,
  FilePen,
  Palette,
  Workflow,
} from 'lucide-react';

export const PAGES = [
  { key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { key: 'tasks', label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { key: 'habits', label: 'Habits', path: '/habits', icon: Tally4 },
  { key: 'focus', label: 'Focus', path: '/focus', icon: Timer },
  { key: 'calendar', label: 'Calendar', path: '/calendar', icon: CalendarIcon },
  { key: 'notes', label: 'Notes', path: '/notes', icon: FileText },
  { key: 'whiteboard', label: 'Whiteboard', path: '/whiteboard', icon: PenTool },
  { key: 'pdf-editor', label: 'PDF Editor', path: '/pdf-editor', icon: FilePen },
  { key: 'sleep', label: 'Sleep', path: '/sleep', icon: Moon },
  { key: 'money', label: 'Money', path: '/money', icon: DollarSign },
  { key: 'translator', label: 'Translator', path: '/translator', icon: Globe },
  { key: 'workflows', label: 'Workflows', path: '/workflows', icon: Workflow },
  { key: 'art', label: 'Art', path: '/art', icon: Palette },
];

export const ALL_PAGE_KEYS = PAGES.map((page) => page.key);

// Dashboard is the owner's home and is not individually grantable.
export const GRANTABLE_PAGES = PAGES.filter((page) => page.key !== 'dashboard');
export const GRANTABLE_PAGE_KEYS = GRANTABLE_PAGES.map((page) => page.key);

export const pageByKey = (key) => PAGES.find((page) => page.key === key);
