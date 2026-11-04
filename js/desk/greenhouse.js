// 眠花糖机 — 桌面「花房」：整个小手机养一盆植物（用户选品种，种下满三个月或者彻底枯萎了才能换）。
// 浇水、施肥、晒太阳、摸摸让它长大：种子 → 发芽 → 小苗 → 长叶 → 花苞 → 开花；太久不浇水会渴、会蔫，七天不浇就枯萎了（mphone_garden）

var GARDEN_SPECIES = [
  { id: 'sunflower', name: '向日葵', kind: 'radial', petal: '#f7c948', center: '#8a5a2b', n: 18, pl: 17, pw: 6, cr: 13, leaf: '#79b26a' },
  { id: 'rose', name: '玫瑰', kind: 'rose', petal: '#e8637f', center: '#c94767', leaf: '#5f9f63' },
  { id: 'tulip', name: '郁金香', kind: 'tulip', petal: '#f2879d', center: '#e66a86', leaf: '#7dbb79', longLeaf: true },
  { id: 'lavender', name: '薰衣草', kind: 'spike', petal: '#a88bd8', center: '#8c6bc8', leaf: '#8fb59a', longLeaf: true },
  { id: 'daisy', name: '小雏菊', kind: 'radial', petal: '#ffffff', center: '#f5c542', n: 14, pl: 13, pw: 5, cr: 7, leaf: '#78b871' },
  { id: 'hydrangea', name: '绣球', kind: 'cluster', petal: '#9ec3f0', center: '#b9a6e0', leaf: '#6fa86b' },
  { id: 'sakura', name: '樱花', kind: 'sprig', petal: '#f8c6d4', center: '#e88aa5', leaf: '#8cbf7a' },
  { id: 'lily', name: '铃兰', kind: 'bell', petal: '#ffffff', center: '#e9ecd8', leaf: '#6fb07a', longLeaf: true },
  { id: 'succulent', name: '多肉', kind: 'succulent', petal: '#f4a6b8', center: '#9cc9a7', leaf: '#9cc9a7' },
  { id: 'hyacinth', name: '风信子', kind: 'spike', petal: '#f39fc0', center: '#e27ca6', leaf: '#7ab884', longLeaf: true, star: true }
];
var GARDEN_STAGES = [['种子', 0], ['发芽', 4], ['小苗', 12], ['长叶', 26], ['花苞', 44], ['开花', 66]];
var GARDEN_ACTS = {
  water: { name: '浇水', pts: 3, cd: 12, done: '浇过啦，土还是湿的' },
  feed:  { name: '施肥', pts: 5, cd: 72, done: '养分还够，过几天再施' },
  sun:   { name: '晒太阳', pts: 2, cd: 6, done: '刚晒过，歇一会儿' },
  pet:   { name: '摸摸', pts: 1, cd: 1, done: '' }
};
var GARDEN_LOCK_DAYS = 90;
var garden = mphoneStore.load('mphone_garden', null);
function saveGarden() { mphoneStore.save('mphone_garden', garden); }
function gardenSpecies(id) { return GARDEN_SPECIES.filter(function(s) { return s.id === id; })[0] || GARDEN_SPECIES[0]; }
function gardenHours(t) { return t ? (Date.now() - t) / 3600000 : 1e9; }
function gardenStage(g) { var s = 0; GARDEN_STAGES.forEach(function(x, i) { if ((g.pts || 0) >= x[1]) s = i; }); return s; }
// 水：48 小时不浇有点渴，96 小时蔫了，七天不浇彻底枯萎（种下当天算浇过）
function gardenHealth(g) {
  if (g.deadAt) return 'dead';
  var h = gardenHours(g.last.water || g.plantedAt);
  if (h >= 168) { g.deadAt = Date.now(); saveGarden(); return 'dead'; }
  return h >= 96 ? 'wilt' : h >= 48 ? 'thirsty' : 'ok';
}
var GARDEN_HEALTH_TEXT = { ok: '精神很好', thirsty: '有点渴了', wilt: '蔫了，快浇水', dead: '彻底枯萎了' };
function gardenCanReplant(g) { return !g || g.deadAt || gardenHours(g.plantedAt) >= GARDEN_LOCK_DAYS * 24; }
function gardenUserName() { try { return getMainAccount().nickname || '我'; } catch (_) { return '我'; } }

