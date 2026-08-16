import { app, ipcMain, Menu, shell, dialog, Notification, protocol, net, type BrowserWindow, type Tray } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { DshServer, ensureDshExtractedAsync } from './server';
import { AppConfigStore } from './config';
import { ExtensionRegistry } from './extensions/registry';
import { registerBuiltinExtensions } from './extensions/builtin';
import { createShellWindow } from './window';
import { buildTray, buildTrayMenu } from './tray';
import { buildAppMenu } from './menu';
import { readDir, readFileText, writeFileText, readImageAsDataUrl, pickDirectory, pickFile, pickVideoFile, copyFilesInto, revealPath, resolveDshHome, homeDir } from './fs';
import { runCommand, openTerminal } from './terminal';
import { readClipboard, writeClipboard, readClipboardImage, writeClipboardImage } from './clipboard';
import { listProfiles } from './profiles';
import { listSessions, listTasks, removeSession, detectAgentActivity } from './sessions';
import { scanWallpaperEngine, hasWallpaperEngine } from './wallpaper';
import { MODEL_PRESETS, readModelApiState, saveModelProvider } from './modelconfig';
import { scanMcp } from './mcp';
import { checkDsh, upgradeDsh, checkGithubRelease } from './update';
import { applyPet, movePet, hidePet, sendPetServiceState, sendPetActivity } from './pet';
import { ensureBundledPlugins, listBundledPlugins } from './plugins';
import { BUNDLED_PLUGIN_IDS } from '../shared/plugins';
import { startRemoteGateway, generateToken, type RemoteGateway } from './remote';
import { qrDataUrl } from './qr';
import {
  initAutoUpdater,
  updaterSupported,
  shellUpdaterState,
  checkShellUpdate,
  downloadShellUpdate,
  installShellUpdate,
} from './updater';
import { IPC } from '../shared/ipc';
import type { BootstrapState, RemoteStatus, ServiceState, StartupProgress } from '../shared/types';

const APP_NAME = 'Harness UI';

// 自定义协议：渲染层用 media://local/<path> 加载本地视频（动态壁纸），
// 避免 file:// 在渲染层被拦截/同源限制。
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } },
]);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let server: DshServer | null = null;
let remoteGateway: RemoteGateway | null = null;
let quitting = false;
let idleTimer: NodeJS.Timeout | null = null;
let idleStopped = false;

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

