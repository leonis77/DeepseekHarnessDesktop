import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { PanelDefinition } from './registry';

interface Props {
  panel: PanelDefinition;
  onClose(): void;
}

export default function PanelContainer({ panel, onClose }: Props) {
  const [width, setWidth] = useState(300);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onMouseDown = (e: ReactMouseEvent): void => {
    dragRef.current = { startX: e.clientX, startW: width };
    const onMove = (ev: MouseEvent): void => {
      if (!dragRef.current) return;
      const next = dragRef.current.startW + (ev.clientX - dragRef.current.startX);
      setWidth(Math.max(220, Math.min(640, next)));
    };
    const onUp = (): void => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const PanelComp = panel.component;

  return (
    <aside className="panel-container" style={{ width }}>
      <header className="panel-header">
        <span>{panel.title}</span>
        <button className="panel-close" onClick={onClose}>
          ✕
        </button>
      </header>
      <div className="panel-body">
        <PanelComp />
      </div>
      <div className="panel-resizer" onMouseDown={onMouseDown} />
    </aside>
  );
}
