import { useEffect, useState } from 'react';

interface Props {
  onOpenPalette(): void;
}

export default function TitleBar({ onOpenPalette }: Props) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const off = window.harnessShell.onMaximized(setMaximized);
    void window.harnessShell.isMaximized().then(setMaximized);
    return off;
  }, []);

  return (
    <header className="titlebar" onDoubleClick={() => window.harnessShell.toggleMaximize()}>
      <div className="titlebar-left">
        <span className="app-logo">◆</span>
        <span className="app-title">Harness UI</span>
      </div>
      <button className="titlebar-cmd" onClick={onOpenPalette} title="命令面板 (Ctrl+K)">
        <span>搜索命令…</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div className="titlebar-controls">
        <button className="win-btn" onClick={() => window.harnessShell.minimize()} title="最小化">
          ─
        </button>
        <button className="win-btn" onClick={() => window.harnessShell.toggleMaximize()} title={maximized ? '还原' : '最大化'}>
          {maximized ? '❐' : '□'}
        </button>
        <button className="win-btn win-close" onClick={() => window.harnessShell.close()} title="关闭">
          ✕
        </button>
      </div>
    </header>
  );
}
