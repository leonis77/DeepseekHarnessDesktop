const PRESET = { cat: '🐱', dog: '🐶', fox: '🦊', panda: '🐼', frog: '🐸', rabbit: '🐰', tiger: '🐯', owl: '🦉' };
const FALLBACK_TIPS = ['DSH 运行中~', '摸我一下🐾', '记得喝口水💧', '今天也要加油✨', '我会一直陪着你'];
const PARTICLES = ['✨', '💖', '⭐', '🌟', '💫'];
const HAPPY = ['好开心！🎉', '再来一次！', '耶！', '哈哈哈~', '最喜欢你了💕'];

const pet = document.getElementById('pet');
const bubble = document.getElementById('bubble');

let cfg = { enabled: false, skin: 'cat', customEmoji: '', name: '', size: 1, animation: 'bob', tips: FALLBACK_TIPS };
let tips = FALLBACK_TIPS;
let svcState = 'idle';

function emoji() {
  if (cfg.customEmoji && cfg.customEmoji.trim()) return cfg.customEmoji.trim();
  return PRESET[cfg.skin] || PRESET.cat;
}

function apply(c) {
  cfg = Object.assign({}, cfg, c || {});
  tips = cfg.tips && cfg.tips.length ? cfg.tips : FALLBACK_TIPS;
  pet.textContent = emoji();
  pet.style.fontSize = Math.round(96 * (cfg.size || 1)) + 'px';
  pet.dataset.anim = cfg.animation || 'bob';
}

function randomTip() {
  return tips[Math.floor(Math.random() * tips.length)];
}

let tipTimer = null;
function showTip(text) {
  const prefix = cfg.name ? cfg.name + '：' : '';
  bubble.textContent = prefix + (text || randomTip());
  bubble.classList.remove('hidden');
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => bubble.classList.add('hidden'), 2800);
}

function bounce() {
  pet.classList.remove('bounce', 'spin');
  void pet.offsetWidth;
  pet.classList.add('bounce');
}

function spin() {
  pet.classList.remove('bounce', 'spin');
  void pet.offsetWidth;
  pet.classList.add('spin');
}

function particles(n) {
  const count = n || 5;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'particle';
    s.textContent = PARTICLES[Math.floor(Math.random() * PARTICLES.length)];
    s.style.left = 50 + (Math.random() * 50 - 25) + '%';
    s.style.top = '38%';
    s.style.setProperty('--dx', Math.round(Math.random() * 80 - 40) + 'px');
    s.style.setProperty('--dy', Math.round(-30 - Math.random() * 40) + 'px');
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

function onClick() {
  if (svcState === 'error') {
    bounce();
    showTip('别担心，重启一下就好~');
    return;
  }
  const r = Math.random();
  if (r < 0.4) bounce();
  else if (r < 0.7) spin();
  else particles();
  showTip();
}

function excited() {
  spin();
  bounce();
  particles(9);
  showTip(HAPPY[Math.floor(Math.random() * HAPPY.length)]);
}

// 拖拽 + 点击判定
let dragging = false;
let moved = false;
let sx = 0;
let sy = 0;

pet.addEventListener('mousedown', (e) => {
  dragging = true;
  moved = false;
  sx = e.screenX;
  sy = e.screenY;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - sx;
  const dy = e.screenY - sy;
  if (Math.abs(dx) + Math.abs(dy) > 5) {
    moved = true;
    window.petApi.moveBy(dx, dy);
    sx = e.screenX;
    sy = e.screenY;
  }
});
window.addEventListener('mouseup', () => {
  if (dragging && !moved) onClick();
  dragging = false;
});
pet.addEventListener('dblclick', () => excited());

// 定期冒泡 / 蹦跶
setInterval(() => {
  if (Math.random() < 0.45) showTip();
  else bounce();
}, 9000);
setTimeout(() => showTip(), 1500);

// 初始化 + 订阅配置更新
window.petApi.getConfig().then(apply);
window.petApi.onConfig(apply);

// agent 状态联动：启动中→转圈 / 停止→睡觉 / 出错→变脸
const statusEl = document.getElementById('status');
function applyServiceState(s) {
  svcState = (s && s.status) || 'idle';
  pet.classList.remove('working', 'sleeping', 'sad');
  statusEl.classList.add('hidden');
  if (svcState === 'starting') {
    pet.classList.add('working');
    statusEl.textContent = '🔄';
    statusEl.classList.remove('hidden');
  } else if (svcState === 'stopped') {
    pet.classList.add('sleeping');
    statusEl.textContent = '💤';
    statusEl.classList.remove('hidden');
  } else if (svcState === 'error') {
    pet.classList.add('sad');
    statusEl.textContent = '💢';
    statusEl.classList.remove('hidden');
  }
}
window.petApi.onServiceState(applyServiceState);

// 右键：特殊互动
pet.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  spin();
  showTip(['别乱点啦！', '痒~', '嘿嘿😝', '干嘛呢？'][Math.floor(Math.random() * 4)]);
});

document.getElementById('close').addEventListener('click', () => window.petApi.close());
