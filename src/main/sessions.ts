import fs from 'node:fs';
import path from 'node:path';
import type { SessionInfo } from '../shared/types';
import { resolveDshHome } from './fs';

/**
 * 列出 DSH_HOME/sessions/<workspace>/session-<uuid> 的会话目录。
 * 会话正文是 zstd 压缩的 jsonl，这里只做目录级元数据（id/工作区/更新时间），不做解压。
 */
export function listSessions(): SessionInfo[] {
  const sessionsRoot = path.join(resolveDshHome(), 'sessions');
  const result: SessionInfo[] = [];
  let workspaces: fs.Dirent[] = [];
  try {
    workspaces = fs.readdirSync(sessionsRoot, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    return [];
  }
  for (const ws of workspaces) {
    const wsPath = path.join(sessionsRoot, ws.name);
    let sessionDirs: fs.Dirent[] = [];
    try {
      sessionDirs = fs.readdirSync(wsPath, { withFileTypes: true }).filter((e) => e.isDirectory());
    } catch {
      continue;
    }
    for (const sd of sessionDirs) {
      const full = path.join(wsPath, sd.name);
      let updatedAt = 0;
      try {
        updatedAt = fs.statSync(full).mtimeMs;
      } catch {
        /* ignore */
      }
      result.push({
        id: sd.name,
        title: sd.name.replace(/^session-/, '').slice(0, 8),
        workspace: ws.name,
        updatedAt,
        path: full,
      });
    }
  }
  return result.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 删除一个会话目录（带路径白名单校验，防止误删 sessions 之外的东西）。 */
export function removeSession(target: string): void {
  const root = path.resolve(resolveDshHome(), 'sessions');
  const resolved = path.resolve(target);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('拒绝删除：目标不在会话目录内');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}