// ---------- 画植物（200×260 的格子，花盆在下面，茎从 (100,196) 长出来） ----------
function gardenFlower(sp, x, y, k) {
  var s = '', i, a;
  k = k || 1;
  if (sp.kind === 'radial') {
    for (i = 0; i < sp.n; i++) {
      a = 360 / sp.n * i;
      s += '<ellipse cx="' + x + '" cy="' + (y - sp.cr * k - sp.pl * k / 2) + '" rx="' + sp.pw * k + '" ry="' + sp.pl * k / 2 + '" fill="' + sp.petal + '" stroke="rgba(0,0,0,0.06)" transform="rotate(' + a + ' ' + x + ' ' + y + ')"/>';
    }
    s += '<circle cx="' + x + '" cy="' + y + '" r="' + sp.cr * k + '" fill="' + sp.center + '"/>';
    if (sp.id === 'sunflower') for (i = 0; i < 14; i++) s += '<circle cx="' + (x + Math.cos(i * 2.4) * sp.cr * 0.55 * k * (i % 3 / 2 + 0.3)) + '" cy="' + (y + Math.sin(i * 2.4) * sp.cr * 0.55 * k * (i % 3 / 2 + 0.3)) + '" r="' + 1.3 * k + '" fill="#5e3a1a" opacity="0.6"/>';
  } else if (sp.kind === 'rose') {
    s += '<circle cx="' + x + '" cy="' + y + '" r="' + 17 * k + '" fill="' + sp.petal + '"/>';
    for (i = 0; i < 5; i++) s += '<path d="M' + (x - 15 * k + i * 3 * k) + ' ' + (y - 2 * k + i * 2 * k) + ' q' + (15 * k - i * 3 * k) + ' ' + (-16 * k + i * 4 * k) + ' ' + (30 * k - i * 6 * k) + ' 0" fill="none" stroke="' + sp.center + '" stroke-width="' + 2 * k + '" stroke-linecap="round"/>';
    s += '<path d="M' + (x - 16 * k) + ' ' + (y + 6 * k) + ' q' + 16 * k + ' ' + 16 * k + ' ' + 32 * k + ' 0" fill="' + sp.center + '" opacity="0.5"/>';
  } else if (sp.kind === 'tulip') {
    s += '<path d="M' + (x - 15 * k) + ' ' + (y - 14 * k) + ' L' + (x - 7 * k) + ' ' + (y - 4 * k) + ' L' + x + ' ' + (y - 18 * k) + ' L' + (x + 7 * k) + ' ' + (y - 4 * k) + ' L' + (x + 15 * k) + ' ' + (y - 14 * k) + ' Q' + (x + 17 * k) + ' ' + (y + 14 * k) + ' ' + x + ' ' + (y + 14 * k) + ' Q' + (x - 17 * k) + ' ' + (y + 14 * k) + ' ' + (x - 15 * k) + ' ' + (y - 14 * k) + 'Z" fill="' + sp.petal + '"/>';
    s += '<path d="M' + x + ' ' + (y - 18 * k) + ' L' + (x - 6 * k) + ' ' + (y + 12 * k) + ' M' + x + ' ' + (y - 18 * k) + ' L' + (x + 6 * k) + ' ' + (y + 12 * k) + '" stroke="' + sp.center + '" stroke-width="' + 1.5 * k + '" opacity="0.55"/>';
  } else if (sp.kind === 'spike') {
    for (i = 0; i < 9; i++) {
      var yy = y + 18 * k - i * 5 * k, ww = (9 - i * 0.6) * k;
      if (sp.star) { s += '<circle cx="' + (x - ww * 0.6) + '" cy="' + yy + '" r="' + 3.6 * k + '" fill="' + sp.petal + '"/><circle cx="' + (x + ww * 0.6) + '" cy="' + (yy - 2 * k) + '" r="' + 3.6 * k + '" fill="' + sp.petal + '"/><circle cx="' + x + '" cy="' + (yy - 3 * k) + '" r="' + 3.2 * k + '" fill="' + sp.center + '"/>'; }
      else { s += '<ellipse cx="' + (x - 3 * k) + '" cy="' + yy + '" rx="' + 2.6 * k + '" ry="' + 3.8 * k + '" fill="' + sp.petal + '" transform="rotate(-20 ' + (x - 3 * k) + ' ' + yy + ')"/><ellipse cx="' + (x + 3 * k) + '" cy="' + (yy - 2 * k) + '" rx="' + 2.6 * k + '" ry="' + 3.8 * k + '" fill="' + sp.center + '" transform="rotate(20 ' + (x + 3 * k) + ' ' + (yy - 2 * k) + ')"/>'; }
    }
  } else if (sp.kind === 'cluster') {
    for (i = 0; i < 16; i++) {
      var cx = x + Math.cos(i * 2.4) * (i % 4 + 1) * 4.6 * k, cy = y + Math.sin(i * 2.4) * (i % 4 + 1) * 3.8 * k;
      var col = i % 3 ? sp.petal : sp.center;
      s += '<g transform="translate(' + cx + ' ' + cy + ') rotate(' + i * 23 + ')"><ellipse rx="' + 3.2 * k + '" ry="' + 1.8 * k + '" fill="' + col + '"/><ellipse rx="' + 1.8 * k + '" ry="' + 3.2 * k + '" fill="' + col + '"/><circle r="' + 0.9 * k + '" fill="#fff" opacity="0.8"/></g>';
    }
  } else if (sp.kind === 'bell') {
    for (i = 0; i < 5; i++) {
      var bx = x + 6 * k + i * 7 * k, by = y + 4 * k + i * i * 0.9 * k;
      s += '<path d="M' + bx + ' ' + (by - 5 * k) + ' v' + 4 * k + '" stroke="#7aa77f" stroke-width="' + k + '"/><path d="M' + (bx - 4.5 * k) + ' ' + (by + 5 * k) + ' Q' + (bx - 4.5 * k) + ' ' + (by - 2 * k) + ' ' + bx + ' ' + (by - 2 * k) + ' Q' + (bx + 4.5 * k) + ' ' + (by - 2 * k) + ' ' + (bx + 4.5 * k) + ' ' + (by + 5 * k) + ' q-2.2 -1.4 -4.5 0 q-2.2 -1.4 -4.5 0Z" fill="' + sp.petal + '" stroke="#e3e6d3" stroke-width="0.6"/>';
    }
  } else if (sp.kind === 'sprig') {
    var spots = [[0, 0], [-16, 10], [15, 8], [-6, -14], [10, -12]];
    spots.forEach(function(p) {
      for (var j = 0; j < 5; j++) s += '<ellipse cx="' + (x + p[0] * k) + '" cy="' + (y + p[1] * k - 5 * k) + '" rx="' + 3 * k + '" ry="' + 4.6 * k + '" fill="' + sp.petal + '" transform="rotate(' + j * 72 + ' ' + (x + p[0] * k) + ' ' + (y + p[1] * k) + ')"/>';
      s += '<circle cx="' + (x + p[0] * k) + '" cy="' + (y + p[1] * k) + '" r="' + 1.8 * k + '" fill="' + sp.center + '"/>';
    });
  } else if (sp.kind === 'succulent') {
    s += '<circle cx="' + x + '" cy="' + y + '" r="' + 4 * k + '" fill="' + sp.petal + '"/>';
    for (i = 0; i < 5; i++) s += '<ellipse cx="' + x + '" cy="' + (y - 4 * k) + '" rx="' + 2 * k + '" ry="' + 4 * k + '" fill="' + sp.petal + '" transform="rotate(' + i * 72 + ' ' + x + ' ' + y + ')"/>';
  }
  return s;
}
function gardenBud(sp, x, y) {
  return '<path d="M' + (x - 7) + ' ' + (y + 6) + ' Q' + (x - 8) + ' ' + (y - 8) + ' ' + x + ' ' + (y - 14) + ' Q' + (x + 8) + ' ' + (y - 8) + ' ' + (x + 7) + ' ' + (y + 6) + ' Z" fill="' + sp.petal + '" stroke="' + sp.center + '" stroke-width="1"/>' +
    '<path d="M' + (x - 8) + ' ' + (y + 6) + ' Q' + x + ' ' + (y - 2) + ' ' + (x + 8) + ' ' + (y + 6) + '" fill="' + sp.leaf + '"/>';
}
function gardenPlantSvg(g, opt) {
  opt = opt || {};
  var sp = gardenSpecies(g.species), st = opt.stage !== undefined ? opt.stage : gardenStage(g), hl = opt.health || (g.plantedAt ? gardenHealth(g) : 'ok');
  var leaf = hl === 'dead' ? '#a08b74' : hl === 'wilt' ? '#a99a68' : hl === 'thirsty' ? '#93ad74' : sp.leaf;
  var droop = hl === 'dead' ? 38 : hl === 'wilt' ? 20 : hl === 'thirsty' ? 7 : 0;
  var H = [0, 16, 42, 76, 106, 124][st], top = 196 - H, s = '';
  // 花盆
  var pot = '<defs><linearGradient id="gpPot" x1="0" x2="1"><stop offset="0" stop-color="#f6c9b6"/><stop offset="0.5" stop-color="#f9dacd"/><stop offset="1" stop-color="#eab5a2"/></linearGradient></defs>' +
    '<ellipse cx="100" cy="250" rx="52" ry="6" fill="rgba(140,90,80,0.18)"/>' +
    '<path d="M58 204 L142 204 L132 250 Q100 256 68 250 Z" fill="url(#gpPot)"/>' +
    '<rect x="52" y="194" width="96" height="14" rx="5" fill="#f3bfa9"/><rect x="52" y="194" width="96" height="4" rx="2" fill="#fbe0d4"/>' +
    '<path d="M74 222 q26 10 52 0" stroke="#fff" stroke-opacity="0.45" stroke-width="2" fill="none"/>' +
    '<ellipse cx="100" cy="197" rx="44" ry="5" fill="#7a5b48"/>';
  if (st === 0) return pot + '<ellipse cx="100" cy="195" rx="9" ry="3.5" fill="#94704f"/><ellipse cx="100" cy="193" rx="3" ry="2" fill="#c9a77a"/>';
  if (sp.kind === 'succulent') {
    var R = [0, 10, 18, 26, 32, 36][st];
    for (var r = 3; r >= 1; r--) for (var i = 0; i < 8; i++) {
      s += '<ellipse cx="100" cy="' + (192 - R * r / 3 * 0.55) + '" rx="' + (R * r / 3 * 0.38 + 2) + '" ry="' + (R * r / 3 * 0.62 + 2) + '" fill="' + (r === 1 ? sp.petal : leaf) + '" opacity="' + (0.75 + r * 0.08) + '" transform="rotate(' + (i * 45 + r * 20) + ' 100 192)"/>';
    }
    if (st >= 4) s += '<path d="M100 186 Q108 150 118 130" stroke="' + leaf + '" stroke-width="2.4" fill="none"/>' + (st === 5 ? gardenFlower(sp, 118, 128, 1.2) : gardenBud(sp, 118, 132));
    return pot + '<g transform="rotate(' + droop / 3 + ' 100 196)">' + s + '</g>';
  }
  // 茎（微微弯）和叶子
  s += '<path d="M100 196 Q' + (96 + H * 0.06) + ' ' + (196 - H * 0.5) + ' 100 ' + top + '" stroke="' + leaf + '" stroke-width="' + (st >= 3 ? 4 : 3) + '" fill="none" stroke-linecap="round"/>';
  if (st === 1) {
    s += '<ellipse cx="92" cy="' + (top + 2) + '" rx="8" ry="4" fill="' + leaf + '" transform="rotate(-25 92 ' + (top + 2) + ')"/><ellipse cx="108" cy="' + (top + 2) + '" rx="8" ry="4" fill="' + leaf + '" transform="rotate(25 108 ' + (top + 2) + ')"/>';
  } else {
    var n = st === 2 ? 2 : 4;
    for (var j = 0; j < n; j++) {
      var ly = 196 - H * (0.22 + j * 0.17), side = j % 2 ? 1 : -1;
      if (sp.longLeaf) s += '<path d="M100 196 Q' + (100 + side * (22 + j * 4)) + ' ' + (196 - H * 0.35) + ' ' + (100 + side * (14 + j * 6)) + ' ' + (196 - H * (0.45 + j * 0.12)) + ' Q' + (100 + side * 8) + ' ' + (196 - H * 0.3) + ' 100 196Z" fill="' + leaf + '"/>';
      else s += '<ellipse cx="' + (100 + side * 13) + '" cy="' + ly + '" rx="13" ry="6" fill="' + leaf + '" transform="rotate(' + (side * -28) + ' ' + (100 + side * 13) + ' ' + ly + ')"/><path d="M' + (100 + side * 3) + ' ' + ly + ' L' + (100 + side * 22) + ' ' + (ly - side * 0 - 6) + '" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>';
    }
  }
  if (st === 4) s += gardenBud(sp, 100, top - 6);
  if (st === 5) s += gardenFlower(sp, 100, top - (sp.kind === 'spike' ? 18 : sp.kind === 'bell' ? 0 : 10), sp.kind === 'radial' && sp.id === 'sunflower' ? 1.25 : 1.15);
  var filt = hl === 'dead' ? ' style="filter:grayscale(0.7) sepia(0.4)"' : hl === 'wilt' ? ' style="filter:saturate(0.55)"' : '';
  return pot + '<g transform="rotate(' + droop + ' 100 196)"' + filt + '>' + s + '</g>';
}
function gardenSvg(g, opt, cls) { return '<svg class="' + (cls || 'gd-plant') + '" viewBox="0 0 200 260" aria-hidden="true">' + gardenPlantSvg(g, opt) + '</svg>'; }

