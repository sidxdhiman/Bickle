import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, LogOut } from 'lucide-react';
import { PAGES } from '../config/pages';
import { useAccess } from '../context/AccessContext';
import { useDockSettings } from '../hooks/useDockSettings';

const SIGMA = 0.85;

const hexToRgba = (hex, alpha) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const hexLuminance = (hex) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const Dock = () => {
  const { isGuest, allowedPages, endGuest } = useAccess();
  const [settings] = useDockSettings();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    position,
    size,
    padding,
    gap,
    magnification,
    magnificationEnabled,
    color,
    opacity,
    showLabels,
    showTiles,
    showIndicators,
  } = settings;

  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (event) => setIsDesktop(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const vertical = isDesktop && position !== 'bottom';

  const navItems = PAGES.filter((page) => allowedPages.includes(page.key));

  const items = navItems.map((page) => ({
    id: page.key,
    label: page.label,
    to: page.path,
    Icon: page.icon,
  }));
  const groupStart = items.length;
  if (!isGuest) {
    items.push({ id: 'settings', label: 'Settings', to: '/settings', Icon: SettingsIcon });
  }
  items.push({
    id: 'session',
    label: isGuest ? 'Leave session' : 'Logout',
    Icon: LogOut,
    action: true,
  });

  const cellRefs = useRef([]);
  const [centers, setCenters] = useState([]);
  const [mouse, setMouse] = useState(null);

  useLayoutEffect(() => {
    const next = [];
    for (let i = 0; i < items.length; i += 1) {
      const el = cellRefs.current[i];
      next.push(el ? (vertical ? el.offsetTop + el.offsetHeight / 2 : el.offsetLeft + el.offsetWidth / 2) : 0);
    }
    setCenters(next);
  }, [size, padding, gap, vertical, items.length]);

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMouse(vertical ? event.clientY - rect.top : event.clientX - rect.left);
  };

  const handleMouseLeave = () => setMouse(null);

  const magFactor = magnificationEnabled ? Math.max(1, magnification / 100) : 1;
  let scales = null;
  let hovered = -1;

  if (mouse !== null && centers.length === items.length && items.length > 0) {
    let best = -1;
    let bestDist = Infinity;
    centers.forEach((center, index) => {
      const dist = Math.abs(center - mouse);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    if (bestDist <= size * 0.9) hovered = best;

    if (magFactor > 1) {
      scales = centers.map((center) => {
        const d = (center - mouse) / Math.max(size, 1);
        if (Math.abs(d) > 3) return 1;
        return 1 + (magFactor - 1) * Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
      });
    }
  }

  const isActive = (to) => (to === '/' ? location.pathname === '/' : location.pathname === to);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('backendToken');
    localStorage.removeItem('authUnlocked');
    localStorage.removeItem('profilePic');
    navigate('/');
    setTimeout(() => window.location.reload(), 50);
  };

  const handleAction = () => {
    if (isGuest) endGuest();
    else handleLogout();
  };

  const bg = color === 'auto' ? `hsl(var(--secondary) / ${opacity})` : hexToRgba(color, opacity);
  const contentColor = color === 'auto' ? undefined : hexLuminance(color) > 0.5 ? '#18181b' : '#f4f4f5';

  const dockPosClass =
    position === 'left' ? 'dock-pos-left' : position === 'right' ? 'dock-pos-right' : 'dock-pos-bottom';

  const iconPx = Math.max(14, Math.round(size * 0.52));
  const tileRadius = Math.max(8, Math.round(size * 0.3));

  return (
    <div
      className={`dock ${dockPosClass}`}
      style={{
        backgroundColor: bg,
        borderColor: color !== 'auto' ? 'rgba(255, 255, 255, 0.14)' : undefined,
        color: contentColor,
        padding: `${padding}px`,
        gap: `${gap}px`,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {navItems.length === 0 && (
        <span className="whitespace-nowrap px-2 text-xs text-muted-foreground">
          No modules are available for this session.
        </span>
      )}

      {items.map((item, index) => {
        const scale = scales ? scales[index] : 1;
        const active = item.to ? isActive(item.to) : false;
        const isHot = hovered === index;
        const transformOrigin = vertical
          ? position === 'left'
            ? 'center left'
            : 'center right'
          : 'bottom center';
        const extra = size * (scale - 1);
        const tooltipStyle = vertical
          ? position === 'left'
            ? { left: `calc(100% + ${8 + extra}px)`, top: '50%', transform: 'translateY(-50%)' }
            : { right: `calc(100% + ${8 + extra}px)`, top: '50%', transform: 'translateY(-50%)' }
          : { bottom: `calc(100% + ${8 + extra}px)`, left: '50%', transform: 'translateX(-50%)' };

        const tileAlpha = isHot ? 0.22 : 0.12;
        const customTileBg =
          showTiles && color !== 'auto'
            ? hexLuminance(color) > 0.5
              ? `rgba(0, 0, 0, ${tileAlpha})`
              : `rgba(255, 255, 255, ${tileAlpha})`
            : undefined;

        const inner = (
          <span
            className={
              showTiles && color === 'auto'
                ? `dock-tile-auto${isHot ? ' dock-tile-hot' : ''}`
                : undefined
            }
            style={{
              width: size,
              height: size,
              borderRadius: tileRadius,
              backgroundColor: customTileBg,
              transform: `scale(${scale.toFixed(3)})`,
              transformOrigin,
              transition: 'transform 120ms ease-out, background-color 150ms ease',
            }}
          >
            <span className="flex h-full w-full items-center justify-center select-none">
              <item.Icon style={{ width: iconPx, height: iconPx }} strokeWidth={1.8} />
            </span>
          </span>
        );

        return (
          <React.Fragment key={item.id}>
            {index === groupStart && (
              <div
                className={vertical ? 'h-px w-8 self-center' : 'w-px self-stretch'}
                style={{ backgroundColor: 'currentColor', opacity: 0.25 }}
              />
            )}
            <div
              ref={(el) => {
                cellRefs.current[index] = el;
              }}
              className="relative flex flex-col items-center"
              style={{ width: size }}
            >
              {item.action ? (
                <button
                  type="button"
                  onClick={handleAction}
                  aria-label={item.label}
                  className="flex shrink-0 cursor-pointer items-center justify-center text-current transition-colors hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  style={{ width: size, height: size }}
                >
                  {inner}
                </button>
              ) : (
                <NavLink
                  to={item.to}
                  aria-label={item.label}
                  className="flex shrink-0 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  style={{ width: size, height: size }}
                >
                  {inner}
                </NavLink>
              )}
              {showIndicators && (
                <span
                  className="mt-1 block h-1 w-1 rounded-[999px]"
                  style={active ? { backgroundColor: 'hsl(var(--primary))' } : undefined}
                />
              )}
              {showLabels && isHot && (
                <span
                  className="pointer-events-none absolute z-50 whitespace-nowrap border border-border bg-foreground px-2 py-1 text-xs font-medium text-background shadow-lg"
                  style={{ ...tooltipStyle, borderRadius: 8 }}
                >
                  {item.label}
                </span>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Dock;
