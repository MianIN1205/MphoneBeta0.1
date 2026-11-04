// 眠花糖机 — 桌宠：桌面「桌宠」app 是个小窝，里面可以养好几只（像素小动物自己捏，或者用一张 Q 版图片当 TA 的代表），
// 想放出去的会在屏幕上自己爬来爬去，时不时跳舞、玩电脑、看书、伸懒腰（点一下摸摸，按住拖着走，没人理会打盹）。说的话里可以写 {{user}} / {{char}}

// =============================================
// 数据：mphone_pet = { follow, pets: [{ id, name, kind, color, eye, acc, img, charId, words, out }] }
// =============================================
var PET_KINDS = [['crab', '螃蟹'], ['blob', '团子'], ['cat', '小猫'], ['bear', '小熊'], ['bunny', '小兔'], ['img', '用图片']];
var PET_EYES = [['bean', '豆豆眼'], ['round', '圆眼睛'], ['line', '眯眯眼']];
var PET_ACCS = [['none', '没有'], ['blush', '腮红'], ['bow', '蝴蝶结'], ['flower', '小花'], ['sprout', '小芽']];
var PET_COLORS = ['#D97757', '#f3a6b8', '#9ec3e6', '#f6d77a', '#b9a6e0', '#9fd3b0', '#c9a58a', '#8f8a99'];
var PET_WORDS = ['{{user}}～', '抱抱', '在呢', '嘿嘿', '陪着你', '摸摸', '♥', '一起玩'];
var PET_WAKE = ['唔…', '醒啦', '{{user}}来啦'];
var PET_DEFAULT = { id: 'crab', name: '小螃蟹', kind: 'crab', color: '#D97757', eye: 'bean', acc: 'none', img: '', charId: '', words: '', out: true };

var petCfg = (function() {
  var c = mphoneStore.load('mphone_pet', {}) || {};
  if (!Array.isArray(c.pets)) {   // 第一版只有一只小螃蟹和开关 on
    c.pets = [Object.assign({}, PET_DEFAULT, { out: c.on !== false })];
    delete c.on;
  }
  c.follow = !!c.follow;
  return c;
})();
function savePetCfg() { mphoneStore.save('mphone_pet', petCfg); }
function petChar(p) {
  if (!p.charId || typeof charList === 'undefined') return null;
  for (var i = 0; i < charList.length; i++) if (charList[i] && String(charList[i].id) === String(p.charId)) return charList[i];
  return null;
}
// 叫你的名字：关联了角色就用那个角色那边你的名字，没关联用主账号的名字
function petFill(text, p) {
  var ch = petChar(p), user = '';
  try { user = (ch ? resolveCharAccount(ch) : getMainAccount()).nickname || ''; } catch (_) {}
  return String(text).replace(/\{\{\s*user\s*\}\}/gi, user || '你')
    .replace(/\{\{\s*char\s*\}\}/gi, (ch && (ch.charAlias || ch.charName)) || p.name || '我');
}
function petWordList(p, waking) {
  var own = String(p.words || '').split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
  return own.length ? own : (waking ? PET_WAKE : PET_WORDS);
}

