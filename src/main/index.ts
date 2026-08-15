import { app, ipcMain, Menu, shell, dialog, Notification, type BrowserWindow, type Tray } from 'electron';
import { join } from 'node:path';
import fs from 'node:fs';
import { DshServer } from './server';
import { AppConfigStore } from './config';
import { ExtensionRegistry } from './extensions/registry';
import { registerBuiltinExtensions } from './extensions/builtin';
import { createShellWindow } from './window';
import { buildTray, buildTrayMenu } from './tray';
import { buildAppMenu } from './menu';
import { readDir, readFileText, writeFileText, readImageAsDataUrl, pickDirectory, pickFile, revealPath, resolveDshHome, homeDir } from './fs';
import { runCommand, openTerminal } from './terminal';
import { readClipboard, writeClipboard } from './clipboard';
import { listProfiles } from './profiles';
import { listSessions, removeSession } from './sessions';
import { scanMcp } from './mcp';
import { checkDsh, upgradeDsh, checkShellUpdate } from './update';
import { IPC } from '../shared/ipc';
import type { BootstrapState, ServiceState } from '../shared/types';

const APP_NAME = 'Harness UI';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let server: DshServer | null = null;
let quitting = false;

const config = new AppConfigStore();
const registry = new ExtensionRegistry();

function logFile(): string {
  return join(app.getPath('userData'), 'logs', 'main.log');
}

function log(...args: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  try {
    fs.mkdirSync(join(app.getPath('userData'), 'logs'), { recursive: true });
    fs.appendFileSync(logFile(), line + '\n');
  } catch {
    /* ignore */
  }
  console.log(line);
}

function iconPath(): string {
  return join(__dirname, '../../resources/icon.png');
}

function preloadPath(): string {
  return join(__dirname, '../preload/index.js');
}

function serviceState(): ServiceState {
  const s = server;
  return { status: s?.status ?? 'idle', mode: s?.mode ?? null, url: s?.url ?? null, pid: s?.pid ?? null };
}

function tooltip(state: ServiceState): string {
  const labels: Record<string, string> = {
    idle: APP_NAME,
    starting: 'Harness 启动中…',
    running: 'Harness 运行中',
    attached: 'Harness 运行中（已连接现有实例）',
    stopped: 'Harness 已停止',
    error: 'Harness 启动失败',
  };
  return labels[state.status] ?? APP_NAME;
}

function notify(title: string, body: string): void {
  try {
    new Notification({ title, body }).show();
  } catch {
    /* ignore */
  }
}

function showWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow(): void {
  if (mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized()) mainWindow.hide();
  else showWindow();
}

function showAbout(): void {
  const detail = `版本 ${app.getVersion()}\n\nDeepSeek Harness 的桌面壳应用（Codex 风格，可扩展）。\n数据目录：${app.getPath('userData')}\n日志：${logFile()}`;
  const options = { type: 'info' as const, title: '关于 Harness UI', message: APP_NAME, detail };
  if (mainWindow) void dialog.showMessageBox(mainWindow, options);
  else void dialog.showMessageBox(options);
}

function refreshTray(): void {
  if (!tray) return;
  tray.setToolTip(tooltip(serviceState()));
  tray.setContextMenu(
    buildTrayMenu({
      commands: registry.listCommands(),
      canRestart: server?.status !== 'starting',
      hasUrl: server?.url != null,
      onShow: () => showWindow(),
      onToggle: () => toggleWindow(),
      onRestart: () => void restartServer(),
      onOpenBrowser: () => {
        if (server?.url) void shell.openExternal(server.url);
      },
      onRunCommand: (id) => registry.runCommand(id),
      onQuit: () => {
        quitting = true;
        app.quit();
      },
    })
  );
}

function refreshMenu(): void {
  Menu.setApplicationMenu(
    buildAppMenu({
      commands: registry.listCommands(),
      canRestart: server?.status !== 'starting',
      onRestart: () => void restartServer(),
      onOpenBrowser: () => {
        if (server?.url) void shell.openExternal(server.url);
      },
      onOpenDevTools: () => mainWindow?.webContents.openDevTools({ mode: 'detach' }),
      onOpenLogs: () => void shell.openPath(join(app.getPath('userData'), 'logs')),
      onAbout: () => showAbout(),
      onRunCommand: (id) => registry.runCommand(id),
    })
  );
}

function broadcastServiceState(): void {
  const state = serviceState();
  mainWindow?.webContents.send(IPC.service.onState, state);
  refreshTray();
  refreshMenu();
}

async function startServer(): Promise<string | null> {
  server = new DshServer({
    port: 0,
    profile: config.get().profile,
    log,
    env: { ...process.env },
    onState: () => broadcastServiceState(),
    onExit: (code, signal) => {
      log(`dsh 异常退出（code=${code} signal=${signal}）`);
      notify('Harness 服务已停止', '可从菜单或托盘「重启服务」重新启动。');
    },
  });
  try {
    const url = await server.start();
    log(`就绪：${url}（模式：${server.mode}）`);
    broadcastServiceState();
    return url;
  } catch (error) {
    log('启动失败：' + (error instanceof Error ? (error.stack ?? error.message) : String(error)));
    dialog.showErrorBox(
      `${APP_NAME} 启动失败`,
      (error instanceof Error ? error.message : String(error)) + '\n\n日志：' + logFile()
    );
    return null;
  }
}

async function restartServer(): Promise<void> {
  if (server) await server.stop();
  server = null;
  broadcastServiceState();
  await startServer();
}

