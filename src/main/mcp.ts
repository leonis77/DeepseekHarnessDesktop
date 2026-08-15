import fs from 'node:fs';
import path from 'node:path';
import type { McpScanResult } from '../shared/types';
import { resolveDshHome } from './fs';

/** 朴素扫描 settings.yaml 中的 mcp 段，返回已配置的服务器名列表。 */
export function scanMcp(): McpScanResult {
  const settingsPath = path.join(resolveDshHome(), 'settings.yaml');
  let raw = '';
  try {
    raw = fs.readFileSync(settingsPath, 'utf8');
  } catch {
    return { servers: [], raw: '' };
  }
  const servers: string[] = [];
  const lines = raw.split(/\r?\n/);
  let inMcp = false;
  for (const line of lines) {
    if (/^mcp\s*:/.test(line)) {
      inMcp = true;
      continue;
    }
    if (inMcp) {
      if (/^\S/.test(line)) break; // 回到顶层键
      const m = line.match(/^\s{2,}([\w-]+)\s*:/);
      if (m) servers.push(m[1]);
    }
  }
  return { servers, raw };
}
