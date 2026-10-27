import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Dock from '../components/Dock';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import BackgroundLayer from '../components/BackgroundLayer';
import { useDockSettings } from '../hooks/useDockSettings';
import { useNavMode } from '../hooks/useNavMode';

const MainLayout = () => {
  const [settings] = useDockSettings();
  const [navMode] = useNavMode();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const mainRef = useRef(null);
  const { pathname } = useLocation();

  // Start each page at the top — like a fresh, polished navigation
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  const dockMode = navMode !== 'sidebar';

  const spaceClass = !dockMode
    ? ''
    : settings.position === 'left'
      ? 'dock-space dock-space-left'
      : settings.position === 'right'
        ? 'dock-space dock-space-right'
        : 'dock-space';

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <BackgroundLayer />
      {!dockMode && (
        <>
          <div
            className={`fixed inset-0 bg-black/50 z-40 md:hidden ${isSidebarOpen ? 'block' : 'hidden'}`}
            onClick={() => setIsSidebarOpen(false)}
          ></div>
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </>
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <TopNav
          showMenu={!dockMode}
          onMenuClick={() => setIsSidebarOpen((open) => !open)}
        />
        <main
          ref={mainRef}
          className={`flex-1 overflow-y-auto p-6 pt-4 scrollbar-hide ${spaceClass}`}
          style={
            dockMode
              ? { '--dock-footprint': `${settings.size + settings.padding * 2 + 28}px` }
              : undefined
          }
        >
          <Outlet />
        </main>
      </div>

      {dockMode && <Dock />}
    </div>
  );
};

export default MainLayout;
