import type {
  AppConfig,
  BootstrapState,
  CommandDescriptor,
  DshVersionInfo,
  FileEntry,
  McpScanResult,
  ModelApiPreset,
  ModelApiState,
  ModelProviderConfig,
  PluginState,
  ProfileInfo,
  RemoteStatus,
  ServiceState,
  SessionInfo,
  SettingsUpdate,
  ShellUpdaterState,
  StartupProgress,
  TaskInfo,
  TerminalResult,
  UpdateStatus,
  WallpaperEntry,
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
    onProgress: 'service:progress',
  },
  commands: {
    list: 'ext:list-commands',
    run: 'ext:run-command',
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set',
    onChanged: 'settings:changed',
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
    pickVideoFile: 'fs:pick-video-file',
    copyFilesInto: 'fs:copy-files-into',
    reveal: 'fs:reveal',
  },
  terminal: {
    run: 'terminal:run',
    open: 'terminal:open',
  },
  clipboard: {
    read: 'clipboard:read',
    write: 'clipboard:write',
    readImage: 'clipboard:read-image',
    writeImage: 'clipboard:write-image',
  },
  profiles: {
    list: 'profiles:list',
  },
  sessions: {
    list: 'sessions:list',
    tasks: 'sessions:tasks',
    reveal: 'sessions:reveal',
    remove: 'sessions:remove',
    removeMany: 'sessions:remove-many',
  },
  mcp: {
    scan: 'mcp:scan',
  },
  wallpaper: {
    scan: 'wallpaper:scan',
    has: 'wallpaper:has',
  },
  model: {
    presets: 'model:presets',
    state: 'model:state',
    save: 'model:save',
  },
  plugins: {
    list: 'plugins:list',
    setEnabled: 'plugins:set-enabled',
  },
  remote: {
    status: 'remote:status',
    setEnabled: 'remote:set-enabled',
    regenerateToken: 'remote:regenerate-token',
    regenerateCode: 'remote:regenerate-code',
    qr: 'remote:qr',
  },
  update: {
    checkDsh: 'update:check-dsh',
    upgradeDsh: 'update:upgrade-dsh',
    checkShell: 'update:check-shell',
    shellState: 'update:shell-state',
    shellCheck: 'update:shell-check',
    shellDownload: 'update:shell-download',
    shellInstall: 'update:shell-install',
    onShellState: 'update:shell-state-changed',
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
  onServiceProgress(cb: (progress: StartupProgress) => void): () => void;

  listCommands(): Promise<CommandDescriptor[]>;
  runCommand(id: string): Promise<void>;

  getSettings(): Promise<AppConfig>;
  setSettings(update: SettingsUpdate): Promise<AppConfig>;
  onSettingsChanged(cb: (config: AppConfig) => void): () => void;

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
    pickVideoFile(): Promise<string | null>;
    copyFilesInto(dir: string, paths: string[]): Promise<string[]>;
    getPathForFile(file: unknown): string;
    reveal(path: string): void;
  };

  terminal: {
    run(command: string, cwd?: string): Promise<TerminalResult>;
    open(cwd?: string): void;
  };

  clipboard: {
    read(): Promise<string>;
    write(text: string): void;
    readImage(): Promise<string | null>;
    writeImage(dataUrl: string): void;
  };

  profiles: {
    list(): Promise<ProfileInfo[]>;
  };

  sessions: {
    list(): Promise<SessionInfo[]>;
    tasks(): Promise<TaskInfo[]>;
    reveal(path: string): void;
    remove(path: string): Promise<void>;
    removeMany(paths: string[]): Promise<void>;
  };

  mcp: {
    scan(): Promise<McpScanResult>;
  };

  wallpaper: {
    scan(): Promise<WallpaperEntry[]>;
    has(): Promise<boolean>;
  };

  model: {
    presets(): Promise<ModelApiPreset[]>;
    state(): Promise<ModelApiState>;
    save(provider: ModelProviderConfig): Promise<void>;
  };

  plugins: {
    list(): Promise<PluginState[]>;
    setEnabled(enabledIds: string[]): Promise<AppConfig>;
  };

  remote: {
    status(): Promise<RemoteStatus>;
    setEnabled(enabled: boolean): Promise<RemoteStatus>;
    regenerateToken(): Promise<RemoteStatus>;
    regenerateCode(): Promise<RemoteStatus>;
    qr(): Promise<string | null>;
  };

  update: {
    checkDsh(): Promise<DshVersionInfo>;
    upgradeDsh(): Promise<TerminalResult>;
    checkShell(): Promise<UpdateStatus>;
    shellState(): Promise<ShellUpdaterState>;
    shellCheck(): Promise<void>;
    shellDownload(): Promise<void>;
    shellInstall(): void;
    onShellState(cb: (state: ShellUpdaterState) => void): () => void;
  };
}
