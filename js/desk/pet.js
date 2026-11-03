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
// 样子：像素小动物（24×22 的格子，上面留了 4 格放耳朵）或者一张图片
// 分组：pet-legs-a / pet-legs-b 两组腿轮流抬，pet-top 是身子，pet-eye 是眼睛（眨眼、睡觉用）
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
function petSvg(p) {
  var c = p.color || '#D97757', d = petShade(c, -0.22), kind = p.kind || 'crab';
  var legsA = '', legsB = '', back = '', body = '', eyes = [8, 14], ey = 10;
  if (kind === 'crab') {
    legsA = petR(4, 16, 2, 4, c) + petR(15, 16, 2, 4, c);
    legsB = petR(7, 16, 2, 4, c) + petR(18, 16, 2, 4, c);
    body = petR(3, 7, 18, 10, c) + petR(0, 10, 3, 3, c) + petR(21, 10, 3, 3, c);
    eyes = [7, 15]; ey = 9;
  } else if (kind === 'blob') {
    legsA = petR(6, 16, 3, 3, d, '', 1);
    legsB = petR(15, 16, 3, 3, d, '', 1);
    body = petR(3, 7, 18, 11, c, '', 4);
  } else if (kind === 'cat') {
    legsA = petR(6, 16, 2, 4, c) + petR(14, 16, 2, 4, c);
    legsB = petR(9, 16, 2, 4, c) + petR(17, 16, 2, 4, c);
    back = '<path d="M20 13 h2 v-5 h2 v7 h-4 z" fill="' + d + '"/>';
    body = '<path d="M4 9 L5 3 L10 7 L14 7 L19 3 L20 9 Z" fill="' + c + '"/>' + petR(4, 7, 16, 10, c, '', 1) +
           '<path d="M6 7 L6.4 5 L8.2 6.6 Z" fill="' + d + '"/><path d="M18 7 L17.6 5 L15.8 6.6 Z" fill="' + d + '"/>';
  } else if (kind === 'bear') {
    legsA = petR(6, 16, 3, 4, c) + petR(14, 16, 3, 4, c);
    legsB = petR(9, 16, 2, 4, c) + petR(17, 16, 2, 4, c);
    body = '<circle cx="6" cy="7" r="2.6" fill="' + c + '"/><circle cx="18" cy="7" r="2.6" fill="' + c + '"/>' +
           '<circle cx="6" cy="7" r="1.2" fill="' + d + '"/><circle cx="18" cy="7" r="1.2" fill="' + d + '"/>' +
           petR(4, 6, 16, 11, c, '', 3) + petR(9.5, 12, 5, 3, petShade(c, 0.45), '', 1.2) + petR(11.3, 12.3, 1.4, 1, '#2a2422');
  } else if (kind === 'bunny') {
    legsA = petR(6, 16, 3, 3, c, '', 1);
    legsB = petR(15, 16, 3, 3, c, '', 1);
    body = petR(6.5, -1, 3, 10, c, '', 1.5) + petR(14.5, -1, 3, 10, c, '', 1.5) +
           petR(7.5, 0.5, 1, 6, '#f6b4c4') + petR(15.5, 0.5, 1, 6, '#f6b4c4') + petR(4, 7, 16, 11, c, '', 4);
  }
  // 眼睛
  var eye = p.eye || 'bean', ink = '#2a2422', eyeSvg = '';
  eyes.forEach(function(x) {
    if (eye === 'round') eyeSvg += '<g class="pet-eye"><rect x="' + x + '" y="' + ey + '" width="2.2" height="2.4" rx="1.1" fill="' + ink + '"/><rect x="' + (x + 1.2) + '" y="' + (ey + 0.4) + '" width="0.7" height="0.7" fill="#fff"/></g>';
    else if (eye === 'line') eyeSvg += petR(x - 0.5, ey + 1.2, 3, 1, ink, 'pet-eye');
    else eyeSvg += petR(x, ey, 2, 3, ink, 'pet-eye');
  });
  // 小装饰
  var acc = '', a = p.acc || 'none';
  if (a === 'blush') acc = petR(eyes[0] - 1.5, ey + 3.4, 2.5, 1.2, '#f39bb0', '', 0.6) + petR(eyes[1] + 1, ey + 3.4, 2.5, 1.2, '#f39bb0', '', 0.6);
  else if (a === 'bow') acc = '<path d="M15 5 L18 3.2 L18 7.8 Z M21 5 L18 3.2 L18 7.8 Z" fill="#f08aa6" transform="translate(-0.5 1)"/><rect x="17" y="5" width="1.6" height="1.6" fill="#d9607e" transform="translate(-0.5 0.2)"/>';
  else if (a === 'flower') acc = '<g transform="translate(17.5 6.2)"><circle cx="0" cy="-1.3" r="1.1" fill="#fff"/><circle cx="1.3" cy="0" r="1.1" fill="#fff"/><circle cx="0" cy="1.3" r="1.1" fill="#fff"/><circle cx="-1.3" cy="0" r="1.1" fill="#fff"/><circle r="0.8" fill="#f6c94a"/></g>';
  else if (a === 'sprout') acc = '<path d="M12 7 V3.6" stroke="#6bb67e" stroke-width="0.9"/><path d="M12 4.6 C10 4.6 9.2 3.2 9.4 2.2 C11 2.2 12 3.2 12 4.6 Z M12 4 C13.6 4 14.8 2.8 14.6 1.6 C13 1.6 12 2.6 12 4 Z" fill="#7cc48e"/>';
  return '<svg class="pet-svg" viewBox="0 -2 24 24" aria-hidden="true">' + back +
    '<g class="pet-legs-a">' + legsA + '</g><g class="pet-legs-b">' + legsB + '</g>' +
    '<g class="pet-top">' + body + eyeSvg + acc + '</g></svg>';
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

// =============================================
// 一只会动的宠物：box 是它能走动的地方；opt = { size, top, bottom }
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
  this.setData(data);
  this.x = -1; this.y = -1;
  this.state = 'idle'; this.until = 0; this.tx = 0; this.ty = 0;
  this.lastTouch = Date.now(); this.last = 0; this.running = false;
  this.blinkAt = Date.now() + 1000 + Math.random() * 3000;
  this.bindPointer();
  this.tick = function(t) { self.frame(t); };
}
Pet.prototype.setData = function(p) {
  this.data = p;
  this.inner.innerHTML = petLook(p) + '<svg class="pet-prop" viewBox="0 -2 24 24" aria-hidden="true">' + (PET_PROPS[this.state] || '') + '</svg><span class="pet-z">z</span>';
  this.prop = this.inner.querySelector('.pet-prop');
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
  ['walk', 'sleep', 'look-l', 'look-r', 'look-up', 'act-dance', 'act-pc', 'act-book', 'act-stretch'].forEach(function(c) { el.classList.remove(c); });
  this.state = state;
  this.until = Date.now() + (ms || 0);
  if (state === 'walk' || state === 'sleep') el.classList.add(state);
  if (PET_ACTS[state]) el.classList.add('act-' + state);   // 加前缀：.book 之类会和书架的样式撞
  if (state === 'look') el.classList.add(['look-l', 'look-r', 'look-up'][Math.floor(Math.random() * 3)]);
  if (this.prop) this.prop.innerHTML = PET_PROPS[state] || '';
};
Pet.prototype.act = function(name) {
  this.lastTouch = Date.now();
  if (name === 'sleep') { this.set('sleep', 20000 + Math.random() * 30000); return; }
  var a = PET_ACTS[name];
  if (a) this.set(name, a[0] + Math.random() * a[1]);
};
// 跳舞时头上冒小音符
Pet.prototype.float = function(text, cls) {
  var s = document.createElement('span');
  s.className = cls; s.textContent = text;
  this.inner.appendChild(s);
  setTimeout(function() { s.remove(); }, 1300);
};
// 想想接下来干什么：多半是走到附近一个地方，有时东张西望、发会儿呆，久没人理（或者夜里）就打个盹
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
    var dx = this.tx - this.x, dy = this.ty - this.y, d = Math.sqrt(dx * dx + dy * dy), step = 34 * dt;
    if (d <= step || now > this.until) { this.x = this.tx; this.y = this.ty; this.set('idle', 800 + Math.random() * 2500); }
    else { this.x += dx / d * step; this.y += dy / d * step; }
  } else if (this.state !== 'drag' && now > this.until) {
    if (this.state === 'sleep') { this.set('idle', 1500); this.talk(true); }
    else this.decide();
  }
  if (this.state === 'dance' && !(now < this.noteAt)) {
    this.float(Math.random() < 0.5 ? '♪' : '♫', 'pet-note' + (Math.random() < 0.5 ? ' r' : ''));
    this.noteAt = now + 600 + Math.random() * 500;
  }
  if (this.state !== 'sleep' && now > this.blinkAt) {
    var el = this.el;
    el.classList.add('blink');
    setTimeout(function() { el.classList.remove('blink'); }, 130);
    this.blinkAt = now + 2500 + Math.random() * 4000;
  }
  this.place();
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
// 摸一下：跳一跳、冒个小爱心，有时候说句话；睡着的被摸醒
Pet.prototype.pat = function() {
  var el = this.el;
  this.lastTouch = Date.now();
  if (this.state === 'sleep') { this.set('idle', 2000); this.talk(true); return; }
  this.set('idle', 1800);
  el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop');
  setTimeout(function() { el.classList.remove('hop'); }, 400);
  var heart = document.createElement('span');
  heart.className = 'pet-heart'; heart.textContent = '♥';
  this.inner.appendChild(heart);
  setTimeout(function() { heart.remove(); }, 950);
  if (Math.random() < 0.6) this.talk(false);
};
// 点一下 = 摸摸；按住拖动 = 拎着走（拖动时腿乱蹬）
Pet.prototype.bindPointer = function() {
  var self = this, el = this.el, down = null;
  el.addEventListener('pointerdown', function(e) {
    e.stopPropagation();
    var r = self.box.getBoundingClientRect(), k = r.width / (self.box.offsetWidth || r.width) || 1;   // 带边框模式整个小手机是缩放过的
    down = { px: e.clientX, py: e.clientY, x: self.x, y: self.y, k: k, moved: false };
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  });
  el.addEventListener('pointermove', function(e) {
    if (!down) return;
    var dx = (e.clientX - down.px) / down.k, dy = (e.clientY - down.py) / down.k;
    if (!down.moved && dx * dx + dy * dy < 36) return;
    if (!down.moved) { down.moved = true; self.set('drag'); el.classList.add('drag'); self.lastTouch = Date.now(); }
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
    if (moved) self.set('idle', 1200 + Math.random() * 1500);
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
function petRefresh() {
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
