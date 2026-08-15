import { useEffect, useState } from 'react';
import type { McpScanResult } from '../../../shared/types';

export default function McpPanel() {
  const [result, setResult] = useState<McpScanResult | null>(null);

  const reload = (): void => {
    setResult(null);
    void window.harnessShell.mcp.scan().then(setResult);
  };

  useEffect(reload, []);

  return (
    <div className="mcp-panel">
      <div className="panel-toolbar">
        <button onClick={reload} title="刷新">
          ↻ 刷新
        </button>
      </div>
      {!result ? (
        <p className="muted">加载中…</p>
      ) : result.servers.length === 0 ? (
        <div className="panel-empty">
          <h4>MCP 服务器</h4>
          <p>settings.yaml 中未配置 MCP 服务器。</p>
          <p>可在 Harness 设置里添加 MCP，或直接编辑 settings.yaml 增加 mcp 段后刷新。</p>
        </div>
      ) : (
        <>
          <h4 className="panel-subtitle">已配置 {result.servers.length} 个 MCP 服务器</h4>
          <ul className="session-list">
            {result.servers.map((s) => (
              <li key={s} className="session-item">
                <span className="s-title">{s}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