// =============================================
// 样子：像素小动物（24×24 的格子，上面留了 2 格放耳朵）或者一张图片
// 拆成会动的几块：每条腿（pet-leg）、身子（pet-top，里面有钳子 / 小爪 pet-arm、眼睛 pet-eyes、小尾巴 pet-tail），
// 每一帧在 Pet.frame 里算位置，所以能做出蹲下、弹起、甩钳子、腿乱蹬这些
// =============================================
function petShade(hex, k) {
  var n = parseInt(String(hex || '#D97757').replace('#', ''), 16);
  if (isNaN(n)) n = 0xD97757;
  var f = function(v) { return Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); };
  return 'rgb(' + f(n >> 16 & 255) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')';
}
function petR(x, y, w, h, fill, cls, rx) {
  return '<rect' + (cls ? ' class="' + cls + '"' : '') + ' x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' + (rx ? ' rx="' + rx + '"' : '') + ' fill="' + fill + '"/>';
}
// 每种的零件：legs = [[x, y, w, h, rx]]，arms = 左右两只 [x, y, w, h, rx, 肩膀 x, 肩膀 y]，eyes = 两只眼睛的 x，ey = 眼睛的 y
function petParts(p) {
  var c = p.color || '#D97757', d = petShade(c, -0.22), kind = p.kind || 'crab';
  if (kind === 'crab') return { c: c, legC: c, legs: [[4, 16, 2, 4], [7, 16, 2, 4], [15, 16, 2, 4], [18, 16, 2, 4]],
    body: petR(3, 7, 18, 10, c), arms: [[0, 10, 3, 3, 0, 3, 11.5], [21, 10, 3, 3, 0, 21, 11.5]], eyes: [7, 15], ey: 9 };
  if (kind === 'blob') return { c: c, legC: d, legs: [[6, 16, 3, 3, 1], [15, 16, 3, 3, 1]],
    body: petR(3, 7, 18, 11, c, '', 4), arms: [[1.2, 12, 2.6, 2.2, 1, 3.6, 13], [20.2, 12, 2.6, 2.2, 1, 20.4, 13]], eyes: [8, 14], ey: 10 };
  if (kind === 'cat') return { c: c, legC: c, legs: [[6, 16, 2, 4], [9, 16, 2, 4], [14, 16, 2, 4], [17, 16, 2, 4]],
    tail: '<path d="M19.5 14 h2.5 v-5 h2 v7 h-4.5 z" fill="' + d + '"/>', tailPivot: [20, 15],
    body: '<path d="M4 9 L5 3 L10 7 L14 7 L19 3 L20 9 Z" fill="' + c + '"/>' + petR(4, 7, 16, 10, c, '', 1) +
          '<path d="M6 7 L6.4 5 L8.2 6.6 Z" fill="' + d + '"/><path d="M18 7 L17.6 5 L15.8 6.6 Z" fill="' + d + '"/>',
    arms: [[2.2, 12, 2.4, 2, 0.8, 4.4, 13], [19.4, 12, 2.4, 2, 0.8, 19.6, 13]], eyes: [8, 14], ey: 10 };
  if (kind === 'bear') return { c: c, legC: c, legs: [[5.5, 16, 2.5, 4], [8.5, 16, 2.5, 4], [13, 16, 2.5, 4], [16, 16, 2.5, 4]],
    body: '<circle cx="6" cy="7" r="2.6" fill="' + c + '"/><circle cx="18" cy="7" r="2.6" fill="' + c + '"/>' +
          '<circle cx="6" cy="7" r="1.2" fill="' + d + '"/><circle cx="18" cy="7" r="1.2" fill="' + d + '"/>' +
          petR(4, 6, 16, 11, c, '', 3) + petR(9.5, 12, 5, 3, petShade(c, 0.45), '', 1.2) + petR(11.3, 12.3, 1.4, 1, '#2a2422'),
    arms: [[2.2, 11.5, 2.4, 2.4, 1, 4.4, 12.7], [19.4, 11.5, 2.4, 2.4, 1, 19.6, 12.7]], eyes: [8, 14], ey: 10 };
  // bunny
  return { c: c, legC: c, legs: [[6, 16, 3, 3, 1], [15, 16, 3, 3, 1]],
    body: petR(6.5, -1, 3, 10, c, '', 1.5) + petR(14.5, -1, 3, 10, c, '', 1.5) +
          petR(7.5, 0.5, 1, 6, '#f6b4c4') + petR(15.5, 0.5, 1, 6, '#f6b4c4') + petR(4, 7, 16, 11, c, '', 4),
    arms: [[2.4, 12, 2.4, 2.2, 1, 4.6, 13], [19.2, 12, 2.4, 2.2, 1, 19.4, 13]], eyes: [8, 14], ey: 10 };
}
function petSvg(p) {
  var P = petParts(p), ink = '#2a2422', eye = p.eye || 'bean';
  var legs = P.legs.map(function(l) { return '<g class="pet-leg">' + petR(l[0], l[1], l[2], l[3], P.legC, '', l[4]) + '</g>'; }).join('');
  var arms = P.arms.map(function(a, i) {
    return '<g class="pet-arm" data-px="' + a[5] + '" data-py="' + a[6] + '" data-side="' + (i ? 1 : -1) + '">' + petR(a[0], a[1], a[2], a[3], P.c, '', a[4]) + '</g>';
  }).join('');
  var eyeSvg = '';
  P.eyes.forEach(function(x) {
    if (eye === 'round') eyeSvg += '<rect x="' + x + '" y="' + P.ey + '" width="2.2" height="2.4" rx="1.1" fill="' + ink + '"/><rect x="' + (x + 1.2) + '" y="' + (P.ey + 0.4) + '" width="0.7" height="0.7" fill="#fff"/>';
    else if (eye === 'line') eyeSvg += petR(x - 0.5, P.ey + 1.2, 3, 1, ink);
    else eyeSvg += petR(x, P.ey, 2, 3, ink);
  });
  var acc = '', a = p.acc || 'none', ex = P.eyes, ey = P.ey;
  if (a === 'blush') acc = petR(ex[0] - 1.5, ey + 3.4, 2.5, 1.2, '#f39bb0', '', 0.6) + petR(ex[1] + 1, ey + 3.4, 2.5, 1.2, '#f39bb0', '', 0.6);
  else if (a === 'bow') acc = '<path d="M15 5 L18 3.2 L18 7.8 Z M21 5 L18 3.2 L18 7.8 Z" fill="#f08aa6" transform="translate(-0.5 1)"/><rect x="17" y="5" width="1.6" height="1.6" fill="#d9607e" transform="translate(-0.5 0.2)"/>';
  else if (a === 'flower') acc = '<g transform="translate(17.5 6.2)"><circle cx="0" cy="-1.3" r="1.1" fill="#fff"/><circle cx="1.3" cy="0" r="1.1" fill="#fff"/><circle cx="0" cy="1.3" r="1.1" fill="#fff"/><circle cx="-1.3" cy="0" r="1.1" fill="#fff"/><circle r="0.8" fill="#f6c94a"/></g>';
  else if (a === 'sprout') acc = '<path d="M12 7 V3.6" stroke="#6bb67e" stroke-width="0.9"/><path d="M12 4.6 C10 4.6 9.2 3.2 9.4 2.2 C11 2.2 12 3.2 12 4.6 Z M12 4 C13.6 4 14.8 2.8 14.6 1.6 C13 1.6 12 2.6 12 4 Z" fill="#7cc48e"/>';
  return '<svg class="pet-svg" viewBox="0 -2 24 24" aria-hidden="true">' +
    (P.tail ? '<g class="pet-tail" data-px="' + P.tailPivot[0] + '" data-py="' + P.tailPivot[1] + '">' + P.tail + '</g>' : '') + legs +
    '<g class="pet-top">' + arms + P.body + '<g class="pet-eyes" data-cy="' + (ey + 1.5) + '">' + eyeSvg + '</g>' + acc + '</g></svg>';
}
function petLook(p) {
  if (p.kind === 'img') return p.img ? '<img class="pet-img" alt="" draggable="false" src="' + String(p.img).replace(/"/g, '&quot;') + '">' : petSvg(Object.assign({}, p, { kind: 'blob' }));
  return petSvg(p);
}

// =============================================
// 动作：跳舞、玩电脑、看书、伸懒腰（还有走路、东张西望、发呆、睡觉）。道具画在和身子一样的格子里，盖在前面
// =============================================
var PET_ACTS = { dance: [4000, 3000], pc: [10000, 15000], book: [10000, 15000], stretch: [1700, 0] };
var PET_PROPS = {
  pc: '<rect class="pc-glow" x="5.5" y="12.6" width="13" height="0.9" fill="#bfe3ff"/>' +
      '<rect x="4.5" y="13.5" width="15" height="7" rx="1" fill="#d6d9e2" stroke="#a9aebb" stroke-width="0.6"/>' +
      '<path d="M12 18.2 l-1.4 -1.4 a0.8 0.8 0 0 1 1.4 -1 a0.8 0.8 0 0 1 1.4 1 z" fill="#f08aa6"/>' +
      '<rect x="3" y="20.3" width="18" height="1" rx="0.5" fill="#a9aebb"/>',
  book: '<g transform="translate(0 1.4)"><rect x="5" y="13" width="14" height="7.2" rx="0.8" fill="#e8737f"/>' +
        '<rect x="5.8" y="12.4" width="6" height="7" fill="#fffaf2"/><rect x="12.2" y="12.4" width="6" height="7" fill="#fffaf2"/>' +
        '<rect x="11.8" y="12.4" width="0.4" height="7.2" fill="#d9c9b8"/>' +
        '<g fill="#e3d6c8"><rect x="6.6" y="14" width="4.2" height="0.5"/><rect x="6.6" y="15.4" width="4.2" height="0.5"/><rect x="6.6" y="16.8" width="3" height="0.5"/>' +
        '<rect x="13" y="14" width="4.2" height="0.5"/><rect x="13" y="15.4" width="4.2" height="0.5"/><rect x="13" y="16.8" width="3.4" height="0.5"/></g></g>'
};
// 四条腿错开抬（像小碎步），两条腿的一左一右
var PET_LEG_PHASE = { 4: [0, Math.PI, Math.PI / 2, Math.PI * 1.5], 2: [0, Math.PI] };

// =============================================
// 一只会动的宠物：box 是它能走动的地方；opt = { size, top, bottom }
// 动起来的部分全在 frame 里按时间算：身子的压扁 / 拉长 / 摇摆（pet-inner）、腿、钳子、眼睛、尾巴
// =============================================
function Pet(box, data, opt) {
  var self = this;
  this.box = box; this.opt = opt; this.data = data;
  this.w = opt.size; this.h = opt.size;
  var el = this.el = document.createElement('div');
  el.className = 'pet';
  el.style.width = this.w + 'px'; el.style.height = this.h + 'px';
  el.innerHTML = '<div class="pet-inner"></div><div class="pet-say"></div>';
  box.appendChild(el);
  this.inner = el.firstChild;
  this.say = el.querySelector('.pet-say');
  this.state = 'idle'; this.until = 0; this.since = Date.now();
  this.setData(data);
  this.x = -1; this.y = -1; this.tx = 0; this.ty = 0; this.v = 0; this.maxV = 34; this.dir = 1;
  this.phase = 0; this.rot = 0; this.rotV = 0; this.eyeX = 0; this.eyeY = 0; this.eyeTX = 0; this.eyeTY = 0;
  this.fx = null;          // 一次性的动作：hop 跳一下、land 落地、wave 挥手
  this.dragV = 0;          // 拖着走时手指的横向速度（身子跟着晃）
  this.lastTouch = Date.now(); this.last = 0; this.running = false;
  this.blinkAt = Date.now() + 1000 + Math.random() * 3000; this.blinkT = 0; this.blink2 = false;
  this.bindPointer();
  this.tick = function(t) { self.frame(t); };
}
Pet.prototype.setData = function(p) {
  this.data = p;
  this.inner.innerHTML = petLook(p) + '<svg class="pet-prop" viewBox="0 -2 24 24" aria-hidden="true">' + (PET_PROPS[this.state] || '') + '</svg><span class="pet-z">z</span>' +
    '<span class="pet-mail" aria-hidden="true"><svg viewBox="0 0 24 18"><rect x="1" y="1" width="22" height="16" rx="3" fill="#fff" stroke="#e8879f" stroke-width="1.6"/><path d="M2 3 L12 10.5 L22 3" fill="none" stroke="#e8879f" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="11" r="2.2" fill="#f08aa6"/></svg></span>';
  this.prop = this.inner.querySelector('.pet-prop');
  var q = function(s) { return this.inner.querySelectorAll(s); }.bind(this);
  this.legs = Array.prototype.slice.call(q('.pet-leg'));
  this.arms = Array.prototype.slice.call(q('.pet-arm'));
  this.top = this.inner.querySelector('.pet-top');
  this.eyes = this.inner.querySelector('.pet-eyes');
  this.tail = this.inner.querySelector('.pet-tail');
  this.el.classList.toggle('is-img', p.kind === 'img' && !!p.img);
};
Pet.prototype.area = function() {
  var bw = this.box.clientWidth, bh = this.box.clientHeight, m = 6;
  return { x0: m, x1: Math.max(m, bw - this.w - m), y0: this.opt.top || m, y1: Math.max(this.opt.top || m, bh - this.h - (this.opt.bottom || m)) };
};
Pet.prototype.place = function() {
  this.el.style.transform = 'translate3d(' + Math.round(this.x) + 'px,' + Math.round(this.y) + 'px,0)';
};
Pet.prototype.set = function(state, ms) {
  var el = this.el;
  ['walk', 'sleep', 'act-dance', 'act-pc', 'act-book', 'act-stretch'].forEach(function(c) { el.classList.remove(c); });
  this.state = state;
  this.since = Date.now();
  this.until = Date.now() + (ms || 0);
  if (state === 'walk' || state === 'sleep') el.classList.add(state);
  if (PET_ACTS[state]) el.classList.add('act-' + state);   // 加前缀：.book 之类会和书架的样式撞
  if (this.prop) this.prop.innerHTML = PET_PROPS[state] || '';
  // 东张西望：眼睛看向一边，脑袋跟着歪一点
  if (state === 'look') { var k = Math.floor(Math.random() * 3); this.eyeTX = [-1, 1, 0][k]; this.eyeTY = [0, 0, -0.9][k]; this.tilt = [-5, 5, 0][k]; }
  else this.tilt = 0;
};
Pet.prototype.act = function(name) {
  this.lastTouch = Date.now();
  if (name === 'sleep') { this.set('sleep', 20000 + Math.random() * 30000); return; }
  var a = PET_ACTS[name];
  if (a) this.set(name, a[0] + Math.random() * a[1]);
};
Pet.prototype.float = function(text, cls) {
  var s = document.createElement('span');
  s.className = cls; s.textContent = text;
  this.inner.appendChild(s);
  setTimeout(function() { s.remove(); }, 1300);
};
// 想想接下来干什么：多半是走到附近一个地方，有时东张西望、发会儿呆、跳舞、玩电脑、看书、伸懒腰，久没人理（或者夜里）就打个盹
Pet.prototype.decide = function() {
  var a = this.area(), r = Math.random(), h = new Date().getHours();
  var sleepy = (h >= 23 || h < 6) ? 0.25 : (Date.now() - this.lastTouch > 90000 ? 0.12 : 0.04);
  if (r < sleepy) { this.set('sleep', 18000 + Math.random() * 40000); return; }
  if (r < sleepy + 0.14) { this.set('look', 1200 + Math.random() * 1600); return; }
  if (r < sleepy + 0.26) { this.set('idle', 1500 + Math.random() * 3000); return; }
  if (r < sleepy + 0.33) { this.act('dance'); return; }
  if (r < sleepy + 0.40) { this.act('pc'); return; }
  if (r < sleepy + 0.46) { this.act('book'); return; }
  if (r < sleepy + 0.50) { this.act('stretch'); return; }
  var ang = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 130;
  this.tx = Math.min(a.x1, Math.max(a.x0, this.x + Math.cos(ang) * dist));
  this.ty = Math.min(a.y1, Math.max(a.y0, this.y + Math.sin(ang) * dist * 0.7));
  this.maxV = 24 + Math.random() * 26;   // 有时慢慢晃，有时小跑
  this.v = 0;
  this.set('walk', 15000);
};
Pet.prototype.frame = function(t) {
  if (!this.running) return;
  requestAnimationFrame(this.tick);
  if (document.hidden || !this.box.clientWidth) { this.last = t; return; }
  var dt = Math.min(0.05, this.last ? (t - this.last) / 1000 : 0);
  this.last = t;
  var a = this.area(), now = Date.now();
  if (this.x < 0) {   // 第一次出现：随便找个地方
    this.x = a.x0 + Math.random() * (a.x1 - a.x0);
    this.y = a.y0 + (0.45 + Math.random() * 0.5) * (a.y1 - a.y0);
  }
  if (this.state !== 'drag') {   // 屏幕大小变了也别跑出去
    this.x = Math.min(a.x1, Math.max(a.x0, this.x));
    this.y = Math.min(a.y1, Math.max(a.y0, this.y));
  }
  if (this.state === 'walk') {
    // 起步慢慢加速，快到了慢下来
    var dx = this.tx - this.x, dy = this.ty - this.y, d = Math.sqrt(dx * dx + dy * dy);
    this.v += (Math.min(this.maxV, 10 + d * 2.2) - this.v) * Math.min(1, dt * 5);
    var step = this.v * dt;
    if (Math.abs(dx) > 1) this.dir = dx < 0 ? -1 : 1;
    if (d <= Math.max(step, 0.6) || now > this.until) { this.x = this.tx; this.y = this.ty; this.v = 0; this.set('idle', 800 + Math.random() * 2500); }
    else { this.x += dx / d * step; this.y += dy / d * step; }
  } else if (this.state !== 'drag' && now > this.until) {
    if (this.state === 'sleep') { this.set('idle', 1500); this.talk(true); this.fx = { type: 'hop', t0: now }; }
    else this.decide();
  }
  if (this.state === 'dance') {
    if (!(now < this.noteAt)) { this.float(Math.random() < 0.5 ? '♪' : '♫', 'pet-note' + (Math.random() < 0.5 ? ' r' : '')); this.noteAt = now + 600 + Math.random() * 500; }
  }
  this.pose(t / 1000, dt, now);
  this.place();
};
// 摆姿势：每一帧按状态算出身子、腿、钳子、眼睛的位置
Pet.prototype.pose = function(s, dt, now) {
  var st = this.state, el = this.since ? (now - this.since) / 1000 : 0;
  var ix = 0, iy = 0, sx = 1, sy = 1, rotT = this.tilt || 0, bodyY = 0, armL = 4 * Math.sin(s * 2), armR = 4 * Math.sin(s * 2 + 1);
  var legLift = [0, 0, 0, 0], legX = [0, 0, 0, 0], legY = 0, eyeS = 1, eyeTX = this.eyeTX, eyeTY = this.eyeTY, tail = 10 * Math.sin(s * 2.2);
  var walking = st === 'walk' && this.v > 2, stepHz = 0;
  if (walking) stepHz = 1.2 + this.v / 14;
  if (st === 'dance' || st === 'drag') stepHz = st === 'drag' ? 5 : 3.4;
  this.phase += dt * Math.PI * 2 * stepHz;
  var ph = PET_LEG_PHASE[this.legs.length] || PET_LEG_PHASE[4];
  // 平时：轻轻呼吸
  sy = 1 + 0.022 * Math.sin(s * 2.4); sx = 1 - 0.012 * Math.sin(s * 2.4);
  if (st === 'idle' || st === 'look') { eyeTX = st === 'look' ? this.eyeTX : 0.35 * Math.sin(s * 0.7); eyeTY = st === 'look' ? this.eyeTY : 0; }
  if (walking) {
    for (var i = 0; i < this.legs.length; i++) { var w = this.phase + ph[i]; legLift[i] = Math.max(0, Math.sin(w)) * 1.5; legX[i] = Math.cos(w) * 0.5 * this.dir; }
    bodyY = -0.45 * Math.abs(Math.sin(this.phase));
    rotT = this.dir * Math.min(5, this.v / 8);
    armL = 10 * Math.sin(this.phase); armR = 10 * Math.sin(this.phase + Math.PI);
    eyeTX = this.dir * 0.9; eyeTY = 0;
    tail = 18 * Math.sin(this.phase);
  }
  if (st === 'dance') {
    var b = s * 7;
    rotT = 10 * Math.sin(b); iy = -Math.abs(Math.sin(b)) * this.h * 0.09;
    sy = 1 + 0.06 * Math.cos(b * 2); sx = 1 - 0.04 * Math.cos(b * 2);
    armL = 38 + 28 * Math.sin(b); armR = 38 + 28 * Math.sin(b + Math.PI);
    for (var j = 0; j < this.legs.length; j++) legLift[j] = Math.max(0, Math.sin(this.phase + ph[j])) * 1.4;
    eyeTX = 0.6 * Math.sin(b); tail = 25 * Math.sin(b);
  }
  if (st === 'pc') {
    var k1 = Math.max(0, Math.sin(s * 19)), k2 = Math.max(0, Math.sin(s * 19 + Math.PI));
    armL = 6 + 10 * k1; armR = 6 + 10 * k2; bodyY = 0.25 * (k1 + k2); eyeTY = 0.6; eyeTX = 0.3 * Math.sin(s * 0.9);
  }
  if (st === 'book') { armL = armR = 22; rotT = 2 * Math.sin(s * 0.8); eyeTY = 1.1; eyeTX = 0.6 * Math.sin(s * 1.3); eyeS = 0.7; }
  if (st === 'stretch') {
    var p = Math.sin(Math.min(1, el / 1.6) * Math.PI);
    sy = 1 + 0.15 * p; sx = 1 - 0.07 * p; armL = armR = 75 * p; if (p > 0.3) eyeS = 0.15;
  }
  if (st === 'sleep') {
    bodyY = 2.6 + 0.35 * Math.sin(s * 1.4); legY = -1; armL = armR = -8; eyeS = 0.15; eyeTY = 1; eyeTX = 0;
    sy = 1 + 0.03 * Math.sin(s * 1.4); sx = 1 + 0.02; tail = 4 * Math.sin(s * 0.8);
  }
  if (st === 'drag') {
    // 拎在手里：腿乱蹬，钳子乱挥，身子跟着手指晃，眼睛往下看
    for (var m = 0; m < this.legs.length; m++) { legLift[m] = -1 - 0.8 * Math.max(0, Math.sin(this.phase + ph[m])); legX[m] = 0.6 * Math.sin(this.phase * 1.3 + m); }
    armL = 35 + 20 * Math.sin(s * 15); armR = 35 + 20 * Math.sin(s * 15 + 2);
    rotT = Math.max(-28, Math.min(28, -this.dragV * 0.06)); eyeTY = 0.8; eyeTX = 0; sy = 1.04; sx = 0.97;
    this.dragV *= Math.pow(0.02, dt);
    tail = 30 * Math.sin(s * 9);
  }
  // 一次性的动作：跳一下（先蹲、再弹起、落地压扁）、落地、挥手
  var fx = this.fx;
  if (fx) {
    var k = (now - fx.t0) / 1000, h = this.h;
    if (fx.type === 'hop') {
      if (k < 0.09) { var q = k / 0.09; sy = 1 - 0.18 * q; sx = 1 + 0.12 * q; }
      else if (k < 0.37) { var q2 = (k - 0.09) / 0.28; iy = -Math.sin(q2 * Math.PI) * h * 0.42; sy = 1.1 - 0.1 * q2; sx = 0.93 + 0.07 * q2; legY = 0.6; armL = armR = 40; }
      else if (k < 0.6) { var q3 = (k - 0.37) / 0.23; sy = 1 - 0.16 * Math.cos(q3 * Math.PI / 2) * (1 - q3) + 0.04 * Math.sin(q3 * Math.PI); sx = 1 + 0.12 * (1 - q3); }
      else this.fx = null;
    } else if (fx.type === 'land') {
      if (k < 0.3) { var q4 = k / 0.3; sy = 1 - 0.18 * (1 - q4) + 0.05 * Math.sin(q4 * Math.PI); sx = 1 + 0.12 * (1 - q4); }
      else this.fx = null;
    } else if (fx.type === 'wave') {
      if (k < 1.1) armR = 60 + 28 * Math.sin(k * 16);
      else this.fx = null;
    }
  }
  // 身子的摇摆用弹簧（甩一下会晃两下才停）
  var acc = (rotT - this.rot) * 90 - this.rotV * 11;
  this.rotV += acc * dt; this.rot += this.rotV * dt;
  // 眨眼（有时连眨两下）
  if (st !== 'sleep' && now > this.blinkAt) { this.blinkT = now; this.blink2 = Math.random() < 0.25; this.blinkAt = now + 2500 + Math.random() * 4000; }
  var bk = now - this.blinkT;
  if (bk < 120 || (this.blink2 && bk > 220 && bk < 340)) eyeS = Math.min(eyeS, 0.12);
  this.eyeX += (eyeTX - this.eyeX) * Math.min(1, dt * 10);
  this.eyeY += (eyeTY - this.eyeY) * Math.min(1, dt * 10);

  this.inner.style.transform = 'translate(' + ix.toFixed(2) + 'px,' + iy.toFixed(2) + 'px) rotate(' + this.rot.toFixed(2) + 'deg) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
  if (this.top) this.top.setAttribute('transform', 'translate(0 ' + bodyY.toFixed(2) + ')');
  for (var n = 0; n < this.legs.length; n++) this.legs[n].setAttribute('transform', 'translate(' + legX[n].toFixed(2) + ' ' + (legY - legLift[n]).toFixed(2) + ')');
  for (var r = 0; r < this.arms.length; r++) {
    var g = this.arms[r], side = +g.getAttribute('data-side'), ang = (side < 0 ? armL : -armR);
    g.setAttribute('transform', 'rotate(' + ang.toFixed(1) + ' ' + g.getAttribute('data-px') + ' ' + g.getAttribute('data-py') + ')');
  }
  if (this.eyes) {
    var cy = +this.eyes.getAttribute('data-cy');
    this.eyes.setAttribute('transform', 'translate(' + this.eyeX.toFixed(2) + ' ' + (this.eyeY + cy).toFixed(2) + ') scale(1 ' + eyeS.toFixed(2) + ') translate(0 ' + (-cy) + ')');
  }
  if (this.tail) this.tail.setAttribute('transform', 'rotate(' + tail.toFixed(1) + ' ' + this.tail.getAttribute('data-px') + ' ' + this.tail.getAttribute('data-py') + ')');
};
Pet.prototype.start = function() { if (this.running) return; this.running = true; this.last = 0; requestAnimationFrame(this.tick); };
Pet.prototype.stop = function() { this.running = false; };
Pet.prototype.remove = function() { this.stop(); this.el.remove(); };
Pet.prototype.talk = function(waking) {
  var s = this.say, list = petWordList(this.data, waking);
  s.textContent = petFill(list[Math.floor(Math.random() * list.length)], this.data);
  s.classList.add('show');
  clearTimeout(this._sayT);
  this._sayT = setTimeout(function() { s.classList.remove('show'); }, 1800);
};
// 摸一下：蹲一下跳起来、挥挥钳子、冒个小爱心，有时候说句话；睡着的被摸醒（揉揉眼睛跳起来）
Pet.prototype.pat = function() {
  var now = Date.now();
  this.lastTouch = now;
  // 头上顶着小信封（关联的角色有没看的消息）：点一下直接打开和 TA 的聊天
  if (this.el.classList.contains('has-mail') && this.data.charId && typeof openFromNotification === 'function') {
    this.fx = { type: 'hop', t0: now };
    openFromNotification({ open: 'chat', charId: this.data.charId });
    return;
  }
  if (this.state === 'sleep') { this.set('idle', 2000); this.talk(true); this.fx = { type: 'hop', t0: now }; return; }
  this.set('idle', 1800);
  this.fx = Math.random() < 0.6 ? { type: 'hop', t0: now } : { type: 'wave', t0: now };
  var heart = document.createElement('span');
  heart.className = 'pet-heart'; heart.textContent = '♥';
  this.inner.appendChild(heart);
  setTimeout(function() { heart.remove(); }, 950);
  if (Math.random() < 0.6) this.talk(false);
};
// 点一下 = 摸摸；按住拖动 = 拎着走（腿乱蹬、身子跟着晃，放下时落地压一下）
Pet.prototype.bindPointer = function() {
  var self = this, el = this.el, down = null;
  el.addEventListener('pointerdown', function(e) {
    e.stopPropagation();
    var r = self.box.getBoundingClientRect(), k = r.width / (self.box.offsetWidth || r.width) || 1;   // 带边框模式整个小手机是缩放过的
    down = { px: e.clientX, py: e.clientY, x: self.x, y: self.y, k: k, moved: false, lx: e.clientX, lt: performance.now() };
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  });
  el.addEventListener('pointermove', function(e) {
    if (!down) return;
    var dx = (e.clientX - down.px) / down.k, dy = (e.clientY - down.py) / down.k;
    if (!down.moved && dx * dx + dy * dy < 36) return;
    if (!down.moved) { down.moved = true; self.set('drag'); el.classList.add('drag'); self.lastTouch = Date.now(); self.fx = null; }
    var tnow = performance.now(), dtm = Math.max(8, tnow - down.lt);
    self.dragV = self.dragV * 0.6 + ((e.clientX - down.lx) / down.k / dtm * 1000) * 0.4;
    down.lx = e.clientX; down.lt = tnow;
    var a = self.area();
    self.x = Math.min(a.x1, Math.max(a.x0, down.x + dx));
    self.y = Math.min(a.y1, Math.max(a.y0, down.y + dy));
    self.place();
  });
  var end = function() {
    if (!down) return;
    var moved = down.moved;
    down = null;
    el.classList.remove('drag');
    if (moved) { self.set('idle', 1200 + Math.random() * 1500); self.fx = { type: 'land', t0: Date.now() }; self.dragV = 0; self.rot *= 0.3; self.rotV = 0; }
    else self.pat();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('contextmenu', function(e) { e.preventDefault(); });
};

// 一群宠物放在一个地方：按数据增删，已经在的不动位置
function PetGroup(box, opt, pick) {
  this.box = box; this.opt = opt; this.pick = pick; this.map = {}; this.running = false;
}
PetGroup.prototype.sync = function() {
  var self = this, keep = {};
  petCfg.pets.filter(this.pick).forEach(function(p) {
    keep[p.id] = true;
    if (self.map[p.id]) self.map[p.id].setData(p);
    else { self.map[p.id] = new Pet(self.box, p, self.opt); if (self.running) self.map[p.id].start(); }
  });
  Object.keys(this.map).forEach(function(id) { if (!keep[id]) { self.map[id].remove(); delete self.map[id]; } });
};
PetGroup.prototype.run = function(on) {
  var self = this;
  if (on === this.running) return;
  this.running = on;
  Object.keys(this.map).forEach(function(id) { on ? self.map[id].start() : self.map[id].stop(); });
};

// =============================================
// 屏幕上的：只在桌面（被别的界面盖住就藏起来、停下），开了「也跟着」时到哪都在
// =============================================
var petLayer = document.createElement('div');
petLayer.className = 'pet-layer';
document.querySelector('.phone').appendChild(petLayer);
var screenPets = new PetGroup(petLayer, { size: 40, top: 46, bottom: 14 }, function(p) { return p.out; });
var homePets = new PetGroup(document.getElementById('petHome'), { size: 60, top: 64, bottom: 18 }, function() { return true; });
var appPet = document.getElementById('appPet');
// 桌宠认人：关联的角色发来了还没看的消息，桌宠头上冒一个小信封（点一下打开聊天）
function petMailSync(group) {
  Object.keys(group.map).forEach(function(id) {
    var pet = group.map[id], cid = pet.data.charId;
    pet.el.classList.toggle('has-mail', !!(cid && typeof chatUnread !== 'undefined' && chatUnread[cid]));
  });
}
function petRefresh() {
  petMailSync(screenPets);
  petMailSync(homePets);
  var covered = !!document.querySelector('.app-screen.active, .settings-screen.active');
  var show = !appPet.classList.contains('active') && (petCfg.follow || !covered) && petCfg.pets.some(function(p) { return p.out; });
  petLayer.classList.toggle('follow', petCfg.follow);
  petLayer.classList.toggle('off', !show);
  screenPets.run(show);
}
function petSyncAll() { screenPets.sync(); homePets.sync(); renderPetList(); petRefresh(); }

// =============================================
// 「桌宠」app：小窝、宠物列表、跟着的开关
// =============================================
function petListSub(p) {
  var ch = petChar(p);
  return (p.out ? '在桌面上玩' : '待在小窝里') + (ch ? ' · ' + (ch.charAlias || ch.charName || '角色') + '的' : '');
}
function renderPetList() {
  var list = document.getElementById('petList');
  list.innerHTML = '';
  petCfg.pets.forEach(function(p) {
    var row = document.createElement('div');
    row.className = 'pet-row';
    row.innerHTML = '<div class="pet-row-look"></div><div class="pet-row-info"><div class="pet-row-name"></div><div class="pet-row-sub"></div></div>' +
      '<label class="toggle-wrap"><input type="checkbox"><span class="toggle-slider"></span></label>';
    row.querySelector('.pet-row-look').innerHTML = petLook(p);
    row.querySelector('.pet-row-name').textContent = p.name || '没起名字';
    row.querySelector('.pet-row-sub').textContent = petListSub(p);
    var cb = row.querySelector('input');
    cb.checked = !!p.out;
    cb.addEventListener('change', function() { p.out = cb.checked; savePetCfg(); petSyncAll(); });
    row.querySelector('.toggle-wrap').addEventListener('click', function(e) { e.stopPropagation(); });
    row.addEventListener('click', function() { openPetEdit(p); });
    list.appendChild(row);
  });
  if (!petCfg.pets.length) {
    var empty = document.createElement('div');
    empty.className = 'pet-list-empty';
    empty.textContent = '小窝空空的';
    list.appendChild(empty);
  }
}
// 小窝下面的按钮：叫小窝里的大家一起做
[['dance', '跳个舞'], ['pc', '玩电脑'], ['book', '看书'], ['stretch', '伸懒腰'], ['sleep', '睡觉']].forEach(function(a) {
  var b = document.createElement('button');
  b.className = 'pet-chip';
  b.textContent = a[1];
  b.addEventListener('click', function() { Object.keys(homePets.map).forEach(function(id) { homePets.map[id].act(a[0]); }); });
  document.getElementById('petHomeActs').appendChild(b);
});
document.getElementById('dockPet').addEventListener('click', function() { appPet.classList.add('active'); homePets.run(true); petRefresh(); });
document.getElementById('backPet').addEventListener('click', function() { appPet.classList.remove('active'); homePets.run(false); petRefresh(); });
(function() {
  var follow = document.getElementById('petToggleFollow');
  follow.checked = petCfg.follow;
  follow.addEventListener('change', function() { petCfg.follow = follow.checked; savePetCfg(); petRefresh(); });
})();

// =============================================
// 添加 / 编辑一只：捏样子（种类、颜色、眼睛、小装饰）或者用图片，关联角色，写它会说的话
// =============================================
var petEditOverlay = document.getElementById('petEditOverlay');
var petEditing = null, petDraft = null;
function petChips(id, items, key) {
  var box = document.getElementById(id);
  box.innerHTML = '';
  items.forEach(function(it) {
    var b = document.createElement('button');
    b.className = 'pet-chip' + (petDraft[key] === it[0] ? ' active' : '');
    b.textContent = it[1];
    b.addEventListener('click', function() { petDraft[key] = it[0]; paintPetEdit(); });
    box.appendChild(b);
  });
}
function paintPetEdit() {
  var d = petDraft, isImg = d.kind === 'img';
  document.getElementById('petEditPreview').innerHTML = petLook(d);
  petChips('petEditKinds', PET_KINDS, 'kind');
  petChips('petEditEyes', PET_EYES, 'eye');
  petChips('petEditAccs', PET_ACCS, 'acc');
  var sw = document.getElementById('petEditColors');
  sw.innerHTML = '';
  PET_COLORS.forEach(function(c) {
    var b = document.createElement('button');
    b.className = 'pet-swatch' + (String(d.color).toLowerCase() === c.toLowerCase() ? ' active' : '');
    b.style.background = c;
    b.setAttribute('aria-label', c);
    b.addEventListener('click', function() { d.color = c; paintPetEdit(); });
    sw.appendChild(b);
  });
  document.getElementById('petEditColor').value = /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#D97757';
  document.querySelectorAll('#petEditOverlay .pet-edit-pixel').forEach(function(el) { el.style.display = isImg ? 'none' : ''; });
  document.querySelectorAll('#petEditOverlay .pet-edit-img').forEach(function(el) { el.style.display = isImg ? '' : 'none'; });
  var ch = petChar(d);
  document.getElementById('petEditUseAv').style.display = ch && ch.charAvatar ? '' : 'none';
}
function openPetEdit(p) {
  petEditing = p || null;
  petDraft = Object.assign({}, PET_DEFAULT, { id: '', name: '', out: true }, p || {});
  if (!p) petDraft.kind = 'blob', petDraft.color = PET_COLORS[1];
  document.getElementById('petEditTitle').textContent = p ? '编辑宠物' : '添加宠物';
  document.getElementById('petEditName').value = petDraft.name || '';
  document.getElementById('petEditWords').value = petDraft.words || '';
  document.getElementById('petEditDel').style.display = p ? '' : 'none';
  var sel = document.getElementById('petEditChar');
  sel.innerHTML = '<option value="">不关联</option>';
  (typeof charList !== 'undefined' ? charList : []).forEach(function(c) {
    if (!c) return;
    var o = document.createElement('option');
    o.value = c.id; o.textContent = c.charAlias || c.charName || '未命名';
    sel.appendChild(o);
  });
  sel.value = petDraft.charId && petChar(petDraft) ? String(petDraft.charId) : '';
  paintPetEdit();
  petEditOverlay.classList.add('open');
}
// 图片缩小到 240 像素以内，保留透明（Q 版图多是透明底）；动图不动
function petShrinkImg(src, cb) {
  if (!/^data:image\//.test(src) || /^data:image\/gif/i.test(src)) { cb(src); return; }
  var img = new Image();
  img.onload = function() {
    var k = Math.min(1, 240 / Math.max(img.width, img.height));
    if (k >= 1) { cb(src); return; }
    var c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    try { var out = c.toDataURL('image/png'); cb(out.length < src.length ? out : src); } catch (_) { cb(src); }
  };
  img.onerror = function() { cb(src); };
  img.src = src;
}
document.getElementById('petEditColor').addEventListener('input', function() { petDraft.color = this.value; paintPetEdit(); });
document.getElementById('petEditChar').addEventListener('change', function() { petDraft.charId = this.value; paintPetEdit(); });
document.getElementById('petEditName').addEventListener('input', function() { petDraft.name = this.value; });
document.getElementById('petEditWords').addEventListener('input', function() { petDraft.words = this.value; });
document.getElementById('petEditPick').addEventListener('click', function() { document.getElementById('petEditFile').click(); });
document.getElementById('petEditFile').addEventListener('change', function() {
  var f = this.files && this.files[0];
  this.value = '';
  if (!f) return;
  var rd = new FileReader();
  rd.onload = function() { petShrinkImg(rd.result, function(src) { petDraft.img = src; paintPetEdit(); }); };
  rd.readAsDataURL(f);
});
document.getElementById('petEditUseAv').addEventListener('click', function() {
  var ch = petChar(petDraft);
  if (ch && ch.charAvatar) petShrinkImg(ch.charAvatar, function(src) { petDraft.img = src; paintPetEdit(); });
});
document.getElementById('petEditCancel').addEventListener('click', function() { petEditOverlay.classList.remove('open'); });
document.getElementById('petEditSave').addEventListener('click', function() {
  var d = petDraft;
  d.name = d.name.trim();
  if (!d.name) { var ch = petChar(d); d.name = ch ? '小' + (ch.charAlias || ch.charName || '宠物') : '小' + (PET_KINDS.filter(function(k) { return k[0] === d.kind; })[0] || ['', '宠物'])[1].replace(/^小/, ''); }
  if (d.kind === 'img' && !d.img) { showToast('还没选图片', 'error'); return; }
  if (petEditing) Object.assign(petEditing, d);
  else { d.id = 'p' + Date.now().toString(36); petCfg.pets.push(d); }
  savePetCfg();
  petEditOverlay.classList.remove('open');
  petSyncAll();
});
document.getElementById('petEditDel').addEventListener('click', function() {
  var p = petEditing;
  if (!p) return;
  openConfirm('让「' + (p.name || '它') + '」离开小窝吗？', function() {
    petCfg.pets = petCfg.pets.filter(function(x) { return x !== p; });
    savePetCfg();
    petEditOverlay.classList.remove('open');
    petSyncAll();
  });
});
document.getElementById('petAddBtn').addEventListener('click', function() { openPetEdit(null); });
closeOnBackdrop(petEditOverlay);

petSyncAll();
setInterval(petRefresh, 500);
