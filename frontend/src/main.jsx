import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { getSavedTheme, applyTheme } from './utils/themeUtils';

const savedTheme = getSavedTheme();
applyTheme(savedTheme);

// Font is stored by Settings but was only applied when that page mounted —
// restore it on boot so a reload keeps the choice.
const FONT_STACKS = {
  inter: '"Inter", sans-serif',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  manrope: '"Manrope", sans-serif',
  'plus-jakarta-sans': '"Plus Jakarta Sans", sans-serif',
};
const savedFont = localStorage.getItem('bickle-font') || 'inter';
if (FONT_STACKS[savedFont]) {
  document.body.style.fontFamily = FONT_STACKS[savedFont];
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
