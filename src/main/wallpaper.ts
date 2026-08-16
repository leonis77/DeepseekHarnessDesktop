import fs from 'node:fs';
import path from 'node:path';
import type { WallpaperEntry } from '../shared/types';

/**
 * 扫描 Wallpaper Engine 订阅目录，适配其 video 类型壁纸作为应用内动态背景。
 * WE 的 Steam App ID = 431960，订阅的壁纸落在 <steam>/steamapps/workshop/content/431960/<壁纸ID>/，
 * 每个壁纸文件夹含 project.json（title/type/file/preview）。这里只解析元数据，不重新下载、不分发。
 */

const WE_APP_ID = '431960';

interface ProjectJson {
  title?: string;
  type?: string;
  file?: string;
  preview?: string;
}

function steamRoots(): string[] {
  const candidates = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam',
    'D:\\SteamLibrary',
    'E:\\Steam',
    'E:\\SteamLibrary',
  ];
  const roots = new Set<string>();
  for (const c of candidates) {
    const workshop = path.join(c, 'steamapps', 'workshop', 'content', WE_APP_ID);
    if (fs.existsSync(workshop)) roots.add(workshop);
  }
  // 从注册表读 Steam 安装路径（可选）
  try {
    const reg = require('node:child_process').execSync(
      'reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath 2>nul',
      { encoding: 'utf8' }
    );
    const m = reg.match(/SteamPath\s+REG_SZ\s+(.+)/);
    if (m?.[1]) {
      const p = path.join(m[1].trim(), 'steamapps', 'workshop', 'content', WE_APP_ID);
      if (fs.existsSync(p)) roots.add(p);
    }
  } catch {
    /* ignore */
  }
  return [...roots];
}

/** 扫描 WE workshop 目录，返回所有壁纸（含 video/web/scene，非 video 供 UI 灰显）。 */
export function scanWallpaperEngine(): WallpaperEntry[] {
  const out: WallpaperEntry[] = [];
  for (const root of steamRoots()) {
    let items: fs.Dirent[] = [];
    try {
      items = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
    } catch {
      continue;
    }
    for (const item of items) {
      const dir = path.join(root, item.name);
      const projPath = path.join(dir, 'project.json');
      if (!fs.existsSync(projPath)) continue;
      let proj: ProjectJson = {};
      try {
        proj = JSON.parse(fs.readFileSync(projPath, 'utf8')) as ProjectJson;
      } catch {
        continue;
      }
      const type = (proj.type ?? 'unknown') as WallpaperEntry['type'];
      const filePath = proj.file ? path.join(dir, proj.file) : null;
      const previewPath = proj.preview ? path.join(dir, proj.preview) : null;
      out.push({
        id: item.name,
        title: proj.title || item.name,
        type,
        filePath: filePath && fs.existsSync(filePath) ? filePath : null,
        previewPath: previewPath && fs.existsSync(previewPath) ? previewPath : null,
      });
    }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

/** 是否检测到 WE workshop 目录（供 UI 判断是否显示「Wallpaper Engine」来源）。 */
export function hasWallpaperEngine(): boolean {
  return steamRoots().length > 0;
}
