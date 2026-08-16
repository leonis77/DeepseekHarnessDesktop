import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import type { PetConfig, ServiceState } from '../shared/types';

let petWindow: BrowserWindow | null = null;

function petHtml(): string {
  return join(__dirname, '../../resources/pet/pet.html');
}

function petPreload(): string {
  return join(__dirname, '../preload/pet.js');
}

/** 显示/创建宠物窗口（配置由 pet.js 通过 IPC 拉取）。 */
export function showPet(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.showInactive();
    return;
  }
  const size = 240;
  const { workArea } = screen.getPrimaryDisplay();
  petWindow = new BrowserWindow({
    width: size,
    height: size,
    x: workArea.x + workArea.width - size - 24,
    y: workArea.y + workArea.height - size - 24,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: petPreload(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.once('ready-to-show', () => petWindow?.showInactive());
  void petWindow.loadFile(petHtml());
  petWindow.on('closed', () => {
    petWindow = null;
  });
}

export function hidePet(): void {
  petWindow?.close();
}

/** 按配置应用宠物状态。 */
export function applyPet(config: PetConfig): void {
  if (config.enabled) {
    showPet();
    sendPetConfig(config);
  } else {
    hidePet();
  }
}

/** 把最新配置推给宠物窗口（实时换肤/改名字等，无需重载）。 */
export function sendPetConfig(config: PetConfig): void {
  petWindow?.webContents.send('pet:config', config);
}

/** 把 Harness 服务状态推给宠物窗口（启动中/运行/停止/出错 → 宠物联动）。 */
export function sendPetServiceState(state: ServiceState): void {
  petWindow?.webContents.send('pet:service-state', state);
}

/** 拖拽：按屏幕位移增量移动窗口。 */
export function movePet(dx: number, dy: number): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  const [x, y] = petWindow.getPosition();
  petWindow.setPosition(x + Math.round(dx), y + Math.round(dy));
}
