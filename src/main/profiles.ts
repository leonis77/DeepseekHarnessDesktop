import fs from 'node:fs';
import path from 'node:path';
import type { ProfileInfo } from '../shared/types';
import { resolveDshHome } from './fs';

/** 列出 DSH_HOME/profiles 下的所有 profile（排除 node_modules），默认必有 web。 */
export function listProfiles(): ProfileInfo[] {
  const dir = path.join(resolveDshHome(), 'profiles');
  let names: string[] = [];
  try {
    names = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [{ name: 'web', isDefault: true }];
  }
  const profiles = names.filter((n) => n !== 'node_modules');
  if (profiles.length === 0) return [{ name: 'web', isDefault: true }];
  if (!profiles.includes('web')) profiles.unshift('web');
  return profiles.map((name) => ({ name, isDefault: name === 'web' }));
}
