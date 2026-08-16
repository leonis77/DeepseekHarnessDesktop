import { useEffect, useState } from 'react';
import type {
  AppConfig,
  BackgroundConfig,
  DshVersionInfo,
  ModelApiPreset,
  ModelApiState,
  ModelProviderConfig,
  PluginState,
  ProfileInfo,
  RemoteStatus,
  ServiceState,
  ShellUpdaterState,
  TerminalResult,
  UpdateStatus,
  WallpaperEntry,
} from '../../../shared/types';
import { gradientPresets, presetPreviewCss } from '../utils/backgrounds';
import { PET_SKINS } from '../../../shared/types';

interface Props {
  service: ServiceState;
  config: AppConfig;
  appVersion: string;
  onRestart(): void;
  onUpdateSettings(patch: Partial<AppConfig>): Promise<AppConfig>;
}

export default function SettingsPanel({ service, config, appVersion, onRestart, onUpdateSettings }: Props) {
  const [autoLaunch, setAutoLaunch] = useState(config.autoLaunch);
  const [closeToTray, setCloseToTray] = useState(config.closeToTray);
  const [idleStopMinutes, setIdleStopMinutes] = useState(config.idleStopMinutes ?? 0);
  const [theme, setTheme] = useState(config.theme);
  const [accent, setAccent] = useState(config.accent);
  const [profile, setProfile] = useState(config.profile);
  const [keybindings, setKeybindings] = useState(config.keybindings);
  const [background, setBackground] = useState(config.background);
  const [pet, setPet] = useState(config.pet);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [saved, setSaved] = useState(false);

  const [dshInfo, setDshInfo] = useState<DshVersionInfo | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<TerminalResult | null>(null);
  const [shellStatus, setShellStatus] = useState<UpdateStatus | null>(null);
  const [checkingShell, setCheckingShell] = useState(false);

  const [plugins, setPlugins] = useState<PluginState[]>([]);
  const [remote, setRemote] = useState<RemoteStatus | null>(null);
  const [remoteQr, setRemoteQr] = useState<string | null>(null);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [shellState, setShellState] = useState<ShellUpdaterState | null>(null);
  const [shellActionBusy, setShellActionBusy] = useState(false);

  // 动态壁纸（Wallpaper Engine）
  const [weWallpapers, setWeWallpapers] = useState<WallpaperEntry[]>([]);
  const [weHas, setWeHas] = useState(false);
  const [weLoaded, setWeLoaded] = useState(false);

  // 模型 / API 配置
  const [modelPresets, setModelPresets] = useState<ModelApiPreset[]>([]);
  const [modelState, setModelState] = useState<ModelApiState | null>(null);
  const [modelForm, setModelForm] = useState<ModelProviderConfig | null>(null);
  const [modelSaved, setModelSaved] = useState(false);

  useEffect(() => {
    void window.harnessShell.profiles.list().then(setProfiles);
    void window.harnessShell.plugins.list().then(setPlugins);
    void window.harnessShell.remote.status().then(refreshRemote);
    void window.harnessShell.update.shellState().then(setShellState);
    const off = window.harnessShell.update.onShellState(setShellState);
    return off;
  }, []);

  useEffect(() => {
    void window.harnessShell.wallpaper.has().then(setWeHas);
    void window.harnessShell.model.presets().then(setModelPresets);
    void window.harnessShell.model.state().then(setModelState);
  }, []);

  const save = async (patch: Partial<AppConfig>): Promise<void> => {
    await onUpdateSettings(patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const flash = (): void => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const saveBackground = (patch: Partial<BackgroundConfig>): void => {
    const next = { ...background, ...patch };
    setBackground(next);
    void save({ background: next });
  };

  const savePet = (patch: Partial<AppConfig['pet']>): void => {
    const next = { ...pet, ...patch };
    setPet(next);
    void save({ pet: next });
  };

  const changeProfile = async (name: string): Promise<void> => {
    setProfile(name);
    await onUpdateSettings({ profile: name });
    flash();
    onRestart();
  };

  const checkDsh = async (): Promise<void> => {
    setDshInfo(null);
    setDshInfo(await window.harnessShell.update.checkDsh());
  };

  const doUpgradeDsh = async (): Promise<void> => {
    setUpgrading(true);
    setUpgradeResult(null);
    try {
      setUpgradeResult(await window.harnessShell.update.upgradeDsh());
      setDshInfo(await window.harnessShell.update.checkDsh());
    } finally {
      setUpgrading(false);
    }
  };

  const checkShell = async (): Promise<void> => {
    setCheckingShell(true);
    setShellStatus(null);
    try {
      setShellStatus(await window.harnessShell.update.checkShell());
    } finally {
      setCheckingShell(false);
    }
  };

  const refreshRemote = async (s?: RemoteStatus): Promise<void> => {
    const st = s ?? (await window.harnessShell.remote.status());
    setRemote(st);
    setRemoteQr(st.running ? await window.harnessShell.remote.qr() : null);
  };

  const toggleRemote = async (enabled: boolean): Promise<void> => {
    setRemoteBusy(true);
    try {
      await refreshRemote(await window.harnessShell.remote.setEnabled(enabled));
    } finally {
      setRemoteBusy(false);
    }
  };

  const regenerateRemote = async (): Promise<void> => {
    setRemoteBusy(true);
    try {
      await refreshRemote(await window.harnessShell.remote.regenerateToken());
    } finally {
      setRemoteBusy(false);
    }
  };

  const togglePlugin = async (id: string, enabled: boolean): Promise<void> => {
    const next = plugins.map((p) => (p.id === id ? { ...p, enabled } : p));
    setPlugins(next);
    await window.harnessShell.plugins.setEnabled(next.filter((p) => p.enabled).map((p) => p.id));
  };

  const shellCheck = async (): Promise<void> => {
    setShellActionBusy(true);
    try {
      await window.harnessShell.update.shellCheck();
    } catch (e) {
      setShellState((prev) => ({ ...(prev ?? { supported: false, state: 'idle', version: null, percent: 0, error: null }), error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setShellActionBusy(false);
    }
  };

  const shellDownload = async (): Promise<void> => {
    setShellActionBusy(true);
    try {
      await window.harnessShell.update.shellDownload();
    } finally {
      setShellActionBusy(false);
    }
  };

  const loadWeWallpapers = async (): Promise<void> => {
    setWeLoaded(true);
    setWeWallpapers(await window.harnessShell.wallpaper.scan());
  };

  const pickLocalVideo = async (): Promise<void> => {
    const f = await window.harnessShell.fs.pickVideoFile();
    if (f) saveBackground({ type: 'video', videoPath: f });
  };

  const useWeWallpaper = (entry: WallpaperEntry): void => {
    if (entry.filePath) saveBackground({ type: 'video', videoPath: entry.filePath });
  };

  const startModelForm = (preset: ModelApiPreset): void => {
    setModelForm({
      id: preset.id,
      name: preset.name,
      baseURL: preset.baseURL,
      apiKeyRef: preset.apiKeyRef,
      apiKey: '',
      models: [...preset.models],
      input: [...preset.input],
    });
    setModelSaved(false);
  };

  const saveModel = async (): Promise<void> => {
    if (!modelForm) return;
    await window.harnessShell.model.save(modelForm);
    setModelState(await window.harnessShell.model.state());
    setModelSaved(true);
    setTimeout(() => setModelSaved(false), 1500);
  };

  return (
    <div className="settings">
      <h2>设置</h2>

      <section className="settings-card">
        <h3>通用</h3>
        <label className="switch-row">
          <span>开机自启动</span>
          <input
            type="checkbox"
            checked={autoLaunch}
            onChange={(e) => {
              setAutoLaunch(e.target.checked);
              void save({ autoLaunch: e.target.checked });
            }}
          />
        </label>
        <label className="switch-row">
          <span>关闭窗口时隐藏到托盘</span>
          <input
            type="checkbox"
            checked={closeToTray}
            onChange={(e) => {
              setCloseToTray(e.target.checked);
              void save({ closeToTray: e.target.checked });
            }}
          />
        </label>
        <div className="kv">
          <span>空闲自动停止 dsh（分钟，0=禁用）</span>
          <input
            className="kbd-input"
            type="number"
            min={0}
            value={idleStopMinutes}
            onChange={(e) => {
              const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
              setIdleStopMinutes(v);
              void save({ idleStopMinutes: v });
            }}
          />
        </div>
      </section>

      <section className="settings-card">
        <h3>外观</h3>
        <div className="kv">
          <span>主题</span>
          <select
            value={theme}
            onChange={(e) => {
              const v = e.target.value as AppConfig['theme'];
              setTheme(v);
              void save({ theme: v });
            }}
          >
            <option value="dark">深色</option>
            <option value="light">浅色</option>
            <option value="system">跟随系统</option>
          </select>
        </div>
        <div className="kv">
          <span>强调色</span>
          <input
            type="color"
            value={accent}
            onChange={(e) => {
              setAccent(e.target.value);
              void save({ accent: e.target.value });
            }}
          />
        </div>
      </section>

      <section className="settings-card">
        <h3>背景</h3>
        <div className="kv">
          <span>类型</span>
          <select
            value={background.type}
            onChange={(e) => saveBackground({ type: e.target.value as BackgroundConfig['type'] })}
          >
            <option value="gradient">渐变（大厂预设）</option>
            <option value="color">纯色</option>
            <option value="image">图片</option>
            <option value="video">动态壁纸（视频）</option>
          </select>
        </div>

        {background.type === 'gradient' && (
          <>
          <div className="swatch-grid">
            {gradientPresets.map((p) => (
              <button
                key={p.id}
                className={'swatch' + (background.gradientId === p.id ? ' active' : '')}
                onClick={() => saveBackground({ gradientId: p.id })}
                title={p.name}
              >
                <span className="swatch-preview" style={{ background: presetPreviewCss(p) }} />
                <span className="swatch-name">{p.name}</span>
              </button>
            ))}
          </div>

          <div className="custom-gradient">
            <span className="muted">自定义渐变（改任意颜色即切换）</span>
            <div className="custom-colors">
              {background.customColors.map((c, i) => (
                <input
                  key={i}
                  type="color"
                  value={c}
                  onChange={(e) => {
                    const next = [...background.customColors] as [string, string, string];
                    next[i] = e.target.value;
                    saveBackground({ gradientId: 'custom', customColors: next });
                  }}
                />
              ))}
            </div>
          </div>
          </>
        )}

        {background.type === 'color' && (
          <div className="kv">
            <span>颜色</span>
            <input type="color" value={background.color} onChange={(e) => saveBackground({ color: e.target.value })} />
          </div>
        )}

        {background.type === 'image' && (
          <div className="bg-image-controls">
            <button
              className="btn"
              onClick={async () => {
                const f = await window.harnessShell.fs.pickFile();
                if (f) saveBackground({ imagePath: f });
              }}
            >
              选择图片
            </button>
            {background.imagePath && (
              <button className="btn" onClick={() => saveBackground({ imagePath: undefined })}>
                清除
              </button>
            )}
            {background.imagePath && <div className="hint mono bg-image-path">{background.imagePath}</div>}
          </div>
        )}

        {background.type === 'video' && (
          <div className="bg-video-controls">
            <button className="btn" onClick={() => void pickLocalVideo()}>
              选择本地视频
            </button>
            {background.videoPath && (
              <>
                <button className="btn" onClick={() => saveBackground({ videoPath: undefined })}>
                  清除
                </button>
                <div className="hint mono bg-image-path">{background.videoPath}</div>
              </>
            )}

            <div className="we-wallpaper-block">
              <div className="we-head">
                <span className="muted">Wallpaper Engine（video 类型，需已订阅）</span>
                <button className="btn" onClick={() => void loadWeWallpapers()} disabled={weLoaded}>
                  {weLoaded ? '扫描中…' : '扫描'}
                </button>
              </div>
              {!weHas && (
                <p className="hint">
                  未检测到 Steam Workshop 目录。在 Wallpaper Engine 里订阅视频壁纸后点「扫描」。
                </p>
              )}
              {weWallpapers.length > 0 && (
                <ul className="we-list">
                  {weWallpapers.map((w) => (
                    <li key={w.id} className={w.type !== 'video' ? 'we-item disabled' : 'we-item'}>
                      <button
                        className="we-pick"
                        disabled={w.type !== 'video' || !w.filePath}
                        onClick={() => useWeWallpaper(w)}
                      >
                        <span className="we-title">{w.title || w.id}</span>
                        <span className="muted">{w.type === 'video' ? 'video' : `暂不支持（${w.type}）`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="kv slider-row">
          <span>透明度</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(background.opacity * 100)}
            onChange={(e) => saveBackground({ opacity: Number(e.target.value) / 100 })}
          />
          <span className="mono">{Math.round(background.opacity * 100)}%</span>
        </div>

        <div className="kv slider-row">
          <span>模糊</span>
          <input
            type="range"
            min={0}
            max={40}
            value={background.blur}
            onChange={(e) => saveBackground({ blur: Number(e.target.value) })}
          />
          <span className="mono">{background.blur}px</span>
        </div>

        <label className="switch-row">
          <span>极光动画</span>
          <input
            type="checkbox"
            checked={background.animated}
            onChange={(e) => saveBackground({ animated: e.target.checked })}
          />
        </label>

        <div className="kv slider-row">
          <span>玻璃模糊</span>
          <input
            type="range"
            min={0}
            max={40}
            value={background.glassBlur}
            onChange={(e) => saveBackground({ glassBlur: Number(e.target.value) })}
          />
          <span className="mono">{background.glassBlur}px</span>
        </div>

        <label className="switch-row">
          <span>噪点颗粒</span>
          <input
            type="checkbox"
            checked={background.noise}
            onChange={(e) => saveBackground({ noise: e.target.checked })}
          />
        </label>
      </section>

      <section className="settings-card">
        <h3>桌面宠物</h3>
        <label className="switch-row">
          <span>显示宠物</span>
          <input type="checkbox" checked={pet.enabled} onChange={(e) => savePet({ enabled: e.target.checked })} />
        </label>

        {pet.enabled && (
          <>
            <div className="swatch-grid">
              {PET_SKINS.map((s) => (
                <button
                  key={s.id}
                  className={'swatch' + (pet.skin === s.id && !pet.customEmoji ? ' active' : '')}
                  onClick={() => savePet({ skin: s.id, customEmoji: '' })}
                  title={s.name}
                >
                  <span className="swatch-preview pet-emoji">{s.emoji}</span>
                  <span className="swatch-name">{s.name}</span>
                </button>
              ))}
            </div>

            <div className="kv">
              <span>自定义形象</span>
              <input
                className="kbd-input"
                value={pet.customEmoji}
                placeholder="任意 emoji / 字符"
                onChange={(e) => savePet({ customEmoji: e.target.value })}
              />
            </div>
            <div className="kv">
              <span>名字</span>
              <input
                className="kbd-input"
                value={pet.name}
                placeholder="给宠物起个名"
                onChange={(e) => savePet({ name: e.target.value })}
              />
            </div>
            <div className="kv slider-row">
              <span>大小</span>
              <input
                type="range"
                min={50}
                max={200}
                value={Math.round(pet.size * 100)}
                onChange={(e) => savePet({ size: Number(e.target.value) / 100 })}
              />
              <span className="mono">{Math.round(pet.size * 100)}%</span>
            </div>
            <div className="kv">
              <span>动画</span>
              <select
                value={pet.animation}
                onChange={(e) => savePet({ animation: e.target.value as AppConfig['pet']['animation'] })}
              >
                <option value="bob">呼吸浮动</option>
                <option value="float">轻柔摇摆</option>
                <option value="bounce">弹跳</option>
                <option value="none">静止</option>
              </select>
            </div>
            <div className="pet-tips">
              <span className="muted">气泡短语（每行一句）</span>
              <textarea
                className="pet-tips-input"
                rows={4}
                value={pet.tips.join('\n')}
                onChange={(e) => savePet({ tips: e.target.value.split('\n').filter((t) => t.trim()) })}
              />
            </div>
          </>
        )}
        <p className="hint">点击：蹦跶/旋转/撒特效+冒泡 · 双击：兴奋 · 悬停：发光 · 拖动：移动 · 右上 ×：关闭</p>
      </section>

      <section className="settings-card">
        <h3>Profile</h3>
        <div className="kv">
          <span>启动 Profile</span>
          <select value={profile} onChange={(e) => void changeProfile(e.target.value)}>
            {profiles.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <p className="hint">切换 Profile 会重启服务。非 web 的 profile 若不含 Web 界面，则无法嵌入显示。</p>
      </section>

      <section className="settings-card">
        <h3>插件</h3>
        <p className="hint">内置插件开关，切换后自动重启服务生效。</p>
        {plugins.map((p) => (
          <label className="switch-row" key={p.id}>
            <span title={p.description}>
              {p.name}
              <span className="muted"> · {p.description}</span>
            </span>
            <input
              type="checkbox"
              checked={p.enabled}
              onChange={(e) => void togglePlugin(p.id, e.target.checked)}
            />
          </label>
        ))}
      </section>

      <section className="settings-card">
        <h3>快捷键</h3>
        <div className="kv">
          <span>命令面板</span>
          <input
            className="kbd-input"
            value={keybindings.commandPalette}
            onChange={(e) => setKeybindings({ ...keybindings, commandPalette: e.target.value })}
            onBlur={() => void save({ keybindings })}
          />
        </div>
        <div className="kv">
          <span>切换面板</span>
          <input
            className="kbd-input"
            value={keybindings.togglePanel}
            onChange={(e) => setKeybindings({ ...keybindings, togglePanel: e.target.value })}
            onBlur={() => void save({ keybindings })}
          />
        </div>
        <p className="hint">格式如 Ctrl+K、Ctrl+Shift+B、Alt+P。</p>
      </section>

      <section className="settings-card">
        <h3>服务</h3>
        <div className="kv">
          <span>状态</span>
          <span>{service.status}</span>
        </div>
        <div className="kv">
          <span>地址</span>
          <span className="mono">{service.url ?? '—'}</span>
        </div>
        <div className="kv">
          <span>模式</span>
          <span>{service.mode ?? '—'}</span>
        </div>
        <button className="btn" onClick={onRestart}>
          重启服务
        </button>
      </section>

      <section className="settings-card">
        <h3>远程访问（手机）</h3>
        <p className="hint">在局域网内用手机扫码访问桌面端 Harness。网关需 token 认证，仅在同网段可用。</p>
        <label className="switch-row">
          <span>开启远程访问</span>
          <input
            type="checkbox"
            checked={remote?.enabled ?? false}
            disabled={remoteBusy}
            onChange={(e) => void toggleRemote(e.target.checked)}
          />
        </label>
        {remote?.enabled && (
          <>
            {remote.running ? (
              <>
                <div className="remote-box">
                  {remoteQr && <img className="remote-qr" src={remoteQr} alt="扫码访问" />}
                  <div className="remote-info">
                    <div className="kv">
                      <span>访问地址</span>
                      <span className="mono">{remote.url}</span>
                    </div>
                    <div className="kv">
                      <span>访问 token</span>
                      <span className="mono">{remote.token}</span>
                    </div>
                    <button className="btn" onClick={() => void regenerateRemote()} disabled={remoteBusy}>
                      重新生成 token
                    </button>
                  </div>
                </div>
                <p className="hint">手机与电脑连同一 WiFi，用浏览器/相机扫左侧二维码即可访问。</p>
              </>
            ) : (
              <p className="hint">远程访问已开启，但网关未运行（可能启动失败）。{remote.error ? `错误：${remote.error}` : ''}</p>
            )}
          </>
        )}
      </section>

      <section className="settings-card">
        <h3>模型 / API</h3>
        <p className="hint">
          给需要 API 的插件（如视觉路由）配置模型。Key 写入 dsh 的 <span className="mono">.credentials.yaml</span>
          （热重载，无需重启）；provider 写入 <span className="mono">settings.yaml</span>，保存后可点「重启服务」加载模型。
        </p>
        {modelState && modelState.providers.length > 0 && (
          <ul className="model-configured">
            {modelState.providers.map((p) => (
              <li key={p.id}>
                <span className="mono">{p.id}</span> · {p.name}
                {p.configured ? <span className="badge ok">已配 Key</span> : <span className="badge">未配 Key</span>}
              </li>
            ))}
          </ul>
        )}

        <div className="model-presets">
          {modelPresets.map((p) => (
            <button key={p.id} className="btn" onClick={() => startModelForm(p)}>
              {p.name}
            </button>
          ))}
        </div>
        {modelPresets.map((p) => (
          <p key={p.id} className="hint">
            {p.name}：{p.hint}
          </p>
        ))}

        {modelForm && (
          <div className="model-form">
            <div className="kv">
              <span>provider id</span>
              <input className="kbd-input" value={modelForm.id} onChange={(e) => setModelForm({ ...modelForm, id: e.target.value })} />
            </div>
            <div className="kv">
              <span>名称</span>
              <input className="kbd-input" value={modelForm.name} onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })} />
            </div>
            <div className="kv">
              <span>baseURL</span>
              <input className="kbd-input wide" value={modelForm.baseURL} onChange={(e) => setModelForm({ ...modelForm, baseURL: e.target.value })} />
            </div>
            <div className="kv">
              <span>模型（逗号分隔）</span>
              <input
                className="kbd-input wide"
                value={modelForm.models.join(', ')}
                onChange={(e) => setModelForm({ ...modelForm, models: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div className="kv">
              <span>API Key</span>
              <input
                className="kbd-input wide"
                type="password"
                placeholder="粘贴 Key（不回显）"
                value={modelForm.apiKey}
                onChange={(e) => setModelForm({ ...modelForm, apiKey: e.target.value })}
              />
            </div>
            <button className="btn" onClick={() => void saveModel()}>
              保存
            </button>
            {modelSaved && <span className="saved-inline">已保存 ✓</span>}
          </div>
        )}
      </section>

      <section className="settings-card">
        <h3>更新</h3>
        <div className="kv">
          <span>dsh 版本</span>
          <span className="mono">{dshInfo ? `${dshInfo.current}` : config.dshBin ?? '检查中…'}</span>
        </div>
        {dshInfo && (
          <div className="kv">
            <span>最新版本</span>
            <span className="mono">{dshInfo.latest ?? '未知'}</span>
          </div>
        )}
        {dshInfo?.outdated && <p className="hint warn">dsh 有可用更新。</p>}
        <button className="btn" onClick={() => void checkDsh()}>
          检查 dsh 更新
        </button>
        {dshInfo?.outdated && (
          <button className="btn" onClick={() => void doUpgradeDsh()} disabled={upgrading}>
            {upgrading ? '升级中…' : '升级 dsh 到最新'}
          </button>
        )}
        {upgradeResult && <pre className="term-output">{upgradeResult.stdout || upgradeResult.stderr}</pre>}

        <div className="update-divider" />
        {shellState?.supported ? (
          <>
            <p className="hint">
              {shellState.state === 'idle' && '启动后会自动在后台静默检查更新。'}
              {shellState.state === 'checking' && '正在检查更新…'}
              {shellState.state === 'not-available' && '已是最新版本'}
              {shellState.state === 'available' && `发现新版本 ${shellState.version}，后台下载中…`}
              {shellState.state === 'downloading' && `正在下载 ${shellState.version}（${shellState.percent}%）…`}
              {shellState.state === 'downloaded' && `新版本 ${shellState.version} 已下载，退出时自动安装。`}
              {shellState.state === 'error' && `更新检查失败：${shellState.error}`}
            </p>
            <button className="btn" onClick={() => void shellCheck()} disabled={shellActionBusy || shellState.state === 'checking' || shellState.state === 'downloading'}>
              检查更新
            </button>
            {shellState.state === 'available' && (
              <button className="btn" onClick={() => void shellDownload()} disabled={shellActionBusy}>
                立即下载
              </button>
            )}
            {shellState.state === 'downloaded' && (
              <button className="btn" onClick={() => window.harnessShell.update.shellInstall()}>
                重启并安装
              </button>
            )}
          </>
        ) : (
          <>
            <button className="btn" onClick={() => void checkShell()} disabled={checkingShell}>
              {checkingShell ? '检查中…' : '检查壳更新'}
            </button>
            {shellStatus && (
              <p className="hint">
                {shellStatus.error
                  ? `检查失败：${shellStatus.error}`
                  : shellStatus.available
                    ? `有新版本 ${shellStatus.version}`
                    : '已是最新版本'}
                {shellStatus.available && shellStatus.url && (
                  <button className="btn" onClick={() => window.harnessShell.openExternal(shellStatus.url as string)}>
                    前往下载
                  </button>
                )}
              </p>
            )}
            <p className="hint">便携版不支持静默自更新，请下载新版覆盖。</p>
          </>
        )}
      </section>

      <section className="settings-card">
        <h3>关于</h3>
        <div className="kv">
          <span>版本</span>
          <span>{appVersion}</span>
        </div>
        <button className="btn" onClick={() => window.harnessShell.openDevTools()}>
          开发者工具
        </button>
        <button className="btn" onClick={() => window.harnessShell.openLogs()}>
          打开日志目录
        </button>
      </section>

      {saved && <div className="saved-toast">已保存</div>}
    </div>
  );
}
