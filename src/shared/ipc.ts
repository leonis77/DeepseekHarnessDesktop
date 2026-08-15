import type {
  AppConfig,
  BootstrapState,
  CommandDescriptor,
  DshVersionInfo,
  FileEntry,
  McpScanResult,
  ProfileInfo,
  ServiceState,
  SessionInfo,
  SettingsUpdate,
  TerminalResult,
  UpdateStatus,
} from './types';

/** IPC 通道名（主进程与 preload 共用，避免拼写漂移）。 */
export const IPC = {
  bootstrap: 'shell:bootstrap',
  window: {
    minimize: 'shell:window:minimize',
    toggleMaximize: 'shell:window:toggleMaximize',
    close: 'shell:window:close',
    isMaximized: 'shell:window:isMaximized',
    onMaximized: 'shell:window:maximized-changed',
  },
  service: {
    restart: 'service:restart',
    onState: 'service:state',
  },
  commands: {
    list: 'ext:list-commands',
    run: 'ext:run-command',
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set',
  },
  shell: {
    openExternal: 'shell:open-external',
    openDevTools: 'shell:open-devtools',
    openLogs: 'shell:open-logs',
  },
  fs: {
    dshHome: 'fs:dsh-home',
    homeDir: 'fs:home-dir',
    readDir: 'fs:read-dir',
    readFile: 'fs:read-file',
    writeFile: 'fs:write-file',
    readImage: 'fs:read-image',
    pickDirectory: 'fs:pick-directory',
    pickFile: 'fs:pick-file',
    reveal: 'fs:reveal',
  },
  terminal: {
    run: 'terminal:run',
    open: 'terminal:open',
  },
  clipboard: {
    read: 'clipboard:read',
    write: 'clipboard:write',
  },
  profiles: {
    list: 'profiles:list',
  },
  sessions: {
    list: 'sessions:list',
    reveal: 'sessions:reveal',
    remove: 'sessions:remove',
  },
  mcp: {
    scan: 'mcp:scan',
  },
  update: {
    checkDsh: 'update:check-dsh',
    upgradeDsh: 'update:upgrade-dsh',
    checkShell: 'update:check-shell',
  },
} as const;

/** preload 通过 contextBridge 暴露给 Shell UI 的 API（window.harnessShell）。 */
export interface ShellApi {
  getBootstrap(): Promise<BootstrapState>;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximized(cb: (maximized: boolean) => void): () => void;

  restartService(): Promise<ServiceState>;
  onServiceState(cb: (state: ServiceState) => void): () => void;

  listCommands(): Promise<CommandDescriptor[]>;
  runCommand(id: string): Promise<void>;

  getSettings(): Promise<AppConfig>;
  setSettings(update: SettingsUpdate): Promise<AppConfig>;

  openExternal(url: string): void;
  openDevTools(): void;
  openLogs(): void;

  fs: {
    dshHome(): Promise<string>;
    homeDir(): Promise<string>;
    readDir(path: string): Promise<FileEntry[]>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    readImage(path: string): Promise<string>;
    pickDirectory(): Promise<string | null>;
    pickFile(): Promise<string | null>;
    reveal(path: string): void;
  };

  terminal: {
    run(command: string, cwd?: string): Promise<TerminalResult>;
    open(cwd?: string): void;
  };

  clipboard: {
    read(): Promise<string>;
    write(text: string): void;
  };

  profiles: {
    list(): Promise<ProfileInfo[]>;
  };

  sessions: {
    list(): Promise<SessionInfo[]>;
    reveal(path: string): void;
    remove(path: string): Promise<void>;
  };

  mcp: {
    scan(): Promise<McpScanResult>;
  };

  update: {
    checkDsh(): Promise<DshVersionInfo>;
    upgradeDsh(): Promise<TerminalResult>;
    checkShell(): Promise<UpdateStatus>;
  };
}
