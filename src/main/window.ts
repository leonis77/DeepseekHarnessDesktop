import { BrowserWindow, shell } from 'electron';

export interface ShellWindowOptions {
  width: number;
  height: number;
  preload: string;
  icon: string;
}

/** 创建无边框壳窗口（自定义标题栏在渲染层绘制）。 */
export function createShellWindow(options: ShellWindowOptions): BrowserWindow {
  const win = new BrowserWindow({
    width: options.width,
    height: options.height,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    show: false,
    icon: options.icon,
    backgroundColor: '#0b0f17',
    webPreferences: {
      preload: options.preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  return win;
}
