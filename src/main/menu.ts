import { Menu, app, type MenuItemConstructorOptions } from 'electron';
import type { CommandDescriptor } from '../shared/types';

export interface MenuContext {
  commands: CommandDescriptor[];
  canRestart: boolean;
  onRestart(): void;
  onOpenBrowser(): void;
  onOpenDevTools(): void;
  onOpenLogs(): void;
  onAbout(): void;
  onRunCommand(id: string): void;
}

export function buildAppMenu(ctx: MenuContext): Menu {
  const commandItems: MenuItemConstructorOptions[] =
    ctx.commands.length > 0
      ? ctx.commands.map((c) => ({ label: c.title, click: () => ctx.onRunCommand(c.id) }))
      : [{ label: '(无命令)', enabled: false }];

  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: '重启服务', enabled: ctx.canRestart, click: () => ctx.onRestart() },
        { label: '在浏览器中打开', click: () => ctx.onOpenBrowser() },
        { type: 'separator' },
        { label: '退出', accelerator: 'Alt+F4', click: () => app.quit() },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '开发者工具', accelerator: 'F12', click: () => ctx.onOpenDevTools() },
      ],
    },
    { label: '命令', submenu: commandItems },
    {
      label: '帮助',
      submenu: [
        { label: '打开日志', click: () => ctx.onOpenLogs() },
        { label: '关于', click: () => ctx.onAbout() },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}
