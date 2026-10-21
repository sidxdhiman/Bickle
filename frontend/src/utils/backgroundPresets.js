export const BACKGROUND_PRESETS = [
  {
    id: 'midnight-aurora',
    name: 'Midnight Aurora',
    base: '#0a0f1e',
    blobs: [
      { x: 22, y: 24, r: 62, color: 'rgba(124, 58, 237, 0.55)' },
      { x: 82, y: 72, r: 58, color: 'rgba(20, 184, 166, 0.38)' },
      { x: 58, y: 12, r: 46, color: 'rgba(244, 63, 94, 0.22)' },
      { x: 10, y: 88, r: 42, color: 'rgba(37, 99, 235, 0.3)' },
    ],
  },
  {
    id: 'nebula',
    name: 'Nebula',
    base: '#120820',
    blobs: [
      { x: 30, y: 30, r: 60, color: 'rgba(147, 51, 234, 0.5)' },
      { x: 75, y: 60, r: 55, color: 'rgba(219, 39, 119, 0.35)' },
      { x: 60, y: 90, r: 50, color: 'rgba(59, 130, 246, 0.32)' },
      { x: 15, y: 70, r: 40, color: 'rgba(99, 102, 241, 0.3)' },
    ],
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    base: '#04121f',
    blobs: [
      { x: 25, y: 70, r: 64, color: 'rgba(14, 165, 233, 0.45)' },
      { x: 78, y: 25, r: 58, color: 'rgba(6, 182, 212, 0.38)' },
      { x: 55, y: 90, r: 48, color: 'rgba(79, 70, 229, 0.4)' },
      { x: 90, y: 80, r: 38, color: 'rgba(45, 212, 191, 0.25)' },
    ],
  },
  {
    id: 'ember',
    name: 'Ember',
    base: '#1a0b08',
    blobs: [
      { x: 28, y: 75, r: 60, color: 'rgba(234, 88, 12, 0.45)' },
      { x: 75, y: 30, r: 55, color: 'rgba(225, 29, 72, 0.3)' },
      { x: 55, y: 55, r: 48, color: 'rgba(217, 119, 6, 0.35)' },
      { x: 12, y: 20, r: 40, color: 'rgba(244, 63, 94, 0.2)' },
    ],
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    base: '#06140e',
    blobs: [
      { x: 25, y: 30, r: 62, color: 'rgba(16, 185, 129, 0.42)' },
      { x: 80, y: 65, r: 56, color: 'rgba(20, 184, 166, 0.35)' },
      { x: 50, y: 90, r: 48, color: 'rgba(101, 163, 13, 0.25)' },
      { x: 88, y: 15, r: 38, color: 'rgba(52, 211, 153, 0.22)' },
    ],
  },
  {
    id: 'sakura-night',
    name: 'Sakura Night',
    base: '#170a16',
    blobs: [
      { x: 30, y: 65, r: 60, color: 'rgba(236, 72, 153, 0.42)' },
      { x: 75, y: 25, r: 55, color: 'rgba(168, 85, 247, 0.38)' },
      { x: 55, y: 85, r: 46, color: 'rgba(251, 113, 133, 0.3)' },
      { x: 12, y: 25, r: 40, color: 'rgba(219, 39, 119, 0.25)' },
    ],
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    base: '#151007',
    blobs: [
      { x: 25, y: 70, r: 62, color: 'rgba(234, 179, 8, 0.38)' },
      { x: 78, y: 30, r: 56, color: 'rgba(245, 158, 11, 0.35)' },
      { x: 55, y: 60, r: 48, color: 'rgba(251, 146, 60, 0.3)' },
      { x: 15, y: 20, r: 38, color: 'rgba(217, 119, 6, 0.22)' },
    ],
  },
  {
    id: 'linen',
    name: 'Linen',
    base: '#f2eee6',
    blobs: [
      { x: 25, y: 25, r: 60, color: 'rgba(251, 146, 60, 0.22)' },
      { x: 80, y: 70, r: 56, color: 'rgba(139, 148, 138, 0.28)' },
      { x: 55, y: 90, r: 46, color: 'rgba(244, 114, 182, 0.14)' },
      { x: 10, y: 75, r: 40, color: 'rgba(148, 163, 184, 0.22)' },
    ],
  },
];

export const getPreset = (id) => BACKGROUND_PRESETS.find((p) => p.id === id) || null;

export const presetToStyle = (preset) => ({
  backgroundColor: preset.base,
  backgroundImage: preset.blobs
    .map((b) => `radial-gradient(circle at ${b.x}% ${b.y}%, ${b.color} 0%, transparent ${b.r}%)`)
    .join(', '),
});

export const paintPresetToCanvas = (preset, width = 320, height = 200) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = preset.base;
  ctx.fillRect(0, 0, width, height);
  for (const blob of preset.blobs) {
    const cx = (blob.x / 100) * width;
    const cy = (blob.y / 100) * height;
    const radius = (blob.r / 100) * Math.max(width, height);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, blob.color);
    gradient.addColorStop(1, blob.color.replace(/[\d.]+\)$/, '0)'));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
};
