import { useCallback, useEffect, useState } from 'react';
import type { FileEntry } from '../../../shared/types';

export default function FilesPanel() {
  const [root, setRoot] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cwd = history.length ? history[history.length - 1] : root;

  const load = useCallback(async (dir: string) => {
    setLoading(true);
    setError('');
    try {
      const list = await window.harnessShell.fs.readDir(dir);
      list.sort((a, b) =>
        a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1
      );
      setEntries(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void window.harnessShell.fs.homeDir().then((h) => {
      setRoot(h);
      setHistory([h]);
    });
  }, []);

  useEffect(() => {
    if (cwd) void load(cwd);
  }, [cwd, load]);

  const enter = (dir: string): void => setHistory((h) => [...h, dir]);
  const up = (): void => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const chooseRoot = async (): Promise<void> => {
    const dir = await window.harnessShell.fs.pickDirectory();
    if (dir) {
      setRoot(dir);
      setHistory([dir]);
    }
  };

  return (
    <div className="files-panel">
      <div className="panel-toolbar">
        <button onClick={up} title="上一级" disabled={history.length <= 1}>
          ↑
        </button>
        <button onClick={() => cwd && void load(cwd)} title="刷新">
          ↻
        </button>
        <button onClick={chooseRoot} title="选择文件夹">
          📂
        </button>
        <button onClick={() => window.harnessShell.terminal.open(cwd ?? undefined)} title="在此打开终端">
          ⌘
        </button>
        <button onClick={() => cwd && window.harnessShell.fs.reveal(cwd)} title="在资源管理器打开">
          🔍
        </button>
      </div>
      <div className="panel-path">{cwd ?? '加载中…'}</div>
      <ul className="file-list">
        {loading && <li className="muted">加载中…</li>}
        {error && <li className="err">{error}</li>}
        {!loading &&
          entries.map((entry) => (
            <li
              key={entry.path}
              className="file-item"
              onClick={() => (entry.isDirectory ? enter(entry.path) : window.harnessShell.fs.reveal(entry.path))}
              onDoubleClick={() => entry.isDirectory && enter(entry.path)}
            >
              <span className="file-name">
                {entry.isDirectory ? '📁 ' : '📄 '}
                {entry.name}
              </span>
              {!entry.isDirectory && <span className="file-size">{formatSize(entry.size)}</span>}
            </li>
          ))}
      </ul>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