function registerIpc(): void {
  ipcMain.handle(
    IPC.bootstrap,
    (): BootstrapState => ({
      appVersion: app.getVersion(),
      service: serviceState(),
      config: config.get(),
      commands: registry.listCommands(),
    })
  );
  ipcMain.on(IPC.window.minimize, () => mainWindow?.minimize());
  ipcMain.on(IPC.window.toggleMaximize, () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on(IPC.window.close, () => mainWindow?.close());
  ipcMain.handle(IPC.window.isMaximized, () => mainWindow?.isMaximized() ?? false);
  ipcMain.handle(IPC.service.restart, async () => {
    await restartServer();
    return serviceState();
  });
  ipcMain.handle(IPC.commands.list, () => registry.listCommands());
  ipcMain.handle(IPC.commands.run, (_event, id: string) => {
    registry.runCommand(id);
  });
  ipcMain.handle(IPC.settings.get, () => config.get());
  ipcMain.handle(IPC.settings.set, (_event, patch: Partial<import('../shared/types').AppConfig>) => {
    if (patch && typeof patch.autoLaunch === 'boolean') config.setAutoLaunch(patch.autoLaunch);
    return config.update(patch ?? {});
  });
  ipcMain.on(IPC.shell.openExternal, (_event, url: string) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
  });
  ipcMain.on(IPC.shell.openDevTools, () => mainWindow?.webContents.openDevTools({ mode: 'detach' }));
  ipcMain.on(IPC.shell.openLogs, () => void shell.openPath(join(app.getPath('userData'), 'logs')));

  // 原生集成：文件
  ipcMain.handle(IPC.fs.dshHome, () => resolveDshHome());
  ipcMain.handle(IPC.fs.homeDir, () => homeDir());
  ipcMain.handle(IPC.fs.readDir, (_event, dirPath: string) => readDir(dirPath));
  ipcMain.handle(IPC.fs.readFile, (_event, filePath: string) => readFileText(filePath));
  ipcMain.handle(IPC.fs.writeFile, (_event, filePath: string, content: string) => writeFileText(filePath, content));
  ipcMain.handle(IPC.fs.readImage, (_event, filePath: string) => readImageAsDataUrl(filePath));
  ipcMain.handle(IPC.fs.pickDirectory, () => pickDirectory());
  ipcMain.handle(IPC.fs.pickFile, () => pickFile());
  ipcMain.on(IPC.fs.reveal, (_event, target: string) => revealPath(target));

  // 原生集成：终端 / 剪贴板
  ipcMain.handle(IPC.terminal.run, (_event, command: string, cwd?: string) => runCommand(command, cwd));
  ipcMain.on(IPC.terminal.open, (_event, cwd?: string) => openTerminal(cwd));
  ipcMain.handle(IPC.clipboard.read, () => readClipboard());
  ipcMain.on(IPC.clipboard.write, (_event, text: string) => writeClipboard(text));

  // 面板数据
  ipcMain.handle(IPC.profiles.list, () => listProfiles());
  ipcMain.handle(IPC.sessions.list, () => listSessions());
  ipcMain.on(IPC.sessions.reveal, (_event, target: string) => revealPath(target));
  ipcMain.handle(IPC.sessions.remove, (_event, target: string) => removeSession(target));
  ipcMain.handle(IPC.mcp.scan, () => scanMcp());

  // 更新
  ipcMain.handle(IPC.update.checkDsh, () => checkDsh());
  ipcMain.handle(IPC.update.upgradeDsh, () => upgradeDsh());
  ipcMain.handle(IPC.update.checkShell, () => checkShellUpdate(config.get().updateFeedUrl ?? '', app.getVersion()));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(() => {
    app.setAppUserModelId('com.local.harness-ui');
    config.setAutoLaunch(config.get().autoLaunch);

    registerBuiltinExtensions(registry, {
      restart: () => void restartServer(),
      openExternal: (url) => {
        if (/^https?:/i.test(url)) void shell.openExternal(url);
      },
      openDevTools: () => mainWindow?.webContents.openDevTools({ mode: 'detach' }),
      openLogs: () => void shell.openPath(join(app.getPath('userData'), 'logs')),
      getUrl: () => server?.url ?? null,
      about: () => showAbout(),
      quit: () => {
        quitting = true;
        app.quit();
      },
    });

    registerIpc();

    tray = buildTray({
      iconPath: iconPath(),
      tooltip: APP_NAME,
      commands: registry.listCommands(),
      canRestart: true,
      hasUrl: false,
      onShow: () => showWindow(),
      onToggle: () => toggleWindow(),
      onRestart: () => void restartServer(),
      onOpenBrowser: () => {
        if (server?.url) void shell.openExternal(server.url);
      },
      onRunCommand: (id) => registry.runCommand(id),
      onQuit: () => {
        quitting = true;
        app.quit();
      },
    });

    const cfg = config.get();
    mainWindow = createShellWindow({
      width: cfg.window.width,
      height: cfg.window.height,
      preload: preloadPath(),
      icon: iconPath(),
    });

    mainWindow.on('close', (event) => {
      if (!quitting && config.get().closeToTray) {
        event.preventDefault();
        mainWindow?.hide();
        notify(`${APP_NAME} 仍在后台运行`, '点击托盘图标可重新打开窗口。');
      }
    });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
    mainWindow.on('maximize', () => mainWindow?.webContents.send(IPC.window.onMaximized, true));
    mainWindow.on('unmaximize', () => mainWindow?.webContents.send(IPC.window.onMaximized, false));

    const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
    if (rendererUrl) {
      void mainWindow.loadURL(rendererUrl);
    } else {
      void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    refreshMenu();
    refreshTray();
    void startServer();
  });

  app.on('before-quit', () => {
    quitting = true;
    void server?.stop();
  });

  app.on('window-all-closed', () => {
    /* 托盘常驻，不退出 */
  });

  process.on('uncaughtException', (error) => {
    log('uncaughtException：' + (error instanceof Error ? (error.stack ?? error.message) : String(error)));
  });
}
