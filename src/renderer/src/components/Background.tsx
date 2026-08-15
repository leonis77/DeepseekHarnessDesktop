import type { CSSProperties, ReactNode } from 'react';
import type { BackgroundConfig } from '../../../shared/types';
import { getPreset } from '../utils/backgrounds';

interface Props {
  config: BackgroundConfig;
  imageDataUrl: string | null;
}

/** 壳层背景：渐变极光 / 纯色 / 图片，叠加噪点颗粒，营造大厂级质感。 */
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
    layer = (
      <div className="bg-gradient" style={{ background: preset.base }}>
        {preset.blobs.map((blob, i) => (
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
      <div className="bg-grain" />
    </div>
  );
}
