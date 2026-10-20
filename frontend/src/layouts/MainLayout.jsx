import React from 'react';
import { Outlet } from 'react-router-dom';
import Dock from '../components/Dock';
import TopNav from '../components/TopNav';
import { useDockSettings } from '../hooks/useDockSettings';

const MainLayout = () => {
  const [settings] = useDockSettings();

  const spaceClass =
    settings.position === 'left'
      ? 'dock-space dock-space-left'
      : settings.position === 'right'
        ? 'dock-space dock-space-right'
        : 'dock-space';

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav />
        <main
          className={`flex-1 overflow-y-auto p-6 scrollbar-hide ${spaceClass}`}
          style={{ '--dock-footprint': `${settings.size + 44}px` }}
        >
          <Outlet />
        </main>
      </div>
      <Dock />
    </div>
  );
};

export default MainLayout;
