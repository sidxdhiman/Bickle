import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings as SettingsIcon, Palette, Type, AlertTriangle, Trash2, Moon, Sun, Download, X } from 'lucide-react';
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
      <div className="bg-background border border-border rounded-lg p-6 shadow-2xl max-w-sm w-full mx-4">
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
      <div className="bg-background border border-border rounded-lg p-6 shadow-2xl max-w-md w-full mx-4">
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
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
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
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
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
          {/* Export Data & Delete Everything Section */}
          <div className="p-4 bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
            <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Export & Delete Everything</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
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
          <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
            <h3 className="font-medium text-red-800 dark:text-red-200 mb-2">Delete Without Export</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mb-4">
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