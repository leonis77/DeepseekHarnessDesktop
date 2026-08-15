import type { MenuItemConstructorOptions } from 'electron';
import type { CommandDescriptor } from '../../shared/types';

/**
 * 壳层扩展注册表：命令 / 菜单 的统一登记点。
 * 任何扩展（内置或未来的用户扩展）都通过这里贡献能力，
 * 并自动出现在：应用菜单「命令」、托盘菜单、命令面板（Ctrl+K）。
 */
export interface ExtensionCommand {
  id: string;
  title: string;
  category?: string;
  run: () => void | Promise<void>;
}

export interface Disposable {
  dispose(): void;
}

export interface ExtensionContext {
  registerCommand(command: ExtensionCommand): Disposable;
  registerMenu(menu: MenuItemConstructorOptions): Disposable;
}

export interface Extension {
  id: string;
  name: string;
  activate(ctx: ExtensionContext): void | Promise<void>;
}

export class ExtensionRegistry {
  private commands = new Map<string, ExtensionCommand>();
  private menus: MenuItemConstructorOptions[] = [];

  /** 激活一个扩展，向其暴露注册 API。 */
  async activate(extension: Extension): Promise<void> {
    await extension.activate({
      registerCommand: (command) => this.addCommand(command),
      registerMenu: (menu) => this.addMenu(menu),
    });
  }

  addCommand(command: ExtensionCommand): Disposable {
    this.commands.set(command.id, command);
    return { dispose: () => this.commands.delete(command.id) };
  }

  addMenu(menu: MenuItemConstructorOptions): Disposable {
    this.menus.push(menu);
    return {
      dispose: () => {
        const index = this.menus.indexOf(menu);
        if (index >= 0) this.menus.splice(index, 1);
      },
    };
  }

  listCommands(): CommandDescriptor[] {
    return [...this.commands.values()].map(({ id, title, category }) => ({ id, title, category }));
  }

  runCommand(id: string): boolean {
    const command = this.commands.get(id);
    if (!command) return false;
    void command.run();
    return true;
  }

  getMenus(): MenuItemConstructorOptions[] {
    return [...this.menus];
  }
}
