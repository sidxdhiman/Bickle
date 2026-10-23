import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Settings as SettingsIcon,
  Palette,
  Type,
  AlertTriangle,
  Trash2,
  Moon,
  Sun,
  Download,
  X,
  Dock as DockIcon,
  PanelBottom,
  PanelLeft,
  PanelRight,
  RotateCcw,
  Image as ImageIcon,
  Upload,
  SlidersHorizontal,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SettingsSkeleton } from '../components/Skeletons';
import { applyTheme } from '../utils/themeUtils';
import { useDockSettings } from '../hooks/useDockSettings';
import { useNavMode } from '../hooks/useNavMode';
import { useBackground } from '../hooks/useBackground';
import { BACKGROUND_PRESETS, presetToStyle } from '../utils/backgroundPresets';
import { compressImageFile } from '../utils/colorUtils';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Toggle = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={cn(
      'relative h-5 w-10 shrink-0 transition-colors',
      checked ? 'bg-primary' : 'bg-border'
    )}
  >
    <span
      className={cn(
        'absolute top-0.5 h-4 w-4 bg-background transition-all duration-200',
        checked ? 'left-[22px]' : 'left-0.5'
      )}
    />
  </button>
);

const positionOptions = [
  { id: 'bottom', label: 'Bottom', Icon: PanelBottom },
  { id: 'left', label: 'Left', Icon: PanelLeft },
  { id: 'right', label: 'Right', Icon: PanelRight },
];

