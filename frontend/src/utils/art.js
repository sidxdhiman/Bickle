import axios from 'axios';
import exifr from 'exifr';

const apiOrigin = () => (axios.defaults.baseURL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

export const mediaUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiOrigin()}${path.startsWith('/') ? '' : '/'}${path}`;
};

export const fileNameToTitle = (name = '') =>
  name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

const MP4_EPOCH = Date.UTC(1904, 0, 1);

const cleanString = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value instanceof Date) return '';
  if (Array.isArray(value)) {
    const joined = value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part === 'number') return String.fromCharCode(part);
        return '';
      })
      .join('')
      .replace(/\0/g, '')
      .trim();
    return joined;
  }
  if (value && typeof value === 'object' && 'value' in value) {
    return cleanString(value.value);
  }
  return '';
};

const firstString = (...values) => {
  for (const value of values) {
    const text = cleanString(value);
    if (text) return text;
  }
  return '';
};

const pad2 = (value) => String(value).padStart(2, '0');

export const toLocalInput = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const isoDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return toLocalInput(date);
};

export const reverseGeocode = async (latitude, longitude) => {
  const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${latitude}&lon=${longitude}`,
      { signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(6000) : undefined }
    );
    if (!response.ok) return fallback;
    const data = await response.json();
    const address = data.address || {};
    const place = address.city || address.town || address.village || address.suburb || address.county || address.state;
    const country = address.country;
    const label = [place, country].filter(Boolean).join(', ');
    return label || fallback;
  } catch (error) {
    return fallback;
  }
};

const readImageSize = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });

export const readImageMeta = async (file) => {
  const size = await readImageSize(file);
  const meta = {
    title: fileNameToTitle(file.name),
    description: '',
    location: '',
    takenAt: '',
    camera: '',
    width: size.width,
    height: size.height,
    detected: [],
  };

  let tags = null;
  try {
    tags = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: true,
      iptc: true,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
      mergeOutput: true,
    });
  } catch (error) {
    tags = null;
  }

  if (!tags) return meta;

  const description = firstString(
    tags.ImageDescription,
    tags.XPComment,
    tags.UserComment,
    tags.Caption,
    tags['Caption-ABSTRACT'],
    tags.Description,
    tags.dcDescription
  );
  const title = firstString(tags.XPTitle, tags.Title);
  const when = tags.DateTimeOriginal || tags.CreateDate || tags.ModifyDate;
  const make = cleanString(tags.Make);
  const model = cleanString(tags.Model);
  const camera = (model && make && model.toLowerCase().startsWith(make.toLowerCase()) ? model : [make, model].filter(Boolean).join(' ')).trim();

  meta.description = description;
  if (title) meta.title = title;
  if (when) {
    const iso = isoDate(when);
    if (iso) {
      meta.takenAt = iso;
      meta.detected.push('date & time');
    }
  }
  if (camera) {
    meta.camera = camera;
    meta.detected.push('camera');
  }
  if (meta.description) meta.detected.push('description');
  if (meta.width) meta.detected.push('dimensions');

  const latitude = tags.latitude;
  const longitude = tags.longitude;
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    meta.detected.push('gps coordinates');
    const place = await reverseGeocode(latitude, longitude);
    if (place) {
      meta.location = place;
      meta.detected.push('location');
    }
  }

  return meta;
};

const probeVideo = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      resolve({ duration: 0, width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    video.src = url;
  });

const readMp4Box = async (file) => {
  const slice = file.slice(0, Math.min(file.size, 12 * 1024 * 1024));
  const buffer = await slice.arrayBuffer();
  const view = new DataView(buffer);
  const limit = view.byteLength - 32;

  for (let i = 4; i < limit; i += 1) {
    if (view.getUint32(i) !== 0x6d766864) continue;

    const version = view.getUint8(i + 4);
    let creation = 0;
    let duration = 0;
    let timescale = 0;

    if (version === 1) {
      const high = view.getUint32(i + 8);
      const low = view.getUint32(i + 12);
      creation = high * 4294967296 + low;
      timescale = view.getUint32(i + 24);
      const durationHigh = view.getUint32(i + 28);
      const durationLow = view.getUint32(i + 32);
      duration = durationHigh * 4294967296 + durationLow;
    } else {
      creation = view.getUint32(i + 8);
      timescale = view.getUint32(i + 16);
      duration = view.getUint32(i + 20);
    }

    return { creation, duration, timescale };
  }

  return null;
};

export const readVideoMeta = async (file) => {
  const [probe, box] = await Promise.all([probeVideo(file), readMp4Box(file).catch(() => null)]);

  const meta = {
    title: fileNameToTitle(file.name),
    description: '',
    location: '',
    recordedAt: '',
    width: probe.width,
    height: probe.height,
    duration: probe.duration,
    detected: [],
  };

  if (box && box.creation > 0) {
    const date = new Date(MP4_EPOCH + box.creation * 1000);
    if (!Number.isNaN(date.getTime()) && date.getFullYear() > 1970 && date.getFullYear() < 2200) {
      meta.recordedAt = isoDate(date);
      meta.detected.push('creation date');
    }
  }

  if (!meta.duration && box && box.timescale > 0) {
    meta.duration = box.duration / box.timescale;
  }
  if (meta.duration) meta.detected.push('duration');
  if (meta.width) meta.detected.push('dimensions');

  return meta;
};

export const computeWaveform = async (file, buckets = 900) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    const channel = buffer.getChannelData(0);
    const count = Math.min(buckets, Math.max(1, channel.length));
    const blockSize = Math.floor(channel.length / count);
    const peaks = new Array(count).fill(0);

    for (let i = 0; i < count; i += 1) {
      const start = i * blockSize;
      let peak = 0;
      for (let j = 0; j < blockSize; j += 1) {
        const value = Math.abs(channel[start + j]);
        if (value > peak) peak = value;
      }
      peaks[i] = peak;
    }

    const max = Math.max(...peaks, 0.0001);
    return {
      peaks: peaks.map((peak) => Math.round((peak / max) * 1000) / 1000),
      duration: buffer.duration,
    };
  } finally {
    context.close().catch(() => {});
  }
};

export const formatDuration = (seconds) => {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

export const formatDate = (value, withTime = false) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return withTime
    ? date.toLocaleString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

export const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};
