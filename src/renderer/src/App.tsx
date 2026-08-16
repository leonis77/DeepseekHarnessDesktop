import { useEffect, useMemo, useState } from 'react';
import { useShell } from './hooks/useShell';
import { applyTheme } from './hooks/useTheme';
import { matchesKey } from './utils/keys';
import { panels } from './panels/registry';
import Background from './components/Background';
import TitleBar from './components/TitleBar';
import ActivityBar from './components/ActivityBar';
import PanelContainer from './panels/PanelContainer';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import HarnessView from './components/HarnessView';
import SettingsPanel from './components/SettingsPanel';
import SessionsPanel from './panels/SessionsPanel';

type MainView = 'harness' | 'settings' | 'sessions';

export default function App() {
  const { state, restart, updateSettings } = useShell();
  const [view, setView] = useState<MainView>('harness');
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  const activePanel = useMemo(() => panels.find((p) => p.id === activePanelId) ?? null, [activePanelId]);

  // 主题（含 system 模式的系统偏好监听）
  useEffect(() => {
    applyTheme(state.config.theme, state.config.accent);
    if (state.config.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (): void => applyTheme(state.config.theme, state.config.accent);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [state.config.theme, state.config.accent]);

  // 玻璃模糊（背景相关，独立于主题）
  useEffect(() => {
    document.documentElement.style.setProperty('--glass-blur', `${state.config.background.glassBlur}px`);
  }, [state.config.background.glassBlur]);

  // 背景图片：按 imagePath 读取为 data URL（避免 file:// 跨源问题）
  useEffect(() => {
    const bg = state.config.background;
    if (bg.type === 'image' && bg.imagePath) {
      let alive = true;
      window.harnessShell.fs
        .readImage(bg.imagePath)
        .then((url) => {
          if (alive) setImageDataUrl(url);
        })
        .catch(() => {
          if (alive) setImageDataUrl(null);
        });
      return () => {
        alive = false;
      };
    }
    setImageDataUrl(null);
    return;
  }, [state.config.background.type, state.config.background.imagePath]);

  // 快捷键（从配置读取，可自定义）
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (matchesKey(e, state.config.keybindings.commandPalette)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (matchesKey(e, state.config.keybindings.togglePanel)) {
        e.preventDefault();
        setActivePanelId((v) => (v ? null : 'files'));
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.config.keybindings]);

  return (
    <>
      <Background config={state.config.background} imageDataUrl={imageDataUrl} />
      <div className="app">
        <TitleBar onOpenPalette={() => setPaletteOpen(true)} />
        <div className="app-body">
          <ActivityBar
            view={view}
            activePanelId={activePanelId}
            onSelectView={setView}
            onTogglePanel={(id) => setActivePanelId((v) => (v === id ? null : id))}
            onOpenPalette={() => setPaletteOpen(true)}
          />
          {activePanel && <PanelContainer panel={activePanel} onClose={() => setActivePanelId(null)} />}
          <main className="content">
            {view === 'harness' ? (
              <HarnessView service={state.service} progress={state.progress} />
            ) : view === 'sessions' ? (
              <div className="manage-view">
                <div className="manage-head">
                  <button className="btn" onClick={() => setView('settings')}>
                    ← 返回设置
                  </button>
                  <h2>会话管理</h2>
                </div>
                <SessionsPanel />
              </div>
            ) : (
              <SettingsPanel
                service={state.service}
                config={state.config}
                appVersion={state.appVersion}
                onRestart={restart}
                onUpdateSettings={updateSettings}
                onOpenSessions={() => setView('sessions')}
              />
            )}
          </main>
        </div>
        <StatusBar service={state.service} appVersion={state.appVersion} />
        {paletteOpen && <CommandPalette commands={state.commands} onClose={() => setPaletteOpen(false)} />}
      </div>
    </>
  );
}
