import { Menu, Tray, nativeImage, type NativeImage } from 'electron';
import type { CommandDescriptor } from '../shared/types';

export interface TrayMenuActions {
  commands: CommandDescriptor[];
  canRestart: boolean;
  hasUrl: boolean;
  onShow(): void;
  onToggle(): void;
  onRestart(): void;
  onOpenBrowser(): void;
  onRunCommand(id: string): void;
  onQuit(): void;
}

export interface TrayOptions extends TrayMenuActions {
  iconPath: string;
  tooltip: string;
}

export function buildTrayMenu(actions: TrayMenuActions): Menu {
  const commandItems = actions.commands.map((c) => ({
    label: c.title,
    click: () => actions.onRunCommand(c.id),
  }));
  return Menu.buildFromTemplate([
    { label: '显示 Harness UI', click: () => actions.onShow() },
    { label: '在浏览器中打开', enabled: actions.hasUrl, click: () => actions.onOpenBrowser() },
    { type: 'separator' },
    { label: '重启服务', enabled: actions.canRestart, click: () => actions.onRestart() },
    ...(commandItems.length > 0 ? ([{ type: 'separator' as const }, ...commandItems] as const) : []),
    { type: 'separator' },
    { label: '退出', click: () => actions.onQuit() },
  ]);
}

export function buildTray(options: TrayOptions): Tray {
  const image: NativeImage = nativeImage.createFromPath(options.iconPath);
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip(options.tooltip);
  tray.on('click', () => options.onToggle());
  tray.setContextMenu(buildTrayMenu(options));
  return tray;
}
