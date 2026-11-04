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
function addStar(char, text, src) {
  text = String(text || '').replace(/^["“「『]+|["”」』]+$/g, '').trim().slice(0, 120);
  if (!char || !text) return null;
  var s = { id: 'st' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), charId: char.id, name: char.charAlias || char.charName || '', text: text, at: Date.now(), src: src || 'chat', read: false };
  stars.push(s);
  saveStars();
  if (document.getElementById('appStarJar').classList.contains('active')) renderStarJar(s.id);
  return s;
}

// ---------- 聊天里：角色偶尔悄悄叠一颗（一天最多一颗） ----------
function starRuleFor(char) {
  if (!char || !char.id) return '';
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
    if (!c.id || !(c.inChat || c.builtinAssistant) || (starDailyRetry[c.id] || 0) > Date.now()) return false;
    return !stars.some(function(s) { return s.charId === c.id && s.src === 'daily' && starDayKey(s.at) === today; });
  })[0];
  if (!char) return;
  var idx = findCharIdx(char.id);
  if (idx < 0) return;
  starDailyBusy = true;
  var msgs = charContextMsgs(idx).concat([activityAsk('【星星瓶】现在是 ' + nowText(char) + '。今天你要给{{user}}叠一颗小星星：写一张很短的小纸条（15～50 字），放进 TA 的星星瓶里。' +
    '写今天你想悄悄对 TA 说的一句话——想念、心疼、一件让你想起 TA 的小事、一句晚安都可以，要具体、像你本人，不要客套、不要署名，也不要提「星星」「纸条」。只输出纸条上的字。')]);
  callApiOnce(msgs, char).then(function(text) {
    text = String(text || '').replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').replace(/<[^>]*>/g, '').trim();
    if (!text) throw new Error('空的');
    addStar(char, text, 'daily');
  }).catch(function() {
    starDailyRetry[char.id] = Date.now() + 2 * 3600000;   // 失败了过两个小时再试，不弹提示
  }).then(function() {
    starDailyBusy = false;
    setTimeout(starDailyTick, 8000);
  });
}
onMphoneReady(function() {
  paintStarBadge();
  setTimeout(starDailyTick, 30000);
  setInterval(starDailyTick, 30 * 60000);
});

// ---------- 界面：玻璃瓶 ----------
var sjBody = document.querySelector('#appStarJar .settings-content');
sjBody.classList.add('sj-body');
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
  shown.forEach(function(s, i) {
    var h = starHash(s.id), p = starPilePos(i, shown.length, size);
    var el = document.createElement('button');
    el.className = 'sj-star' + (s.read ? '' : ' unread') + (s.id === dropId ? ' drop' : '');
    el.style.width = el.style.height = size + 'px';
    el.style.left = (p.x + (h % 7) - 3) + 'px';
    el.style.bottom = (p.y + (h >> 3) % 5) + 'px';
    el.style.setProperty('--r', ((h % 70) - 35) + 'deg');
    el.style.animationDelay = (h % 30) / 10 + 's';
    el.innerHTML = starSvg(STAR_COLORS[h % STAR_COLORS.length]);
    el.addEventListener('click', function() { openStarNote(s); });
    pile.appendChild(el);
  });
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
var starNoteCur = null;
function openStarNote(s) {
  starNoteCur = s;
  var box = document.getElementById('starNote');
  box.querySelector('.star-note-text').textContent = s.text;
  var d = new Date(s.at);
  var char = charList.filter(function(c) { return c.id === s.charId; })[0];
  box.querySelector('.star-note-from').textContent = '—— ' + ((char && (char.charAlias || char.charName)) || s.name || 'TA');
  box.querySelector('.star-note-date').textContent = d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  box.querySelector('.star-note-ic').innerHTML = starSvg(STAR_COLORS[starHash(s.id) % STAR_COLORS.length]);
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
