export const getSavedTheme = () => {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem('bickle-theme') || 'dark';
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
  }
};
