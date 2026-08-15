import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type ShellApi } from '../shared/ipc';
import type { ServiceState, SettingsUpdate } from '../shared/types';

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

  listCommands: () => ipcRenderer.invoke(IPC.commands.list),
  runCommand: (id: string) => ipcRenderer.invoke(IPC.commands.run, id),

  getSettings: () => ipcRenderer.invoke(IPC.settings.get),
  setSettings: (update: SettingsUpdate) => ipcRenderer.invoke(IPC.settings.set, update),

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
    reveal: (target: string) => ipcRenderer.send(IPC.fs.reveal, target),
  },

  terminal: {
    run: (command: string, cwd?: string) => ipcRenderer.invoke(IPC.terminal.run, command, cwd),
    open: (cwd?: string) => ipcRenderer.send(IPC.terminal.open, cwd),
  },

  clipboard: {
    read: () => ipcRenderer.invoke(IPC.clipboard.read),
    write: (text: string) => ipcRenderer.send(IPC.clipboard.write, text),
  },

  profiles: {
    list: () => ipcRenderer.invoke(IPC.profiles.list),
  },

  sessions: {
    list: () => ipcRenderer.invoke(IPC.sessions.list),
    reveal: (p: string) => ipcRenderer.send(IPC.sessions.reveal, p),
    remove: (p: string) => ipcRenderer.invoke(IPC.sessions.remove, p),
  },

  mcp: {
    scan: () => ipcRenderer.invoke(IPC.mcp.scan),
  },

  update: {
    checkDsh: () => ipcRenderer.invoke(IPC.update.checkDsh),
    upgradeDsh: () => ipcRenderer.invoke(IPC.update.upgradeDsh),
    checkShell: () => ipcRenderer.invoke(IPC.update.checkShell),
  },
};

contextBridge.exposeInMainWorld('harnessShell', api);