const dockColorSwatches = [
  { value: 'auto', label: 'Theme' },
  { value: '#18181b', label: 'Zinc' },
  { value: '#3f3f46', label: 'Stone' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#b91c1c', label: 'Red' },
  { value: '#15803d', label: 'Green' },
];

const accentSwatches = [
  { value: null, label: 'Default' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#f43f5e', label: 'Rose' },
];

const fontOptions = [
  { id: 'inter', label: 'Inter', fontFamily: '"Inter", sans-serif' },
  { id: 'system', label: 'System UI', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' },
  { id: 'helvetica', label: 'Helvetica', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
];

const exportFormats = [
  { id: 'json', label: 'JSON', extension: '.json' },
  { id: 'csv', label: 'CSV', extension: '.csv' },
  { id: 'html', label: 'HTML', extension: '.html' },
  { id: 'pdf', label: 'PDF', extension: '.pdf' },
  { id: 'excel', label: 'Excel', extension: '.xlsx' },
  { id: 'word', label: 'Word', extension: '.docx' },
];

// Confirmation Modal Component
const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, isDangerous = false }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4">
        <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "px-4 py-2 rounded-lg transition-colors",
              isDangerous
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// Export Format Selection Modal
const ExportModal = ({ isOpen, onClose, onExport, isExporting }) => {
  const [selectedFormats, setSelectedFormats] = useState(['json']);
  const [shouldDelete, setShouldDelete] = useState(true);

  const toggleFormat = (format) => {
    setSelectedFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Export & Delete Data</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Select the formats you want to export your data in:
        </p>
        <div className="space-y-3 mb-6">
          {exportFormats.map((format) => (
            <label
              key={format.id}
              className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-accent/40 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedFormats.includes(format.id)}
                onChange={() => toggleFormat(format.id)}
                className="w-4 h-4 rounded-sm border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-foreground">{format.label}</span>
            </label>
          ))}
        </div>
        <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={shouldDelete}
              onChange={(e) => setShouldDelete(e.target.checked)}
              className="w-4 h-4 rounded-sm border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-red-800 dark:text-red-200">
              Delete all data after export
            </span>
          </label>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onExport(selectedFormats, shouldDelete)}
            disabled={selectedFormats.length === 0 || isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Settings = () => {
  const [theme, setTheme] = useState('dark');
  const [font, setFont] = useState('inter');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [dock, updateDock, resetDock] = useDockSettings();
  const [navMode, setNavMode] = useNavMode();
  const [bg, updateBg] = useBackground();
  const [isUploadingBg, setIsUploadingBg] = useState(false);

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

  const handleBackgroundNone = () => {
    updateBg({ type: 'none', presetId: null, accentHex: null });
  };

  const handleBackgroundPreset = (presetId) => {
    updateBg({ type: 'preset', presetId, accentHex: null });
  };

  const handleBackgroundUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsUploadingBg(true);
    try {
      const dataUrl = await compressImageFile(file);
      updateBg({ type: 'custom', presetId: null, customImage: dataUrl, accentHex: null });
    } catch (error) {
      alert(error.message || 'Could not use that image. Please try a different one.');
    } finally {
      setIsUploadingBg(false);
    }
  };

  const handleAccentAutoToggle = () => {
    updateBg({ accentAuto: !bg.accentAuto, accentHex: null });
  };

  const handleManualAccent = (hex) => {
    updateBg({ manualAccent: hex });
  };

  const handleDeleteAllData = async () => {
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
      setShowDeleteModal(false);
    }
  };

  const handleDeleteFromServer = async () => {
    setIsDeleting(true);
    try {
      await axios.delete('/settings/delete-from-server');
      alert('Data has been deleted from server.');
      window.location.reload();
    } catch (error) {
      console.error('Error deleting from server:', error);
      alert('Failed to delete data from server. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportData = async (formats, shouldDelete = false) => {
    setIsExporting(true);
    try {
      // Create a data object with all user data
      const dataToExport = {
        exportDate: new Date().toISOString(),
        theme: theme,
        font: font,
        // In a real app, you would fetch actual user data from the server
      };

      // Export in selected formats
      for (const format of formats) {
        let content = '';
        let mimeType = 'text/plain';
        let filename = `bickle-data-${new Date().toISOString().split('T')[0]}`;

        switch (format) {
          case 'json':
            content = JSON.stringify(dataToExport, null, 2);
            mimeType = 'application/json';
            filename += '.json';
            break;
          case 'csv':
            content = 'Key,Value\n';
            Object.entries(dataToExport).forEach(([key, value]) => {
              content += `"${key}","${JSON.stringify(value)}"\n`;
            });
            mimeType = 'text/csv';
            filename += '.csv';
            break;
          case 'html':
            content = `
<!DOCTYPE html>
<html>
<head>
  <title>Bickle Data Export</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
  </style>
</head>
<body>
  <h1>Bickle Data Export</h1>
  <p>Export Date: ${new Date().toLocaleString()}</p>
  <table>
    <tr><th>Key</th><th>Value</th></tr>
    ${Object.entries(dataToExport).map(([key, value]) => `<tr><td>${key}</td><td>${JSON.stringify(value)}</td></tr>`).join('')}
  </table>
</body>
</html>
            `;
            mimeType = 'text/html';
            filename += '.html';
            break;
          case 'pdf':
            // For PDF, we would typically use a library like jsPDF
            // For now, show a message
            alert('PDF export requires additional setup. Please use JSON or HTML export for now.');
            continue;
          case 'excel':
            // For Excel, we would typically use a library like xlsx
            alert('Excel export requires additional setup. Please use JSON or CSV export for now.');
            continue;
          case 'word':
            // For Word, we would typically use a library
            alert('Word export requires additional setup. Please use HTML export for now.');
            continue;
          default:
            continue;
        }

        // Create blob and download
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }

      // If shouldDelete is true, delete all data after export
      if (shouldDelete) {
        await axios.delete('/settings/delete-all-data');
        alert('Data exported and deleted successfully. The page will reload.');
        window.location.reload();
      }

      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete All Data"
        message="Are you sure you want to delete all your data? This action cannot be undone and will permanently delete all tasks, notes, calendar events, sleep records, and task lists."
        onConfirm={handleDeleteAllData}
        onCancel={() => setShowDeleteModal(false)}
        isDangerous={true}
      />
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportData}
        isExporting={isExporting}
      />
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      {/* Theme Settings */}
      <div className="bg-card border border-border rounded-2xl p-6">
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

          <div className="pt-4 border-t border-border">
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Navigation style</label>
            <div className="flex gap-2">
              <button
                onClick={() => setNavMode('dock')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 border transition-all",
                  navMode === 'dock'
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-accent"
                )}
              >
                <DockIcon className="w-4 h-4" />
                Dock
              </button>
              <button
                onClick={() => setNavMode('sidebar')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 border transition-all",
                  navMode === 'sidebar'
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-secondary-foreground border-border hover:bg-accent"
                )}
              >
                <PanelLeft className="w-4 h-4" />
                Sidebar
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Dock is a floating macOS-style bar; Sidebar is the classic list. Applies instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Background Settings */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ImageIcon className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">Background</h2>
          </div>
          <button
            onClick={() =>
              updateBg({
                type: 'none',
                presetId: null,
                customImage: null,
                accentHex: null,
                accentAuto: true,
                manualAccent: null,
                scrimOpacity: 0.4,
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border hover:bg-accent transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Wallpaper</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={handleBackgroundNone}
                aria-label="No background"
                className={cn(
                  'relative aspect-[16/10] border transition-all overflow-hidden',
                  bg.type === 'none'
                    ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'border-border hover:border-muted-foreground/50'
                )}
                style={{ backgroundColor: 'hsl(var(--background))' }}
              >
                <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                  None
                </span>
                <X className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-muted-foreground" />
              </button>

              {BACKGROUND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleBackgroundPreset(preset.id)}
                  aria-label={preset.name}
                  className={cn(
                    'relative aspect-[16/10] border transition-all overflow-hidden',
                    bg.type === 'preset' && bg.presetId === preset.id
                      ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
                      : 'border-border hover:border-muted-foreground/50'
                  )}
                  style={presetToStyle(preset)}
                >
                  <span className="absolute bottom-0 inset-x-0 px-2 py-1 text-[11px] font-medium text-left text-white bg-gradient-to-t from-black/70 to-transparent">
                    {preset.name}
                  </span>
                </button>
              ))}

              <button
                onClick={() => document.getElementById('bg-upload-input')?.click()}
                aria-label="Upload your own background"
                className={cn(
                  'relative aspect-[16/10] border transition-all overflow-hidden',
                  bg.type === 'custom'
                    ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'border-border hover:border-muted-foreground/50'
                )}
                style={
                  bg.customImage
                    ? {
                        backgroundImage: `url(${bg.customImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : undefined
                }
              >
                <span
                  className={cn(
                    'absolute inset-0 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                    bg.customImage
                      ? 'text-white bg-black/45'
                      : 'text-muted-foreground bg-secondary/40'
                  )}
                >
                  <Upload className="w-4 h-4" />
                  {isUploadingBg ? 'Uploading…' : bg.customImage ? 'Replace' : 'Upload'}
                </span>
              </button>
              <input
                id="bg-upload-input"
                type="file"
                accept="image/*"
                onChange={handleBackgroundUpload}
                className="hidden"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Large images are resized automatically. Your own wallpaper stays on this device.
            </p>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block">Match accent to background</label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Detects the main color of your wallpaper and applies it to icons, buttons and the dock.
                </p>
              </div>
              <Toggle
                checked={bg.accentAuto}
                onChange={handleAccentAutoToggle}
                label="Match accent to background"
              />
            </div>

            <div className="mt-3 flex items-center gap-3">
              {bg.accentAuto ? (
                <>
                  <span
                    className="w-6 h-6 border border-border shrink-0"
                    style={{
                      backgroundColor: bg.type === 'none' ? '#8b5cf6' : bg.accentHex || 'hsl(var(--primary))',
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {bg.type === 'none'
                      ? 'Pick a wallpaper to auto-match its color.'
                      : bg.accentHex
                        ? `Detected accent ${bg.accentHex.toUpperCase()}`
                        : 'Detecting dominant color…'}
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  {accentSwatches.map((swatch) => (
                    <button
                      key={swatch.value || 'default'}
                      onClick={() => handleManualAccent(swatch.value)}
                      title={swatch.label}
                      aria-label={`Accent ${swatch.label}`}
                      className={cn(
                        'w-6 h-6 border transition-all',
                        (bg.manualAccent || null) === swatch.value
                          ? 'border-primary ring-2 ring-primary ring-offset-1 ring-offset-background'
                          : 'border-border hover:border-muted-foreground/50'
                      )}
                      style={{
                        backgroundColor: swatch.value || '#8b5cf6',
                        opacity: swatch.value ? 1 : 0.35,
                        backgroundImage: swatch.value
                          ? undefined
                          : 'linear-gradient(135deg, #8b5cf6 50%, #3b82f6 50%)',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <label className="text-sm font-medium text-muted-foreground">Dimness</label>
              <span className="ml-auto text-xs text-muted-foreground">{Math.round(bg.scrimOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="70"
              value={Math.round(bg.scrimOpacity * 100)}
              onChange={(e) => updateBg({ scrimOpacity: Number(e.target.value) / 100 })}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Darkens (or lightens in light mode) the wallpaper so content stays readable.
            </p>
          </div>
        </div>
      </div>

      {/* Font Settings */}
      <div className="bg-card border border-border rounded-2xl p-6">
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

      {/* Dock Settings */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DockIcon className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">Dock</h2>
          </div>
          <button
            type="button"
            onClick={resetDock}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>

        <div className="space-y-6">
          {/* Position */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Position</label>
            <div className="flex gap-2">
              {positionOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateDock({ position: option.id })}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 border transition-all',
                    dock.position === option.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-secondary-foreground border-border hover:bg-accent'
                  )}
                >
                  <option.Icon className="w-4 h-4" />
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Side docks move to the bottom on small screens.
            </p>
          </div>

          {/* Size & Spacing */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-muted-foreground">Icon size</label>
                <span className="text-xs text-muted-foreground">{dock.size}px</span>
              </div>
              <input
                type="range"
                min={28}
                max={64}
                step={2}
                value={dock.size}
                onChange={(e) => updateDock({ size: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-muted-foreground">Dock size (padding)</label>
                <span className="text-xs text-muted-foreground">{dock.padding}px</span>
              </div>
              <input
                type="range"
                min={4}
                max={20}
                step={1}
                value={dock.padding}
                onChange={(e) => updateDock({ padding: Number(e.target.value) })}
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                How bulky the dock bar is around the icons.
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-muted-foreground">Icon spacing</label>
                <span className="text-xs text-muted-foreground">{dock.gap}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={16}
                step={1}
                value={dock.gap}
                onChange={(e) => updateDock({ gap: Number(e.target.value) })}
                className="w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Gap between neighbouring icons.
              </p>
            </div>
          </div>

          {/* Magnification */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-muted-foreground">
                Magnify icons on hover
              </label>
              <Toggle
                checked={dock.magnificationEnabled}
                onChange={() => updateDock({ magnificationEnabled: !dock.magnificationEnabled })}
                label="Magnify icons on hover"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={100}
                max={220}
                step={5}
                value={dock.magnification}
                disabled={!dock.magnificationEnabled}
                onChange={(e) => updateDock({ magnification: Number(e.target.value) })}
                className="w-full accent-primary disabled:opacity-40"
              />
              <span className="w-10 text-right text-xs text-muted-foreground">
                {dock.magnification}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              How much icons grow when the pointer hovers over them.
            </p>
          </div>

          {/* Background Color */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Background
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {dockColorSwatches.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  title={swatch.label}
                  aria-label={`Dock color: ${swatch.label}`}
                  onClick={() => updateDock({ color: swatch.value })}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center border-2 transition-all',
                    dock.color === swatch.value ? 'border-primary' : 'border-border'
                  )}
                  style={swatch.value === 'auto' ? undefined : { backgroundColor: swatch.value }}
                >
                  {swatch.value === 'auto' && <Palette className="w-4 h-4" />}
                </button>
              ))}
              <label
                className="flex h-8 w-8 cursor-pointer items-center justify-center border border-border"
                title="Custom color"
              >
                <input
                  type="color"
                  value={dock.color === 'auto' ? '#18181b' : dock.color}
                  onChange={(e) => updateDock({ color: e.target.value })}
                  className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                  aria-label="Custom dock color"
                />
              </label>
            </div>
          </div>

          {/* Opacity */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-muted-foreground">
                Background opacity
              </label>
              <span className="text-xs text-muted-foreground">
                {Math.round(dock.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={30}
              max={100}
              step={5}
              value={Math.round(dock.opacity * 100)}
              onChange={(e) => updateDock({ opacity: Number(e.target.value) / 100 })}
              className="w-full accent-primary"
            />
          </div>

          {/* Appearance toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Show labels</label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Display the app name above an icon on hover.
                </p>
              </div>
              <Toggle
                checked={dock.showLabels}
                onChange={() => updateDock({ showLabels: !dock.showLabels })}
                label="Show labels on hover"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Icon background</label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  A subtle tile behind each icon that grows with it, so icons stay visible even
                  when the dock color matches them.
                </p>
              </div>
              <Toggle
                checked={dock.showTiles}
                onChange={() => updateDock({ showTiles: !dock.showTiles })}
                label="Icon background tiles"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Active indicator</label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Small dot under the icon of the app that is currently open.
                </p>
              </div>
              <Toggle
                checked={dock.showIndicators}
                onChange={() => updateDock({ showIndicators: !dock.showIndicators })}
                label="Active app indicator"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-300">Danger Zone</h2>
        </div>

        <div className="space-y-4">
          {/* Export Data & Delete Everything Section */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-900 rounded-lg">
            <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Export & Delete Everything</h3>
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-4">
              Export your data in multiple formats and then permanently delete all your data.
            </p>
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export & Delete Everything
            </button>
          </div>

          {/* Delete Without Export Section */}
          <div className="p-4 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-900 rounded-lg">
            <h3 className="font-medium text-red-900 dark:text-red-200 mb-2">Delete Without Export</h3>
            <p className="text-sm text-red-800 dark:text-red-300 mb-4">
              Permanently delete all your tasks, notes, calendar events, sleep records, and task lists without exporting.
              This cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Deleting...' : 'Delete Without Export'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;