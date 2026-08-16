import { createElement, useEffect, useRef } from 'react';
import type { ServiceState } from '../../../shared/types';

interface Props {
  service: ServiceState;
}

// 注入透明背景，让壳的自定义背景透进 Harness 对话区（沉浸式）
const INJECTED_CSS = `
html, body, #root { background: transparent !important; }
:root, [data-theme] { --dsw-alias-bg-base: transparent !important; }
`;

export default function HarnessView({ service }: Props) {
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
    wv.addEventListener('dom-ready', inject);
    wv.addEventListener('new-window', onNewWindow);
    return () => {
      wv.removeEventListener('dom-ready', inject);
      wv.removeEventListener('new-window', onNewWindow);
    };
  }, [service.url]);

  const loading = service.url == null || service.status === 'idle' || service.status === 'starting';

  if (loading) {
    return (
      <div className="harness-loading">
        <div className="spinner" />
        <p>{service.status === 'starting' ? '正在启动 Harness 服务…' : '等待服务…'}</p>
        {service.status === 'error' && <p className="muted">启动失败，请到「设置」查看，或使用「重启服务」。</p>}
      </div>
    );
  }

  return createElement('webview', {
    ref: webviewRef,
    key: service.url,
    className: 'harness-frame',
    src: service.url as string,
  });
}
