import { dialog, shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FileEntry } from '../shared/types';

export function resolveDshHome(): string {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
}

export function homeDir(): string {
  return os.homedir();
}

export function readDir(dirPath: string): FileEntry[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.map((entry) => {
    const full = path.join(dirPath, entry.name);
    let size = 0;
    let mtimeMs = 0;
    try {
      const stat = fs.statSync(full);
      size = stat.size;
      mtimeMs = stat.mtimeMs;
    } catch {
      /* 忽略无法 stat 的条目（如损坏链接） */
    }
    return { name: entry.name, path: full, isDirectory: entry.isDirectory(), size, mtimeMs };
  });
}

export function readFileText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

/** 读取图片并以 data URL 返回（渲染层据此展示背景，避免 file:// 跨源问题）。 */
export function readImageAsDataUrl(filePath: string): string {
  const data = fs.readFileSync(filePath);
  const mime = IMAGE_MIME[path.extname(filePath).toLowerCase()] ?? 'image/png';
  return `data:${mime};base64,${data.toString('base64')}`;
}

export function writeFileText(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf8');
}

/** 把一组文件复制进目标目录（用于拖拽导入文件面板）。返回复制后的文件名列表。 */
export function copyFilesInto(targetDir: string, filePaths: string[]): string[] {
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    throw new Error('目标不是目录');
  }
  const copied: string[] = [];
  for (const src of filePaths) {
    if (!fs.existsSync(src)) continue;
    const name = path.basename(src);
    const dst = path.join(targetDir, name);
    if (path.resolve(src) === path.resolve(dst)) continue;
    fs.copyFileSync(src, dst);
    copied.push(name);
  }
  return copied;
}

export async function pickDirectory(): Promise<string | null> {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

export async function pickFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({ properties: ['openFile'] });
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

const VIDEO_EXT = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'];

/** 选择本地视频文件（动态壁纸）。 */
export async function pickVideoFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: '视频', extensions: VIDEO_EXT }],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

export function revealPath(target: string): void {
  if (target) shell.showItemInFolder(target);
}
