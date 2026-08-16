import { useState } from 'react';

interface Tab {
  id: number;
  cwd: string;
  command: string;
  output: string;
  running: boolean;
}

let nextId = 1;

function newTab(): Tab {
  return { id: nextId++, cwd: '', command: '', output: '', running: false };
}

export default function TerminalPanel() {
  const [tabs, setTabs] = useState<Tab[]>([newTab()]);
  const [activeId, setActiveId] = useState<number>(1);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const patch = (id: number, p: Partial<Tab>): void => {
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
  };

  const run = async (tab: Tab): Promise<void> => {
    const cmd = tab.command.trim();
    if (!cmd || tab.running) return;
    patch(tab.id, { running: true, output: tab.output + `\n> ${cmd}\n` });
    try {
      const res = await window.harnessShell.terminal.run(cmd, tab.cwd.trim() || undefined);
      patch(tab.id, {
        output: tab.output + `\n> ${cmd}\n` + res.stdout + (res.stderr ? `\n[stderr]\n${res.stderr}` : '') + `\n[exit ${res.exitCode}]`,
      });
    } catch (e) {
      patch(tab.id, { output: tab.output + `\n> ${cmd}\n[error] ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      patch(tab.id, { running: false });
    }
  };

  const addTab = (): void => {
    const t = newTab();
    setTabs((ts) => [...ts, t]);
    setActiveId(t.id);
  };

  const closeTab = (id: number): void => {
    setTabs((ts) => {
      const next = ts.filter((t) => t.id !== id);
      if (next.length === 0) return [newTab()];
      if (activeId === id) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  return (
    <div className="terminal-panel">
      <div className="term-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={'term-tab' + (t.id === activeId ? ' active' : '')}
            onClick={() => setActiveId(t.id)}
          >
            #{t.id}
            {tabs.length > 1 && (
              <span
                className="term-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
                }}
              >
                ✕
              </span>
            )}
          </button>
        ))}
        <button className="term-tab-add" onClick={addTab} title="新建会话">
          +
        </button>
        <div className="term-tab-spacer" />
        <button onClick={() => window.harnessShell.terminal.open(active?.cwd.trim() || undefined)} title="打开外部终端">
          外部终端
        </button>
      </div>
      <div className="term-cwd">
        <span className="muted">工作目录</span>
        <input value={active?.cwd ?? ''} onChange={(e) => patch(activeId, { cwd: e.target.value })} placeholder="留空 = 默认目录" />
      </div>
      <div className="term-input-row">
        <input
          value={active?.command ?? ''}
          onChange={(e) => patch(activeId, { command: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run(active);
          }}
          placeholder="输入命令，如 dir / git status"
        />
        <button onClick={() => void run(active)} disabled={active?.running}>
          {active?.running ? '…' : '运行'}
        </button>
      </div>
      <pre className="term-output">{active?.output || '运行命令后输出显示在这里。'}</pre>
    </div>
  );
}
