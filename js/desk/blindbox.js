// 眠花糖机 — 桌面「盲盒」：货架上摆着一个个系列（自带的 + 自己做的 + 让 AI 做的），点进去是一整盒 12 个（4×3：1 个隐藏、2～3 个稀有、其余普通），
// 挑一个拆，花钱包里的钱，抽到的放进「我的 → 资产 → 赛博小物」（js/chat/assets.js）；拆过的位置空着，「换一盒」重新装一盒。
// 系列：{ id, name, icon, img, price, kind: 'item'（emoji / 图片 + 名字）| 'text'（一张小纸条一句话）, items: [{ id, r: n/r/h, name, icon, img, text }] }
// mphone_blindbox = { custom: [系列], boxes: { 系列id: { slots: [{ iid, r, open }] } } }

var BB_SLOTS = 12;   // 4×3（用户要的，和下面图鉴一样一排 4 个）
var BB_BUILTIN = [
  { id: 'bb_sweet', name: '云朵甜品屋', icon: '🧁', price: 29, kind: 'item', items: [
    { id: 'a1', r: 'n', icon: '🍰', name: '草莓奶油蛋糕' }, { id: 'a2', r: 'n', icon: '🍮', name: '焦糖布丁' },
    { id: 'a3', r: 'n', icon: '🧁', name: '小纸杯蛋糕' }, { id: 'a4', r: 'n', icon: '🍩', name: '粉色甜甜圈' },
    { id: 'a5', r: 'n', icon: '🍪', name: '巧克力曲奇' }, { id: 'a6', r: 'n', icon: '🍡', name: '三色团子' },
    { id: 'a7', r: 'r', icon: '🍨', name: '星空圣代' }, { id: 'a8', r: 'r', icon: '🎂', name: '生日蛋糕' },
    { id: 'a9', r: 'h', icon: '🍯', name: '月光蜂蜜罐' }] },
  { id: 'bb_garden', name: '小花店', icon: '💐', price: 25, kind: 'item', items: [
    { id: 'b1', r: 'n', icon: '🌷', name: '郁金香' }, { id: 'b2', r: 'n', icon: '🌻', name: '向日葵' },
    { id: 'b3', r: 'n', icon: '🌼', name: '小雏菊' }, { id: 'b4', r: 'n', icon: '🌸', name: '樱花' },
    { id: 'b5', r: 'n', icon: '🌹', name: '玫瑰' }, { id: 'b6', r: 'n', icon: '🪻', name: '风信子' },
    { id: 'b7', r: 'r', icon: '💐', name: '一整束花' }, { id: 'b8', r: 'r', icon: '🪷', name: '睡莲' },
    { id: 'b9', r: 'h', icon: '🍀', name: '四叶草' }] },
  { id: 'bb_night', name: '夜空小动物', icon: '🌙', price: 39, kind: 'item', items: [
    { id: 'c1', r: 'n', icon: '🐱', name: '打盹的小猫' }, { id: 'c2', r: 'n', icon: '🐰', name: '长耳朵兔兔' },
    { id: 'c3', r: 'n', icon: '🐻', name: '抱枕小熊' }, { id: 'c4', r: 'n', icon: '🦊', name: '小狐狸' },
    { id: 'c5', r: 'n', icon: '🐧', name: '小企鹅' }, { id: 'c6', r: 'n', icon: '🐥', name: '小黄鸭' },
    { id: 'c7', r: 'r', icon: '🦄', name: '独角兽' }, { id: 'c8', r: 'r', icon: '🦉', name: '守夜猫头鹰' },
    { id: 'c9', r: 'h', icon: '🐋', name: '星海鲸鱼' }] },
  { id: 'bb_note', name: '小纸条', icon: '✉️', price: 9.9, kind: 'text', items: [
    { id: 'd1', r: 'n', text: '今天也辛苦了，先喝口水吧。' }, { id: 'd2', r: 'n', text: '慢一点也没关系，你一直在往前走。' },
    { id: 'd3', r: 'n', text: '记得吃饭，好好吃的那种。' }, { id: 'd4', r: 'n', text: '难过的时候不用急着好起来。' },
    { id: 'd5', r: 'n', text: '今天的云很好看，你抬头看了吗？' }, { id: 'd6', r: 'n', text: '你已经做得很好了，真的。' },
    { id: 'd7', r: 'n', text: '允许自己今天只做一件小事。' }, { id: 'd8', r: 'n', text: '被子晒过太阳的味道，送给你。' },
    { id: 'd9', r: 'r', text: '有人在很远的地方，认真地想着你。' }, { id: 'd10', r: 'r', text: '今天的运气分你一半，剩下一半也给你。' },
    { id: 'd11', r: 'h', text: '你是被偷偷喜欢着的人。' }] }
];

