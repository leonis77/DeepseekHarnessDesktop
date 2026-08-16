import { createElement, useEffect, useRef } from 'react';
import type { ServiceState, StartupProgress } from '../../../shared/types';

interface Props {
  service: ServiceState;
  progress: StartupProgress;
}

// 注入透明背景，让壳的自定义背景透进 Harness 对话区（沉浸式）
const INJECTED_CSS = `
html, body, #root { background: transparent !important; }
:root, [data-theme] { --dsw-alias-bg-base: transparent !important; }
`;

export default function HarnessView({ service, progress }: Props) {
  const webviewRef = useRef<any>(null);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    const inject = (): void => {
      try {
        wv.insertCSS(INJECTED_CSS);
      } catch {
        /* ignore */
      }
    };
    const onNewWindow = (e: any): void => {
      e.preventDefault();
      if (/^https?:/i.test(e.url)) window.harnessShell.openExternal(e.url);
    };
    // 限制 webview 导航：只允许停留在 dsh 本地地址，外部/其它一律拦截
    const onWillNavigate = (e: any): void => {
      const target = e.url as string;
      if (!/^https?:\/\/127\.0\.0\.1(:\d+)?\//i.test(target) && !/^https?:\/\/localhost(:\d+)?\//i.test(target)) {
        e.preventDefault();
        if (/^https?:/i.test(target)) window.harnessShell.openExternal(target);
      }
    };
    wv.addEventListener('dom-ready', inject);
    wv.addEventListener('new-window', onNewWindow);
    wv.addEventListener('will-navigate', onWillNavigate);
    return () => {
      wv.removeEventListener('dom-ready', inject);
      wv.removeEventListener('new-window', onNewWindow);
      wv.removeEventListener('will-navigate', onWillNavigate);
    };
  }, [service.url]);

  const loading = service.url == null || service.status === 'idle' || service.status === 'starting';

  if (loading) {
    const percent = Math.max(0, Math.min(100, progress.percent));
    const busy = service.status === 'starting' || service.status === 'preparing';
    return (
      <div className="harness-loading">
        <div className="spinner" />
        <p>
          {service.status === 'preparing'
            ? '首次启动，正在准备 Harness 环境（解压约 1 分钟）…'
            : progress.label || (service.status === 'starting' ? '正在启动 Harness 服务…' : '等待服务…')}
        </p>
        {busy && (
          <div className="boot-progress" role="progressbar" aria-valuenow={percent}>
            <div className="boot-progress-fill" style={{ width: `${percent}%` }} />
            <span className="boot-progress-text">{percent}%</span>
          </div>
        )}
        {service.status === 'error' && <p className="muted">启动失败，请到「设置」查看，或使用「重启服务」。</p>}
      </div>
    );
  }

  return createElement('webview', {
    ref: webviewRef,
    key: service.url,
    className: 'harness-frame',
    src: service.url as string,
    webpreferences: 'nodeIntegration=no,contextIsolation=yes,sandbox=yes',
  });
}
