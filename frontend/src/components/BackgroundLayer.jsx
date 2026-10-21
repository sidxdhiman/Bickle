import React, { useEffect, useState } from 'react';
import { useBackground } from '../hooks/useBackground';
import { getPreset, paintPresetToCanvas, presetToStyle } from '../utils/backgroundPresets';
import { extractAccentHex } from '../utils/colorUtils';
import { applyAccentColor, getSavedTheme } from '../utils/themeUtils';

const BackgroundLayer = () => {
  const [settings, updateSetting] = useBackground();
  const { type, presetId, customImage, accentAuto, accentHex, manualAccent, scrimOpacity } = settings;
  const [theme, setTheme] = useState(getSavedTheme);

  useEffect(() => {
    const onThemeChange = (event) => setTheme(event.detail || getSavedTheme());
    window.addEventListener('bickle-theme-change', onThemeChange);
    return () => window.removeEventListener('bickle-theme-change', onThemeChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (type === 'none') {
      root.classList.remove('has-bg');
      return;
    }
    root.classList.add('has-bg');
    return () => root.classList.remove('has-bg');
  }, [type]);

  useEffect(() => {
    if (type === 'none') {
      if (accentHex) updateSetting({ accentHex: null });
      applyAccentColor(null);
      return;
    }

    if (!accentAuto) {
      applyAccentColor(manualAccent || null);
      if (accentHex) updateSetting({ accentHex: null });
      return;
    }

    if (accentHex) {
      applyAccentColor(accentHex);
      return;
    }

    const applyExtracted = (hex) => {
      if (hex) {
        applyAccentColor(hex);
        updateSetting({ accentHex: hex });
      } else {
        applyAccentColor(null);
      }
    };

    if (type === 'preset') {
      const preset = getPreset(presetId);
      if (!preset) {
        applyAccentColor(null);
        return;
      }
      applyExtracted(extractAccentHex(paintPresetToCanvas(preset, 320, 200)));
      return;
    }

    if (type === 'custom' && customImage) {
      const img = new Image();
      img.onload = () => applyExtracted(extractAccentHex(img));
      img.onerror = () => applyAccentColor(null);
      img.src = customImage;
    }
  }, [type, presetId, customImage, accentAuto, accentHex, manualAccent, updateSetting]);

  if (type === 'none') return null;

  const isLightTheme = theme === 'light';
  const scrimColor = isLightTheme
    ? `rgba(255, 255, 255, ${scrimOpacity})`
    : `rgba(10, 10, 12, ${scrimOpacity})`;

  const layerStyle =
    type === 'preset' && getPreset(presetId)
      ? { ...presetToStyle(getPreset(presetId)), backgroundAttachment: 'fixed' }
      : type === 'custom' && customImage
        ? {
            backgroundImage: `url(${customImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
          }
        : null;

  if (!layerStyle) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0" style={layerStyle} />
      <div className="absolute inset-0" style={{ backgroundColor: scrimColor }} />
      <div className="absolute inset-0 bg-noise" />
    </div>
  );
};

export default BackgroundLayer;
