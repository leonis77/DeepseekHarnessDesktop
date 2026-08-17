# Harness UI

> DeepSeek Harness 的 Codex 风格桌面壳应用 —— 一键启动、零依赖分发、可无限扩展。

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20x64-0078D6" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-43-47848F" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB" />
  <img alt="Version" src="https://img.shields.io/badge/version-0.1.4-orange" />
  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/leonis77/DeepseekHarnessDesktop" />
</p>

> ⚠️ **非官方声明**：本项目是 DeepSeek Harness 的**第三方**桌面封装，**并非** DeepSeek 官方产品。DeepSeek 及其相关商标归其权利人所有。

---

## 目录

- [简介](#简介)
- [特性](#特性)
- [快速开始](#快速开始)
- [构建产物](#构建产物)
- [架构](#架构)
- [关键设计](#关键设计)
- [如何扩展](#如何扩展)
- [自包含分发](#自包含分发)
- [内置插件](#内置插件)
- [发布更新](#发布更新)
- [开发](#开发)
- [配置与日志](#配置与日志)
- [说明](#说明)
- [路线图](#路线图)
- [贡献](#贡献)
- [致谢](#致谢)
- [许可证](#许可证)

---

## 简介

Harness UI 把 DeepSeek Harness 的网页界面包装成一个**原生桌面应用**：独立窗口、自定义标题栏、侧边栏面板、命令面板、系统托盘、原生文件/终端/剪贴板能力，以及一套统一的扩展机制。

它不只是「开个浏览器标签页」，而是一个像 Codex / VS Code 那样可以持续长出面板、命令、主题、原生集成的壳。

你的会话与配置数据始终存放在 `DSH_HOME`（默认 `C:\Users\<你>\.dsh`），升级、卸载应用均不影响。

---

## 特性

| 特性 | 说明 |
| --- | --- |
| 一键启动 | 双击自动拉起 `dsh web`（`--port 0` 自动选空闲端口） |
| 智能复用 | 3080 端口已有实例则直接连接，不重复启动 |
| 原生壳 | 无边框窗口 + 自定义标题栏、活动栏、状态栏、托盘、通知、单实例 |
| 侧边栏面板 | 可注册面板：文件树 / 终端（多标签）/ 会话 / 任务 / MCP，宽度可拖拽 |
| 原生集成 | 文件读写/选择/拖拽导入、终端命令、剪贴板（文本+图片），经 preload 类型化暴露 |
| 命令面板 | `Ctrl+K` 呼出，搜索执行所有命令 |
| 主题系统 | 深色 / 浅色 / 跟随系统 + 强调色自定义 |
| 自定义背景 | 渐变预设（含自定义）/ 纯色 / 图片 / 动态壁纸（本地视频 + Wallpaper Engine），可调透明度/模糊/动画/玻璃模糊/噪点 |
| 桌面宠物 | 可定制形象/名字/大小/动画/气泡短语，点击/双击/右键互动，联动服务状态 |
| 多 Profile | 列出 `profiles/` 下所有 profile，切换即重启 |
| 快捷键自定义 | 命令面板、面板切换的快捷键可在设置里改 |
| 插件可控 | 设置 → 插件，逐个开关 6 个内置插件，切换即重启生效 |
| 模型/API 配置 | 设置 → 模型/API，预置智谱/百炼/SiliconFlow/OpenRouter，Key 写入 dsh 凭据（热重载） |
| 冷启动进度条 | 启动阶段显示「解压 → 启动 → 加载插件」进度与耗时 |
| 静默自更新 | 安装版后台静默检查+下载，退出时自动装新版（electron-updater） |
| 手机远程访问 | 设置 → 远程访问，同网段扫码用手机操作桌面端（token 认证网关） |
| 会话管理 | 真实标题/轮数（读投影缓存）、删除（两步确认）/ 定位 / 复制路径 |
| 任务面板 | 展示各会话的 goal / todos / plan（读投影缓存） |
| 更新 | dsh 版本检测 + 一键升级；壳自更新（GitHub Release） |
| 自包含 | dsh 已打进 exe，用 Electron 内置 Node 运行，免装 Node/npm |

---

## 快速开始

1. 下载并运行便携版 `Harness-UI-Portable-<version>.exe`，或安装 `Harness-UI-Setup-<version>.exe`。
2. 首次启动会自动拉起内置 dsh，窗口内直接显示 Harness。
3. 在 Harness 的 **设置 → 模型** 里填入你的 API Key（如 DeepSeek 官方 Key）。
4. 开始对话。关闭窗口默认隐藏到托盘，托盘「退出」才完全退出。

---

## 构建产物

| 文件 | 说明 |
| --- | --- |
| `dist/Harness-UI-Setup-<version>.exe` | 安装版（向导式，可取消、可选安装目录，约 200 MB） |
| `dist/Harness-UI-Portable-<version>.exe` | 便携版，双击即用（约 200 MB） |

> 体积包含内置 dsh（约 254 MB 源码，减重 + 打包压缩后约 +70 MB）与 6 个内置插件。

---

## 架构

```
src/
├─ main/                主进程（Node + Electron）
│  ├─ index.ts          组合根：窗口/托盘/菜单/IPC 接线 + 服务生命周期
│  ├─ server.ts         服务管理：attach 探测 / spawn 拉起（--profile / --expose-internals）/ 进程树清理
│  ├─ window.ts         无边框壳窗口
│  ├─ tray.ts / menu.ts 托盘与原生菜单（命令驱动，自动刷新）
│  ├─ config.ts         用户配置（config.json）+ 开机自启
│  ├─ fs.ts             原生文件：读目录/读写/读图/选择/资源管理器定位
│  ├─ terminal.ts       终端：执行命令 / 打开外部终端
│  ├─ clipboard.ts      剪贴板
│  ├─ profiles.ts       枚举 profile
│  ├─ sessions.ts       枚举 + 删除会话目录（带路径白名单）
│  ├─ mcp.ts            扫描 settings.yaml 的 mcp 段
│  ├─ update.ts         dsh 版本检测 / 升级 / GitHub Release 检测
│  ├─ updater.ts        壳静默自更新（electron-updater + GitHub Releases）
│  ├─ remote.ts         手机远程网关（token 认证反向代理，HTTP + WebSocket）
│  ├─ qr.ts             二维码生成（远程访问扫码）
│  ├─ pet.ts            桌面宠物窗口管理
│  ├─ plugins.ts        内置插件激活（写入 profile，支持禁用）
│  └─ extensions/       扩展注册表 + 内置扩展
├─ preload/index.ts     contextBridge 类型化桥（window.harnessShell）
├─ preload/pet.ts       宠物窗口专用桥（拖拽/配置/服务状态）
├─ renderer/            Shell UI（React + Vite）
│  └─ src/
│     ├─ App.tsx        布局编排 + 主题/背景/快捷键
│     ├─ hooks/         useShell / useTheme
│     ├─ utils/         keys（快捷键解析）/ backgrounds（渐变预设）
│     ├─ panels/        面板系统（registry + 5 面板 + 容器）
│     └─ components/    标题栏/活动栏/命令面板/状态栏/背景/对话视图(webview)/设置
└─ shared/              主进程与 UI 共享的 IPC 契约 + 类型 + 插件目录
```

```
vendor/dsh              全局 dsh 的副本（npm run vendor 生成，gitignore）
scripts/after-pack.cjs  打包钩子：整体拷进 resources/dsh（绕过 node_modules 过滤）
scripts/copy-dsh.mjs    vendor 脚本（含减重）
scripts/bundle-plugins.mjs 插件安装脚本（plugins.json → vendor/dsh）
scripts/make-icon.mjs   图标生成（纯 Node 手写 PNG/ICO）
scripts/smoke-test.ts   开发路径冒烟测试（系统 Node + 全局 dsh）
scripts/smoke-bundled.ts 自包含冒烟测试（Electron Node + 内置 dsh + 插件）
scripts/remote-smoke.ts 远程网关冒烟测试（认证 / HTTP 代理 / WebSocket）
```

---

## 关键设计

1. **壳与内核分离** — 壳只负责「拉起 + 展示 + 原生体验」，Harness 本体随 exe 内置（或走全局安装），升级互不干扰。
2. **命令即扩展** — `registry.addCommand({ id, title, category, run })` 自动出现在菜单「命令」、托盘、命令面板三处。
3. **面板即扩展** — 在 `panels/registry.tsx` 登记 `{ id, title, icon, component }`，活动栏自动出按钮。
4. **类型化 IPC** — `src/shared/ipc.ts` 定义通道名与 API 契约，主进程和 preload 共用，杜绝字符串漂移。
5. **自适应解析** — 优先复用本机系统 Node + 全局 dsh；都没有才用内置 dsh + Electron 内置 Node（零依赖兜底）。

---

## 如何扩展

**加一个命令（主进程能力）：**

```ts
registry.addCommand({
  id: 'my.feature',
  title: '我的功能',
  category: '自定义',
  run: () => { /* 任意主进程逻辑 */ },
});
```

**加一个面板（界面能力）：**

新建组件后在 `src/renderer/src/panels/registry.tsx` 登记；组件内通过 `window.harnessShell` 调用原生能力。

**加一个原生能力：**

`main/` 新建模块 → `shared/ipc.ts` 注册通道与类型 → `preload` 暴露 → `index.ts` 接 IPC handler。

---

## 自包含分发

`npm run dist` 会把全局安装的 dsh 整个拷进 exe（`vendor/dsh` → `resources/dsh`），运行时用 Electron 内置 Node 启动它。

| 需要 | 说明 |
| --- | --- |
| ✅ Windows x64 | 当前构建目标 |
| ✅ API Key | Harness 设置 → 模型里填一个模型 API Key |
| ❌ Node.js | 不再需要（内置 Electron Node） |
| ❌ npm / `npm i -g @deepseek-ai/dsh` | 不再需要（已内置 dsh） |

- 若机器上已有全局 dsh 且不想用内置副本，设环境变量 `DSH_DESKTOP_DSH_BIN` 指向外部 `lib/bin.js`。

### 减重与分发建议

- **减重**：vendor 阶段已剔除运行时用不到的 sourcemap / TS 源码 / 文档 / 测试文件，dsh 从 3.3 万文件 255MB 降到 ~1.2 万文件 ~170MB，便携版解压提速约 3 倍。
- **推荐安装版**：安装版（向导式，可取消、可选安装目录）安装一次后启动快；便携版是自解压格式，每次启动都要解压一遍，体积越大越慢。

---

## 内置插件

以下插件随应用内置（声明于 `plugins.json`），首次启动自动激活到 web profile，零依赖可用：

| 插件 | 功能 | 版本 | 作者仓库 |
| --- | --- | --- | --- |
| dsh-plugin-genui | 生成式 UI（图表/Mermaid/3D/表单） | 0.12.2 | [deepseek-harness-genui](https://github.com/pengyue-polaron/deepseek-harness-genui) |
| oh-my-dsh | 插件管理器（一键装/管插件） | 0.1.3 | [amplifthq/oh-my-dsh](https://github.com/amplifthq/oh-my-dsh) |
| dsh-voice-webspeech | 浏览器语音输入 | 0.1.0 | [anweat/dsh-voice-webspeech](https://github.com/anweat/dsh-voice-webspeech) |
| dsh-message-edit | 消息编辑 / 重试 / 版本时间线 | 0.2.2 | [Moeblack/dsh-message-edit](https://github.com/Moeblack/dsh-message-edit) |
| dsh-git-status | git 图（commit DAG / diff / 分支） | 0.1.1 | [Wongzexu/dsh-git-status](https://github.com/Wongzexu/dsh-git-status) |
| dsh-vision-router | 视觉（免 key 链 + OCR/抠图/截图） | 1.2.3 | [ysr666/dsh-vision-router](https://github.com/ysr666/dsh-vision-router) |

> 增删插件只需改 `plugins.json` + `src/main/plugins.ts`，然后 `npm run plugins && npm run dist`。

---

## 发布更新

发版走 GitHub Actions（推 `v*` tag 自动构建 + 发布）或手动两步：

**自动（推荐）**

1. 改 `package.json` 的 `version` 并提交推送
2. 打 tag 并推送：`git tag v0.1.1 && git push origin v0.1.1`
3. GitHub Actions 自动构建安装版 + 便携版，并把 `latest.yml` / `.blockmap` 一并发布到 Release

**手动**

1. 打开仓库 **Releases** → **Create a new release**
2. **Tag** 填 `v0.1.1`（比 `package.json` 递增）
3. 上传 `dist/Harness-UI-Setup-<version>.exe`、同名 `.blockmap`、`dist/latest.yml`、便携版 exe
4. 点 **Publish release**

发布后：**安装版**启动后静默检查 → 后台下载 → 退出时自动安装；**便携版**不支持静默更新，在「设置 → 更新 → 检查壳更新」里手动下载覆盖。

---

## 开发

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 热更新运行（electron-vite，需图形环境） |
| `npm run typecheck` | 类型检查 |
| `npm run build` | 构建 `out/`（main + preload + renderer） |
| `npm run smoke` | 开发路径冒烟测试（attach/spawn/进程清理） |
| `npm run smoke:bundled` | 自包含冒烟测试（Electron Node + 内置 dsh + 插件） |
| `npm run smoke:remote` | 远程网关冒烟测试（认证 / HTTP 代理 / WebSocket） |
| `npm run vendor` | 复制全局 dsh 到 `vendor/dsh`（`-- --force` 强制重拷） |
| `npm run plugins` | 把 `plugins.json` 里的插件装进 `vendor/dsh` |
| `npm run dist` | 打包安装版 + 便携版（含 vendor + plugins + build） |
| `npm run dist:dir` | 仅产出 `win-unpacked`（调试用） |
| `npm run icon` | 重新生成图标 |

> 国内打包若报 `connect ETIMEDOUT`（GitHub 工具链下载失败），先设置镜像：
> ```powershell
> $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
> $env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
> npm run dist
> ```

---

## 配置与日志

| 项 | 路径 |
| --- | --- |
| 应用日志 | `%APPDATA%\Harness UI\logs\main.log` |
| 用户配置 | `%APPDATA%\Harness UI\config.json` |

| 环境变量 | 作用 |
| --- | --- |
| `DSH_DESKTOP_DSH_BIN` | 指定外部 dsh 的 `lib/bin.js` 路径 |
| `DSH_DESKTOP_NODE` | 指定 node.exe 路径 |

---

## 说明

- 未做代码签名，首次运行若 SmartScreen 拦截，点「更多信息 → 仍要运行」。
- 会话删除是删除磁盘上的会话目录（不可恢复），带路径白名单校验；Harness 界面内的会话侧栏需刷新才会同步。
- 会话标题 / 任务直接读 dsh 的投影缓存 `session_projcache.json`（免解压 zstd 正文）。
- 目前仅支持 **Windows x64**，不计划 macOS / Linux。
- 终端为多标签命令执行（非 PTY），交互式程序（vim 等）请用「外部终端」。

---

## 路线图

- [x] 会话标题深接：读投影缓存拿真实标题 / 轮数
- [x] 任务面板深接：展示 goal / todos / plan
- [x] 原生集成：文件拖拽、终端多会话、剪贴板图片
- [x] 动态壁纸：本地视频 + Wallpaper Engine（video 类型）
- [x] 模型/API 桌面配置：Key 写 dsh 凭据、provider 写 settings.yaml
- [x] 自动更新：GitHub Release（静默后台下载 + 退出自动安装，安装版）
- [x] 插件可控面板：设置里逐个开关内置插件
- [x] 冷启动进度条：解压 / 启动 / 加载插件进度与耗时
- [x] 手机远程访问：token 认证网关 + 扫码（同网段）
- [ ] 主题增强：更多背景预设、自定义 CSS、主题分享
- [ ] 会话导入导出 / 批量管理
- [ ] 内置任务板（`dsh-web-ui`，需 GitHub 可达时补）
- [ ] 文件树编辑器（与 dsh 自带 workspace 重叠，低优先）

---

## 贡献

欢迎提交 PR。开发流程见上文「开发」一节，扩展方式见「如何扩展」。

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/xxx`
3. 提交并推送：`git push origin feature/xxx`
4. 发起 Pull Request

---

## 致谢

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) —— 本项目封装的核心
- [Electron](https://www.electronjs.org/) / [electron-vite](https://electron-vite.org/) / [React](https://react.dev/) / [Cordis](https://github.com/cordiverse/cordis)
- 内置插件原作者（见上文「内置插件」）：pengyue-polaron / amplifthq / anweat / Moeblack / Wongzexu / ysr666
- 参考生态列表：[awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness)、[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)

---

## 许可证

[MIT](./LICENSE) · 版权归 DeepSeek 所有
