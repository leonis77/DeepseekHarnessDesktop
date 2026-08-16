/**
 * 手机远程访问网关（自写、零依赖）：带 token 认证的反向代理。
 * - HTTP：校验 cookie / ?token= 后，把请求转发给本机 dsh（Host 重写为 loopback，
 *   并剥离 Origin / sec-fetch-* 以通过 dsh 的 DNS-rebinding 信任栅栏）。
 * - WebSocket：同源 Cookie 校验后，原始 socket 透传 upgrade 握手与后续帧。
 * - 未认证：返回一个最小登录页，可输入 token；扫码访问时 ?token= 自动种 cookie。
 */
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import type { Duplex } from 'node:stream';
import { networkInterfaces } from 'node:os';

const COOKIE_NAME = 'harness_remote';

/**
 * 手机走的是 http://<LAN IP>（非安全上下文），浏览器不会提供 `crypto.randomUUID`
 * （该 API 仅限 HTTPS / localhost）。而 dsh 前端在发送消息时调用它，导致手机端报
 * "crypto.randomUUID is not a function"。这里在代理返回的 HTML 里注入一个 polyfill：
 * 用 `crypto.getRandomValues`（非安全上下文也可用）生成标准 v4 UUID。
 */
const RANDOM_UUID_POLYFILL =
  '<script>(function(){try{if(window.crypto&&!window.crypto.randomUUID){window.crypto.randomUUID=function(){var b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;var h="";for(var i=0;i<16;i++){h+=(b[i]<16?"0":"")+b[i].toString(16);}return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);};}}catch(e){}})();</script>';

/** 把 fragment 注入 <head>（或 <html> 之后）。 */
function injectIntoHead(html: string, fragment: string): string {
  const lower = html.toLowerCase();
  const headIdx = lower.indexOf('<head>');
  if (headIdx !== -1) {
    const at = headIdx + '<head>'.length;
    return html.slice(0, at) + fragment + html.slice(at);
  }
  const htmlIdx = lower.indexOf('<html');
  if (htmlIdx !== -1) {
    const closeIdx = html.indexOf('>', htmlIdx);
    if (closeIdx !== -1) return html.slice(0, closeIdx + 1) + fragment + html.slice(closeIdx + 1);
  }
  return fragment + html;
}

function injectUuidPolyfill(html: string): string {
  return injectIntoHead(html, RANDOM_UUID_POLYFILL);
}

/**
 * 手机响应式补丁：dsh 网页 UI 无宽度断点（CSS 类名还带构建哈希），在窄屏会横向溢出。
 * 这里注入一组「语义级」响应式规则（不依赖哈希类名，兼容 dsh 升级），改善手机观感：
 * 防横向滚动、防 iOS 聚焦缩放、放大触控目标、代码/图片/表格不撑破。
 */
const RESPONSIVE_CSS =
  '<style id="harness-mobile">html{-webkit-text-size-adjust:100%;}body,#root{overflow-x:hidden;max-width:100vw;}input,textarea,select,button{font-size:16px!important;}img,svg,video,canvas,pre,code,table{max-width:100%!important;}pre,code{white-space:pre-wrap!important;word-break:break-word!important;}button,[role="button"]{min-height:36px;}</style>';

function isMobileUA(ua: string | undefined): boolean {
  return /Android|iPhone|iPad|Mobile|Mobi|Windows Phone/i.test(ua ?? '');
}

function injectResponsive(html: string, mobile: boolean): string {
  if (!mobile) return html;
  return injectIntoHead(html, RESPONSIVE_CSS);
}

export interface RemoteGatewayOptions {
  /** 返回当前 dsh 的目标 URL（http://127.0.0.1:port/），未就绪返回 null。 */
  getTarget: () => string | null;
  token: string;
  port?: number;
  log?: (msg: string) => void;
  /** 会话/任务管理能力（注入，避免本模块直接依赖 electron）。 */
  manage?: {
    data(): { sessions: unknown[]; tasks: unknown[] };
    remove(path: string): void;
  };
}

export interface RemoteGateway {
  port: number;
  host: string;
  url: string;
  pairingCode: string; // 短期一次性配对码（扫码用，不泄露持久 token）
  regenerateCode(): string;
  stop(): Promise<void>;
}

