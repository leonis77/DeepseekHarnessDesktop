import { useEffect, useState } from 'react';
import type {
  AppConfig,
  BackgroundConfig,
  DshVersionInfo,
  ProfileInfo,
  ServiceState,
  TerminalResult,
  UpdateStatus,
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

  useEffect(() => {
    void window.harnessShell.profiles.list().then(setProfiles);
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
