/**
 * 自包含冒烟测试：用打包后的 Electron 内置 Node 跑打包进 resources/dsh 的 dsh，
 * 验证「零依赖分发」路径端到端可用（免系统 Node / 免全局 dsh）。
 * 前提：先 `npm run build` 且 `npx electron-builder --win --dir` 产出 win-unpacked。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DshServer } from '../src/main/server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const unpacked = path.join(__dirname, '..', 'dist', 'win-unpacked');
const electronExe = path.join(unpacked, 'Harness UI.exe');
const archive = path.join(unpacked, 'resources', 'dsh.tar.gz');
const extractedDsh = path.join(__dirname, '..', '.smoke-dsh');
const bundledBin = path.join(extractedDsh, 'dsh', 'lib', 'bin.js');

let failures = 0;
function check(name: string, condition: boolean, extra = ''): void {
  if (condition) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${extra ? ' —— ' + extra : ''}`);
  }
}

async function main(): Promise<void> {
  console.log('== 自包含冒烟测试（Electron 内置 Node + 打包 dsh）==');
  check('win-unpacked 存在', fs.existsSync(electronExe), electronExe);
  check('dsh.tar.gz 存在', fs.existsSync(archive), archive);
  if (!fs.existsSync(electronExe) || !fs.existsSync(archive)) {
    console.log('\nSMOKE FAILED（缺产物，先运行 npm run dist:dir）');
    process.exit(1);
  }

  // 解压 dsh.tar.gz（等价于应用首次启动的 ensureDshExtracted）
  fs.rmSync(extractedDsh, { recursive: true, force: true });
  fs.mkdirSync(extractedDsh, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', extractedDsh], { stdio: 'ignore' });
  check('解压后 bundled dsh 存在', fs.existsSync(bundledBin), bundledBin);

  // 隔离 DSH_HOME
  const realHome = process.env.DSH_HOME || path.join(process.env.USERPROFILE ?? '', '.dsh');
  const smokeHome = path.join(__dirname, '..', '.smoke-home2');
  fs.rmSync(smokeHome, { recursive: true, force: true });
  fs.mkdirSync(smokeHome, { recursive: true });
  for (const sub of ['profiles', 'settings.yaml', '.anonymous-user-id']) {
    const src = path.join(realHome, sub);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(smokeHome, sub), { recursive: true });
  }
  fs.rmSync(path.join(smokeHome, 'profiles', 'node_modules'), { recursive: true, force: true });

  // 激活内置插件（等价于 ensureBundledPlugins），验证插件挂载后 dsh 仍能正常启动
  const BUNDLED = ['dsh-plugin-genui', 'oh-my-dsh', 'dsh-voice-webspeech', 'dsh-message-edit', 'dsh-git-status', 'dsh-vision-router'];
  const pkgPath = path.join(smokeHome, 'profiles', 'web', 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      dsh?: { profile?: { bundles?: string[] } };
    };
    const deps = pkg.dependencies ?? {};
    const bundles = pkg.dsh?.profile?.bundles ?? [];
    let changed = false;
    for (const p of BUNDLED) {
      if (!bundles.includes(p)) {
        bundles.push(p);
        changed = true;
      }
      if (!(p in deps)) {
        deps[p] = '*';
        changed = true;
      }
    }
    if (changed) {
      pkg.dependencies = deps;
      pkg.dsh = { ...(pkg.dsh ?? {}), profile: { ...(pkg.dsh?.profile ?? {}), bundles } };
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
    }
  }

  const server = new DshServer({
    nodeBin: electronExe,
    dshBin: bundledBin,
    useElectronNode: true,
    port: 0,
    attachPort: 31199,
    log: (m) => console.log('[bundled]', m),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: smokeHome, NO_COLOR: '1', FORCE_COLOR: '0' },
  });

  const url = await server.start();
  check('spawn 模式', server.mode === 'spawn', `mode=${server.mode}`);
  check('拿到 URL', /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(url), url);
  const res = await fetch(url);
  check('HTTP 200', res.status === 200, String(res.status));
  await server.stop();
  check('已停止', server.child === null);

  console.log(failures === 0 ? '\nSMOKE OK（自包含可用）' : `\nSMOKE FAILED（${failures}）`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
