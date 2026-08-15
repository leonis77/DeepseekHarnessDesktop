import type { ServiceState } from '../../../shared/types';

interface Props {
  service: ServiceState;
  framed?: boolean;
}

export default function HarnessView({ service, framed }: Props) {
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

  return (
    <iframe
      key={service.url}
      className={'harness-frame' + (framed ? ' framed' : '')}
      src={service.url as string}
      title="Harness"
      allow="clipboard-read; clipboard-write; fullscreen"
    />
  );
}
