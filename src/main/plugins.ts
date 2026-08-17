import fs from 'node:fs';
import path from 'node:path';
import { resolveDshHome } from './fs';
import { BUNDLED_PLUGINS, RETIRED_PLUGINS } from '../shared/plugins';
import type { PluginState } from '../shared/types';

/**
 * 首次启动时，把内置插件写入 web profile 的 dsh.profile.bundles + dependencies。
 * 插件本体已在 vendor/dsh 的依赖闭包里（healProfilesModuleFallback 会 symlink），
 * 这里只负责「激活」。`disabledPlugins` 中的插件不会被写入 bundles（下次 dsh 启动即生效）。
 */
export function ensureBundledPlugins(disabledPlugins: string[] = []): void {
  const profileDir = path.join(resolveDshHome(), 'profiles', 'web');
  const pkgPath = path.join(profileDir, 'package.json');

  let pkg: { dependencies?: Record<string, string>; dsh?: { profile?: { bundles?: string[] } } };
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as typeof pkg;
  } catch {
    return; // profile 尚未创建，等 dsh 首次启动生成
  }

  const deps: Record<string, string> = pkg.dependencies ?? {};
  const bundles: string[] = pkg.dsh?.profile?.bundles ?? [];
  const enabled = new Set(BUNDLED_PLUGINS.map((p) => p.id).filter((id) => !disabledPlugins.includes(id)));
  let changed = false;

  // 先移除已下架的插件（避免残留 bundle 导致 dsh 启动失败）
  const retired = new Set(RETIRED_PLUGINS);
  const withoutRetired = bundles.filter((b) => !retired.has(b));
  if (withoutRetired.length !== bundles.length) changed = true;
  bundles.length = 0;
  bundles.push(...withoutRetired);
  for (const id of RETIRED_PLUGINS) {
    if (id in deps) {
      delete deps[id];
      changed = true;
    }
  }

  // 再移除被禁用的内置插件（保留用户自己加的其它 bundle）
  const filtered = bundles.filter((b) => !BUNDLED_PLUGINS.some((p) => p.id === b) || enabled.has(b));
  if (filtered.length !== bundles.length) changed = true;
  bundles.length = 0;
  bundles.push(...filtered);

  for (const id of enabled) {
    if (!bundles.includes(id)) {
      bundles.push(id);
      changed = true;
    }
    if (!(id in deps)) {
      deps[id] = '*';
      changed = true;
    }
  }

  if (!changed) return;
  pkg.dependencies = deps;
  pkg.dsh = { ...(pkg.dsh ?? {}), profile: { ...(pkg.dsh?.profile ?? {}), bundles } };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
}

/** 返回内置插件的启用状态（供设置面板开关）。 */
export function listBundledPlugins(disabledPlugins: string[] = []): PluginState[] {
  return BUNDLED_PLUGINS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    enabled: !disabledPlugins.includes(p.id),
  }));
}
