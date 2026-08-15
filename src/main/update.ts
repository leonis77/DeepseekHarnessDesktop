import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { DshVersionInfo, TerminalResult, UpdateStatus } from '../shared/types';
import { resolveDshBin } from './server';

const PACKAGE = '@deepseek-ai/dsh';

/** 从全局安装的 dsh package.json 读取当前版本。 */
export function readDshVersion(): string {
  const bin = resolveDshBin();
  if (bin) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(bin), '..', 'package.json'), 'utf8'));
      return typeof pkg.version === 'string' ? pkg.version : 'unknown';
    } catch {
      /* ignore */
    }
  }
  return 'unknown';
}

async function npmViewVersion(pkg: string): Promise<string | null> {
  const registries = ['https://registry.npmjs.org', 'https://registry.npmmirror.com'];
  for (const base of registries) {
    const url = `${base}/${pkg.replace(/\//g, '%2F')}/latest`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = (await res.json()) as { version?: string };
      if (data.version) return data.version;
    } catch {
      /* try next registry */
    }
  }
  return null;
}

export async function checkDsh(): Promise<DshVersionInfo> {
  const current = readDshVersion();
  const latest = await npmViewVersion(PACKAGE);
  const outdated = latest != null && current !== 'unknown' && current !== latest;
  return { current, latest, outdated };
}

export function upgradeDsh(): Promise<TerminalResult> {
  return new Promise((resolve) => {
    exec(
      `npm install -g ${PACKAGE}@latest`,
      { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
        resolve({ stdout, stderr, exitCode: code });
      }
    );
  });
}

/** 壳自更新检查：拉取清单 JSON（{ version, url }），与当前版本比对。 */
export async function checkShellUpdate(feedUrl: string, currentVersion: string): Promise<UpdateStatus> {
  if (!feedUrl) {
    return { available: false, version: null, url: null, error: '未配置更新源（config.updateFeedUrl）' };
  }
  try {
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { available: false, version: null, url: null, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { version?: string; url?: string };
    const available = !!data.version && data.version !== currentVersion;
    return { available, version: data.version ?? null, url: data.url ?? null, error: null };
  } catch (e) {
    return { available: false, version: null, url: null, error: e instanceof Error ? e.message : String(e) };
  }
}
