import { hexToHsl } from './colorUtils';

const DEFAULT_ACCENT = { primary: '262.1 83.3% 57.8%', primaryForeground: '210 20% 98%' };

export const getSavedTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem('bickle-theme') || 'dark';
};

const getSavedAccentHex = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('bickle-background');
    if (!raw) return null;
    const settings = JSON.parse(raw);
    if (!settings.accentAuto || settings.type === 'none') return null;
    return settings.accentHex || null;
  } catch (error) {
    return null;
  }
};

export const applyAccentColor = (hex) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!hex) {
    root.style.setProperty('--primary', DEFAULT_ACCENT.primary);
    root.style.setProperty('--primary-foreground', DEFAULT_ACCENT.primaryForeground);
    return;
  }
  const { h, s, l } = hexToHsl(hex);
  const usableSat = Math.min(100, Math.max(48, s));
  const usableLight = Math.min(64, Math.max(46, l));
  root.style.setProperty('--primary', `${h.toFixed(1)} ${usableSat.toFixed(1)}% ${usableLight.toFixed(1)}%`);
  root.style.setProperty('--primary-foreground', usableLight > 55 ? '240 10% 9%' : '210 20% 98%');
};

export const applyTheme = (theme) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.remove('dark');
    root.style.setProperty('--background', '0 0% 100%');
    root.style.setProperty('--foreground', '240 10% 3.9%');
    root.style.setProperty('--border', '240 5.9% 90%');
    root.style.setProperty('--input', '240 5.9% 90%');
    root.style.setProperty('--ring', '240 4.9% 83.9%');
    root.style.setProperty('--primary', '262.1 83.3% 57.8%');
    root.style.setProperty('--primary-foreground', '210 20% 98%');
    root.style.setProperty('--secondary', '240 5.9% 96.1%');
    root.style.setProperty('--secondary-foreground', '240 5.9% 10%');
    root.style.setProperty('--accent', '240 5.9% 96.1%');
    root.style.setProperty('--accent-foreground', '240 5.9% 10%');
    root.style.setProperty('--muted', '240 5.9% 96.1%');
    root.style.setProperty('--muted-foreground', '240 3.8% 46.1%');
    root.style.setProperty('--destructive', '0 84.2% 60.2%');
    root.style.setProperty('--destructive-foreground', '0 0% 98%');
    root.style.setProperty('--card', '0 0% 100%');
  } else {
    root.classList.add('dark');
    root.style.setProperty('--background', '240 10% 3.9%');
    root.style.setProperty('--foreground', '0 0% 98%');
    root.style.setProperty('--border', '240 3.7% 15.9%');
    root.style.setProperty('--input', '240 3.7% 15.9%');
    root.style.setProperty('--ring', '240 4.9% 83.9%');
    root.style.setProperty('--primary', '262.1 83.3% 57.8%');
    root.style.setProperty('--primary-foreground', '210 20% 98%');
    root.style.setProperty('--secondary', '240 3.7% 15.9%');
    root.style.setProperty('--secondary-foreground', '0 0% 98%');
    root.style.setProperty('--accent', '240 3.7% 15.9%');
    root.style.setProperty('--accent-foreground', '0 0% 98%');
    root.style.setProperty('--muted', '240 3.7% 15.9%');
    root.style.setProperty('--muted-foreground', '240 5% 64.9%');
    root.style.setProperty('--destructive', '0 62.8% 30.6%');
    root.style.setProperty('--destructive-foreground', '0 0% 98%');
    root.style.setProperty('--card', '240 10% 3.9%');
  }

  applyAccentColor(getSavedAccentHex());

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bickle-theme-change', { detail: theme }));
  }
};
