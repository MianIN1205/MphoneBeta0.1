// 眠花糖机 — 表情包：用图床链接导入、分类、用名字辅助识别；打字时联想表情包；聊天里发送和显示，角色也能按名字发表情包

// =============================================
// 数据：{ cats: [{ id, name }], items: [{ id, name, url, cat }] }
// 每个角色能不能发、能用哪些分类：char.stickerCfg = { on, cats: [分类 id] }
// 消息里的表情包：{ content: '[表情包：名字]', sticker: { name, url } }，发给 AI 的就是 content 这一句；
// 图片打不开时气泡也显示这一句
// =============================================
var stkData = mphoneStore.load('mphone_stickers', null);
if (!stkData || !Array.isArray(stkData.cats) || !Array.isArray(stkData.items)) stkData = { cats: [], items: [] };
var stkCurCat = stkData.cats.length ? stkData.cats[0].id : '';

function saveStickers() { mphoneStore.save('mphone_stickers', stkData); }
function stkNewId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function stkCat(id) { return stkData.cats.filter(function(c) { return c.id === id; })[0] || null; }
function stkCatByName(name) { return stkData.cats.filter(function(c) { return c.name === name; })[0] || null; }
function stkItemsOf(catId) { return stkData.items.filter(function(s) { return s.cat === catId; }); }

function stickerText(name) { return '[表情包：' + name + ']'; }
var STK_RE = /\[表情包[：:]\s*([^\]\n]{1,40}?)\s*\]/g;

// 按名字找表情包：不分大小写，带不带 .jpg / .gif 这类后缀都算同一个
function stkKey(name) { return String(name || '').trim().toLowerCase().replace(/\.(jpe?g|png|gif|webp|bmp)$/, ''); }
function findSticker(name, pool) {
  var k = stkKey(name);
  if (!k) return null;
  return (pool || stkData.items).filter(function(s) { return stkKey(s.name) === k; })[0] || null;
}

// 角色能用的表情包：没打开就是空的
function stkCharCfg(char) { return (char && char.stickerCfg) || { on: false, cats: [] }; }
function stkCharItems(char) {
  var cfg = stkCharCfg(char);
  if (!cfg.on) return [];
  return stkData.items.filter(function(s) { return cfg.cats.indexOf(s.cat) >= 0; });
}

// 只有链接时用文件名当名字
function stkNameFromUrl(url) {
  try {
    var seg = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    seg = decodeURIComponent(seg).trim();
    if (seg) return seg.slice(0, 30);
  } catch (_) {}
  return '表情';
}
// 名字重复时在后面加数字，免得角色按名字认错
function stkUniqueName(name, exceptId) {
  var base = name, n = 2;
  var taken = function(x) { return stkData.items.some(function(s) { return s.id !== exceptId && stkKey(s.name) === stkKey(x); }); };
  while (taken(name)) name = base + n++;
  return name;
}

// 图床图片：不带来源网址（不少图床会拦外站引用）；打不开时交给 onFail
function stkImg(url, alt, onFail) {
  var img = document.createElement('img');
  img.alt = alt;
  img.referrerPolicy = 'no-referrer';
  img.decoding = 'async';
  img.onerror = onFail;
  img.src = url;
  return img;
}

