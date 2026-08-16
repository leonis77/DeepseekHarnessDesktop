import { useEffect, useState } from 'react';
import type { TaskInfo } from '../../../shared/types';

export default function TasksPanel() {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void window.harnessShell.sessions
      .tasks()
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">加载任务…</p>;
  if (tasks.length === 0) {
    return (
      <div className="panel-empty">
        <h4>任务</h4>
        <p>暂无进行中的目标 / 待办。任务数据来自会话投影缓存（session_projcache.json）。</p>
      </div>
    );
  }

  return (
    <div className="tasks-panel">
      <div className="panel-toolbar">
        <button onClick={() => void window.harnessShell.sessions.tasks().then(setTasks)} title="刷新">
          ↻ 刷新
        </button>
      </div>
      <ul className="task-list">
        {tasks.map((t) => (
          <li key={t.sessionId} className="task-item">
            <div className="task-head">
              <span className="task-title">{t.sessionTitle}</span>
              {t.planActive && <span className="badge ok">计划中</span>}
            </div>
            {t.goal && (
              <div className="task-row">
                <span className="muted">目标</span>
                <span>{t.goal}</span>
              </div>
            )}
            {t.todos && (
              <div className="task-row">
                <span className="muted">待办</span>
                <span>{t.todos}</span>
              </div>
            )}
            <div className="task-meta muted">
              {t.workspace} · {new Date(t.updatedAt).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
