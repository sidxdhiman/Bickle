export const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

export const hexToRgb = (hex) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

export const rgbToHsl = (r, g, b) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
};

export const hexToHsl = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
};

export const relativeLuminance = ({ r, g, b }) => {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const HUE_BINS = 36;

export const extractAccentHex = (source) => {
  if (!source || !source.width || !source.height) return null;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const sw = source.width;
  const sh = source.height;
  const scale = Math.max(size / sw, size / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(source, (size - dw) / 2, (size - dh) / 2, dw, dh);

  let data;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch (error) {
    return null;
  }

  const bins = Array.from({ length: HUE_BINS }, () => ({ r: 0, g: 0, b: 0, weight: 0 }));
  let totalWeight = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 125) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const { h, s, l } = rgbToHsl(r, g, b);
    if (s < 12 || l < 8 || l > 94) continue;
    const weight = (s / 100) * (1 - Math.abs(l - 58) / 92);
    if (weight <= 0) continue;
    const bin = bins[Math.min(HUE_BINS - 1, Math.floor(h / (360 / HUE_BINS)))];
    bin.r += r * weight;
    bin.g += g * weight;
    bin.b += b * weight;
    bin.weight += weight;
    totalWeight += weight;
  }

  if (totalWeight < 4) return null;

  let best = bins[0];
  for (const bin of bins) {
    if (bin.weight > best.weight) best = bin;
  }
  if (best.weight <= 0) return null;

  const r = best.r / best.weight;
  const g = best.g / best.weight;
  const b = best.b / best.weight;
  const { h, s, l } = rgbToHsl(r, g, b);

  const usableSat = Math.min(100, Math.max(48, s));
  const usableLight = Math.min(64, Math.max(46, l));
  const { h: hh, s: ss, l: ll } = { h, s: usableSat, l: usableLight };

  const c = ((1 - Math.abs((ll / 100) * 2 - 1)) * (ss / 100)) / 1;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll / 100 - c / 2;
  let rgb;
  if (hh < 60) rgb = [c, x, 0];
  else if (hh < 120) rgb = [x, c, 0];
  else if (hh < 180) rgb = [0, c, x];
  else if (hh < 240) rgb = [0, x, c];
  else if (hh < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return rgbToHex((rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255);
};

export const compressImageFile = (file, maxDim = 1920, quality = 0.82) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load the image.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas is not supported.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
