/** 远程网关冒烟：验证 token 认证 + HTTP 反向代理 + WebSocket upgrade 转发。 */
import http from 'node:http';
import net from 'node:net';
import { startRemoteGateway } from '../src/main/remote';

function check(name: string, condition: boolean, extra = ''): void {
  if (condition) console.log(`  ✓ ${name}`);
  else {
    console.log(`  ✗ ${name}${extra ? ' —— ' + extra : ''}`);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  // 上游：一个回显 HTTP 服务 + 一个 HTML 页 + 一个 upgrade 回显 socket
  const upstream = http.createServer((req, res) => {
    if (req.url === '/page') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html><head><title>t</title></head><body>hi</body></html>');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(`upstream:${req.url}:${req.headers.host ?? ''}`);
  });
  upstream.on('upgrade', (req, socket, head) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
    if (head.length) socket.write(head);
    socket.end();
  });
  await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', () => r()));
  const upPort = (upstream.address() as { port: number }).port;

  const gateway = await startRemoteGateway({
    getTarget: () => `http://127.0.0.1:${upPort}/`,
    token: 'deadbeefcafebabe',
    port: 0,
    log: () => {},
    manage: {
      data: () => ({ sessions: [{ title: '测试会话', path: '/tmp/x', turns: 3 }], tasks: [] }),
      remove: () => {},
    },
  });

  const base = `http://127.0.0.1:${gateway.port}`;

  // 1) 未认证 → 登录页（200，含表单）
  const r1 = await fetch(`${base}/`);
  check('未认证返回登录页', r1.status === 200 && (await r1.text()).includes('token'));

  // 2) 错误 token POST → 401
  const r2 = await fetch(`${base}/__auth`, { method: 'POST', body: 'token=wrong', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  check('错误 token → 401', r2.status === 401);

  // 3) 正确 ?code=<配对码> → 302 + 种 cookie（一次性，不泄露持久 token）
  const r3 = await fetch(`${base}/?code=${gateway.pairingCode}`, { redirect: 'manual' });
  const cookie = r3.headers.get('set-cookie') ?? '';
  check('?code= 配对码 → 302 并种 cookie', r3.status === 302 && cookie.includes('harness_remote='));
  const r3b = await fetch(`${base}/?code=${gateway.pairingCode}`, { redirect: 'manual' });
  check('配对码一次性（二次使用失败）', r3b.status !== 302);

  // 4) 带 cookie 请求 → 代理到上游
  const r4 = await fetch(`${base}/hello`, { headers: { cookie: 'harness_remote=deadbeefcafebabe' } });
  const body4 = await r4.text();
  check('带 cookie 代理成功', r4.status === 200 && body4.includes('upstream:/hello'));

  // 4b) HTML 响应注入 crypto.randomUUID polyfill + 手机响应式（按 UA）
  const r4b = await fetch(`${base}/page`, {
    headers: { cookie: 'harness_remote=deadbeefcafebabe', 'user-agent': 'Mozilla/5.0 (iPhone)' },
  });
  const body4b = await r4b.text();
  check('HTML 注入 randomUUID polyfill', body4b.includes('window.crypto.randomUUID') && body4b.includes('<head>'));
  check('手机 UA 注入响应式 CSS', body4b.includes('harness-mobile'));
  const r4c = await fetch(`${base}/page`, {
    headers: { cookie: 'harness_remote=deadbeefcafebabe', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0)' },
  });
  const body4c = await r4c.text();
  check('桌面 UA 不注入响应式 CSS', !body4c.includes('harness-mobile'));

  // 5) 正确 token POST → 302 到 /
  const r5 = await fetch(`${base}/__auth`, { method: 'POST', body: 'token=deadbeefcafebabe', headers: { 'content-type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });
  check('正确 token POST → 302', r5.status === 302);

  // 5b) 会话管理页 / API
  const r5b = await fetch(`${base}/__manage`, { headers: { cookie: 'harness_remote=deadbeefcafebabe' } });
  check('管理页可访问', r5b.status === 200 && (await r5b.text()).includes('会话管理'));
  const r5c = await fetch(`${base}/__api/data`, { headers: { cookie: 'harness_remote=deadbeefcafebabe' } });
  const data5c = (await r5c.json()) as { sessions: Array<{ title: string }> };
  check('管理 API 返回会话数据', data5c.sessions?.length === 1 && data5c.sessions[0].title === '测试会话');

  // 6) WebSocket upgrade 带 cookie → 转发到上游并回 101
  const wsResult = await new Promise<string>((resolve) => {
    const s = net.connect(gateway.port, '127.0.0.1', () => {
      s.write(
        'GET /api/events.mux HTTP/1.1\r\n' +
          `Host: 127.0.0.1:${gateway.port}\r\n` +
          'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
          'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
          'Sec-WebSocket-Version: 13\r\n' +
          'Cookie: harness_remote=deadbeefcafebabe\r\n\r\n'
      );
    });
    let buf = '';
    s.on('data', (d: Buffer) => {
      buf += d.toString();
      if (buf.includes('\r\n\r\n')) {
        s.destroy();
        resolve(buf);
      }
    });
    s.on('error', () => resolve(''));
    setTimeout(() => resolve(buf), 2000);
  });
  check('WebSocket upgrade 代理成功', wsResult.startsWith('HTTP/1.1 101'), wsResult.split('\r\n')[0] ?? '');

  await gateway.stop();
  await new Promise<void>((r) => upstream.close(() => r()));
  console.log(process.exitCode ? '\nREMOTE SMOKE FAILED' : '\nREMOTE SMOKE OK');
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
