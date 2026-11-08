// 眠花糖机 — 桌面「星星瓶」：一个玻璃瓶，角色们写给用户的小纸条折成星星掉进来（不分是谁的，全放一起）。点一颗星星展开看纸条。
// 星星有两种来：聊天里角色偶尔悄悄叠一颗（<星星>…</星星>，聊天里看不到），和消息列表里的每个角色每天一颗（mphone_stars）

var stars = mphoneStore.load('mphone_stars', []);
function saveStars() { mphoneStore.save('mphone_stars', stars); paintStarBadge(); }
function paintStarBadge() {
  var d = document.querySelector('#dockStarJar .dock-icon');
  if (d) d.classList.toggle('has-unread', stars.some(function(s) { return !s.read; }));
}
var STAR_COLORS = ['#ffd6a5', '#fdffb6', '#caffbf', '#a0c4ff', '#ffc6ff', '#ffadad', '#bdb2ff', '#ffe5ec', '#d0f4de', '#fcd5ce'];
function starHash(s) { var h = 7; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function starDayKey(t) { var d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
// 角色设置「聊天」页的「TA 会折星星」（默认开）
function starOn(char) { return !!(char && Object.assign({}, DEFAULT_CHAT_CFG, char.chatCfg || {}).starOn); }
// 匿名星星：纸条上不写名字，界面上谁都看不出是谁（用户、MianIN、别的角色都不知道），只有写的那个角色自己记得（starAnonContextLine）。
// charId 还是存着，只给写的人自己认；name 不存
var STAR_ANON_P = 0.15, STAR_ANON_COLOR = '#e4def3';
function addStar(char, text, src, anon) {
  text = String(text || '').replace(/^["“「『]+|["”」』]+$/g, '').trim().slice(0, 120);
  if (!char || !text) return null;
  var s = { id: 'st' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), charId: char.id, name: anon ? '' : char.charAlias || char.charName || '', text: text, at: Date.now(), src: src || 'chat', read: false };
  if (anon) s.anon = true;
  stars.push(s);
  saveStars();
  if (document.getElementById('appStarJar').classList.contains('active')) renderStarJar(s.id);
  return s;
}

// ---------- 聊天里：角色偶尔悄悄叠一颗（一天最多一颗） ----------
function starRuleFor(char) {
  if (!char || !char.id || !starOn(char)) return '';
  var last = stars.filter(function(s) { return s.charId === char.id && s.src === 'chat'; }).pop();
  if (last && Date.now() - last.at < 24 * 3600000) return '';
  return '你可以偶尔（很少，大概一两天才一次）悄悄给对方叠一颗星星：此刻心里有一句想留给对方、又不想直接说出口的话时，在全部消息最后另起一行写 <星星>不超过 40 字的小纸条</星星>，' +
    '它会折成一颗星星悄悄掉进对方的星星瓶里，聊天里不会显示。没有特别想说的就不要写。';
}
function starTakeTag(char, text) {
  var got = false;
  text = String(text || '').replace(/<星星>([\s\S]*?)(<\/星星>|$)/g, function(_, body) {
    if (!got && char && body.trim()) { addStar(char, body, 'chat'); got = true; }
    return '';
  });
  return text;
}

// ---------- 每天一颗：消息列表里的每个角色每天给用户写一张小纸条（小手机开着时慢慢写，一个接一个） ----------
var starDailyBusy = false, starDailyRetry = {};
function starDailyTick() {
  if (starDailyBusy || !charList.length) return;
  var api = getApiCfg();
  if (!api.url || !api.key || !api.model) return;
  var today = starDayKey(Date.now());
  var char = charList.filter(function(c) {
    if (!c.id || !(c.inChat || c.builtinAssistant) || !starOn(c) || (starDailyRetry[c.id] || 0) > Date.now()) return false;
    return !stars.some(function(s) { return s.charId === c.id && s.src === 'daily' && starDayKey(s.at) === today; });
  })[0];
  if (!char) return;
  var idx = findCharIdx(char.id);
  if (idx < 0) return;
  starDailyBusy = true;
  var anon = Math.random() < STAR_ANON_P;   // 偶尔是一颗匿名的
  var msgs = charContextMsgs(idx).concat([activityAsk(anon
    ? '【星星瓶 · 匿名】现在是 ' + nowText(char) + '。今天你要给{{user}}叠一颗匿名的小星星：写一张很短的小纸条（15～60 字），放进 TA 的星星瓶里。' +
      '这一颗是匿名的：纸条上没有名字，小手机里谁都看不出是谁写的，{{user}}也不会知道是你。所以可以不用顾及身份、关系和你在 TA 面前的样子，' +
      '写平时不好说出口的话：更直白的心事、偷偷的在意、一点小委屈或小抱怨、不好意思承认的事……仍然是你本人真实的心意，不写伤人的话。' +
      '不要署名，不要暗示是谁，不要用你标志性的称呼、口头禅和只有你们俩知道的事，也不要提「星星」「纸条」「匿名」。只输出纸条上的字。'
    : '【星星瓶】现在是 ' + nowText(char) + '。今天你要给{{user}}叠一颗小星星：写一张很短的小纸条（15～50 字），放进 TA 的星星瓶里。' +
      '写今天你想悄悄对 TA 说的一句话——想念、心疼、一件让你想起 TA 的小事、一句晚安都可以，要具体、像你本人，不要客套、不要署名，也不要提「星星」「纸条」。只输出纸条上的字。')]);
  callApiOnce(msgs, char).then(function(text) {
    text = String(text || '').replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').replace(/<[^>]*>/g, '').trim();
    if (!text) throw new Error('空的');
    addStar(char, text, 'daily', anon);
  }).catch(function() {
    starDailyRetry[char.id] = Date.now() + 2 * 3600000;   // 失败了过两个小时再试，不弹提示
  }).then(function() {
    starDailyBusy = false;
    setTimeout(starDailyTick, 8000);
  });
}
// 写匿名星星的人自己记得：最近 7 天 TA 匿名写过的（最多两颗），只放进 TA 自己的现实感知
function starAnonContextLine(char) {
  if (!char || !char.id) return '';
  var mine = stars.filter(function(s) { return s.anon && s.charId === char.id && Date.now() - s.at < 7 * 86400000; }).slice(-2);
  if (!mine.length) return '';
  return '【你偷偷写的匿名星星】你' + mine.map(function(s) { return fmtAgo(s.at) + '匿名给{{user}}叠过一颗星星，纸条上写着「' + s.text + '」'; }).join('；') +
    '。小手机里谁都不知道是你写的，{{user}}也不知道。你自己心里记得就好，不要主动说破；如果{{user}}提起或者猜是谁，认不认看你自己。' + (mine.some(function(s) { return s.read; }) ? '' : '（TA 还没打开看。）');
}
onMphoneReady(function() {
  paintStarBadge();
  setTimeout(starDailyTick, 30000);
  setInterval(starDailyTick, 30 * 60000);
});

// ---------- 界面：玻璃瓶 ----------
var sjBody = document.querySelector('#appStarJar .settings-content');
sjBody.classList.add('sj-body');
function starColor(s) { return s.anon ? STAR_ANON_COLOR : STAR_COLORS[starHash(s.id) % STAR_COLORS.length]; }
function starSvg(color) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.7 5.9 6.4.7-4.8 4.4 1.3 6.3L12 16.7l-5.6 3.2 1.3-6.3-4.8-4.4 6.4-.7z" fill="' + color + '" stroke="rgba(255,255,255,0.9)" stroke-width="1.2" stroke-linejoin="round"/></svg>';
}
// 星星在瓶底一层层堆起来：位置按星星 id 算，每次打开都一样
function starPilePos(i, n, size) {
  var W = 168, perRow = Math.max(4, Math.floor(W / (size * 0.82)));
  var row = Math.floor(i / perRow), col = i % perRow;
  var off = row % 2 ? size * 0.41 : 0;
  return { x: 6 + col * (W - size - 2) / Math.max(1, perRow - 1) * 0.94 + off * 0.5, y: row * size * 0.62 };
}
function renderStarJar(dropId) {
  sjBody.innerHTML = '';
  var wrap = document.createElement('div');
  wrap.className = 'sj-wrap';
  wrap.innerHTML = '<div class="sj-sky"></div><div class="sj-jar"><div class="sj-cork"></div><div class="sj-neck"></div><div class="sj-glass"><div class="sj-pile"></div><div class="sj-shine"></div></div><div class="sj-tag"></div></div>';
  sjBody.appendChild(wrap);
  for (var k = 0; k < 18; k++) {
    var tw = document.createElement('i');
    tw.style.left = (Math.random() * 100).toFixed(1) + '%';
    tw.style.top = (Math.random() * 70).toFixed(1) + '%';
    tw.style.animationDelay = (k * 0.37 % 4) + 's';
    wrap.querySelector('.sj-sky').appendChild(tw);
  }
  var pile = wrap.querySelector('.sj-pile');
  var n = stars.length, size = n > 120 ? 14 : n > 70 ? 17 : n > 36 ? 20 : 24;
  // 最多画最新的 220 颗，更早的还在，抽一颗时也能抽到
  var shown = stars.slice(-220);
  var bodies = [];
  shown.forEach(function(s, i) {
    var h = starHash(s.id), p = starPilePos(i, shown.length, size);
    var el = document.createElement('button');
    el.className = 'sj-star' + (s.read ? '' : ' unread');
    el.style.width = el.style.height = size + 'px';
    el.style.animationDelay = (h % 30) / 10 + 's';
    el.innerHTML = starSvg(starColor(s));
    el.addEventListener('click', function(e) {
      if (sjPhys.dragged) { e.preventDefault(); return; }   // 是在摇瓶子，不是点星星
      openStarNote(s);
    });
    pile.appendChild(el);
    // 位置交给下面的小物理：上次的位置接着用；第一次按原来的堆法摆；刚掉进来的从瓶口落下
    var old = sjPhys.keep[s.id];
    var b = old && s.id !== dropId ? { x: old.x, y: old.y, a: old.a } :
      s.id === dropId ? { x: SJ_W / 2 + (h % 40) - 20, y: size, a: 0, vy: 60 } :
      { x: p.x + (h % 7) - 3 + size / 2, y: SJ_H - (p.y + (h >> 3) % 5) - size / 2, a: (h % 70) - 35 };
    b.id = s.id; b.el = el; b.r = size * 0.42; b.half = size / 2; b.vx = 0; b.vy = b.vy || 0;
    bodies.push(b);
  });
  sjPhysStart(pile, bodies);
  var unread = stars.filter(function(s) { return !s.read; }).length;
  wrap.querySelector('.sj-tag').textContent = n ? n + ' 颗' : '';
  var card = document.createElement('div');
  card.className = 'sj-foot';
  var tip = document.createElement('div');
  tip.className = 'sj-tip';
  tip.textContent = !n ? '瓶子还空着。TA 们想你的时候，会悄悄叠一颗星星放进来' : unread ? '有 ' + unread + ' 颗新的星星在发光，点一颗看看' : '点一颗星星，看看 TA 写了什么';
  card.appendChild(tip);
  if (n) {
    var btn = document.createElement('button');
    btn.className = 'mine-acc-btn sj-pick';
    btn.textContent = '抽一颗';
    btn.addEventListener('click', function() {
      var pool = stars.filter(function(s) { return !s.read; });
      if (!pool.length) pool = stars;
      openStarNote(pool[Math.floor(Math.random() * pool.length)]);
    });
    card.appendChild(btn);
  }
  sjBody.appendChild(card);
}
// ---------- 星星跟着重力滑、摇一摇会晃（手机有陀螺仪时；没有的话在瓶子上左右划也能摇） ----------
// 一个很小的二维物理：星星当成小圆，受重力、互相挤、碰瓶壁（瓶子四角是圆的）；都停稳了就歇着，不一直耗电
var SJ_W = 172, SJ_H = 256, SJ_G = 1500;
var sjPhys = { bodies: [], pile: null, raf: 0, still: 0, gx: 0, gy: 1, keep: {}, last: 0, dragged: false, asked: false, sensor: false };
function sjPhysStart(pile, bodies) {
  sjPhys.pile = pile; sjPhys.bodies = bodies;
  bodies.forEach(sjDraw);
  sjWake();
}
function sjDraw(b) {
  b.el.style.transform = 'translate(' + (b.x - b.half).toFixed(1) + 'px,' + (b.y - b.half).toFixed(1) + 'px) rotate(' + b.a.toFixed(1) + 'deg)';
}
function sjWake() {
  sjPhys.still = 0;
  if (sjPhys.raf || !sjPhys.bodies.length) return;
  sjPhys.last = 0;
  sjPhys.raf = requestAnimationFrame(sjStep);
}
// 摇一下：所有星星往反方向甩（瓶子往右动，里面的东西相对往左），带一点随机
function sjKick(dx, dy) {
  sjPhys.bodies.forEach(function(b) {
    b.vx += dx * (0.8 + Math.random() * 0.4) + (Math.random() - 0.5) * Math.abs(dx + dy) * 0.3;
    b.vy += dy * (0.8 + Math.random() * 0.4) + (Math.random() - 0.5) * Math.abs(dx + dy) * 0.3;
  });
  sjWake();
}
function sjStep(t) {
  sjPhys.raf = 0;
  var scr = document.getElementById('appStarJar');
  if (!scr.classList.contains('active') || !sjPhys.pile || !sjPhys.pile.isConnected) return;
  var dt = sjPhys.last ? Math.min(0.033, (t - sjPhys.last) / 1000) : 0.016;
  sjPhys.last = t;
  var W = sjPhys.pile.clientWidth || SJ_W, H = sjPhys.pile.clientHeight || SJ_H;
  var bs = sjPhys.bodies, n = bs.length, i, j, b;
  var gx = sjPhys.gx * SJ_G, gy = sjPhys.gy * SJ_G;
  for (i = 0; i < n; i++) {
    b = bs[i];
    b.px = b.x; b.py = b.y;
    b.vx = (b.vx + gx * dt) * 0.985; b.vy = (b.vy + gy * dt) * 0.985;
    var vs = Math.abs(b.vx) + Math.abs(b.vy);
    if (vs > 1400) { b.vx *= 1400 / vs; b.vy *= 1400 / vs; }
    b.x += b.vx * dt; b.y += b.vy * dt;
  }
  // 互相挤开：按格子找邻居，挤两遍
  var cell = 2.2 * (bs[0] ? bs[0].r : 10);
  for (var it = 0; it < 2; it++) {
    var grid = {};
    for (i = 0; i < n; i++) { b = bs[i]; var k = Math.floor(b.x / cell) + ',' + Math.floor(b.y / cell); (grid[k] = grid[k] || []).push(i); }
    for (i = 0; i < n; i++) {
      b = bs[i];
      var cx = Math.floor(b.x / cell), cy = Math.floor(b.y / cell);
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var list = grid[(cx + ox) + ',' + (cy + oy)];
        if (!list) continue;
        for (var q = 0; q < list.length; q++) {
          j = list[q]; if (j <= i) continue;
          var o = bs[j], dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy, min = b.r + o.r;
          if (d2 >= min * min || d2 < 1e-6) continue;
          var d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (min - d) / 2;
          b.x -= nx * push; b.y -= ny * push; o.x += nx * push; o.y += ny * push;
        }
      }
    }
    for (i = 0; i < n; i++) sjWalls(bs[i], W, H);
  }
  // 速度按这一帧实际挪了多少来算（挤住了就停下，不会一直抖）；滚动的时候顺手转一点
  var moving = 0;
  for (i = 0; i < n; i++) {
    b = bs[i];
    var mx = b.x - b.px, my = b.y - b.py;
    b.vx = mx / dt; b.vy = my / dt;
    b.a += mx * 2.2;
    var mv = Math.abs(mx) + Math.abs(my);
    if (mv > 0.25) moving++;
    if (mv > 0.05 || !b.drawn) { sjDraw(b); b.drawn = true; }
    sjPhys.keep[b.id] = { x: b.x, y: b.y, a: b.a };
  }
  // 连着一秒钟都没什么动静就歇着，手机一歪、一摇再醒
  sjPhys.still = moving ? 0 : sjPhys.still + 1;
  if (sjPhys.still < 60) sjPhys.raf = requestAnimationFrame(sjStep);
}
// 瓶壁：矩形加圆角（上面圆角大一点，和玻璃的样子对上）
function sjWalls(b, W, H) {
  var r = b.r, R = b.y < H / 2 ? 40 : 32;
  if (b.x < r) { b.x = r; if (b.vx < 0) { b.vx *= -0.2; b.vy *= 0.92; } }
  if (b.x > W - r) { b.x = W - r; if (b.vx > 0) { b.vx *= -0.2; b.vy *= 0.92; } }
  if (b.y < r) { b.y = r; if (b.vy < 0) { b.vy *= -0.2; b.vx *= 0.92; } }
  if (b.y > H - r) { b.y = H - r; if (b.vy > 0) { b.vy *= -0.2; b.vx *= 0.92; } }
  var ccx = b.x < R ? R : b.x > W - R ? W - R : null, ccy = b.y < R ? R : b.y > H - R ? H - R : null;
  if (ccx === null || ccy === null) return;
  var dx = b.x - ccx, dy = b.y - ccy, d = Math.sqrt(dx * dx + dy * dy), lim = R - r;
  if (d <= lim || d < 1e-6) return;
  var nx = dx / d, ny = dy / d;
  b.x = ccx + nx * lim; b.y = ccy + ny * lim;
  var vn = b.vx * nx + b.vy * ny;
  if (vn > 0) { b.vx -= nx * vn * 1.2; b.vy -= ny * vn * 1.2; }
}
// 手机的倾斜 → 屏幕平面里的重力方向（按 alpha/beta/gamma 欧拉角算，竖着拿是正下方，躺平时几乎没有）
window.addEventListener('deviceorientation', function(e) {
  if (e.beta == null || e.gamma == null) return;
  var rad = Math.PI / 180, cb = Math.cos(e.beta * rad);
  var gx = cb * Math.sin(e.gamma * rad), gy = Math.sin(e.beta * rad);
  sjPhys.sensor = true;
  if (Math.abs(gx - sjPhys.gx) + Math.abs(gy - sjPhys.gy) > 0.03) { sjPhys.gx = gx; sjPhys.gy = gy; if (document.getElementById('appStarJar').classList.contains('active')) sjWake(); }
});
// 摇一摇：去掉重力后的加速度突然变大，就往反方向甩一下
window.addEventListener('devicemotion', function(e) {
  var a = e.acceleration;
  if (!a || a.x == null || !document.getElementById('appStarJar').classList.contains('active')) return;
  var m = Math.abs(a.x) + Math.abs(a.y);
  if (m < 6) return;
  sjKick(-a.x * 45, a.y * 45);
});
// iPhone 要先问一句才给陀螺仪（只能在点击里问）；在瓶子上左右划也能摇
(function() {
  var wrap = document.getElementById('appStarJar'), sx = 0, sy = 0, lx = 0, ly = 0, lt = 0, down = false;
  wrap.addEventListener('pointerdown', function(e) {
    if (!e.target.closest('.sj-wrap')) return;
    if (!sjPhys.asked) {
      sjPhys.asked = true;
      [window.DeviceOrientationEvent, window.DeviceMotionEvent].forEach(function(E) {
        if (E && typeof E.requestPermission === 'function') E.requestPermission().catch(function() {});
      });
    }
    down = true; sjPhys.dragged = false; sx = lx = e.clientX; sy = ly = e.clientY; lt = e.timeStamp;
  });
  wrap.addEventListener('pointermove', function(e) {
    if (!down) return;
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10) sjPhys.dragged = true;
    var dtm = Math.max(8, e.timeStamp - lt);
    if (sjPhys.dragged) sjKick((e.clientX - lx) / dtm * 70, (e.clientY - ly) / dtm * 70);
    lx = e.clientX; ly = e.clientY; lt = e.timeStamp;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(t) {
    wrap.addEventListener(t, function() { down = false; setTimeout(function() { sjPhys.dragged = false; }, 0); });
  });
})();

