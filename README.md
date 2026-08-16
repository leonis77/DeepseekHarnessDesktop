# Harness UI

> DeepSeek Harness 的 Codex 风格桌面壳应用 — 一键启动、零依赖分发、可无限扩展。

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20x64-0078D6" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-43-47848F" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB" />
  <img alt="Version" src="https://img.shields.io/badge/version-0.1.0-orange" />
  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/leonis77/DeepseekHarnessDesktop" />
</p>

> ⚠️ **非官方声明**：本项目是 DeepSeek Harness 的**第三方**桌面封装，**非** DeepSeek 官方产品。DeepSeek 及其相关商标归其权利人所有。
>
> ⚠️ **Disclaimer**: This is a **third-party** desktop wrapper for DeepSeek Harness, **not** an official DeepSeek product. DeepSeek and related marks belong to their respective owners.

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
- [开发](#开发)
- [配置与日志](#配置与日志)
- [说明](#说明)
- [License](#license)

---

## 简介

Harness UI 把 DeepSeek Harness 的 Web GUI 包装成一个**原生桌面应用**：独立窗口、自定义标题栏、侧边栏面板、命令面板、系统托盘、原生文件/终端/剪贴板能力，以及一套统一的扩展机制。

它不只是「开个浏览器标签页」，而是一个像 Codex / VS Code 那样可以持续长出面板、命令、主题、原生集成的壳。

你的会话与配置数据始终存放在 `DSH_HOME`（默认 `C:\Users\<你>\.dsh`），升级、卸载应用均不影响。

---

## 特性

| 特性 | 说明 |
| --- | --- |
| 一键启动 | 双击自动拉起 `dsh web`（`--port 0` 自动选空闲端口） |
| 智能复用 | 3080 端口已有实例则直接连接，不重复启动 |
| 原生壳 | 无边框窗口 + 自定义标题栏、活动栏、状态栏、托盘、通知、单实例 |
| 侧边栏面板 | 可注册面板：文件树 / 终端 / 会话 / 任务 / MCP，宽度可拖拽 |
| 原生集成 | 文件读写/选择、终端命令、剪贴板，经 preload 类型化暴露 |
| 命令面板 | `Ctrl+K` 呼出，搜索执行所有命令 |
| 主题系统 | 深色 / 浅色 / 跟随系统 + 强调色自定义 |
| 自定义背景 | 大厂级渐变预设 + 纯色 + 图片，可调透明度/模糊/动画/玻璃模糊/浮动卡片 |
| 多 Profile | 列出 `profiles/` 下所有 profile，切换即重启 |
| 快捷键自定义 | 命令面板、面板切换的快捷键可在设置里改 |
| 更新 | dsh 版本检测 + 一键升级；壳自更新（清单 JSON） |
| 会话管理 | 删除（两步确认）/ 定位 / 复制路径 |
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
| `dist/Harness-UI-Setup-<version>.exe` | NSIS 一键安装版（约 154 MB） |
| `dist/Harness-UI-Portable-<version>.exe` | 便携版，双击即用（约 154 MB） |

> 体积包含内置 dsh（约 254 MB 源码，打包压缩后约 +60 MB）。

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
│  ├─ fs.ts             原生文件：读目录/读写/读图(DataURL)/选择/资源管理器定位
│  ├─ terminal.ts       终端：执行命令 / 打开外部终端
│  ├─ clipboard.ts      剪贴板
│  ├─ profiles.ts       枚举 profile
│  ├─ sessions.ts       枚举 + 删除会话目录（带路径白名单）
│  ├─ mcp.ts            扫描 settings.yaml 的 mcp 段
│  ├─ update.ts         dsh 版本检测 / 升级 / 壳自更新
│  └─ extensions/       扩展注册表 + 内置扩展
├─ preload/index.ts     contextBridge 类型化桥（window.harnessShell）
├─ renderer/            Shell UI（React + Vite）
│  └─ src/
│     ├─ App.tsx        布局编排 + 主题/背景/快捷键
│     ├─ hooks/         useShell / useTheme
│     ├─ utils/         keys（快捷键解析）/ backgrounds（渐变预设）
│     ├─ panels/        面板系统（registry + 5 面板 + 容器）
│     └─ components/    TitleBar / ActivityBar / CommandPalette / StatusBar /
│                        Background / HarnessView(iframe) / SettingsPanel
└─ shared/              主进程与 UI 共享的 IPC 契约 + 类型
```

```
vendor/dsh              全局 dsh 的副本（npm run vendor 生成，gitignore）
scripts/after-pack.cjs  打包钩子：整体拷进 resources/dsh（绕过 node_modules 过滤）
scripts/copy-dsh.mjs    vendor 脚本
scripts/make-icon.mjs   图标生成（纯 Node 手写 PNG/ICO）
scripts/smoke-test.ts   开发路径冒烟测试（系统 Node + 全局 dsh）
scripts/smoke-bundled.ts 自包含冒烟测试（Electron Node + 内置 dsh）
```

---

## 关键设计

1. **壳与内核分离** — 壳只负责「拉起 + 展示 + 原生体验」，Harness 本体随 exe 内置（或走全局安装），升级互不干扰。
2. **命令即扩展** — `registry.addCommand({ id, title, category, run })` 自动出现在菜单「命令」、托盘、命令面板三处。
3. **面板即扩展** — 在 `panels/registry.tsx` 登记 `{ id, title, icon, component }`，活动栏自动出按钮。
4. **类型化 IPC** — `src/shared/ipc.ts` 定义通道名与 API 契约，主进程和 preload 共用，杜绝字符串漂移。
5. **自包含** — dsh 打进 `resources/dsh`，用 `ELECTRON_RUN_AS_NODE=1 --expose-internals` 启动，免装 Node/npm。

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

**加一个面板（Shell UI 能力）：**

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

### 减重与分发建议 / Slimming & tips

- **减重**：vendor 阶段已剔除运行时用不到的 sourcemap / TS 源码 / 文档 / 测试文件，dsh 从 3.3 万文件 255MB 降到 ~1.2 万文件 ~170MB，便携版解压提速约 3 倍。
- **推荐安装版**：安装版（assisted 向导，可取消、可选安装目录）安装一次后启动快；便携版是自解压格式，每次启动都要解压一遍，体积越大越慢。

---

## 内置插件 / Bundled Plugins

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

### 发布更新 / Release

壳的「检查更新」已接通 GitHub Release：发版后自动检测最新版并引导下载。

1. 推送代码到 GitHub 后，在仓库 **Releases → Draft a new release**
2. Tag 填 `v0.1.0`（版本号，需比 `package.json` 的 `version` 递增）
3. 上传 `dist/Harness-UI-Setup-<version>.exe` 作为附件
4. 发布后，应用内「设置 → 更新 → 检查壳更新」即可检测到新版本

---

## 开发

| Script | 说明 |
| --- | --- |
| `npm run dev` | 热更新运行（electron-vite，需图形环境） |
| `npm run typecheck` | 类型检查 |
| `npm run build` | 构建 `out/`（main + preload + renderer） |
| `npm run smoke` | 开发路径冒烟测试（attach/spawn/进程清理） |
| `npm run smoke:bundled` | 自包含冒烟测试（Electron Node + 内置 dsh） |
| `npm run vendor` | 复制全局 dsh 到 `vendor/dsh`（`-- --force` 强制重拷） |
| `npm run dist` | 打包安装版 + 便携版（含 vendor + build） |
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
- 会话 / 任务面板目前读的是目录级元数据；正文是 zstd 压缩的 jsonl，深度解析需后续接 Harness 查询接口。

---

## 路线图 / Roadmap

- [ ] 侧边栏面板深接：会话标题 / 任务（解析 zstd jsonl）、文件树编辑器、MCP 管理
- [ ] 原生集成扩展：文件拖拽、终端多会话、剪贴板图片
- [x] 自动更新：接入 GitHub Releases（检测最新版 + 引导下载）
- [ ] 主题增强：更多背景预设、自定义 CSS、主题分享
- [ ] 会话导入导出 / 批量管理
- [ ] 多平台：macOS / Linux

---

## 贡献 / Contributing

欢迎 PR。开发流程见上文「开发」一节，扩展方式见「如何扩展」。

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/xxx`
3. 提交并推送：`git push origin feature/xxx`
4. 发起 Pull Request

---

## 致谢 / Acknowledgements

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) —— 本项目封装的核心
- [Electron](https://www.electronjs.org/) / [electron-vite](https://electron-vite.org/) / [React](https://react.dev/) / [Cordis](https://github.com/cordiverse/cordis)
- 内置插件原作者（见上文「内置插件」）：pengyue-polaron / amplifthq / anweat / Moeblack / Wongzexu / ysr666 —— 感谢这些开源作者
- 参考生态列表：[awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness)、[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)

---

## License

[MIT](./LICENSE) · 版权归 DeepSeek 所有 / Copyright © DeepSeek
