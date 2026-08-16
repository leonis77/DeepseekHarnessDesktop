export interface GradientPreset {
  id: string;
  name: string;
  base: string;
  blobs: { color: string; x: number; y: number; size: number }[];
}

/** 大厂级渐变预设（极光 / 落日 / 深海 / 森林 / 星云 / 石墨）。 */
export const gradientPresets: GradientPreset[] = [
  {
    id: 'aurora',
    name: '极光',
    base: '#0b1020',
    blobs: [
      { color: 'rgba(59,130,246,0.55)', x: 18, y: 18, size: 62 },
      { color: 'rgba(139,92,246,0.50)', x: 72, y: 58, size: 56 },
      { color: 'rgba(20,184,166,0.45)', x: 40, y: 82, size: 50 },
    ],
  },
  {
    id: 'sunset',
    name: '落日',
    base: '#1a0f1f',
    blobs: [
      { color: 'rgba(244,114,182,0.55)', x: 22, y: 28, size: 60 },
      { color: 'rgba(251,146,60,0.50)', x: 66, y: 44, size: 55 },
      { color: 'rgba(168,85,247,0.45)', x: 44, y: 86, size: 55 },
    ],
  },
  {
    id: 'ocean',
    name: '深海',
    base: '#07101f',
    blobs: [
      { color: 'rgba(14,116,144,0.55)', x: 28, y: 22, size: 60 },
      { color: 'rgba(37,99,235,0.50)', x: 70, y: 70, size: 56 },
      { color: 'rgba(34,211,238,0.40)', x: 44, y: 38, size: 46 },
    ],
  },
  {
    id: 'forest',
    name: '森林',
    base: '#0a140f',
    blobs: [
      { color: 'rgba(16,185,129,0.50)', x: 24, y: 24, size: 60 },
      { color: 'rgba(5,150,105,0.50)', x: 70, y: 60, size: 56 },
      { color: 'rgba(163,230,53,0.35)', x: 46, y: 86, size: 46 },
    ],
  },
  {
    id: 'nebula',
    name: '星云',
    base: '#0d0a1a',
    blobs: [
      { color: 'rgba(147,51,234,0.55)', x: 24, y: 28, size: 60 },
      { color: 'rgba(236,72,153,0.45)', x: 70, y: 50, size: 56 },
      { color: 'rgba(59,130,246,0.45)', x: 48, y: 82, size: 50 },
    ],
  },
  {
    id: 'mono',
    name: '石墨',
    base: '#101418',
    blobs: [
      { color: 'rgba(100,116,139,0.40)', x: 28, y: 24, size: 55 },
      { color: 'rgba(71,85,105,0.40)', x: 70, y: 64, size: 55 },
      { color: 'rgba(148,163,184,0.25)', x: 46, y: 44, size: 45 },
    ],
  },
  {
    id: 'sakura',
    name: '樱花',
    base: '#1a0e14',
    blobs: [
      { color: 'rgba(244,114,182,0.50)', x: 22, y: 24, size: 60 },
      { color: 'rgba(251,191,36,0.35)', x: 72, y: 56, size: 52 },
      { color: 'rgba(192,132,252,0.40)', x: 46, y: 84, size: 50 },
    ],
  },
  {
    id: 'midnight',
    name: '午夜',
    base: '#05070f',
    blobs: [
      { color: 'rgba(30,58,138,0.50)', x: 26, y: 30, size: 62 },
      { color: 'rgba(49,46,129,0.45)', x: 70, y: 64, size: 56 },
      { color: 'rgba(14,165,233,0.30)', x: 48, y: 46, size: 46 },
    ],
  },
  {
    id: 'cyber',
    name: '赛博',
    base: '#080a12',
    blobs: [
      { color: 'rgba(34,211,238,0.45)', x: 20, y: 22, size: 58 },
      { color: 'rgba(236,72,153,0.45)', x: 74, y: 60, size: 56 },
      { color: 'rgba(168,85,247,0.40)', x: 46, y: 80, size: 48 },
    ],
  },
];

export function getPreset(id: string): GradientPreset {
  return gradientPresets.find((p) => p.id === id) ?? gradientPresets[0];
}

/** 用预设的光斑合成一个迷你渐变 CSS，供设置面板的预览色块使用。 */
export function presetPreviewCss(preset: GradientPreset): string {
  const layers = preset.blobs.map(
    (blob) => `radial-gradient(circle at ${blob.x}% ${blob.y}%, ${blob.color} 0%, transparent 65%)`
  );
  return [...layers, preset.base].join(', ');
}
