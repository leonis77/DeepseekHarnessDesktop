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
  // 上游：一个回显 HTTP 服务 + 一个 upgrade 回显 socket
  const upstream = http.createServer((req, res) => {
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
  });

  const base = `http://127.0.0.1:${gateway.port}`;

  // 1) 未认证 → 登录页（200，含表单）
  const r1 = await fetch(`${base}/`);
  check('未认证返回登录页', r1.status === 200 && (await r1.text()).includes('token'));

  // 2) 错误 token POST → 401
  const r2 = await fetch(`${base}/__auth`, { method: 'POST', body: 'token=wrong', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  check('错误 token → 401', r2.status === 401);

  // 3) 正确 ?token= → 302 + 种 cookie
  const r3 = await fetch(`${base}/?token=deadbeefcafebabe`, { redirect: 'manual' });
  const cookie = r3.headers.get('set-cookie') ?? '';
  check('?token= → 302 并种 cookie', r3.status === 302 && cookie.includes('harness_remote='));

  // 4) 带 cookie 请求 → 代理到上游
  const r4 = await fetch(`${base}/hello`, { headers: { cookie: 'harness_remote=deadbeefcafebabe' } });
  const body4 = await r4.text();
  check('带 cookie 代理成功', r4.status === 200 && body4.includes('upstream:/hello'));

  // 5) 正确 token POST → 302 到 /
  const r5 = await fetch(`${base}/__auth`, { method: 'POST', body: 'token=deadbeefcafebabe', headers: { 'content-type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });
  check('正确 token POST → 302', r5.status === 302);

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
