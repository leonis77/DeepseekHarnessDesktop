/** 主进程与 Shell UI 共享的类型契约。 */

export type ServerMode = 'attach' | 'spawn';
export type ServerStatus = 'idle' | 'starting' | 'running' | 'attached' | 'stopped' | 'error';

export interface ServiceState {
  status: ServerStatus;
  mode: ServerMode | null;
  url: string | null;
  pid: number | null;
}

export type ThemeMode = 'dark' | 'light' | 'system';

export type BackgroundType = 'gradient' | 'color' | 'image';

export interface BackgroundConfig {
  type: BackgroundType;
  gradientId: string;
  color: string;
  imagePath?: string;
  opacity: number; // 0..1
  blur: number; // 0..40（图片背景）
  animated: boolean; // 渐变极光动画
  glassBlur: number; // 0..40 磨砂玻璃模糊
  framed: boolean; // 对话区留白（浮动卡片，露出背景）
}

export interface Keybindings {
  commandPalette: string;
  togglePanel: string;
}

export interface AppConfig {
  autoLaunch: boolean;
  closeToTray: boolean;
  window: { width: number; height: number };
  theme: ThemeMode;
  accent: string;
  profile: string;
  keybindings: Keybindings;
  background: BackgroundConfig;
  updateFeedUrl?: string;
  dshBin?: string;
  nodeBin?: string;
}

export type SettingsUpdate = Partial<AppConfig>;

export interface CommandDescriptor {
  id: string;
  title: string;
  category?: string;
}

export interface BootstrapState {
  appVersion: string;
  service: ServiceState;
  config: AppConfig;
  commands: CommandDescriptor[];
}

/** ── 原生集成：文件 ── */
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtimeMs: number;
}

/** ── 原生集成：终端 ── */
export interface TerminalResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/** ── 面板：会话 ── */
export interface SessionInfo {
  id: string;
  title: string;
  workspace: string;
  updatedAt: number;
  path: string;
}

/** ── 面板：profile ── */
export interface ProfileInfo {
  name: string;
  isDefault: boolean;
}

/** ── 更新 ── */
export interface DshVersionInfo {
  current: string;
  latest: string | null;
  outdated: boolean;
}

export interface UpdateStatus {
  available: boolean;
  version: string | null;
  url: string | null;
  error: string | null;
}

/** ── MCP 扫描结果 ── */
export interface McpScanResult {
  servers: string[];
  raw: string;
}
