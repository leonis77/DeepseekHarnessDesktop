import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_PET } from '../shared/types';
import type { AppConfig } from '../shared/types';

const DEFAULTS: AppConfig = {
  autoLaunch: false,
  closeToTray: true,
  window: { width: 1360, height: 860 },
  theme: 'dark',
  accent: '#3b82f6',
  profile: 'web',
  keybindings: { commandPalette: 'Ctrl+K', togglePanel: 'Ctrl+B' },
  githubRepo: 'leonis77/DeepseekHarnessDesktop',
  idleStopMinutes: 0,
  background: { type: 'gradient', gradientId: 'aurora', color: '#0b0f17', customColors: ['#3b82f6', '#8b5cf6', '#14b8a6'], opacity: 1, blur: 0, animated: true, glassBlur: 20, noise: true },
  pet: { ...DEFAULT_PET },
};

/** 用户配置存储：userData/config.json，内存缓存 + 落盘。 */
export class AppConfigStore {
  private file: string;
  private data: AppConfig;

  constructor() {
    this.file = path.join(app.getPath('userData'), 'config.json');
    this.data = this.load();
  }

  private load(): AppConfig {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppConfig>) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  get(): AppConfig {
    return this.data;
  }

  update(patch: Partial<AppConfig>): AppConfig {
    this.data = { ...this.data, ...patch };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
    return this.data;
  }

  setAutoLaunch(enabled: boolean): void {
    this.update({ autoLaunch: enabled });
    app.setLoginItemSettings({ openAtLogin: enabled });
  }
}
