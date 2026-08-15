import { useState } from 'react';

export default function TerminalPanel() {
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);

  const run = async (): Promise<void> => {
    const cmd = command.trim();
    if (!cmd || running) return;
    setRunning(true);
    setOutput((o) => o + `\n> ${cmd}\n`);
    try {
      const res = await window.harnessShell.terminal.run(cmd, cwd.trim() || undefined);
      setOutput((o) => o + res.stdout + (res.stderr ? `\n[stderr]\n${res.stderr}` : '') + `\n[exit ${res.exitCode}]`);
    } catch (e) {
      setOutput((o) => o + `\n[error] ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="terminal-panel">
      <div className="panel-toolbar">
        <button onClick={() => window.harnessShell.terminal.open(cwd.trim() || undefined)} title="打开外部终端">
          外部终端
        </button>
      </div>
      <div className="term-cwd">
        <span className="muted">工作目录</span>
        <input value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="留空 = 默认目录" />
      </div>
      <div className="term-input-row">
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run();
          }}
          placeholder="输入命令，如 dir / git status"
        />
        <button onClick={() => void run()} disabled={running}>
          {running ? '…' : '运行'}
        </button>
      </div>
      <pre className="term-output">{output || '运行命令后输出显示在这里。'}</pre>
    </div>
  );
}