/** 取第一个非内网 IPv4 地址（手机扫描用的 LAN 地址）。 */
export function lanAddress(): string | null {
  for (const list of Object.values(networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

/** 生成 16 位十六进制 token（64-bit，个人 LAN 网关够用）。 */
export function generateToken(): string {
  return crypto.randomBytes(8).toString('hex');
}

/** 生成 6 位数字短期配对码（扫码用，一次性）。 */
function randomPairingCode(): string {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function parseTarget(target: string): { hostname: string; port: number } {
  const u = new URL(target);
  return { hostname: u.hostname, port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80) };
}

/**
 * 从 rawHeaders 重建转发头（name/value 对），重写 Host、剥离认证与浏览器元数据。
 * upgrade 时保留 WebSocket 握手所需头（Upgrade / Connection / Sec-WebSocket-*）。
 */
function sanitizeHeaders(rawHeaders: string[], target: { hostname: string; port: number }, forUpgrade: boolean): Array<[string, string]> {
  const drop = new Set([
    'host', 'keep-alive', 'transfer-encoding', 'te', 'trailer',
    'proxy-authorization', 'proxy-connection', 'origin', 'sec-fetch-site',
    'sec-fetch-mode', 'sec-fetch-dest', 'sec-fetch-user', 'cookie',
  ]);
  if (!forUpgrade) {
    drop.add('connection');
    drop.add('upgrade');
  }
  const out: Array<[string, string]> = [];
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const name = rawHeaders[i];
    const value = rawHeaders[i + 1];
    if (name === undefined || value === undefined) continue;
    const lower = name.toLowerCase();
    if (drop.has(lower)) continue;
    // 对转发到 loopback 的上游，剥离 content-length 让 Node 按流式重新分帧
    if (!forUpgrade && lower === 'content-length') continue;
    out.push([name, value]);
  }
  out.push(['Host', `${target.hostname}:${target.port}`]);
  return out;
}

function readCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

export function startRemoteGateway(options: RemoteGatewayOptions): Promise<RemoteGateway> {
  const { getTarget, token, port = 0, manage } = options;
  const log = options.log ?? (() => {});
  const host = '0.0.0.0';
  let pairingCode = randomPairingCode();

  // 认证限流：每 IP 滑动窗口计数，超限锁定（防暴力枚举配对码/token）
  const authFails = new Map<string, { count: number; windowStart: number }>();
  const RATE_MAX = 8;
  const RATE_WINDOW_MS = 60 * 1000;
  function rateLimited(ip: string): boolean {
    const now = Date.now();
    const e = authFails.get(ip);
    if (!e) return false;
    if (now - e.windowStart > RATE_WINDOW_MS) {
      authFails.delete(ip);
      return false;
    }
    return e.count >= RATE_MAX;
  }
  function recordFail(ip: string): void {
    const now = Date.now();
    const e = authFails.get(ip);
    if (!e || now - e.windowStart > RATE_WINDOW_MS) authFails.set(ip, { count: 1, windowStart: now });
    else e.count += 1;
  }
  function clientIp(req: http.IncomingMessage): string {
    return String(req.socket.remoteAddress ?? 'unknown');
  }

  const isAuthed = (req: http.IncomingMessage): boolean => {
    return timingSafeEqual(readCookies(req.headers.cookie)[COOKIE_NAME] ?? '', token);
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const ip = clientIp(req);

    // 登录表单提交
    if (url.pathname === '/__auth' && req.method === 'POST') {
      if (rateLimited(ip)) {
        res.writeHead(429, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('尝试次数过多，请稍后再试');
        return;
      }
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const submitted = new URLSearchParams(body).get('token') ?? '';
        if (timingSafeEqual(submitted, token)) {
          authFails.delete(ip);
          res.writeHead(302, {
            location: '/',
            'set-cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`,
          });
          res.end();
        } else {
          recordFail(ip);
          serveLogin(res, true);
        }
      });
      return;
    }

    // 短期配对码放 URL（一次性）：换取持久 Cookie，不泄露持久 token
    const code = url.searchParams.get('code');
    if (code != null) {
      if (rateLimited(ip)) {
        res.writeHead(429, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('尝试次数过多，请稍后再试');
        return;
      }
      if (pairingCode && timingSafeEqual(code, pairingCode)) {
        pairingCode = ''; // 一次性消耗
        authFails.delete(ip);
        url.searchParams.delete('code');
        res.writeHead(302, {
          location: url.pathname + url.search,
          'set-cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax`,
        });
        res.end();
        return;
      }
      recordFail(ip);
      serveLogin(res, true);
      return;
    }

    if (!isAuthed(req)) {
      serveLogin(res, false);
      return;
    }

    // ── 会话 / 任务管理（手机端同步 + 删除管理）──
    if (url.pathname === '/__manage') {
      serveManageHtml(res);
      return;
    }
    if (url.pathname === '/__api/data' && manage) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(manage.data()));
      return;
    }
    if (url.pathname === '/__api/sessions/delete' && req.method === 'POST' && manage) {
      // CSRF 兜底：Origin 若存在必须同源
      const origin = req.headers.origin;
      if (origin) {
        const ohost = new URL(origin).host;
        const rhost = req.headers.host ?? '';
        if (ohost !== rhost) {
          res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
          return;
        }
      }
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}') as { path?: string };
          if (parsed.path) manage.remove(parsed.path);
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
        }
      });
      return;
    }

    const target = getTarget();
    if (!target) {
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Harness 服务尚未就绪，请稍后刷新。');
      return;
    }
    proxyHttp(req, res, target, log, url.pathname);
  });

  server.on('upgrade', (req, socket, head) => {
    if (!isAuthed(req)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\nforbidden');
      return;
    }
    const target = getTarget();
    if (!target) {
      socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\nunavailable');
      return;
    }
    proxyUpgrade(req, socket, head, target, log);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      const lan = lanAddress();
      log(`远程网关已启动：0.0.0.0:${actualPort}（LAN ${lan ?? '未知'}:${actualPort}）`);
      resolve({
        port: actualPort,
        host,
        url: `http://${lan ?? '127.0.0.1'}:${actualPort}`,
        pairingCode,
        regenerateCode: () => {
          pairingCode = randomPairingCode();
          return pairingCode;
        },
        stop: () =>
          new Promise((res) => {
            server.close(() => res());
            server.closeAllConnections();
          }),
      });
    });
  });
}

