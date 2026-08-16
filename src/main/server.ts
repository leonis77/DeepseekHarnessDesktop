/**
 * dsh 服务管理：探测现有实例（attach）/ 拉起新实例（spawn）/ 进程树清理。
 * 纯 Node 模块，不依赖 Electron，可独立冒烟测试。
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { StartupProgress } from '../shared/types';

const LOOPBACK = '127.0.0.1';
const DEFAULT_ATTACH_PORT = 3080;
const URL_LINE = /dsh web: (https?:\/\/\S+)/;

export type ServerMode = 'attach' | 'spawn';
export type ServerStatus = 'idle' | 'starting' | 'running' | 'attached' | 'stopped' | 'error';

export interface DshServerOptions {
  port?: number;
  attachPort?: number;
  profile?: string;
  timeoutMs?: number;
  log?: (msg: string) => void;
  env?: NodeJS.ProcessEnv;
  onExit?: (code: number | null, signal: string | null) => void;
  onState?: (status: ServerStatus, mode: ServerMode | null) => void;
  onProgress?: (progress: StartupProgress) => void;
  nodeBin?: string;
  dshBin?: string;
  useElectronNode?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function httpGet(url: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, redirect: 'manual' });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 探测某地址是否为 dsh web（页面特征识别，避免误连其他服务）。 */
export async function probeIsDsh(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await httpGet(url, 2000);
    if (response) {
      try {
        const text = await response.text();
        if (text.includes('__DSH_BOOT__') || text.includes('dsh')) return true;
      } catch {
        /* 响应不完整，重试 */
      }
    }
    await sleep(500);
  }
  return false;
}

export async function waitForHttp(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await httpGet(url, 1200)) return true;
    await sleep(400);
  }
  return false;
}

/** Windows 下用 taskkill /T 杀整个进程树，避免残留孤儿 node 进程。 */
export function killProcessTree(pid: number): boolean {
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return result.status === 0;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
  return true;
}

function electronResourcesPath(): string | undefined {
  return (process as unknown as { resourcesPath?: string }).resourcesPath;
}

/** 自包含打包后 dsh 所在的真实目录（resources/dsh）；开发/纯 Node 环境为 null。 */
function extractedDshBase(): string {
  return process.env.DSH_DESKTOP_DSH_DIR || path.join(process.env.APPDATA || '', 'Harness UI', 'dsh');
}

function extractedDshDir(): string | null {
  const base = extractedDshBase();
  return fs.existsSync(path.join(base, 'lib', 'bin.js')) ? base : null;
}

function dshArchivePath(): string | null {
  const resourcesPath = electronResourcesPath();
  if (!resourcesPath) return null;
  const archive = path.join(resourcesPath, 'dsh.tar.gz');
  return fs.existsSync(archive) ? archive : null;
}

/** 首次启动把 resources/dsh.tar.gz 解压到用户目录（之后复用，无需重复解压）。返回耗时 ms。 */
export async function ensureDshExtractedAsync(onStatus?: (status: 'preparing') => void): Promise<number> {
  if (extractedDshDir()) return 0;
  const archive = dshArchivePath();
  if (!archive) return 0;
  const base = extractedDshBase();
  fs.mkdirSync(path.dirname(base), { recursive: true });
  onStatus?.('preparing');
  const t0 = Date.now();
  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', ['-xzf', archive, '-C', path.dirname(base)], { windowsHide: true });
    child.on('error', (e) => reject(e));
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`tar 解压失败（code=${code}）`))));
  });
  return Date.now() - t0;
}

export function bundledDshDir(): string | null {
  const extracted = extractedDshDir();
  if (extracted) return extracted;
  const resourcesPath = electronResourcesPath();
  if (resourcesPath) {
    const dir = path.join(resourcesPath, 'dsh');
    if (fs.existsSync(path.join(dir, 'lib', 'bin.js'))) return dir;
  }
  return null;
}

export function resolveNodeBin(): string {
  if (process.env.DSH_DESKTOP_NODE && fs.existsSync(process.env.DSH_DESKTOP_NODE)) {
    return process.env.DSH_DESKTOP_NODE;
  }
  // 优先复用本机系统 Node（检测本地环境）
  try {
    const result = spawnSync('where', ['node'], { encoding: 'utf8' });
    if (result.status === 0) {
      const first = String(result.stdout)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && fs.existsSync(line));
      if (first) return first;
    }
  } catch {
    /* fall through */
  }
  // 无系统 Node 时，若有内置 dsh，用 Electron 内置 Node 兜底（零依赖）
  if (bundledDshDir()) return process.execPath;
  return 'node';
}

