import fs from 'node:fs';
import path from 'node:path';
import { resolveDshHome } from './fs';

const BUNDLED_PLUGINS = ['dsh-plugin-genui', 'oh-my-dsh', 'dsh-voice-webspeech', 'dsh-message-edit', 'dsh-git-status', 'dsh-vision-router'];

/**
 * 首次启动时，把内置插件写入 web profile 的 dsh.profile.bundles + dependencies。
 * 插件本体已在 vendor/dsh 的依赖闭包里（healProfilesModuleFallback 会 symlink），
 * 这里只负责「激活」。
 */
export function ensureBundledPlugins(): void {
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
  let changed = false;

  for (const plugin of BUNDLED_PLUGINS) {
    if (!bundles.includes(plugin)) {
      bundles.push(plugin);
      changed = true;
    }
    if (!(plugin in deps)) {
      deps[plugin] = '*';
      changed = true;
    }
  }

  if (!changed) return;
  pkg.dependencies = deps;
  pkg.dsh = { ...(pkg.dsh ?? {}), profile: { ...(pkg.dsh?.profile ?? {}), bundles } };
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
}