// 点一下 / 长按
function stkPress(el, onTap, onLong) {
  var timer = null, fired = false, sx = 0, sy = 0;
  el.addEventListener('pointerdown', function(e) {
    fired = false; sx = e.clientX; sy = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(function() {
      timer = null; fired = true;
      if (navigator.vibrate) navigator.vibrate(15);
      onLong();
    }, 500);
  });
  el.addEventListener('pointermove', function(e) {
    if (timer && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) { clearTimeout(timer); timer = null; }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(ev) {
    el.addEventListener(ev, function() { clearTimeout(timer); timer = null; });
  });
  el.addEventListener('click', function(e) {
    e.stopPropagation();
    if (fired) { fired = false; return; }
    onTap();
  });
  el.addEventListener('contextmenu', function(e) { e.preventDefault(); });
}

// =============================================
// 抽屉
// =============================================
var stkGrid = document.getElementById('stkGrid');
var stkTabs = document.getElementById('stkTabs');

function renderStickerDrawer() {
  if (!stkCat(stkCurCat)) stkCurCat = stkData.cats.length ? stkData.cats[0].id : '';
  stkTabs.innerHTML = '';
  stkData.cats.forEach(function(c) {
    var b = document.createElement('button');
    b.className = 'stk-tab' + (c.id === stkCurCat ? ' active' : '');
    b.textContent = c.name;
    stkPress(b, function() { stkCurCat = c.id; renderStickerDrawer(); }, function() { openStkCat(c); });
    stkTabs.appendChild(b);
  });
  stkGrid.innerHTML = '';
  stkGrid.scrollTop = 0;
  var items = stkItemsOf(stkCurCat);
  if (!items.length) {
    var empty = document.createElement('div');
    empty.className = 'stk-empty';
    empty.textContent = stkData.cats.length ? '这个分类还没有表情包\n点右下角 ＋ 导入' : '还没有表情包\n点右下角 ＋ 用图床链接导入';
    empty.style.whiteSpace = 'pre-line';
    stkGrid.appendChild(empty);
    return;
  }
  items.forEach(function(s) {
    var item = document.createElement('button');
    item.className = 'stk-item';
    var box = document.createElement('div');
    box.className = 'stk-thumb';
    var img = stkImg(s.url, s.name, function() { box.classList.add('broken'); box.textContent = s.name; });
    img.loading = 'lazy';
    box.appendChild(img);
    var name = document.createElement('div');
    name.className = 'stk-name';
    name.textContent = s.name;
    item.appendChild(box);
    item.appendChild(name);
    stkPress(item, function() { sendSticker(s); }, function() { openStkEdit(s); });
    stkGrid.appendChild(item);
  });
}

// 点表情包直接发出去（和键盘回车一样，只发自己的消息，不叫 AI）
function sendSticker(s) {
  if (openingChatCharIdx === -1) return;
  var m = { role: 'user', content: stickerText(s.name), sticker: { name: s.name, url: s.url }, time: Date.now() };
  if (pendingQuote) { m.quote = pendingQuote; clearQuote(); }
  getActiveHistory(openingChatCharIdx).push(m);
  saveHistories();
  renderHistMsg(m);
}

if (crEmojiBtn) crEmojiBtn.addEventListener('click', renderStickerDrawer);
renderStickerDrawer();

// =============================================
// 打字联想：输入的文字和表情包名字对得上时，输入栏上方列出来，点一下发出去并清空输入框
// 对得上 = 名字里有输入的整段，或者输入里有名字的连续两个字以上（英文数字要三个以上）；对上越多排越前
// =============================================
var stkSuggest = document.getElementById('stkSuggest');
function stkMatchLen(t, k) {
  if (!k) return 0;
  if (k.indexOf(t) >= 0) return t.length + 100;
  for (var len = Math.min(k.length, t.length); len >= 2; len--) {
    for (var i = 0; i + len <= k.length; i++) {
      var sub = k.substr(i, len);
      if (len < 3 && /^[\x00-\x7f]+$/.test(sub)) continue;
      if (t.indexOf(sub) >= 0) return len;
    }
  }
  return 0;
}
function updateStkSuggest() {
  var t = stkKey(crInput.value), hits = [];
  if (t && t.length <= 20 && currentCrSubView !== 'contacts' && openingChatCharIdx !== -1) {
    hits = stkData.items.map(function(s) { return { s: s, n: stkMatchLen(t, stkKey(s.name)) }; })
      .filter(function(x) { return x.n > 0; })
      .sort(function(a, b) { return b.n - a.n; })
      .slice(0, 12)
      .map(function(x) { return x.s; });
  }
  stkSuggest.innerHTML = '';
  hits.forEach(function(s) {
    var box = document.createElement('button');
    box.className = 'stk-thumb';
    box.setAttribute('aria-label', s.name);
    box.appendChild(stkImg(s.url, s.name, function() { box.classList.add('broken'); box.textContent = s.name; }));
    box.addEventListener('click', function(e) {
      e.stopPropagation();
      sendSticker(s);
      crInput.value = '';
      crInput.style.height = '';
      updateStkSuggest();
    });
    stkSuggest.appendChild(box);
  });
  stkSuggest.classList.toggle('open', hits.length > 0);
}
crInput.addEventListener('input', updateStkSuggest);
// 回车发出文字后输入框被清空（不会触发 input），切换聊天 / 剧情时也重新看一下
crInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') setTimeout(updateStkSuggest, 0); });
[msgBtnChat, msgBtnContacts].forEach(function(b) { b.addEventListener('click', updateStkSuggest); });

// =============================================
// 聊天里的表情包消息
// =============================================
function appendStickerMsg(role, m, targetListEl, targetEmptyEl) {
  var list  = targetListEl  || getActiveMsgListEl();
  var empty = targetEmptyEl || getActiveEmptyEl();
  if (empty) empty.style.display = 'none';
  var row = document.createElement('div');
  row.className = 'chat-msg-row ' + (role === 'user' ? 'user' : 'ai');
  row.appendChild(createMsgAvatar(role));
  var bubble = document.createElement('div');
  bubble.className = 'chat-msg-bubble sticker-bubble';
  var img = stkImg(m.sticker.url, m.content, function() {
    bubble.classList.remove('sticker-bubble');
    bubble.textContent = stickerText(m.sticker.name);
  });
  // 图片是后加载的：本来停在最底下就继续停在最底下
  img.onload = function() {
    if (list.scrollHeight - list.scrollTop - list.clientHeight < img.offsetHeight + 80) list.scrollTop = list.scrollHeight;
  };
  bubble.appendChild(img);
  row.appendChild(bubble);
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
  return { row: row, bubble: bubble };
}

// 角色回复里的「[表情包：名字]」：名字在 TA 能用的分类里的，拆成单独一条表情包消息；别的照原样留成文字
function stickerSplitParts(parts, char) {
  var pool = stkCharItems(char);
  if (!pool.length) return parts;
  var out = [];
  parts.forEach(function(p) {
    var last = 0, m, segs = [];
    STK_RE.lastIndex = 0;
    while ((m = STK_RE.exec(p))) {
      var s = findSticker(m[1], pool);
      if (!s) continue;
      segs.push(p.slice(last, m.index));
      segs.push({ content: stickerText(s.name), sticker: { name: s.name, url: s.url } });
      last = STK_RE.lastIndex;
    }
    segs.push(p.slice(last));
    segs.forEach(function(x) {
      if (typeof x !== 'string') out.push(x);
      else if (x.trim()) out.push(x.trim());
    });
  });
  return out;
}

// 告诉角色能用哪些表情包（只在聊天窗口，这个角色打开了才有）
function stickerPrompt(char) {
  var cfg = stkCharCfg(char);
  if (!stkCharItems(char).length) return '';
  var lines = [], left = 150;
  stkData.cats.forEach(function(c) {
    if (left <= 0 || cfg.cats.indexOf(c.id) < 0) return;
    var names = stkItemsOf(c.id).slice(0, left).map(function(s) { return s.name; });
    left -= names.length;
    if (names.length) lines.push(c.name + '：' + names.join('、'));
  });
  return '【表情包】你也可以像{{user}}一样发表情包：想发的时候单独发一条，只写「[表情包：名字]」，名字只能从下面挑，不要自己编。' +
    '看心情偶尔发，不用每次都发。\n' + lines.join('\n');
}

// =============================================
// 导入：每行一个「名字 链接」，只有链接时用文件名当名字
// =============================================
var stkImportOverlay = document.getElementById('stkImportOverlay');
var stkImportCat     = document.getElementById('stkImportCat');
var stkImportCats    = document.getElementById('stkImportCats');
var stkImportText    = document.getElementById('stkImportText');

function stkParseLines(text) {
  var out = [];
  String(text || '').split(/\r?\n/).forEach(function(line) {
    var m = line.match(/(https?:\/\/[^\s"'<>]+|data:image\/[^\s"'<>]+)/i);
    if (!m) return;
    var url = m[1];
    var name = (line.slice(0, m.index) + ' ' + line.slice(m.index + url.length))
      .replace(/^[\s:：,，|｜\-—]+|[\s:：,，|｜\-—]+$/g, '').trim();
    out.push({ name: (name || stkNameFromUrl(url)).slice(0, 30), url: url });
  });
  return out;
}

// 分类小标签：点一下选中
function renderStkChips(box, selectedName, onPick) {
  box.innerHTML = '';
  stkData.cats.forEach(function(c) {
    var b = document.createElement('button');
    b.className = 'stk-chip' + (c.name === selectedName ? ' selected' : '');
    b.textContent = c.name;
    b.addEventListener('click', function() { onPick(c); });
    box.appendChild(b);
  });
}
function refreshImportChips() {
  renderStkChips(stkImportCats, stkImportCat.value.trim(), function(c) { stkImportCat.value = c.name; refreshImportChips(); });
}

document.getElementById('stkImportBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  var cur = stkCat(stkCurCat);
  stkImportCat.value = cur ? cur.name : '';
  stkImportText.value = '';
  refreshImportChips();
  stkImportOverlay.classList.add('open');
});
stkImportCat.addEventListener('input', refreshImportChips);
document.getElementById('stkImportCancel').addEventListener('click', function() { stkImportOverlay.classList.remove('open'); });

document.getElementById('stkImportOk').addEventListener('click', function() {
  var list = stkParseLines(stkImportText.value);
  if (!list.length) { showToast('没有找到链接，每行要有一个 http 开头的图片地址', 'error'); return; }
  var catName = stkImportCat.value.trim() || '默认';
  var cat = stkCatByName(catName);
  if (!cat) { cat = { id: stkNewId('sc'), name: catName }; stkData.cats.push(cat); }
  var added = 0, skipped = 0;
  list.forEach(function(x) {
    if (stkItemsOf(cat.id).some(function(s) { return s.url === x.url; })) { skipped++; return; }
    stkData.items.push({ id: stkNewId('sk'), name: stkUniqueName(x.name), url: x.url, cat: cat.id });
    added++;
  });
  saveStickers();
  stkCurCat = cat.id;
  renderStickerDrawer();
  stkImportOverlay.classList.remove('open');
  showToast('✓ 导入了 ' + added + ' 个' + (skipped ? '，' + skipped + ' 个已经有了' : ''), 'success');
});

// =============================================
// 长按表情包：改名字、换分类、删除
// =============================================
var stkEditOverlay = document.getElementById('stkEditOverlay');
var stkEditName    = document.getElementById('stkEditName');
var stkEditCats    = document.getElementById('stkEditCats');
var stkEditTarget = null, stkEditCatId = '';

function refreshEditChips() {
  var cur = stkCat(stkEditCatId);
  renderStkChips(stkEditCats, cur ? cur.name : '', function(c) { stkEditCatId = c.id; refreshEditChips(); });
}
function openStkEdit(s) {
  stkEditTarget = s;
  stkEditCatId = s.cat;
  stkEditName.value = s.name;
  var pv = document.getElementById('stkEditPreview');
  pv.innerHTML = '';
  pv.appendChild(stkImg(s.url, s.name, function() { pv.textContent = '图片打不开'; }));
  refreshEditChips();
  stkEditOverlay.classList.add('open');
}
function closeStkEdit() { stkEditOverlay.classList.remove('open'); stkEditTarget = null; }
document.getElementById('stkEditCancel').addEventListener('click', closeStkEdit);
document.getElementById('stkEditSave').addEventListener('click', function() {
  var s = stkEditTarget;
  if (!s) return;
  var name = stkEditName.value.trim();
  if (!name) { showToast('名字不能为空', 'error'); return; }
  if (stkData.items.some(function(x) { return x.id !== s.id && stkKey(x.name) === stkKey(name); })) {
    showToast('已经有叫「' + name + '」的表情包了', 'error');
    return;
  }
  s.name = name;
  s.cat = stkEditCatId;
  saveStickers();
  renderStickerDrawer();
  closeStkEdit();
});
document.getElementById('stkEditDel').addEventListener('click', function() {
  var s = stkEditTarget;
  if (!s) return;
  closeStkEdit();
  openPfEntryDel('删除表情包「' + s.name + '」？已经发出去的不受影响', function() {
    stkData.items = stkData.items.filter(function(x) { return x !== s; });
    saveStickers();
    renderStickerDrawer();
  });
});

// =============================================
// 长按分类标签：改名、删除分类
// =============================================
var stkCatOverlay = document.getElementById('stkCatOverlay');
var stkCatName    = document.getElementById('stkCatName');
var stkCatTarget = null;

function openStkCat(c) {
  stkCatTarget = c;
  stkCatName.value = c.name;
  stkCatOverlay.classList.add('open');
}
function closeStkCat() { stkCatOverlay.classList.remove('open'); stkCatTarget = null; }
document.getElementById('stkCatCancel').addEventListener('click', closeStkCat);
document.getElementById('stkCatSave').addEventListener('click', function() {
  var c = stkCatTarget;
  if (!c) return;
  var name = stkCatName.value.trim();
  if (!name) { showToast('分类名不能为空', 'error'); return; }
  var same = stkCatByName(name);
  if (same && same !== c) { showToast('已经有「' + name + '」这个分类了', 'error'); return; }
  c.name = name;
  saveStickers();
  renderStickerDrawer();
  closeStkCat();
});
document.getElementById('stkCatDel').addEventListener('click', function() {
  var c = stkCatTarget;
  if (!c) return;
  closeStkCat();
  var n = stkItemsOf(c.id).length;
  openPfEntryDel('删除分类「' + c.name + '」' + (n ? '和里面的 ' + n + ' 个表情包' : '') + '？', function() {
    stkData.cats = stkData.cats.filter(function(x) { return x !== c; });
    stkData.items = stkData.items.filter(function(x) { return x.cat !== c.id; });
    saveStickers();
    renderStickerDrawer();
  });
});

// =============================================
// 设置：当前聊天的角色能不能发表情包、能用哪些分类
// =============================================
var stkSetOverlay = document.getElementById('stkSetOverlay');
var stkAiOn = document.getElementById('stkAiOn');
var stkSetCats = document.getElementById('stkSetCats');
var stkSetChar = null;

function stkSetCfg() {
  if (!stkSetChar.stickerCfg) stkSetChar.stickerCfg = { on: false, cats: [] };
  return stkSetChar.stickerCfg;
}
function renderStkSetCats() {
  var cfg = stkCharCfg(stkSetChar);
  stkSetCats.innerHTML = '';
  stkData.cats.forEach(function(c) {
    var b = document.createElement('button');
    b.className = 'stk-chip' + (cfg.cats.indexOf(c.id) >= 0 ? ' selected' : '');
    b.textContent = c.name + ' ' + stkItemsOf(c.id).length;
    b.addEventListener('click', function() {
      var cats = stkSetCfg().cats, i = cats.indexOf(c.id);
      if (i >= 0) cats.splice(i, 1); else cats.push(c.id);
      saveCharList();
      renderStkSetCats();
    });
    stkSetCats.appendChild(b);
  });
  document.getElementById('stkSetEmpty').style.display = stkData.cats.length ? 'none' : '';
  stkSetCats.classList.toggle('off', !cfg.on);
}
stkAiOn.addEventListener('change', function() {
  if (!stkSetChar) return;
  var cfg = stkSetCfg();
  cfg.on = this.checked;
  // 第一次打开时先把现有分类都选上，再按需要去掉
  if (cfg.on && !cfg.cats.length) cfg.cats = stkData.cats.map(function(c) { return c.id; });
  saveCharList();
  renderStkSetCats();
});
document.getElementById('stkSetBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  stkSetChar = charList[openingChatCharIdx];
  if (!stkSetChar) return;
  document.getElementById('stkSetTitle').textContent = '表情包设置 · ' + (stkSetChar.charAlias || stkSetChar.charName || '未命名');
  stkAiOn.checked = !!stkCharCfg(stkSetChar).on;
  renderStkSetCats();
  stkSetOverlay.classList.add('open');
});
document.getElementById('stkSetClose').addEventListener('click', function() { stkSetOverlay.classList.remove('open'); });

// 点弹窗外面关掉
[stkImportOverlay, stkEditOverlay, stkCatOverlay, stkSetOverlay].forEach(function(ov) {
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.classList.remove('open'); });
});
