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
  customColors: [string, string, string]; // 自定义渐变（gradientId='custom' 时生效）
  imagePath?: string;
  opacity: number; // 0..1
  blur: number; // 0..40（图片背景）
  animated: boolean; // 渐变极光动画
  glassBlur: number; // 0..40 磨砂玻璃模糊
  noise: boolean; // 噪点颗粒
}

export interface Keybindings {
  commandPalette: string;
  togglePanel: string;
}

export interface PetConfig {
  enabled: boolean;
  skin: string;
  customEmoji: string;
  name: string;
  size: number;
  animation: 'bob' | 'float' | 'bounce' | 'none';
  tips: string[];
}

export const DEFAULT_PET: PetConfig = {
  enabled: false,
  skin: 'cat',
  customEmoji: '',
  name: '小助手',
  size: 1,
  animation: 'bob',
  tips: ['DSH 运行中~', '摸我一下🐾', '记得喝口水💧', '今天也要加油✨', '我会一直陪着你'],
};

export const PET_SKINS = [
  { id: 'cat', emoji: '🐱', name: '猫咪' },
  { id: 'dog', emoji: '🐶', name: '小狗' },
  { id: 'fox', emoji: '🦊', name: '狐狸' },
  { id: 'panda', emoji: '🐼', name: '熊猫' },
  { id: 'frog', emoji: '🐸', name: '青蛙' },
  { id: 'rabbit', emoji: '🐰', name: '兔子' },
  { id: 'tiger', emoji: '🐯', name: '老虎' },
  { id: 'owl', emoji: '🦉', name: '猫头鹰' },
] as const;

export interface AppConfig {
  autoLaunch: boolean;
  closeToTray: boolean;
  window: { width: number; height: number };
  theme: ThemeMode;
  accent: string;
  profile: string;
  keybindings: Keybindings;
  background: BackgroundConfig;
  pet: PetConfig;
  updateFeedUrl?: string;
  githubRepo?: string;
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
