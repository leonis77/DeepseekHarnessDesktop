import { clipboard, nativeImage } from 'electron';

export function readClipboard(): string {
  return clipboard.readText();
}

export function writeClipboard(text: string): void {
  clipboard.writeText(text);
}

/** 读取剪贴板图片，返回 data URL（无图片返回 null）。 */
export function readClipboardImage(): string | null {
  const img = clipboard.readImage();
  if (img.isEmpty()) return null;
  return img.toDataURL();
}

/** 把 data URL 图片写入剪贴板。 */
export function writeClipboardImage(dataUrl: string): void {
  const img = nativeImage.createFromDataURL(dataUrl);
  if (!img.isEmpty()) clipboard.writeImage(img);
}
