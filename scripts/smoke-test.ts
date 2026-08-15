/**
 * 无界面冒烟测试：验证 DshServer 的 attach / spawn / 进程树清理逻辑。
 * 运行方式：npm run smoke（tsx 直接执行 TS 源码，不依赖 Electron）。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DshServer } from '../src/main/server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const log = (label: string) => (msg: string): void => console.log(`[${label}] ${msg}`);
let failures = 0;
function check(name: string, condition: boolean, extra = ''): void {
  if (condition) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${extra ? ' —— ' + extra : ''}`);
  }
}

async function main(): Promise<void> {
  // ── 1) attach 模式：3080 上正好跑着真实 dsh（当前会话）──
  console.log('== 1) attach 现有实例 ==');
  const attach = new DshServer({ attachPort: 3080, log: log('attach') });
  const attachUrl = await attach.start();
  check('识别为 attach 模式', attach.mode === 'attach', `mode=${attach.mode}`);
  check('URL 为 3080', attachUrl === 'http://127.0.0.1:3080/', attachUrl);
  const attachRes = await fetch(attachUrl);
  check('attach HTTP 200', attachRes.status === 200, String(attachRes.status));
  await attach.stop();
  check('attach 模式下 stop 不影响外部进程', attach.child === null && attach.pid === null, 'child 已清空');

  // ── 2) spawn 模式：隔离 DSH_HOME 启动独立实例 ──
  console.log('== 2) spawn 独立实例（隔离 DSH_HOME）==');
  const realHome = process.env.DSH_HOME || path.join(process.env.USERPROFILE ?? '', '.dsh');
  const smokeHome = path.join(__dirname, '..', '.smoke-home');
  fs.rmSync(smokeHome, { recursive: true, force: true });
  fs.mkdirSync(smokeHome, { recursive: true });
  for (const sub of ['profiles', 'settings.yaml', '.anonymous-user-id']) {
    const src = path.join(realHome, sub);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(smokeHome, sub), { recursive: true });
  }
  // profiles/node_modules 是 dsh 管理的 junction 链接，复制会被解引用成真目录，删掉让其自重建
  fs.rmSync(path.join(smokeHome, 'profiles', 'node_modules'), { recursive: true, force: true });

  const server = new DshServer({
    port: 0,
    attachPort: 31199,
    log: log('spawn'),
    env: { ...process.env, DSH_HOME: smokeHome, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  const spawnUrl = await server.start();
  check('识别为 spawn 模式', server.mode === 'spawn', `mode=${server.mode}`);
  check('拿到解析出的 URL', /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(spawnUrl), spawnUrl);
  check('端口不是 3080', !spawnUrl.includes(':3080'), spawnUrl);
  const spawnRes = await fetch(spawnUrl);
  check('spawn HTTP 200', spawnRes.status === 200, String(spawnRes.status));
  check('有子进程 pid', Number.isInteger(server.pid) && (server.pid ?? 0) > 0, String(server.pid));
  const spawnPid = server.pid;
  await server.stop();
  check('stop 后子进程已清空', server.child === null);
  await new Promise((r) => setTimeout(r, 1000));
  const stillUp = await (async () => {
    try {
      const res = await fetch(spawnUrl, { signal: AbortSignal.timeout(2000) });
      return res.status === 200;
    } catch {
      return false;
    }
  })();
  check('进程树已清理（端口不再响应）', !stillUp, `pid=${spawnPid}`);

  // ── 3) 端口被非 dsh 服务占用：不应 attach，应另起实例 ──
  console.log('== 3) 非 dsh 服务不误连 ==');
  const foreign = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><body>hello</body></html>');
  });
  await new Promise<void>((resolve) => foreign.listen(0, '127.0.0.1', () => resolve()));
  const foreignPort = (foreign.address() as { port: number }).port;
  const probe = new DshServer({
    attachPort: foreignPort,
    port: 0,
    log: log('probe'),
    env: { ...process.env, DSH_HOME: smokeHome, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  const probeUrl = await probe.start();
  check('未误连普通 HTTP 服务', probe.mode === 'spawn', `mode=${probe.mode}`);
  check('probe URL 合法', /^http:\/\/127\.0\.0\.1:\d+\/?$/.test(probeUrl), probeUrl);
  await probe.stop();
  foreign.close();

  console.log(failures === 0 ? '\nSMOKE OK' : `\nSMOKE FAILED（${failures} 项失败）`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('FATAL', error);
  process.exit(1);
});
