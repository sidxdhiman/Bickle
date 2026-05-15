import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings as SettingsIcon, Palette, Type, AlertTriangle, Trash2, Moon, Sun } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SettingsSkeleton } from '../components/Skeletons';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const fontOptions = [
  { id: 'inter', label: 'Inter', fontFamily: '"Inter", sans-serif' },
  { id: 'system', label: 'System UI', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' },
  { id: 'helvetica', label: 'Helvetica', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
];

const Settings = () => {
  const [theme, setTheme] = useState('dark');
  const [font, setFont] = useState('inter');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const savedTheme = localStorage.getItem('bickle-theme') || 'dark';
    const savedFont = localStorage.getItem('bickle-font') || 'inter';

    setTheme(savedTheme);
    setFont(savedFont);

    // Apply theme
    applyTheme(savedTheme);
    // Apply font
    applyFont(savedFont);
  }, []);

  const applyTheme = (newTheme) => {
    const root = document.documentElement;
    if (newTheme === 'light') {
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

  const applyFont = (newFont) => {
    const fontOption = fontOptions.find(f => f.id === newFont);
    if (fontOption) {
      document.body.style.fontFamily = fontOption.fontFamily;
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('bickle-theme', newTheme);
    applyTheme(newTheme);
  };

  const handleFontChange = (newFont) => {
    setFont(newFont);
    localStorage.setItem('bickle-font', newFont);
    applyFont(newFont);
  };

  const handleDeleteAllData = async () => {
    if (!showConfirmDelete) {
      setShowConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    try {
      await axios.delete('/settings/delete-all-data');
      alert('All data has been deleted successfully. The page will reload.');
      window.location.reload();
    } catch (error) {
      console.error('Error deleting data:', error);
      alert('Failed to delete data. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      {/* Theme Settings */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold">Appearance</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Theme</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleThemeChange('light')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                  theme === 'light'
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-accent"
                )}
              >
                <Sun className="w-4 h-4" />
                Light
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                  theme === 'dark'
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-accent"
                )}
              >
                <Moon className="w-4 h-4" />
                Dark
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Font Settings */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Type className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold">Typography</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Font Family</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {fontOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleFontChange(option.id)}
                  className={cn(
                    "px-4 py-3 rounded-lg border text-left transition-all",
                    font === option.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-border hover:bg-accent"
                  )}
                  style={{ fontFamily: option.fontFamily }}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm opacity-75">The quick brown fox jumps over the lazy dog</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          <h2 className="text-xl font-semibold text-red-700 dark:text-red-300">Danger Zone</h2>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
            <h3 className="font-medium text-red-800 dark:text-red-200 mb-2">Delete All Data</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mb-4">
              This action will permanently delete all your tasks, notes, calendar events, sleep records, and task lists.
              This cannot be undone.
            </p>
            {!showConfirmDelete ? (
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Everything
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Are you sure? Type "DELETE" to confirm:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type DELETE to confirm"
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-600 rounded-lg text-red-900 dark:text-red-100 placeholder-red-400 dark:placeholder-red-500"
                    onChange={(e) => {
                      if (e.target.value === 'DELETE') {
                        handleDeleteAllData();
                      }
                    }}
                  />
                  <button
                    onClick={() => setShowConfirmDelete(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;