import type { ExtensionRegistry } from './registry';

export interface BuiltinDeps {
  restart(): void;
  openExternal(url: string): void;
  openDevTools(): void;
  openLogs(): void;
  getUrl(): string | null;
  about(): void;
  quit(): void;
}

/** 内置扩展：壳层基础命令，全部通过统一注册表挂载。 */
export function registerBuiltinExtensions(registry: ExtensionRegistry, deps: BuiltinDeps): void {
  registry.addCommand({ id: 'service.restart', title: '重启服务', category: '服务', run: () => deps.restart() });
  registry.addCommand({
    id: 'service.open-browser',
    title: '在浏览器中打开',
    category: '服务',
    run: () => {
      const url = deps.getUrl();
      if (url) deps.openExternal(url);
    },
  });
  registry.addCommand({ id: 'shell.devtools', title: '开发者工具', category: '应用', run: () => deps.openDevTools() });
  registry.addCommand({ id: 'shell.logs', title: '打开日志目录', category: '应用', run: () => deps.openLogs() });
  registry.addCommand({ id: 'shell.about', title: '关于 Harness UI', category: '应用', run: () => deps.about() });
  registry.addCommand({ id: 'shell.quit', title: '退出', category: '应用', run: () => deps.quit() });
}
