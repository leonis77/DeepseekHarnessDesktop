import { exec, spawn } from 'node:child_process';
import os from 'node:os';
import type { TerminalResult } from '../shared/types';

/** 同步执行一条命令并返回输出（用于终端面板的快速命令）。 */
export function runCommand(command: string, cwd?: string): Promise<TerminalResult> {
  return new Promise((resolve) => {
    exec(
      command,
      { cwd: cwd || undefined, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
        resolve({ stdout, stderr, exitCode: code });
      }
    );
  });
}

/** 在指定目录打开外部终端（Windows：优先 Windows Terminal，回退 cmd）。 */
export function openTerminal(cwd?: string): void {
  const dir = cwd && cwd.trim() ? cwd.trim() : os.homedir();
  if (process.platform === 'win32') {
    const wt = spawn('wt', ['-d', dir], { detached: true, stdio: 'ignore' });
    wt.on('error', () => {
      spawn('cmd', ['/c', 'start', '', 'cmd', '/K', 'cd', '/d', dir], { detached: true, stdio: 'ignore' }).unref();
    });
    wt.unref();
  }
}
