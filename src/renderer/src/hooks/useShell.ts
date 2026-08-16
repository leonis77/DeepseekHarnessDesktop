import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PET } from '../../../shared/types';
import type { AppConfig, BootstrapState, CommandDescriptor, ServiceState, StartupProgress } from '../../../shared/types';

export interface ShellState {
  appVersion: string;
  service: ServiceState;
  config: AppConfig;
  commands: CommandDescriptor[];
  progress: StartupProgress;
  ready: boolean;
}

const INITIAL: ShellState = {
  appVersion: '',
  service: { status: 'idle', mode: null, url: null, pid: null },
  config: {
    autoLaunch: false,
    closeToTray: true,
    window: { width: 1360, height: 860 },
    theme: 'dark',
    accent: '#3b82f6',
    profile: 'web',
    keybindings: { commandPalette: 'Ctrl+K', togglePanel: 'Ctrl+B' },
    background: { type: 'gradient', gradientId: 'aurora', color: '#0b0f17', customColors: ['#3b82f6', '#8b5cf6', '#14b8a6'], opacity: 1, blur: 0, animated: true, glassBlur: 20, noise: true },
    pet: { ...DEFAULT_PET },
  },
  commands: [],
  progress: { phase: 'idle', percent: 0, label: '', elapsedMs: 0 },
  ready: false,
};

/** 拉取一次 bootstrap，并持续订阅服务状态。 */
export function useShell(): {
  state: ShellState;
  restart: () => void;
  updateSettings: (patch: Partial<AppConfig>) => Promise<AppConfig>;
} {
  const [state, setState] = useState<ShellState>(INITIAL);

  useEffect(() => {
    let disposed = false;
    const offState = window.harnessShell.onServiceState((service) => {
      if (!disposed) setState((prev) => ({ ...prev, service }));
    });
    const offProgress = window.harnessShell.onServiceProgress((progress) => {
      if (!disposed) setState((prev) => ({ ...prev, progress }));
    });
    const offConfig = window.harnessShell.onSettingsChanged((config) => {
      if (!disposed) setState((prev) => ({ ...prev, config }));
    });
    window.harnessShell.getBootstrap().then((b: BootstrapState) => {
      if (disposed) return;
      setState((prev) => ({
        appVersion: b.appVersion,
        service: b.service,
        config: b.config,
        commands: b.commands,
        progress: prev.progress,
        ready: true,
      }));
    });
    return () => {
      disposed = true;
      offState();
      offProgress();
      offConfig();
    };
  }, []);

  const restart = useCallback(() => {
    void window.harnessShell.restartService();
  }, []);

  const updateSettings = useCallback((patch: Partial<AppConfig>) => {
    return window.harnessShell.setSettings(patch).then((newConfig) => {
      // 关键：把主进程返回的新配置回写，驱动主题/背景/快捷键等实时生效
      setState((prev) => ({ ...prev, config: newConfig }));
      return newConfig;
    });
  }, []);

  return { state, restart, updateSettings };
}
