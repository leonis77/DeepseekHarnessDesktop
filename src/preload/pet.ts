import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { PetConfig, ServiceState } from '../shared/types';

/** 宠物窗口专用桥：读配置 / 订阅配置更新 / 订阅服务状态 / 拖动 / 关闭。 */
contextBridge.exposeInMainWorld('petApi', {
  getConfig: (): Promise<PetConfig> => ipcRenderer.invoke('pet:getConfig'),
  onConfig: (cb: (config: PetConfig) => void) => {
    const listener = (_e: IpcRendererEvent, config: PetConfig): void => cb(config);
    ipcRenderer.on('pet:config', listener);
    return () => ipcRenderer.removeListener('pet:config', listener);
  },
  onServiceState: (cb: (state: ServiceState) => void) => {
    const listener = (_e: IpcRendererEvent, state: ServiceState): void => cb(state);
    ipcRenderer.on('pet:service-state', listener);
    return () => ipcRenderer.removeListener('pet:service-state', listener);
  },
  onActivity: (cb: (activity: 'idle' | 'active' | 'working') => void) => {
    const listener = (_e: IpcRendererEvent, activity: 'idle' | 'active' | 'working'): void => cb(activity);
    ipcRenderer.on('pet:activity', listener);
    return () => ipcRenderer.removeListener('pet:activity', listener);
  },
  moveBy: (dx: number, dy: number): void => ipcRenderer.send('pet:move', dx, dy),
  close: (): void => ipcRenderer.send('pet:close'),
});