function clearIdleTimer(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function scheduleIdleStop(): void {
  clearIdleTimer();
  const minutes = config.get().idleStopMinutes ?? 0;
  if (minutes <= 0 || !server) return;
  idleTimer = setTimeout(() => {
    if (!server || idleStopped) return;
    idleStopped = true;
    log(`空闲 ${minutes} 分钟，自动停止 dsh 以节省内存`);
    void server.stop();
    server = null;
    broadcastServiceState();
  }, minutes * 60 * 1000);
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
  sendPetServiceState(state);
  refreshTray();
  refreshMenu();
}

function broadcastConfig(): void {
  mainWindow?.webContents.send(IPC.settings.onChanged, config.get());
}

function broadcastProgress(progress: StartupProgress): void {
  mainWindow?.webContents.send(IPC.service.onProgress, progress);
}

function remoteStatus(): RemoteStatus {
  const cfg = config.get();
  return {
    enabled: cfg.remoteEnabled ?? false,
    running: remoteGateway != null,
    url: remoteGateway ? remoteGateway.url : null,
    token: cfg.remoteToken ?? '',
    error: null,
  };
}

function remoteManageOptions() {
  return {
    data: () => ({ sessions: listSessions(), tasks: listTasks() }),
    remove: (p: string) => removeSession(p),
  };
}

async function applyRemoteEnabled(enabled: boolean): Promise<RemoteStatus> {
  try {
    if (enabled) {
      let token = config.get().remoteToken;
      if (!token) {
        token = generateToken();
        config.update({ remoteToken: token });
      }
      if (!remoteGateway) {
        remoteGateway = await startRemoteGateway({ getTarget: () => server?.url ?? null, token, log, manage: remoteManageOptions() });
      }
      config.update({ remoteEnabled: true });
    } else {
      if (remoteGateway) {
        await remoteGateway.stop();
        remoteGateway = null;
      }
      config.update({ remoteEnabled: false });
    }
    return remoteStatus();
  } catch (e) {
    return { ...remoteStatus(), error: e instanceof Error ? e.message : String(e) };
  }
}

async function regenerateRemoteToken(): Promise<RemoteStatus> {
  const token = generateToken();
  config.update({ remoteToken: token });
  if (remoteGateway) {
    await remoteGateway.stop();
    remoteGateway = null;
  }
  if (config.get().remoteEnabled) {
    remoteGateway = await startRemoteGateway({ getTarget: () => server?.url ?? null, token, log, manage: remoteManageOptions() });
  }
  return remoteStatus();
}

async function startServer(): Promise<string | null> {
  ensureBundledPlugins(config.get().disabledPlugins ?? []);
  const extractMs = await ensureDshExtractedAsync(() => {
    mainWindow?.webContents.send(IPC.service.onState, { status: 'preparing', mode: null, url: null, pid: null });
  });
  const bootStart = Date.now();
  server = new DshServer({
    port: 0,
    profile: config.get().profile,
    log,
    env: { ...process.env },
    onState: () => broadcastServiceState(),
    onProgress: (progress) => broadcastProgress(progress),
    onExit: (code, signal) => {
      log(`dsh 异常退出（code=${code} signal=${signal}）`);
      notify('Harness 服务已停止', '可从菜单或托盘「重启服务」重新启动。');
    },
  });
  try {
    const url = await server.start();
    log(`[埋点] 解压 ${extractMs}ms，dsh 启动 ${Date.now() - bootStart}ms，就绪：${url}`);
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
    const updated = config.update(patch ?? {});
    if (patch && patch.pet) applyPet(updated.pet);
    return updated;
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
  ipcMain.handle(IPC.fs.pickVideoFile, () => pickVideoFile());
  ipcMain.handle(IPC.fs.copyFilesInto, (_event, dir: string, paths: string[]) => copyFilesInto(dir, paths));
  ipcMain.on(IPC.fs.reveal, (_event, target: string) => revealPath(target));

  // 原生集成：终端 / 剪贴板
  ipcMain.handle(IPC.terminal.run, (_event, command: string, cwd?: string) => runCommand(command, cwd));
  ipcMain.on(IPC.terminal.open, (_event, cwd?: string) => openTerminal(cwd));
  ipcMain.handle(IPC.clipboard.read, () => readClipboard());
  ipcMain.on(IPC.clipboard.write, (_event, text: string) => writeClipboard(text));
  ipcMain.handle(IPC.clipboard.readImage, () => readClipboardImage());
  ipcMain.on(IPC.clipboard.writeImage, (_event, dataUrl: string) => writeClipboardImage(dataUrl));

  // 面板数据
  ipcMain.handle(IPC.profiles.list, () => listProfiles());
  ipcMain.handle(IPC.sessions.list, () => listSessions());
  ipcMain.handle(IPC.sessions.tasks, () => listTasks());
  ipcMain.on(IPC.sessions.reveal, (_event, target: string) => revealPath(target));
  ipcMain.handle(IPC.sessions.remove, (_event, target: string) => removeSession(target));
  ipcMain.handle(IPC.mcp.scan, () => scanMcp());

  // 动态壁纸（Wallpaper Engine）
  ipcMain.handle(IPC.wallpaper.scan, () => scanWallpaperEngine());
  ipcMain.handle(IPC.wallpaper.has, () => hasWallpaperEngine());

  // 模型 / API 桌面配置
  ipcMain.handle(IPC.model.presets, () => MODEL_PRESETS);
  ipcMain.handle(IPC.model.state, () => readModelApiState());
  ipcMain.handle(IPC.model.save, (_event, provider: import('../shared/types').ModelProviderConfig) =>
    saveModelProvider(provider)
  );

  // 宠物窗口
  ipcMain.handle('pet:getConfig', () => config.get().pet);
  ipcMain.on('pet:move', (_event, dx: number, dy: number) => movePet(dx, dy));
  ipcMain.on('pet:close', () => {
    hidePet();
    config.update({ pet: { ...config.get().pet, enabled: false } });
    broadcastConfig();
  });

  // 插件开关
  ipcMain.handle(IPC.plugins.list, () => listBundledPlugins(config.get().disabledPlugins ?? []));
  ipcMain.handle(IPC.plugins.setEnabled, async (_event, enabledIds: string[]) => {
    const disabledPlugins = BUNDLED_PLUGIN_IDS.filter((id) => !enabledIds.includes(id));
    config.update({ disabledPlugins });
    ensureBundledPlugins(disabledPlugins);
    await restartServer();
    broadcastConfig();
    return config.get();
  });

  // 手机远程网关
  ipcMain.handle(IPC.remote.status, () => remoteStatus());
  ipcMain.handle(IPC.remote.setEnabled, (_event, enabled: boolean) => applyRemoteEnabled(enabled));
  ipcMain.handle(IPC.remote.regenerateToken, () => regenerateRemoteToken());
  ipcMain.handle(IPC.remote.qr, async () => {
    const st = remoteStatus();
    if (!st.running || !st.url) return null;
    return qrDataUrl(`${st.url}?token=${st.token}`);
  });

  // 更新
  ipcMain.handle(IPC.update.checkDsh, () => checkDsh());
  ipcMain.handle(IPC.update.upgradeDsh, () => upgradeDsh());
  ipcMain.handle(IPC.update.checkShell, () =>
    checkGithubRelease(config.get().githubRepo ?? 'leonis77/DeepseekHarnessDesktop', app.getVersion())
  );
  ipcMain.handle(IPC.update.shellState, () => shellUpdaterState());
  ipcMain.handle(IPC.update.shellCheck, async () => {
    if (!updaterSupported()) throw new Error('当前为便携版/开发态，不支持静默自更新，请使用「前往下载」。');
    await checkShellUpdate();
  });
  ipcMain.handle(IPC.update.shellDownload, async () => {
    await downloadShellUpdate();
  });
  ipcMain.on(IPC.update.shellInstall, () => installShellUpdate());
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(() => {
    app.setAppUserModelId('com.local.harness-ui');
    config.setAutoLaunch(config.get().autoLaunch);
    applyPet(config.get().pet);

    // 本地媒体协议（动态壁纸视频）
    protocol.handle('media', (request) => {
      const filePath = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ''));
      return net.fetch(pathToFileURL(filePath).toString());
    });

    initAutoUpdater({
      onState: (s) => mainWindow?.webContents.send(IPC.update.onShellState, s),
      onNotify: (title, body) => notify(title, body),
      log,
    });

    // 桌面宠物 agent 活动联动（Codex 风格）：每 3s 探测一次
    setInterval(() => sendPetActivity(detectAgentActivity()), 3000);

    // 上次开启了远程访问：恢复网关
    if (config.get().remoteEnabled) void applyRemoteEnabled(true);

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
    mainWindow.on('hide', () => scheduleIdleStop());
    mainWindow.on('show', () => {
      clearIdleTimer();
      if (idleStopped) {
        idleStopped = false;
        void startServer();
      }
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
    if (remoteGateway) {
      void remoteGateway.stop();
      remoteGateway = null;
    }
  });

  app.on('window-all-closed', () => {
    /* 托盘常驻，不退出 */
  });

  process.on('uncaughtException', (error) => {
    log('uncaughtException：' + (error instanceof Error ? (error.stack ?? error.message) : String(error)));
  });
}