export function resolveDshBin(): string | null {
  const env = process.env.DSH_DESKTOP_DSH_BIN;
  if (env && fs.existsSync(env)) return env;
  // 优先复用本地全局安装的 dsh（检测本地环境，避免重复内置）
  const candidates = [
    'D:\\node\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js',
    path.join(process.env.LOCALAPPDATA || '', 'node', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  // 兜底：解析 npm 生成的 dsh.cmd 壳，找到真实 bin.js 路径
  try {
    const result = spawnSync('where', ['dsh'], { encoding: 'utf8' });
    if (result.status === 0) {
      for (const line of String(result.stdout).split(/\r?\n/)) {
        const shim = line.trim();
        if (!shim || !fs.existsSync(shim)) continue;
        const content = fs.readFileSync(shim, 'utf8');
        const match = content.match(/node\s+"([^"]+)"|"([^"]*node_modules\\@deepseek-ai\\dsh\\lib\\bin\.js)"/i);
        if (match) {
          const raw = match[1] || match[2];
          if (raw) {
            const resolved = raw.replace(/%~dp0/gi, path.dirname(shim));
            if (fs.existsSync(resolved)) return resolved;
          }
        }
      }
    }
  } catch {
    /* fall through */
  }
  // 无本地 dsh 时，用打包进 resources/dsh 的内置副本兜底（零依赖）
  const bundled = bundledDshDir();
  if (bundled) {
    const bin = path.join(bundled, 'lib', 'bin.js');
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}

export class DshServer {
  port: number;
  attachPort: number;
  profile: string;
  timeoutMs: number;
  log: (msg: string) => void;
  env: NodeJS.ProcessEnv | null;
  onExit?: (code: number | null, signal: string | null) => void;
  onState?: (status: ServerStatus, mode: ServerMode | null) => void;
  onProgress?: (progress: StartupProgress) => void;
  nodeBin: string;
  dshBin: string | null;
  useElectronNode: boolean;
  child: ChildProcess | null = null;
  url: string | null = null;
  mode: ServerMode | null = null;
  status: ServerStatus = 'idle';
  private _stopping = false;
  private _bootStart = 0;
  private _progressTimer: NodeJS.Timeout | null = null;
  private _progressPercent = 0;

  constructor(options: DshServerOptions = {}) {
    this.port = options.port ?? 0;
    this.attachPort = options.attachPort ?? DEFAULT_ATTACH_PORT;
    this.profile = options.profile ?? 'web';
    this.timeoutMs = options.timeoutMs ?? 180000;
    this.log = options.log ?? (() => {});
    this.env = options.env ?? null;
    this.onExit = options.onExit;
    this.onState = options.onState;
    this.onProgress = options.onProgress;
    this.nodeBin = options.nodeBin ?? resolveNodeBin();
    this.dshBin = options.dshBin ?? resolveDshBin();
    this.useElectronNode =
      options.useElectronNode ?? (electronResourcesPath() !== undefined && this.nodeBin === process.execPath);
  }

  private emitProgress(phase: StartupProgress['phase'], percent: number, label: string): void {
    this._progressPercent = percent;
    this.onProgress?.({ phase, percent, label, elapsedMs: Date.now() - this._bootStart });
  }

  private clearProgressTimer(): void {
    if (this._progressTimer) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  }

  private setStatus(status: ServerStatus): void {
    this.status = status;
    this.onState?.(status, this.mode);
  }

  /** 启动：先尝试连接现有实例，否则拉起新进程。返回最终 URL。 */
  async start(): Promise<string> {
    this._bootStart = Date.now();
    this.setStatus('starting');
    if (this.dshBin) {
      const url = `http://${LOOPBACK}:${this.attachPort}/`;
      if (await probeIsDsh(url)) {
        this.mode = 'attach';
        this.url = url;
        this.setStatus('attached');
        this.emitProgress('ready', 100, '已连接现有实例');
        this.log(`已连接现有实例：${url}（不重复启动服务）`);
        return url;
      }
    }
    return this._spawn();
  }

  private _spawn(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.dshBin) {
        this.setStatus('error');
        return reject(
          new Error(
            '未找到 dsh 程序（lib/bin.js）。请用 `npm i -g @deepseek-ai/dsh` 全局安装，' +
              '或设置环境变量 DSH_DESKTOP_DSH_BIN 指向 bin.js 的完整路径。'
          )
        );
      }
      // Electron 内置 Node 需要 --expose-internals 才能让 HMR 服务访问内部模块
      const nodeArgs = this.useElectronNode ? ['--expose-internals'] : [];
      const args = [...nodeArgs, this.dshBin, '--profile', this.profile, '--port', String(this.port)];
      this.log(`启动命令：${this.nodeBin} ${args.join(' ')}`);
      const env: NodeJS.ProcessEnv = { ...(this.env ?? process.env), NO_COLOR: '1', FORCE_COLOR: '0' };
      if (this.useElectronNode) env.ELECTRON_RUN_AS_NODE = '1';
      const child = spawn(this.nodeBin, args, {
        cwd: path.dirname(this.dshBin),
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      this.child = child;

      let outputTail = '';
      let resolved = false;
      let linesSeen = 0;

      // 冷启动进度：起步 + 逐行/计时缓慢推进到 88%，就绪后跳到 100%。
      this.emitProgress('spawning', 12, '正在启动服务进程…');
      this._progressTimer = setInterval(() => {
        if (resolved) return;
        this._progressPercent = Math.min(88, this._progressPercent + 1);
        this.emitProgress('loading', this._progressPercent, `加载插件与模型…（已用时 ${Math.round((Date.now() - this._bootStart) / 1000)}s）`);
      }, 800);

      const onData = (chunk: Buffer, isError: boolean): void => {
        const text = chunk.toString();
        outputTail = (outputTail + text).slice(-8000);
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          this.log(`[dsh${isError ? ' stderr' : ''}] ${trimmed}`);
          linesSeen += 1;
          if (!isError && !resolved) {
            const match = trimmed.match(URL_LINE);
            if (match) {
              this.url = match[1];
              this._progressPercent = Math.max(this._progressPercent, 88);
              this.emitProgress('loading', this._progressPercent, '服务已监听，等待前端就绪…');
            }
          }
          // 有输出说明在推进：按行数小幅抬升进度（不覆盖上面就绪态）
          if (!resolved && this._progressPercent < 88) {
            this._progressPercent = Math.min(88, 12 + linesSeen * 2);
            this.emitProgress('loading', this._progressPercent, `加载插件与模型…（已用时 ${Math.round((Date.now() - this._bootStart) / 1000)}s）`);
          }
        }
      };

      child.stdout?.on('data', (chunk) => onData(chunk as Buffer, false));
      child.stderr?.on('data', (chunk) => onData(chunk as Buffer, true));
      child.on('error', (error) => {
        this.child = null;
        this.clearProgressTimer();
        if (!this._stopping && !resolved) {
          resolved = true;
          this.setStatus('error');
          this.emitProgress('error', this._progressPercent, '启动失败');
          reject(new Error(`无法启动 dsh 进程：${error.message}`));
        }
      });
      child.on('exit', (code, signal) => {
        this.child = null;
        this.clearProgressTimer();
        if (!this._stopping) {
          this.log(`dsh 进程退出（code=${code} signal=${signal}）`);
          this.setStatus('stopped');
          this.onExit?.(code, signal);
        }
      });

      const deadline = Date.now() + this.timeoutMs;
      const finish = (): void => {
        if (resolved) return;
        resolved = true;
        this.clearProgressTimer();
        const tail = outputTail.slice(-4000) || '(无输出)';
        this.setStatus('error');
        this.emitProgress('error', this._progressPercent, '启动超时');
        void this.stop();
        reject(new Error(`dsh 服务在 ${Math.round(this.timeoutMs / 1000)} 秒内未就绪。\n尾部输出：\n${tail}`));
      };
      const poll = async (): Promise<void> => {
        if (resolved) return;
        if (Date.now() > deadline) return finish();
        if (this.url) {
          if (await waitForHttp(this.url, 3000)) {
            resolved = true;
            this.clearProgressTimer();
            this.mode = 'spawn';
            this.setStatus('running');
            this.emitProgress('ready', 100, '服务就绪');
            this.log(`服务就绪：${this.url}`);
            resolve(this.url);
            return;
          }
        }
        setTimeout(poll, 300);
      };
      poll();
    });
  }

  /** 停止自建进程（attach 模式下无操作，不影响外部实例）。 */
  async stop(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this._stopping = true;
    this.child = null;
    this.log(`停止 dsh 进程（pid=${child.pid}）`);
    killProcessTree(child.pid ?? 0);
    this.setStatus('stopped');
  }

  get running(): boolean {
    return this.child !== null;
  }

  get pid(): number | null {
    return this.child?.pid ?? null;
  }
}