function serveLogin(res: http.ServerResponse, failed: boolean): void {
  res.writeHead(failed ? 401 : 200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Harness UI 远程访问</title><style>body{font-family:system-ui;display:flex;height:100vh;margin:0;align-items:center;justify-content:center;background:#0b0f17;color:#e5e7eb}form{background:#111827;padding:32px;border-radius:12px;box-shadow:0 10px 40px #0008}input{padding:10px;border-radius:8px;border:1px solid #374151;background:#1f2937;color:#fff;font-size:16px}button{margin-top:12px;padding:10px 18px;border:0;border-radius:8px;background:#3b82f6;color:#fff;font-size:16px;cursor:pointer}.err{color:#f87171;margin-bottom:8px}</style></head><body><form method="post" action="/__auth"><div class="err">${failed ? 'token 错误，请重试' : ''}</div><p>输入访问 token（可在桌面端「远程访问」设置中查看）</p><input name="token" autocomplete="off" placeholder="token" autofocus><br><button type="submit">进入</button></form></body></html>`);
}

/** 会话 / 任务管理页（手机端同步 + 删除）。 */
function serveManageHtml(res: http.ServerResponse): void {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>会话管理 · Harness UI</title><style>
body{font-family:system-ui;margin:0;background:#0b0f17;color:#e5e7eb;padding:12px}
h1{font-size:18px;margin:8px 0}
.tabs{display:flex;gap:6px;margin:10px 0}
.tab{flex:1;padding:8px;border:1px solid #374151;border-radius:8px;background:#111827;color:#9ca3af;text-align:center;cursor:pointer}
.tab.active{color:#fff;border-color:#3b82f6;background:#1f2937}
.card{background:#111827;border:1px solid #1f2937;border-radius:10px;padding:10px;margin:8px 0}
.title{font-weight:600;word-break:break-all}
.meta{font-size:11px;color:#6b7280;margin-top:3px}
.row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.del{border:1px solid #7f1d1d;background:#1f1a1a;color:#f87171;border-radius:7px;padding:5px 10px;cursor:pointer;flex:none}
.del:disabled{opacity:.4}
.ok{color:#22c55e;font-size:11px}
.empty{color:#6b7280;text-align:center;padding:24px 0}
a{color:#60a5fa}
</style></head><body>
<h1>会话管理</h1>
<p style="color:#6b7280;font-size:12px">与桌面端同步（读同一份 DSH 数据）。<a href="/">返回 Harness</a></p>
<div class="tabs"><div class="tab active" id="tab-sessions" onclick="show('sessions')">会话</div><div class="tab" id="tab-tasks" onclick="show('tasks')">任务</div></div>
<div id="sessions"></div><div id="tasks" style="display:none"></div>
<script>
var cache = null;
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function show(which){
  document.getElementById('tab-sessions').className='tab'+(which==='sessions'?' active':'');
  document.getElementById('tab-tasks').className='tab'+(which==='tasks'?' active':'');
  document.getElementById('sessions').style.display=which==='sessions'?'':'none';
  document.getElementById('tasks').style.display=which==='tasks'?'':'none';
}
function load(){
  fetch('/__api/data').then(function(r){return r.json()}).then(function(d){
    cache=d;
    render();
  }).catch(function(e){document.getElementById('sessions').innerHTML='<div class="empty">加载失败：'+esc(e)+'</div>'});
}
function render(){
  var s=cache.sessions||[], t=cache.tasks||[];
  var sh=document.getElementById('sessions');
  if(!s.length){sh.innerHTML='<div class="empty">暂无会话</div>';}
  else{
    sh.innerHTML=s.map(function(x){return '<div class="card"><div class="row"><div><div class="title">'+esc(x.title)+'</div><div class="meta">'+esc(x.workspace)+(x.turns>0?' · '+x.turns+' 轮':'')+' · '+esc(new Date(x.updatedAt).toLocaleString())+'</div></div><button class="del" data-path="'+esc(x.path)+'">删除</button></div></div>'}).join('');
    sh.querySelectorAll('.del').forEach(function(b){b.onclick=function(){if(confirm('删除该会话（不可恢复）？')){var btn=b;btn.disabled=true;fetch('/__api/sessions/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:btn.dataset.path})}).then(function(r){return r.json()}).then(function(){load()}).catch(function(){btn.disabled=false})}}});
  }
  var th=document.getElementById('tasks');
  if(!t.length){th.innerHTML='<div class="empty">暂无进行中的任务</div>';}
  else{
    th.innerHTML=t.map(function(x){return '<div class="card"><div class="title">'+esc(x.sessionTitle)+'</div>'+(x.goal?'<div class="meta">目标：'+esc(x.goal)+'</div>':'')+(x.todos?'<div class="meta">待办：'+esc(x.todos)+'</div>':'')+'<div class="meta">'+esc(x.workspace)+'</div></div>'}).join('');
  }
}
load();
</script></body></html>`);
}

function proxyHttp(req: http.IncomingMessage, res: http.ServerResponse, target: string, log: (msg: string) => void, logPath: string): void {
  const t = parseTarget(target);
  const headers = Object.fromEntries(sanitizeHeaders(req.rawHeaders, t, false));
  const mobile = isMobileUA(req.headers['user-agent']);
  const upstream = http.request(
    { hostname: t.hostname, port: t.port, method: req.method, path: req.url, headers },
    (upRes) => {
      const status = upRes.statusCode ?? 502;
      const contentType = String(upRes.headers['content-type'] ?? '');
      // HTML 响应注入 crypto.randomUUID polyfill（手机非安全上下文需要）
      if (contentType.includes('text/html')) {
        const chunks: Buffer[] = [];
        upRes.on('data', (c: Buffer) => chunks.push(c));
        upRes.on('end', () => {
          const body = injectResponsive(injectUuidPolyfill(Buffer.concat(chunks).toString('utf8')), mobile);
          const outHeaders = { ...upRes.headers };
          delete outHeaders['content-length'];
          delete outHeaders['content-encoding'];
          delete outHeaders['transfer-encoding'];
          res.writeHead(status, outHeaders);
          res.end(body);
        });
        upRes.on('error', () => {
          if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('upstream error');
        });
        return;
      }
      res.writeHead(status, upRes.headers);
      upRes.pipe(res);
    }
  );
  upstream.on('error', (e) => {
    log(`远程网关上游错误（${logPath}）：${e.message}`);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('upstream error');
  });
  req.pipe(upstream);
}

function proxyUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer, target: string, log: (msg: string) => void): void {
  const t = parseTarget(target);
  const pairs = sanitizeHeaders(req.rawHeaders, t, true);
  const headText = pairs.map(([n, v]) => `${n}: ${v}`).join('\r\n');
  const upstream = net.connect(t.port, t.hostname, () => {
    upstream.write(`GET ${req.url} HTTP/1.1\r\n${headText}\r\n\r\n`);
    if (head && head.length > 0) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
  const fail = (e: Error): void => {
    log(`远程网关 WebSocket 上游错误：${e.message}`);
    socket.destroy();
    upstream.destroy();
  };
  upstream.on('error', fail);
  socket.on('error', fail);
  socket.on('close', () => upstream.destroy());
  upstream.on('close', () => socket.destroy());
}
