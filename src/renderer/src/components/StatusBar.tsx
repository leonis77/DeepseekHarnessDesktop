import type { ServiceState } from '../../../shared/types';

const STATUS_LABEL: Record<string, string> = {
  idle: '未启动',
  starting: '启动中…',
  running: '运行中',
  attached: '已连接现有实例',
  stopped: '已停止',
  error: '启动失败',
};
const STATUS_COLOR: Record<string, string> = {
  idle: '#64748b',
  starting: '#f59e0b',
  running: '#22c55e',
  attached: '#38bdf8',
  stopped: '#ef4444',
  error: '#ef4444',
};

interface Props {
  service: ServiceState;
  appVersion: string;
}

export default function StatusBar({ service, appVersion }: Props) {
  const color = STATUS_COLOR[service.status] ?? '#64748b';
  const modeLabel = service.mode === 'attach' ? '连接现有' : service.mode === 'spawn' ? '内置实例' : '';
  return (
    <footer className="statusbar">
      <span className="status-item">
        <span className="dot" style={{ background: color }} />
        {STATUS_LABEL[service.status] ?? service.status}
      </span>
      {service.url && (
        <button
          className="status-url"
          title={service.url + '（点击在浏览器打开）'}
          onClick={() => window.harnessShell.openExternal(service.url as string)}
        >
          {service.url}
        </button>
      )}
      {modeLabel && <span className="status-item muted">{modeLabel}</span>}
      <span className="status-spacer" />
      <span className="status-item muted">v{appVersion}</span>
    </footer>
  );
}
