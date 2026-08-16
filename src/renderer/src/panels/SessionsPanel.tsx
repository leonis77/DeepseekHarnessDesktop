import { useEffect, useState } from 'react';
import type { SessionInfo } from '../../../shared/types';

export default function SessionsPanel() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState('');

  const reload = (): void => {
    setLoading(true);
    setError('');
    void window.harnessShell.sessions
      .list()
      .then((s) => setSessions(s))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const remove = async (session: SessionInfo): Promise<void> => {
    try {
      await window.harnessShell.sessions.remove(session.path);
      setConfirming(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConfirming(null);
    }
  };

  const copyPath = (p: string): void => {
    void window.harnessShell.clipboard.write(p);
  };

  return (
    <div className="sessions-panel">
      <div className="panel-toolbar">
        <button onClick={reload} title="刷新">
          ↻ 刷新
        </button>
      </div>
      {error && <div className="err">{error}</div>}
      {loading ? (
        <p className="muted">加载中…</p>
      ) : sessions.length === 0 ? (
        <div className="panel-empty">
          <p>暂无会话。</p>
          <p>会话按「工作区 → session-&lt;id&gt;」存放于 DSH_HOME/sessions。</p>
        </div>
      ) : (
        <ul className="session-list">
          {sessions.map((s) => (
            <li key={s.id} className="session-item">
              <div className="session-row">
                <div
                  className="session-info"
                  onClick={() => window.harnessShell.sessions.reveal(s.path)}
                  title={s.path}
                >
                  <span className="s-title">{s.title}</span>
                  <span className="s-meta">
                    {s.workspace} · {s.turns > 0 ? `${s.turns} 轮 · ` : ''}
                    {new Date(s.updatedAt).toLocaleString()}
                  </span>
                </div>
                <div className="session-actions">
                  <button className="icon-btn" onClick={() => copyPath(s.path)} title="复制路径">
                    ⧉
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => window.harnessShell.sessions.reveal(s.path)}
                    title="在资源管理器打开"
                  >
                    🔍
                  </button>
                  {confirming === s.id ? (
                    <>
                      <button className="icon-btn danger" onClick={() => void remove(s)} title="确认删除">
                        ✔
                      </button>
                      <button className="icon-btn" onClick={() => setConfirming(null)} title="取消">
                        ✕
                      </button>
                    </>
                  ) : (
                    <button className="icon-btn danger" onClick={() => setConfirming(s.id)} title="删除">
                      🗑
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
