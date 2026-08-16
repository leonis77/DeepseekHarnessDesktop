/**
 * 壳自更新（静默）：基于 electron-updater + GitHub Releases。
 * - 仅安装版（NSIS）支持静默更新；便携版 / 开发态回退到「前往下载」。
 * - 启动后延迟静默检查，检测到新版本后台下载，下载完成后下次退出自动安装。
 */
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { ShellUpdaterState } from '../shared/types';

export function isPortable(): boolean {
  return typeof process.env.PORTABLE_EXECUTABLE_DIR === 'string';
}

/** 是否支持静默自更新：已打包 + 非便携版。 */
export function updaterSupported(): boolean {
  return app.isPackaged && !isPortable();
}

type LogFn = (msg: string) => void;

interface UpdaterEvents {
  onState(state: ShellUpdaterState): void;
  onNotify(title: string, body: string): void;
  log: LogFn;
}

let state: ShellUpdaterState = { supported: false, state: 'idle', version: null, percent: 0, error: null };
let notify: ((title: string, body: string) => void) | null = null;
let initialized = false;

function set(patch: Partial<ShellUpdaterState>): void {
  state = { ...state, ...patch };
  events?.onState(state);
}

let events: UpdaterEvents | null = null;

function safeLog(msg: string): void {
  events?.log(msg);
}

export function shellUpdaterState(): ShellUpdaterState {
  return { ...state, supported: updaterSupported() };
}

/** 初始化：装配事件 + 启动后延迟静默检查。 */
export function initAutoUpdater(evts: UpdaterEvents): void {
  if (initialized) return;
  initialized = true;
  events = evts;
  notify = evts.onNotify;

  autoUpdater.logger = {
    info: (m) => safeLog(`[updater] ${m}`),
    warn: (m) => safeLog(`[updater] ${m}`),
    error: (m) => safeLog(`[updater] ${m}`),
    debug: (m) => safeLog(`[updater] ${m}`),
  };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => set({ state: 'checking', error: null }));
  autoUpdater.on('update-available', (info) => set({ state: 'available', version: info.version, error: null }));
  autoUpdater.on('update-not-available', () => set({ state: 'not-available', error: null }));
  autoUpdater.on('download-progress', (p) =>
    set({ state: 'downloading', percent: Math.round(p.percent), error: null })
  );
  autoUpdater.on('update-downloaded', (info) => {
    set({ state: 'downloaded', version: info.version, percent: 100, error: null });
    notify?.('Harness UI 更新已就绪', `新版本 ${info.version} 已下载，退出应用时自动安装。`);
  });
  autoUpdater.on('error', (err) => set({ state: 'error', error: err.message ?? String(err) }));

  // 启动后延迟静默检查（不打扰用户）
  setTimeout(() => {
    if (updaterSupported()) void autoUpdater.checkForUpdates().catch(() => {});
  }, 8000);
}

/** 手动检查（设置面板按钮）。便携版/开发态抛错由调用方兜底。 */
export async function checkShellUpdate(): Promise<void> {
  await autoUpdater.checkForUpdates();
}

/** 手动下载（已检测到但未下载时）。 */
export async function downloadShellUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate();
}

/** 立即退出并安装已下载的更新。 */
export function installShellUpdate(): void {
  autoUpdater.quitAndInstall();
}
