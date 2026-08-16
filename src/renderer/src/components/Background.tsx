import type { CSSProperties, ReactNode } from 'react';
import type { BackgroundConfig } from '../../../shared/types';
import { getPreset } from '../utils/backgrounds';

interface Props {
  config: BackgroundConfig;
  imageDataUrl: string | null;
}

function rgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(59,130,246,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function blobsFor(config: BackgroundConfig) {
  if (config.gradientId === 'custom') {
    return [
      { color: rgba(config.customColors[0], 0.55), x: 20, y: 20, size: 60 },
      { color: rgba(config.customColors[1], 0.5), x: 70, y: 60, size: 55 },
      { color: rgba(config.customColors[2], 0.45), x: 45, y: 85, size: 50 },
    ];
  }
  return getPreset(config.gradientId).blobs;
}

/** 壳层背景：渐变极光（含自定义）/ 纯色 / 图片，叠加噪点颗粒。 */
export default function Background({ config, imageDataUrl }: Props) {
  const layerStyle: CSSProperties = { opacity: config.opacity };
  let layer: ReactNode;

  if (config.type === 'image' && imageDataUrl) {
    layer = (
      <div
        className="bg-image"
        style={{ backgroundImage: `url(${imageDataUrl})`, filter: `blur(${config.blur}px) saturate(1.08)` }}
      />
    );
  } else if (config.type === 'color') {
    layer = <div className="bg-solid" style={{ background: config.color }} />;
  } else {
    const preset = getPreset(config.gradientId);
    const blobs = blobsFor(config);
    layer = (
      <div className="bg-gradient" style={{ background: preset.base }}>
        {blobs.map((blob, i) => (
          <div
            key={i}
            className={'bg-blob' + (config.animated ? ' animated' : '')}
            style={{
              left: `${blob.x}%`,
              top: `${blob.y}%`,
              width: `${blob.size}vw`,
              height: `${blob.size}vw`,
              background: `radial-gradient(circle at center, ${blob.color} 0%, transparent 70%)`,
              animationDelay: `${i * -7}s`,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="background-layer" style={layerStyle}>
      {layer}
      {config.noise && <div className="bg-grain" />}
    </div>
  );
}
