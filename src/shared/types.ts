/** 主进程与 Shell UI 共享的类型契约。 */

export type ServerMode = 'attach' | 'spawn';
export type ServerStatus = 'idle' | 'preparing' | 'starting' | 'running' | 'attached' | 'stopped' | 'error';

export interface ServiceState {
  status: ServerStatus;
  mode: ServerMode | null;
  url: string | null;
  pid: number | null;
}

export type ThemeMode = 'dark' | 'light' | 'system';

export type BackgroundType = 'gradient' | 'color' | 'image' | 'video';

export interface BackgroundConfig {
  type: BackgroundType;
  gradientId: string;
  color: string;
  customColors: [string, string, string]; // 自定义渐变（gradientId='custom' 时生效）
  imagePath?: string;
  videoPath?: string; // 动态壁纸：本地视频 / WE 视频壁纸路径
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
  spritePath?: string; // 自定义 spritesheet（petdex 格式：8 列 × 9 行状态帧，优先于 emoji）
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
  { id: 'koala', emoji: '🐨', name: '考拉' },
  { id: 'pig', emoji: '🐷', name: '小猪' },
  { id: 'penguin', emoji: '🐧', name: '企鹅' },
  { id: 'unicorn', emoji: '🦄', name: '独角兽' },
  { id: 'octopus', emoji: '🐙', name: '章鱼' },
  { id: 'whale', emoji: '🐳', name: '鲸鱼' },
  { id: 'dino', emoji: '🦖', name: '恐龙' },
  { id: 'turtle', emoji: '🐢', name: '乌龟' },
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
  idleStopMinutes?: number;
  dshBin?: string;
  nodeBin?: string;
  disabledPlugins?: string[];
  remoteEnabled?: boolean;
  remoteToken?: string;
  modelProviders?: ModelProviderConfig[];
  customCss?: string; // 主题增强：自定义 CSS
}

/** ── 模型/API 桌面配置 ── */
export interface ModelProviderConfig {
  id: string;
  name: string;
  baseURL: string;
  apiKeyRef: string; // 凭据引用名（写入 .credentials.yaml），如 ZAI_API_KEY
  apiKey: string; // 仅保存时提交，读取时主进程不回显明文
  models: string[]; // model id 列表
  input: ('text' | 'image')[];
}

export interface ModelApiPreset {
  id: string;
  name: string;
  baseURL: string;
  apiKeyRef: string;
  models: string[];
  input: ('text' | 'image')[];
  hint: string;
}

export interface ModelApiState {
  providers: Array<{ id: string; name: string; baseURL: string; apiKeyRef: string; models: string[]; input: string[]; configured: boolean }>;
}

/** ── 动态壁纸（Wallpaper Engine）── */
export interface WallpaperEntry {
  id: string;
  title: string;
  type: 'video' | 'web' | 'scene' | 'unknown';
  filePath: string | null;
  previewPath: string | null;
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
  turns: number;
}

/** ── 面板：任务（来自会话投影缓存）── */
export interface TaskInfo {
  sessionId: string;
  sessionTitle: string;
  workspace: string;
  goal: string | null;
  todos: string | null;
  planActive: boolean;
  updatedAt: number;
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

/** ── 冷启动进度 ── */
export interface StartupProgress {
  phase: 'idle' | 'preparing' | 'spawning' | 'loading' | 'ready' | 'error';
  percent: number; // 0..100
  label: string;
  elapsedMs: number;
}

/** ── 插件开关 ── */
export interface PluginState {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

/** ── 手机远程网关 ── */
export interface RemoteStatus {
  enabled: boolean;
  running: boolean;
  url: string | null; // LAN 访问地址
  token: string;
  pairingCode: string; // 短期一次性配对码（扫码用）
  error: string | null;
}

/** ── 壳自更新状态 ── */
export interface ShellUpdaterState {
  supported: boolean;
  state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version: string | null;
  percent: number;
  error: string | null;
}