// ---------- 界面 ----------
var gdBody = document.querySelector('#appGreenhouse .settings-content');
gdBody.classList.add('gd-body');
function renderGarden(fx) {
  gdBody.innerHTML = '';
  var scene = document.createElement('div');
  scene.className = 'gd-scene';
  scene.innerHTML = '<div class="gd-glass"></div><div class="gd-beams"></div><div class="gd-table"></div><div class="gd-pot-wrap"></div><div class="gd-fx"></div>';
  gdBody.appendChild(scene);
  if (!garden || !garden.species) { renderGardenPick(scene); return; }
  var g = garden, sp = gardenSpecies(g.species), st = gardenStage(g), hl = gardenHealth(g);
  scene.classList.toggle('sunny', gardenHours(g.last.sun) < 6);
  scene.querySelector('.gd-pot-wrap').innerHTML = gardenSvg(g);
  var days = Math.floor(gardenHours(g.plantedAt) / 24) + 1;
  var info = document.createElement('div');
  info.className = 'settings-card gd-info';
  var bars = [['水分', Math.max(0, 1 - gardenHours(g.last.water || g.plantedAt) / 96), '#8fc3ea'], ['阳光', Math.max(0, 1 - gardenHours(g.last.sun) / 24), '#f6cf6a'], ['养分', Math.max(0, 1 - gardenHours(g.last.feed) / 168), '#9fd3a8']];
  info.innerHTML = '<div class="gd-title"><b></b><span></span></div><div class="gd-sub"></div><div class="gd-bars"></div><div class="gd-acts"></div>';
  info.querySelector('b').textContent = sp.name;
  info.querySelector('.gd-title span').textContent = GARDEN_STAGES[st][0];
  info.querySelector('.gd-sub').textContent = '种下第 ' + days + ' 天 · ' + GARDEN_HEALTH_TEXT[hl] + (st < 5 && hl !== 'dead' ? ' · 离「' + GARDEN_STAGES[st + 1][0] + '」还差一点点' : '');
  bars.forEach(function(b) {
    var row = document.createElement('div');
    row.className = 'gd-bar';
    row.innerHTML = '<span>' + b[0] + '</span><i><em style="width:' + Math.round(b[1] * 100) + '%;background:' + b[2] + '"></em></i>';
    info.querySelector('.gd-bars').appendChild(row);
  });
  Object.keys(GARDEN_ACTS).forEach(function(k) {
    var a = GARDEN_ACTS[k], btn = document.createElement('button');
    btn.className = 'gd-act gd-act-' + k;
    btn.innerHTML = '<span class="gd-act-ic"></span><span>' + a.name + '</span>';
    btn.disabled = hl === 'dead';
    btn.addEventListener('click', function() { gardenDo(k); });
    info.querySelector('.gd-acts').appendChild(btn);
  });
  gdBody.appendChild(info);
  // 照顾记录
  if ((g.log || []).length) {
    var log = document.createElement('div');
    log.className = 'settings-card gd-log';
    log.innerHTML = '<div class="bubble-section-label" style="margin-bottom:6px;">照顾记录</div>';
    g.log.slice(-8).reverse().forEach(function(x) {
      var d = new Date(x.t), row = document.createElement('div');
      row.className = 'gd-log-row';
      row.textContent = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '　' + x.text;
      log.appendChild(row);
    });
    gdBody.appendChild(log);
  }
  // 换一盆：满三个月或者枯萎了才行
  var re = document.createElement('div');
  re.className = 'gd-replant';
  if (gardenCanReplant(g)) {
    var rb = document.createElement('button');
    rb.className = 'mine-acc-btn mine-acc-btn-close';
    rb.textContent = hl === 'dead' ? '重新种一盆' : '换一盆';
    rb.addEventListener('click', function() {
      openConfirm(hl === 'dead' ? '重新选一颗种子？' : '换掉这盆' + sp.name + '？换了以后三个月内不能再换', function() { garden = null; saveGarden(); renderGarden(); });
    });
    re.appendChild(rb);
  } else {
    re.textContent = '种满三个月（还要 ' + Math.ceil(GARDEN_LOCK_DAYS - gardenHours(g.plantedAt) / 24) + ' 天）或者彻底枯萎了，才能换一盆';
  }
  gdBody.appendChild(re);
  if (fx) gardenFx(scene, fx);
}
function gardenDo(k) {
  var g = garden, a = GARDEN_ACTS[k];
  if (!g || gardenHealth(g) === 'dead') return;
  var fresh = gardenHours(g.last[k]) >= a.cd;
  var before = gardenStage(g);
  if (k !== 'pet' && !fresh) { showToast(a.done, 'plain'); renderGarden(k); return; }
  g.last[k] = Date.now();
  if (fresh) g.pts = (g.pts || 0) + a.pts;
  if (k === 'pet' || fresh) {
    var who = gardenUserName();
    var text = { water: who + '给它浇了水', feed: who + '施了一点肥', sun: who + '把它搬到阳光下晒了晒', pet: who + '轻轻摸了摸它的叶子' }[k];
    var lastLog = (g.log || [])[g.log.length - 1];
    if (!(k === 'pet' && lastLog && lastLog.text === text && Date.now() - lastLog.t < 3600000)) g.log = (g.log || []).concat({ t: Date.now(), text: text }).slice(-40);
  }
  saveGarden();
  renderGarden(k);
  var after = gardenStage(g);
  if (after > before) showToast('✿ 它' + (after === 5 ? '开花了！' : '长成「' + GARDEN_STAGES[after][0] + '」了'), 'success');
}
// 小动效：浇水掉水滴、施肥冒小亮点、晒太阳光更亮、摸摸冒爱心
function gardenFx(scene, k) {
  var box = scene.querySelector('.gd-fx'), n = k === 'water' ? 9 : k === 'feed' ? 8 : k === 'pet' ? 5 : 0;
  if (k === 'sun') { scene.classList.add('sun-pulse'); setTimeout(function() { scene.classList.remove('sun-pulse'); }, 1400); }
  for (var i = 0; i < n; i++) {
    var e = document.createElement('span');
    e.className = 'gd-fx-' + k;
    e.textContent = k === 'pet' ? '♥' : '';
    e.style.left = (38 + Math.random() * 24) + '%';
    e.style.animationDelay = (i * 0.09) + 's';
    box.appendChild(e);
  }
  setTimeout(function() { box.innerHTML = ''; }, 1800);
}
// 还没种：选一颗种子（种下以后三个月内不能换）
function renderGardenPick(scene) {
  scene.querySelector('.gd-pot-wrap').innerHTML = gardenSvg({ species: 'daisy' }, { stage: 0, health: 'ok' });
  var card = document.createElement('div');
  card.className = 'settings-card';
  card.innerHTML = '<div class="gd-title" style="justify-content:center;"><b>选一颗种子</b></div><div class="gd-sub" style="text-align:center;">整个小手机只养这一盆。种下以后要满三个月，或者它彻底枯萎了，才能换</div><div class="gd-pick"></div>';
  GARDEN_SPECIES.forEach(function(sp) {
    var b = document.createElement('button');
    b.className = 'gd-pick-item';
    b.innerHTML = gardenSvg({ species: sp.id }, { stage: 5, health: 'ok' }, 'gd-pick-svg') + '<span>' + sp.name + '</span>';
    b.addEventListener('click', function() {
      openConfirm('种下一颗' + sp.name + '？三个月内不能换哦', function() {
        garden = { species: sp.id, plantedAt: Date.now(), pts: 0, last: { water: Date.now() }, log: [{ t: Date.now(), text: gardenUserName() + '种下了一颗' + sp.name + '的种子' }] };
        saveGarden();
        renderGarden('water');
      });
    });
    card.querySelector('.gd-pick').appendChild(b);
  });
  gdBody.appendChild(card);
}
document.getElementById('dockGreenhouse').addEventListener('click', function() { renderGarden(); });

// 角色也知道花房里那盆花（聊天窗口的现实感知里带一句）
function gardenContextLine() {
  if (!garden || !garden.species) return '';
  var sp = gardenSpecies(garden.species);
  return '用户在小手机的花房里养了一盆' + sp.name + '，现在是「' + GARDEN_STAGES[gardenStage(garden)][0] + '」，' + GARDEN_HEALTH_TEXT[gardenHealth(garden)] + '。';
}
