import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import { IPC, type ShellApi } from '../shared/ipc';
import type { ServiceState, SettingsUpdate, ShellUpdaterState, StartupProgress } from '../shared/types';

/** 暴露给 Shell UI 的类型化 API（window.harnessShell）。 */
const api: ShellApi = {
  getBootstrap: () => ipcRenderer.invoke(IPC.bootstrap),

  minimize: () => ipcRenderer.send(IPC.window.minimize),
  toggleMaximize: () => ipcRenderer.send(IPC.window.toggleMaximize),
  close: () => ipcRenderer.send(IPC.window.close),
  isMaximized: () => ipcRenderer.invoke(IPC.window.isMaximized),
  onMaximized: (cb) => {
    const listener = (_event: IpcRendererEvent, value: boolean): void => cb(value);
    ipcRenderer.on(IPC.window.onMaximized, listener);
    return () => ipcRenderer.removeListener(IPC.window.onMaximized, listener);
  },

  restartService: () => ipcRenderer.invoke(IPC.service.restart),
  onServiceState: (cb) => {
    const listener = (_event: IpcRendererEvent, value: ServiceState): void => cb(value);
    ipcRenderer.on(IPC.service.onState, listener);
    return () => ipcRenderer.removeListener(IPC.service.onState, listener);
  },
  onServiceProgress: (cb) => {
    const listener = (_event: IpcRendererEvent, value: StartupProgress): void => cb(value);
    ipcRenderer.on(IPC.service.onProgress, listener);
    return () => ipcRenderer.removeListener(IPC.service.onProgress, listener);
  },

  listCommands: () => ipcRenderer.invoke(IPC.commands.list),
  runCommand: (id: string) => ipcRenderer.invoke(IPC.commands.run, id),

  getSettings: () => ipcRenderer.invoke(IPC.settings.get),
  setSettings: (update: SettingsUpdate) => ipcRenderer.invoke(IPC.settings.set, update),
  onSettingsChanged: (cb) => {
    const listener = (_event: IpcRendererEvent, config: import('../shared/types').AppConfig): void => cb(config);
    ipcRenderer.on(IPC.settings.onChanged, listener);
    return () => ipcRenderer.removeListener(IPC.settings.onChanged, listener);
  },

  openExternal: (url: string) => ipcRenderer.send(IPC.shell.openExternal, url),
  openDevTools: () => ipcRenderer.send(IPC.shell.openDevTools),
  openLogs: () => ipcRenderer.send(IPC.shell.openLogs),

  fs: {
    dshHome: () => ipcRenderer.invoke(IPC.fs.dshHome),
    homeDir: () => ipcRenderer.invoke(IPC.fs.homeDir),
    readDir: (dirPath: string) => ipcRenderer.invoke(IPC.fs.readDir, dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke(IPC.fs.readFile, filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke(IPC.fs.writeFile, filePath, content),
    readImage: (filePath: string) => ipcRenderer.invoke(IPC.fs.readImage, filePath),
    pickDirectory: () => ipcRenderer.invoke(IPC.fs.pickDirectory),
    pickFile: () => ipcRenderer.invoke(IPC.fs.pickFile),
    pickVideoFile: () => ipcRenderer.invoke(IPC.fs.pickVideoFile),
    copyFilesInto: (dir: string, paths: string[]) => ipcRenderer.invoke(IPC.fs.copyFilesInto, dir, paths),
    getPathForFile: (file: unknown) => webUtils.getPathForFile(file as File),
    reveal: (target: string) => ipcRenderer.send(IPC.fs.reveal, target),
  },

  terminal: {
    run: (command: string, cwd?: string) => ipcRenderer.invoke(IPC.terminal.run, command, cwd),
    open: (cwd?: string) => ipcRenderer.send(IPC.terminal.open, cwd),
  },

  clipboard: {
    read: () => ipcRenderer.invoke(IPC.clipboard.read),
    write: (text: string) => ipcRenderer.send(IPC.clipboard.write, text),
    readImage: () => ipcRenderer.invoke(IPC.clipboard.readImage),
    writeImage: (dataUrl: string) => ipcRenderer.send(IPC.clipboard.writeImage, dataUrl),
  },

  profiles: {
    list: () => ipcRenderer.invoke(IPC.profiles.list),
  },

  sessions: {
    list: () => ipcRenderer.invoke(IPC.sessions.list),
    tasks: () => ipcRenderer.invoke(IPC.sessions.tasks),
    reveal: (p: string) => ipcRenderer.send(IPC.sessions.reveal, p),
    remove: (p: string) => ipcRenderer.invoke(IPC.sessions.remove, p),
  },

  mcp: {
    scan: () => ipcRenderer.invoke(IPC.mcp.scan),
  },

  wallpaper: {
    scan: () => ipcRenderer.invoke(IPC.wallpaper.scan),
    has: () => ipcRenderer.invoke(IPC.wallpaper.has),
  },

  model: {
    presets: () => ipcRenderer.invoke(IPC.model.presets),
    state: () => ipcRenderer.invoke(IPC.model.state),
    save: (provider) => ipcRenderer.invoke(IPC.model.save, provider),
  },

  plugins: {
    list: () => ipcRenderer.invoke(IPC.plugins.list),
    setEnabled: (enabledIds: string[]) => ipcRenderer.invoke(IPC.plugins.setEnabled, enabledIds),
  },

  remote: {
    status: () => ipcRenderer.invoke(IPC.remote.status),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke(IPC.remote.setEnabled, enabled),
    regenerateToken: () => ipcRenderer.invoke(IPC.remote.regenerateToken),
    qr: () => ipcRenderer.invoke(IPC.remote.qr),
  },

  update: {
    checkDsh: () => ipcRenderer.invoke(IPC.update.checkDsh),
    upgradeDsh: () => ipcRenderer.invoke(IPC.update.upgradeDsh),
    checkShell: () => ipcRenderer.invoke(IPC.update.checkShell),
    shellState: () => ipcRenderer.invoke(IPC.update.shellState),
    shellCheck: () => ipcRenderer.invoke(IPC.update.shellCheck),
    shellDownload: () => ipcRenderer.invoke(IPC.update.shellDownload),
    shellInstall: () => ipcRenderer.send(IPC.update.shellInstall),
    onShellState: (cb) => {
      const listener = (_event: IpcRendererEvent, value: ShellUpdaterState): void => cb(value);
      ipcRenderer.on(IPC.update.onShellState, listener);
      return () => ipcRenderer.removeListener(IPC.update.onShellState, listener);
    },
  },
};

contextBridge.exposeInMainWorld('harnessShell', api);