var starNoteCur = null;
function openStarNote(s) {
  starNoteCur = s;
  var box = document.getElementById('starNote');
  box.querySelector('.star-note-text').textContent = s.text;
  var d = new Date(s.at);
  var char = !s.anon && charList.filter(function(c) { return c.id === s.charId; })[0];
  box.querySelector('.star-note-from').textContent = s.anon ? '—— 一颗匿名的星星' : '—— ' + ((char && (char.charAlias || char.charName)) || s.name || 'TA');
  box.querySelector('.star-note-date').textContent = d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  box.querySelector('.star-note-ic').innerHTML = starSvg(starColor(s));
  var ov = document.getElementById('starNoteOverlay');
  ov.classList.remove('open');
  void ov.offsetWidth;
  ov.classList.add('open');
  if (!s.read) { s.read = true; saveStars(); }
}
function closeStarNote() {
  document.getElementById('starNoteOverlay').classList.remove('open');
  starNoteCur = null;
  renderStarJar();
}
document.getElementById('starNoteClose').addEventListener('click', closeStarNote);
closeOnBackdrop(document.getElementById('starNoteOverlay'), closeStarNote);
document.getElementById('starNoteDel').addEventListener('click', function() {
  var s = starNoteCur;
  if (!s) return;
  openConfirm('把这颗星星拿出瓶子？拿出来就没有了', function() {
    stars = stars.filter(function(x) { return x !== s; });
    saveStars();
    closeStarNote();
  });
});
document.getElementById('dockStarJar').addEventListener('click', function() { renderStarJar(); });
