import fs from 'node:fs';
import path from 'node:path';
import type { SessionInfo, TaskInfo } from '../shared/types';
import { resolveDshHome } from './fs';

/**
 * 会话投影缓存（$DSH_HOME/storages/session_projcache.json）里，dsh 已经把
 * 每个会话的标题/目标/待办/统计/最后活跃时间投影好了——直接读它即可拿到
 * 「标题 / 任务 / 轮数」，无需解压 zstd 正文。
 */
interface ProjectionCache {
  tables?: {
    sessions?: Record<
      string,
      {
        identity?: { cwd?: string };
        rows?: {
          title?: { val?: string | null };
          goal?: { val?: unknown };
          todos?: { val?: unknown };
          plan?: { val?: { active?: boolean; wanted?: unknown } | null };
          sessionStats?: { val?: { turns?: number } | null };
          sessionListMetadata?: { val?: { lastPromptAt?: number | null } | null };
        };
      }
    >;
  };
}

let cachePath: string | null = null;

function projectionCache(): ProjectionCache | null {
  const file = path.join(resolveDshHome(), 'storages', 'session_projcache.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as ProjectionCache;
  } catch {
    return null;
  }
}

function readableValue(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    const items = val.map((v) => readableValue(v)).filter(Boolean);
    return items.length ? items.join(' · ') : null;
  }
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>;
    const preferred = o.objective ?? o.title ?? o.text ?? o.name ?? o.content;
    if (typeof preferred === 'string' && preferred) return preferred;
    // todos 形如 { items: [{content, status}] }
    if (Array.isArray(o.items)) {
      const items = (o.items as Array<Record<string, unknown>>)
        .map((it) => {
          const c = it.content ?? it.text;
          const s = it.status;
          return typeof c === 'string' ? (s ? `[${String(s)}] ${c}` : c) : null;
        })
        .filter(Boolean);
      if (items.length) return items.join(' · ');
    }
    try {
      return JSON.stringify(o);
    } catch {
      return null;
    }
  }
  return null;
}

/** 列出会话，标题/轮数取自投影缓存（无缓存时回退目录名）。 */
export function listSessions(): SessionInfo[] {
  const sessionsRoot = path.join(resolveDshHome(), 'sessions');
  const cache = projectionCache()?.tables?.sessions ?? {};
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
      const proj = cache[sd.name];
      const title = proj?.rows?.title?.val || sd.name.replace(/^session-/, '').slice(0, 8);
      const turns = proj?.rows?.sessionStats?.val?.turns ?? 0;
      result.push({ id: sd.name, title, workspace: ws.name, updatedAt, path: full, turns });
    }
  }
  return result.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 列出有目标/待办的会话（任务面板）。 */
export function listTasks(): TaskInfo[] {
  const sessionsRoot = path.join(resolveDshHome(), 'sessions');
  const cache = projectionCache()?.tables?.sessions ?? {};
  const out: TaskInfo[] = [];
  for (const [id, proj] of Object.entries(cache)) {
    const goal = readableValue(proj?.rows?.goal?.val);
    const todos = readableValue(proj?.rows?.todos?.val);
    const planActive = !!proj?.rows?.plan?.val?.active;
    if (!goal && !todos && !planActive) continue;
    // 反查工作区目录（identity.cwd 编码成了目录名，这里用目录扫描兜底）
    let workspace = '';
    let updatedAt = 0;
    try {
      const wsRoots = fs.readdirSync(sessionsRoot, { withFileTypes: true }).filter((e) => e.isDirectory());
      for (const ws of wsRoots) {
        const p = path.join(sessionsRoot, ws.name, id);
        if (fs.existsSync(p)) {
          workspace = ws.name;
          updatedAt = fs.statSync(p).mtimeMs;
          break;
        }
      }
    } catch {
      /* ignore */
    }
    out.push({
      sessionId: id,
      sessionTitle: proj?.rows?.title?.val || id.replace(/^session-/, '').slice(0, 8),
      workspace,
      goal,
      todos,
      planActive,
      updatedAt,
    });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
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
