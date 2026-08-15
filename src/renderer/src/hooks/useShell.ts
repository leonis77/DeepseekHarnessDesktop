import { useCallback, useEffect, useState } from 'react';
import type { AppConfig, BootstrapState, CommandDescriptor, ServiceState } from '../../../shared/types';

export interface ShellState {
  appVersion: string;
  service: ServiceState;
  config: AppConfig;
  commands: CommandDescriptor[];
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
    background: { type: 'gradient', gradientId: 'aurora', color: '#0b0f17', opacity: 1, blur: 0, animated: true, glassBlur: 20, framed: false },
  },
  commands: [],
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
    window.harnessShell.getBootstrap().then((b: BootstrapState) => {
      if (disposed) return;
      setState({
        appVersion: b.appVersion,
        service: b.service,
        config: b.config,
        commands: b.commands,
        ready: true,
      });
    });
    return () => {
      disposed = true;
      offState();
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