var bbData = mphoneStore.load('mphone_blindbox', null) || {};
if (!bbData.custom) bbData.custom = [];
if (!bbData.boxes) bbData.boxes = {};
function saveBB() { mphoneStore.save('mphone_blindbox', bbData); }
function bbAllSeries() { return BB_BUILTIN.concat(bbData.custom); }
function bbSeries(id) { return bbAllSeries().filter(function(s) { return s.id === id; })[0]; }
function bbItem(s, iid) { return s.items.filter(function(it) { return it.id === iid; })[0]; }
function bbPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function bbShuffle(arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

// 装一盒：1 个隐藏、2～3 个稀有、其余普通（系列里缺哪种就用别的补上）；普通款先各放一个，不够再随机
function bbNewBox(s) {
  var pool = { n: [], r: [], h: [] };
  s.items.forEach(function(it) { (pool[it.r] || pool.n).push(it); });
  var want = { h: 1, r: Math.random() < 0.5 ? 2 : 3 };
  want.n = BB_SLOTS - want.h - want.r;
  var slots = [];
  ['h', 'r', 'n'].forEach(function(r) {
    var src = pool[r].length ? pool[r] : pool.n.length ? pool.n : pool.r.length ? pool.r : pool.h;
    var bag = [];
    for (var i = 0; i < want[r]; i++) {
      if (!bag.length) bag = bbShuffle(src.slice());
      var it = bag.pop();
      slots.push({ iid: it.id, r: it.r, open: false });
    }
  });
  return { slots: bbShuffle(slots) };
}
function bbBox(s) {
  var b = bbData.boxes[s.id];
  // 系列改过、里面的东西删掉了：重新装一盒
  if (!b || b.slots.some(function(x) { return !bbItem(s, x.iid); })) { b = bbData.boxes[s.id] = bbNewBox(s); saveBB(); }
  return b;
}

// ---------- 画 ----------
var appBlindbox = document.getElementById('appBlindbox');
var bbCur = null, bbSel = -1;
function bbIconEl(o, cls) {
  var el = document.createElement('div');
  el.className = cls;
  if (o.img) { var im = document.createElement('img'); im.src = o.img; im.alt = ''; el.appendChild(im); }
  else el.textContent = o.icon || '🎁';
  return el;
}
function bbMoneyChip() {
  var c = document.createElement('div');
  c.className = 'bb-money';
  c.textContent = '钱包 ¥' + fmtMoney(getWallet(getMainAccount().uid).balance);
  return c;
}
function renderBBShelf() {
  bbCur = null; bbSel = -1;
  document.getElementById('bbTitle').textContent = '盲盒';
  document.getElementById('bbNavBtn').style.display = '';
  var body = document.getElementById('bbBody');
  body.innerHTML = '';
  body.appendChild(bbMoneyChip());
  var all = bbAllSeries();
  for (var i = 0; i < all.length; i += 3) {
    var shelf = document.createElement('div');
    shelf.className = 'bb-shelf';
    all.slice(i, i + 3).forEach(function(s) {
      var card = document.createElement('div');
      card.className = 'bb-series' + (bbData.custom.includes(s) ? ' custom' : '');
      card.appendChild(bbIconEl(s, 'bb-series-ic'));
      var nm = document.createElement('div'); nm.className = 'bb-series-name'; nm.textContent = s.name;
      var pr = document.createElement('div'); pr.className = 'bb-series-price'; pr.textContent = '¥' + fmtMoney(s.price);
      card.appendChild(nm); card.appendChild(pr);
      card.addEventListener('click', function() { renderBBBox(s); });
      shelf.appendChild(card);
    });
    body.appendChild(shelf);
  }
  var tip = document.createElement('div');
  tip.className = 'bb-tip';
  tip.textContent = '右上角 + 可以做自己的盲盒（图标款或文字款）';
  body.appendChild(tip);
}
function renderBBBox(s) {
  bbCur = s;
  var box = bbBox(s);
  document.getElementById('bbTitle').textContent = s.name;
  document.getElementById('bbNavBtn').style.display = 'none';
  var body = document.getElementById('bbBody');
  body.innerHTML = '';
  body.appendChild(bbMoneyChip());
  var left = box.slots.filter(function(x) { return !x.open; }).length;
  var crate = document.createElement('div');
  crate.className = 'bb-crate';
  var lid = document.createElement('div');
  lid.className = 'bb-crate-label';
  lid.innerHTML = '<span></span><b></b>';
  lid.querySelector('span').textContent = s.name + ' · 一盒 ' + BB_SLOTS + ' 个';
  lid.querySelector('b').textContent = '还剩 ' + left;
  crate.appendChild(lid);
  var grid = document.createElement('div');
  grid.className = 'bb-grid';
  box.slots.forEach(function(x, i) {
    var cell = document.createElement('div');
    cell.className = 'bb-cell' + (x.open ? ' open' : '') + (i === bbSel ? ' sel' : '');
    if (!x.open) {
      cell.innerHTML = '<div class="bb-mini"><i class="bb-mini-lid"></i><span>?</span></div>';
      cell.addEventListener('click', function() { bbSel = bbSel === i ? -1 : i; renderBBBox(s); });
    }
    grid.appendChild(cell);
  });
  crate.appendChild(grid);
  body.appendChild(crate);
  // 下面的按钮：拆开选中的 / 换一盒
  var acts = document.createElement('div');
  acts.className = 'bb-acts';
  var refill = document.createElement('button');
  refill.className = 'bb-btn ghost';
  refill.textContent = '换一盒';
  refill.addEventListener('click', function() {
    var doIt = function() { bbData.boxes[s.id] = bbNewBox(s); saveBB(); bbSel = -1; renderBBBox(s); };
    if (left && left < BB_SLOTS) openConfirm('换一盒？', doIt, { desc: '这盒剩下的 ' + left + ' 个就不要了', okText: '换' });
    else doIt();
  });
  var open = document.createElement('button');
  open.className = 'bb-btn';
  open.disabled = bbSel < 0;
  open.textContent = left ? (bbSel < 0 ? '挑一个吧' : '拆开（¥' + fmtMoney(s.price) + '）') : '这盒拆完啦';
  open.addEventListener('click', function() { if (bbSel >= 0) bbDraw(s, bbSel); });
  acts.appendChild(refill); acts.appendChild(open);
  body.appendChild(acts);
  // 图鉴：抽到过的亮着，没抽到的灰着，隐藏款没抽到前是问号
  var h = document.createElement('div');
  h.className = 'section-label';
  var got = s.items.filter(function(it) { return assetOwnedCount(s.id, it.id); }).length;
  h.textContent = '图鉴 ' + got + ' / ' + s.items.length;
  body.appendChild(h);
  var dex = document.createElement('div');
  dex.className = 'bb-dex' + (s.kind === 'text' ? ' text' : '');
  ['n', 'r', 'h'].forEach(function(r) {
    s.items.filter(function(it) { return it.r === r; }).forEach(function(it) {
      var n = assetOwnedCount(s.id, it.id);
      var c = document.createElement('div');
      c.className = 'bb-dex-cell r-' + r + (n ? ' got' : '');
      if (s.kind === 'text') c.textContent = n ? it.text : r === 'h' ? '？' : '一张还没拆到的纸条';
      else if (!n && r === 'h') c.innerHTML = '<div class="bb-dex-ic">？</div>';
      else c.appendChild(bbIconEl(it, 'bb-dex-ic'));
      if (s.kind !== 'text') {
        var nm = document.createElement('div'); nm.className = 'bb-dex-name';
        nm.textContent = n || r !== 'h' ? (it.name || '') : '隐藏款';
        c.appendChild(nm);
      }
      if (r !== 'n') { var t = document.createElement('i'); t.className = 'bb-dex-tag'; t.textContent = r === 'h' ? '隐藏' : '稀有'; c.appendChild(t); }
      if (n > 1) { var k = document.createElement('span'); k.className = 'bb-dex-count'; k.textContent = '×' + n; c.appendChild(k); }
      dex.appendChild(c);
    });
  });
  body.appendChild(dex);
  if (bbData.custom.includes(s)) {
    var ed = document.createElement('button');
    ed.className = 'asset-add-btn';
    ed.textContent = '编辑这个盲盒';
    ed.addEventListener('click', function() { openBBEditor(s); });
    body.appendChild(ed);
  }
}

// 拆一个：先扣钱，再放进资产
function bbDraw(s, i) {
  var box = bbBox(s), slot = box.slots[i];
  if (!slot || slot.open) return;
  var uid = getMainAccount().uid;
  if (getWallet(uid).balance < s.price) { showToast('钱包余额不够啦，去「我的 → 钱包」充一点吧', 'error'); return; }
  var it = bbItem(s, slot.iid);
  if (s.price > 0) walletAdd(-s.price, '盲盒 · ' + s.name, uid);
  slot.open = true;
  saveBB();
  var a = assetAddCyber(s, it);
  bbSel = -1;
  renderBBBox(s);
  if (typeof refreshMineEntries === 'function') refreshMineEntries();
  bbReveal(s, it, a.count);
}
function bbReveal(s, it, count) {
  var ov = document.createElement('div');
  ov.className = 'mine-acc-overlay open';
  ov.innerHTML = '<div class="mine-acc-modal bb-reveal r-' + it.r + '"><div class="bb-reveal-tag"></div><div class="bb-reveal-body"></div>' +
    '<div class="bb-reveal-name"></div><div class="bb-reveal-sub"></div><div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-add">收下</button></div></div>';
  ov.querySelector('.bb-reveal-tag').textContent = it.r === 'h' ? '★ 隐藏款 ★' : it.r === 'r' ? '✦ 稀有款' : '普通款';
  var body = ov.querySelector('.bb-reveal-body');
  if (s.kind === 'text') { var p = document.createElement('div'); p.className = 'bb-note-paper'; p.textContent = it.text; body.appendChild(p); }
  else body.appendChild(bbIconEl(it, 'bb-reveal-ic'));
  ov.querySelector('.bb-reveal-name').textContent = it.name || '';
  ov.querySelector('.bb-reveal-sub').textContent = count > 1 ? '这是第 ' + count + ' 个了，放进了资产' : '第一次抽到！放进了「我的 → 资产」';
  var close = function() { ov.remove(); };
  ov.querySelector('button').addEventListener('click', close);
  ov.addEventListener('click', function(e) { if (e.target === ov) close(); });
  (document.querySelector('.phone') || document.body).appendChild(ov);
}

// ---------- 自定义盲盒 ----------
// 图标款：每一个是 emoji 或图片 + 名字；文字款：一行一张纸条，分普通 / 稀有 / 隐藏三个框
function bbHash(t) { var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return 't' + (h >>> 0).toString(36); }
function bbShrink(src, cb) {
  if (!/^data:/.test(src) || typeof compressImage !== 'function') { cb(src); return; }
  var img = new Image();
  img.onload = function() {
    var k = Math.min(1, 200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    try { cb(c.toDataURL('image/png')); } catch (_) { cb(src); }   // 留着透明底
  };
  img.onerror = function() { cb(src); };
  img.src = src;
}
function openBBEditor(s) {
  var editing = !!s;
  var d = s ? JSON.parse(JSON.stringify(s)) : { id: genFeedId('bbc'), name: '', icon: '🎁', img: '', price: 20, kind: 'item', items: [] };
  var ov = document.createElement('div');
  ov.className = 'mine-acc-overlay open';
  ov.innerHTML = '<div class="mine-acc-modal bb-edit">' +
    '<div class="mine-acc-title">' + (editing ? '编辑盲盒' : '做一个盲盒') + '</div>' +
    '<div class="bb-edit-scroll">' +
      '<div class="bb-edit-head"><div class="bb-edit-ic" data-f="ic"></div><div class="bb-edit-head-r">' +
        '<input class="pet-edit-input" maxlength="16" placeholder="盲盒的名字" data-f="name">' +
        '<div class="bb-edit-price">¥ <input class="pet-edit-input" type="number" min="0" step="0.1" data-f="price"></div></div></div>' +
      '<div class="pet-chips bb-edit-kind"><button class="pet-chip" data-k="item">图标款</button><button class="pet-chip" data-k="text">文字款</button></div>' +
      '<div class="bb-ai"><div class="bb-ai-title">✨ 让 AI 帮你做</div>' +
        '<input class="pet-edit-input" maxlength="40" placeholder="主题：某部番 / 某个角色 / 雨天的小镇…" data-f="aitheme">' +
        '<textarea class="pet-edit-input bb-edit-text" rows="2" maxlength="300" placeholder="要求（可以不写）：比如只要徽章和立牌、要有 xx" data-f="aireq"></textarea>' +
        '<button class="bb-ai-btn" data-act="ai">按上面选的款式生成</button></div>' +
      '<div class="bb-edit-items"></div>' +
    '</div>' +
    '<div class="mine-acc-actions">' + (editing ? '<button class="mine-acc-btn mine-acc-btn-close" data-act="del">删除</button>' : '') +
      '<button class="mine-acc-btn mine-acc-btn-close" data-act="cancel">取消</button><button class="mine-acc-btn mine-acc-btn-add" data-act="ok">好了</button></div>' +
  '</div>';
  var $ = function(q) { return ov.querySelector(q); };
  $('[data-f="name"]').value = d.name;
  $('[data-f="price"]').value = d.price;
  // 盲盒的图标：点一下输 emoji 或选图片
  function paintIc() {
    var ic = $('[data-f="ic"]');
    ic.innerHTML = '';
    if (d.img) { var im = document.createElement('img'); im.src = d.img; ic.appendChild(im); } else ic.textContent = d.icon || '🎁';
  }
  paintIc();
  $('[data-f="ic"]').addEventListener('click', function() { bbPickIcon(d, paintIc); });
  // 东西：按款式画
  var rows = { n: [], r: [], h: [] };
  function itemsFromForm() {
    if (d.kind === 'text') {
      var out = [];
      ['n', 'r', 'h'].forEach(function(r) {
        var ta = ov.querySelector('textarea[data-r="' + r + '"]');
        ta.value.split('\n').map(function(t) { return t.trim(); }).filter(Boolean).forEach(function(t) {
          if (!out.some(function(o) { return o.text === t; })) out.push({ id: bbHash(t), r: r, text: t.slice(0, 120) });
        });
      });
      return out;
    }
    var list = [];
    ['n', 'r', 'h'].forEach(function(r) {
      rows[r].forEach(function(it) { it.name = (it._in.value || '').trim().slice(0, 20); if (it.name || it.img || it.icon) list.push({ id: it.id, r: r, name: it.name, icon: it.icon, img: it.img }); });
    });
    return list;
  }
  function paintItems() {
    var wrap = $('.bb-edit-items');
    wrap.innerHTML = '';
    ov.querySelectorAll('.bb-edit-kind .pet-chip').forEach(function(c) { c.classList.toggle('active', c.dataset.k === d.kind); });
    [['n', '普通款', '一盒里最多的'], ['r', '稀有款', '一盒 1～2 个'], ['h', '隐藏款', '一盒 1 个']].forEach(function(g) {
      var r = g[0];
      var lab = document.createElement('div');
      lab.className = 'bb-edit-label r-' + r;
      lab.innerHTML = '<b></b><span></span>';
      lab.querySelector('b').textContent = g[1];
      lab.querySelector('span').textContent = d.kind === 'text' ? g[2] + ' · 一行一张纸条' : g[2];
      wrap.appendChild(lab);
      if (d.kind === 'text') {
        var ta = document.createElement('textarea');
        ta.className = 'pet-edit-input bb-edit-text';
        ta.dataset.r = r;
        ta.rows = r === 'n' ? 5 : 2;
        ta.placeholder = r === 'n' ? '今天也辛苦了\n记得吃饭\n……' : r === 'r' ? '稀有一点的话' : '最想藏起来的那句';
        ta.value = d.items.filter(function(it) { return it.r === r; }).map(function(it) { return it.text; }).join('\n');
        wrap.appendChild(ta);
        return;
      }
      rows[r] = d.items.filter(function(it) { return it.r === r; }).map(function(it) { return { id: it.id, name: it.name, icon: it.icon, img: it.img }; });
      var list = document.createElement('div');
      wrap.appendChild(list);
      function addRow(it) {
        var row = document.createElement('div');
        row.className = 'bb-edit-row';
        var ic = document.createElement('div');
        ic.className = 'bb-edit-row-ic';
        var paint = function() { ic.innerHTML = ''; if (it.img) { var im = document.createElement('img'); im.src = it.img; ic.appendChild(im); } else ic.textContent = it.icon || '＋'; };
        paint();
        ic.addEventListener('click', function() { bbPickIcon(it, paint); });
        var nm = document.createElement('input');
        nm.className = 'pet-edit-input';
        nm.maxLength = 20;
        nm.placeholder = '名字';
        nm.value = it.name || '';
        it._in = nm;
        var del = document.createElement('button');
        del.className = 'bb-edit-row-del';
        del.textContent = '✕';
        del.addEventListener('click', function() { rows[r] = rows[r].filter(function(x) { return x !== it; }); row.remove(); });
        row.appendChild(ic); row.appendChild(nm); row.appendChild(del);
        list.appendChild(row);
      }
      rows[r].forEach(addRow);
      var add = document.createElement('button');
      add.className = 'bb-edit-add';
      add.textContent = '+ 加一个';
      add.addEventListener('click', function() { var it = { id: genFeedId('i'), name: '', icon: '' }; rows[r].push(it); addRow(it); it._in.focus(); });
      wrap.appendChild(add);
    });
  }
  paintItems();
  ov.querySelectorAll('.bb-edit-kind .pet-chip').forEach(function(c) {
    c.addEventListener('click', function() {
      if (c.dataset.k === d.kind) return;
      d.items = itemsFromForm();
      d.kind = c.dataset.k;
      // 换款式：名字 / 纸条互相带过去，免得白写
      d.items = d.items.map(function(it) {
        return d.kind === 'text' ? { id: bbHash(it.name || it.icon || ''), r: it.r, text: it.name || it.icon || '' }
                                 : { id: genFeedId('i'), r: it.r, name: (it.text || '').slice(0, 16), icon: '' };
      }).filter(function(it) { return it.text || it.name; });
      paintItems();
    });
  });
  // AI 生成：填进表单，看看、改改再点「好了」
  $('[data-act="ai"]').addEventListener('click', function() {
    var btn = this, theme = $('[data-f="aitheme"]').value.trim();
    if (!theme) { shakeEl($('[data-f="aitheme"]')); return; }
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '正在做…';
    bbAiGen(d.kind, theme, $('[data-f="aireq"]').value.trim()).then(function(g) {
      if (!ov.isConnected) return;
      d.name = g.name; d.icon = g.icon; d.img = ''; d.items = g.items;
      $('[data-f="name"]').value = g.name;
      paintIc(); paintItems();
      showToast('✓ 做好了，看看要不要改', 'success');
    }).catch(function(e) {
      showToast('没做出来：' + ((e && e.message) || '再试一次吧').slice(0, 60), 'error');
    }).then(function() { btn.disabled = false; btn.textContent = '按上面选的款式生成'; });
  });
  var close = function() { ov.remove(); };
  $('[data-act="cancel"]').addEventListener('click', close);
  $('[data-act="ok"]').addEventListener('click', function() {
    var name = $('[data-f="name"]').value.trim();
    if (!name) { shakeEl($('[data-f="name"]')); return; }
    var price = Math.round(parseFloat($('[data-f="price"]').value) * 100) / 100;
    if (!(price >= 0) || price > WALLET_TOPUP_MAX) { shakeEl($('[data-f="price"]')); showToast('价格写 0～100000 之间', 'error'); return; }
    var items = itemsFromForm();
    if (!items.length) { showToast('至少放一个东西进去', 'error'); return; }
    d.name = name.slice(0, 16); d.price = price; d.items = items;
    var idx = bbData.custom.findIndex(function(x) { return x.id === d.id; });
    if (idx >= 0) bbData.custom[idx] = d; else bbData.custom.push(d);
    // 改过的盒子：里面还有不存在的东西就重新装（bbBox 会处理），款式变了也重装
    if (s && s.kind !== d.kind) delete bbData.boxes[d.id];
    saveBB();
    close();
    if (s) renderBBBox(d); else renderBBShelf();
    showToast(editing ? '✓ 改好了' : '✓ 摆上货架了', 'success');
  });
  if (editing) $('[data-act="del"]').addEventListener('click', function() {
    openConfirm('删除盲盒「' + s.name + '」？', function() {
      bbData.custom = bbData.custom.filter(function(x) { return x.id !== s.id; });
      delete bbData.boxes[s.id];
      saveBB();
      close();
      renderBBShelf();
    }, { desc: '已经抽到的小物还留在资产里' });
  });
  (document.querySelector('.phone') || document.body).appendChild(ov);
  if (!editing) setTimeout(function() { $('[data-f="name"]').focus(); }, 50);
}
// 让 AI 做一个系列：只要 JSON，解析不对就算失败
function bbAiGen(kind, theme, req) {
  var shape = kind === 'text'
    ? '{"name":"系列名（不超过 8 个字）","icon":"一个代表这个系列的 emoji","items":[{"r":"n","text":"一张小纸条上的一句话（不超过 40 个字）"}]}。普通款（r 写 n）10 个，稀有款（r 写 r）3 个，隐藏款（r 写 h）1 个；每句都不一样，越稀有越珍贵、越让人心动'
    : '{"name":"系列名（不超过 10 个字）","icon":"一个代表这个系列的 emoji","items":[{"r":"n","icon":"一个 emoji","name":"名字（不超过 16 个字）"}]}。普通款（r 写 n）8 个，稀有款（r 写 r）3 个，隐藏款（r 写 h）1 个；名字有画面感，越稀有越特别';
  // 用户主要想做二次元 IP 周边盲盒：抽到「某部番的某个角色的某种周边」
  var ip = '如果主题是一部动漫、游戏、小说之类的作品（或者其中的角色），就做成这个作品的周边盲盒：' +
    (kind === 'text' ? '每张纸条是作品里某个角色口吻写给对方的一句话，开头写「角色名：」，句子自己写、不要照搬原作台词；稀有款是人气角色或特别的话，隐藏款最珍贵。'
                     : '每个东西写成「角色名 · 周边种类」（比如徽章、亚克力立牌、钥匙扣、色纸、Q 版小手办、拍立得卡、透卡、棉花娃娃），角色要是作品里真的有的、名字写对，emoji 用周边种类对应的；稀有款是人气角色或特别材质（镭射、闪粉），隐藏款是特别版本（限定服装、隐藏角色之类）。') +
    '不是作品的普通主题就照主题自由发挥。';
  var ask = '请设计一个小手机里的盲盒系列' + (kind === 'text' ? '（文字款：每个盲盒里是一张写着一句话的小纸条）' : '（每个盲盒里是一个小东西，用一个 emoji 表示）') +
    '。主题：' + theme + '。' + (req ? '要求：' + req + '。' : '') + '\n' + ip + '\n只输出 JSON，不要别的文字、不要代码块：' + shape + '。';
  return callApiOnce([{ role: 'user', content: ask }], null).then(function(text) {
    var t = String(text || ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
    var o = JSON.parse(t.slice(a, b + 1));
    var items = (o.items || []).map(function(it) {
      var r = /^[nrh]$/.test(it.r) ? it.r : 'n';
      if (kind === 'text') { var x = String(it.text || '').trim().slice(0, 120); return x ? { id: bbHash(x), r: r, text: x } : null; }
      var nm = String(it.name || '').trim().slice(0, 20);
      return nm ? { id: genFeedId('i'), r: r, name: nm, icon: String(it.icon || '').trim().slice(0, 8) } : null;
    }).filter(Boolean);
    if (!items.length) throw new Error('AI 给的内容读不出来');
    return { name: String(o.name || theme).trim().slice(0, 16), icon: String(o.icon || '🎁').trim().slice(0, 8), items: items };
  });
}
// 换图标：输一个 emoji，或者选图片
function bbPickIcon(o, done) {
  var ov = document.createElement('div');
  ov.className = 'mine-acc-overlay open';
  ov.innerHTML = '<div class="mine-acc-modal"><div class="mine-acc-title">换个样子</div>' +
    '<input class="pet-edit-input" maxlength="8" placeholder="输一个 emoji，比如 🍓" style="text-align:center;font-size:20px;">' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-act="img">用图片</button>' +
    '<button class="mine-acc-btn mine-acc-btn-add" data-act="ok">好了</button></div></div>';
  var inp = ov.querySelector('input');
  inp.value = o.img ? '' : (o.icon || '');
  var close = function() { ov.remove(); };
  ov.addEventListener('click', function(e) { if (e.target === ov) close(); });
  ov.querySelector('[data-act="ok"]').addEventListener('click', function() {
    var v = inp.value.trim();
    if (v) { o.icon = v; o.img = ''; done(); }
    close();
  });
  ov.querySelector('[data-act="img"]').addEventListener('click', function() {
    close();
    openImgPicker(function(src) { bbShrink(src, function(small) { o.img = small; done(); }); });
  });
  (document.querySelector('.phone') || document.body).appendChild(ov);
  setTimeout(function() { inp.focus(); }, 50);
}

// ---------- 打开 / 返回 ----------
document.getElementById('dockBlindbox').addEventListener('click', function() {
  renderBBShelf();
  appBlindbox.classList.add('active');
});
document.getElementById('backBlindbox').addEventListener('click', function() {
  if (bbCur) { renderBBShelf(); return; }   // 在一盒里时先回货架
  appBlindbox.classList.remove('active');
});
document.getElementById('bbNavBtn').addEventListener('click', function() { openBBEditor(null); });
