// 眠花糖机 — 表情包：导入（链接 / 文档）、分类、打字联想、发送和显示、角色能不能发 / 看

// =============================================
// 数据：{ cats: [{ id, name }], items: [{ id, name, url, cat }] }
// 每个角色能不能发、能用哪些分类、能不能看到图片：char.stickerCfg = { on, cats: [分类 id], see }
// 发给 AI 看的小图：导入时把图床图片压成小图存在 b64 里；图床不让读取（跨域）就记 b64Fail，只发名字
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
var STK_RE = /\[表情包[：:]\s*([^\]\n]{1,40}?)\s*(?:\]|$)/g;   // 忘了写后半个括号、写在一条最后的也认

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

// =============================================
// 给 AI 看的小图：长边 256，白底 JPEG（透明图不变黑，动图取第一帧）
// =============================================
function stkMakeThumb(url, cb) {
  var done = false, img = new Image();
  var finish = function(v) { if (!done) { done = true; cb(v); } };
  img.crossOrigin = 'anonymous';
  img.referrerPolicy = 'no-referrer';
  img.onload = function() {
    try {
      var scale = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      var g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      finish(c.toDataURL('image/jpeg', 0.85));
    } catch (_) { finish(null); }
  };
  img.onerror = function() { finish(null); };
  setTimeout(function() { finish(null); }, 20000);
  img.src = url;
}
// 还没存小图的表情包排队去存，同时最多 3 张
var stkBusy = {}, stkRunning = 0;
function stkCacheQueue(onEach) {
  var next = stkData.items.filter(function(s) { return !s.b64 && !s.b64Fail && !stkBusy[s.id]; });
  while (stkRunning < 3 && next.length) {
    (function(s) {
      stkBusy[s.id] = true;
      stkRunning++;
      stkMakeThumb(s.url, function(v) {
        delete stkBusy[s.id];
        stkRunning--;
        if (v) { s.b64 = v; delete s.b64Fail; } else s.b64Fail = true;
        saveStickers();
        // 读不了的在抽屉里补上小灰点（不整个重画，免得正在翻的列表跳回顶上）
        var el = !v && stkGrid.querySelector('.stk-item[data-id="' + s.id + '"]');
        if (el) el.classList.add('no-see');
        if (onEach) onEach(s);
        stkCacheQueue(onEach);
      });
    })(next.shift());
  }
}

// 用户发的表情包要带给 AI 的小图（这个角色打开了「能看到表情包图片」才有）
function stickerImageForAI(m, char) {
  if (!m.sticker || !stkCharCfg(char).see) return '';
  var s = stkData.items.filter(function(x) { return x.url === m.sticker.url && x.b64; })[0];
  return s ? s.b64 : '';
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
    bindPress(b, function() { stkCurCat = c.id; renderStickerDrawer(); }, function() { openStkCat(c); });
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
    item.className = 'stk-item' + (s.b64Fail ? ' no-see' : '');
    item.dataset.id = s.id;
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
    bindPress(item, function() { sendSticker(s); }, function() { openStkEdit(s); });
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
// 以前导入、还没存小图的，打开应用一会儿后在后台补上
setTimeout(function() { stkCacheQueue(); }, 4000);

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
    // 小图下面带名字，发之前看得清是哪个
    var item = document.createElement('button');
    item.className = 'stk-sg-item';
    item.setAttribute('aria-label', s.name);
    var box = document.createElement('div');
    box.className = 'stk-thumb';
    box.appendChild(stkImg(s.url, s.name, function() { box.classList.add('broken'); box.textContent = s.name; }));
    var nm = document.createElement('div');
    nm.className = 'stk-name';
    nm.textContent = s.name;
    item.appendChild(box);
    item.appendChild(nm);
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      sendSticker(s);
      crInput.value = '';
      crInput.style.height = '';
      updateStkSuggest();
    });
    stkSuggest.appendChild(item);
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
    if (typeof p !== 'string') { out.push(p); return; }
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
      else if (x.trim() && !/^[\]］]$/.test(x.trim())) out.push(x.trim());   // 单独剩下的半个括号不要
    });
  });
  return out;
}

// 告诉角色能用哪些表情包（只在聊天窗口，这个角色打开了才有）
var STK_PROMPT_MAX = 300;
function stickerPrompt(char) {
  var cfg = stkCharCfg(char);
  if (!stkCharItems(char).length) return '';
  // 最多列 STK_PROMPT_MAX 个：多了每个分类按比例分名额、每次随机挑（以前按顺序取前 150 个，后面的分类永远轮不到）
  var cats = stkData.cats.filter(function(c) { return cfg.cats.indexOf(c.id) >= 0; });
  var total = cats.reduce(function(n, c) { return n + stkItemsOf(c.id).length; }, 0), lines = [];
  cats.forEach(function(c) {
    var items = stkItemsOf(c.id).slice();
    if (total > STK_PROMPT_MAX) {
      for (var i = items.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = items[i]; items[i] = items[j]; items[j] = t; }
      items = items.slice(0, Math.max(3, Math.round(items.length * STK_PROMPT_MAX / total)));
    }
    if (items.length) lines.push(c.name + '：' + items.map(function(s) { return s.name; }).join('、'));
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

// 认得的写法：「名字 链接」「名字：链接」「链接 名字」；名字单独一行、下一行是链接；一行里好几组「名字 链接」；
// Markdown 图片 / 链接 ![名字](链接)；HTML <img src alt>
var STK_URL_RE = /(https?:\/\/[^\s"'<>()（），。、；」』】]+|data:image\/[^\s"'<>]+)/gi;
function stkCleanName(s) {
  return String(s || '').replace(/^\s*(?:\d+[.、)）]|[-*•·#>]+)\s*(?=\S)/, '')
    .replace(/^[\s:：,，;；|｜\-—=>→]+|[\s:：,，;；|｜\-—=>→]+$/g, '').trim();
}
function stkNormalizeText(text) {
  return String(text || '')
    .replace(/<img\b[^>]*>/gi, function(tag) {
      var src = (tag.match(/\bsrc\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
      var alt = (tag.match(/\b(?:alt|title)\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
      return src ? '\n' + alt + ' ' + src + '\n' : '';
    })
    .replace(/!?\[([^\]\n]*)\]\(\s*<?((?:https?:|data:image\/)[^)\s>]+)>?[^)]*\)/g, '\n$1 $2\n');
}
function stkParseLines(text) {
  var out = [], seen = {}, prevName = '';
  var add = function(name, url) {
    if (seen[url]) return;
    seen[url] = true;
    out.push({ name: (name || stkNameFromUrl(url)).slice(0, 30), url: url });
  };
  stkNormalizeText(text).split(/\r?\n/).forEach(function(line) {
    var urls = [], m;
    STK_URL_RE.lastIndex = 0;
    while ((m = STK_URL_RE.exec(line))) urls.push({ url: m[1], at: m.index, end: STK_URL_RE.lastIndex });
    if (!urls.length) {
      var t = stkCleanName(line);
      prevName = t.length <= 30 ? t : '';
      return;
    }
    if (urls.length === 1) {
      var u = urls[0];
      add(stkCleanName(line.slice(0, u.at) + ' ' + line.slice(u.end)) || prevName, u.url);
    } else {
      // 一行好几个链接：每个链接前面那段是它的名字
      urls.forEach(function(u, i) {
        add(stkCleanName(line.slice(i ? urls[i - 1].end : 0, u.at)) || (i === 0 ? prevName : ''), u.url);
      });
    }
    prevName = '';
  });
  return out;
}

// json：找「名字 → 链接」或带 url / src / link 之类字段的对象
function stkFromJson(data) {
  var out = [];
  var isUrl = function(v) { return typeof v === 'string' && /^(https?:\/\/|data:image\/)/i.test(v.trim()); };
  var NAME_K = /^(name|title|desc|description|key|label|alt|meaning|text|名字|名称|描述|含义|备注)$/i;
  var URL_K = /^(url|src|link|href|image|img|path|uri|data|地址|链接|图片)$/i;
  (function walk(v, key) {
    if (isUrl(v)) { out.push((/^\d*$/.test(key) ? '' : key) + ' ' + v.trim()); return; }
    if (Array.isArray(v)) { v.forEach(function(x) { walk(x, ''); }); return; }
    if (!v || typeof v !== 'object') return;
    var ks = Object.keys(v);
    var uk = ks.filter(function(k) { return URL_K.test(k) && isUrl(v[k]); })[0];
    if (uk) {
      var nk = ks.filter(function(k) { return NAME_K.test(k) && typeof v[k] === 'string'; })[0];
      out.push((nk ? v[nk] : '') + ' ' + v[uk].trim());
      return;
    }
    ks.forEach(function(k) { walk(v[k], k); });
  })(data, '');
  return out.join('\n');
}

// 带分类的 json（眠花糖机的表情包文件，或者 uwu 小手机那种每个表情包带 group 的）：直接按分类导入，不用一类一类选
// 返回 [{ name, url, cat }]；里面没有分类就返回 null，按普通文档处理
function stkGroupedFromJson(data) {
  var out = [];
  var isUrl = function(v) { return typeof v === 'string' && /^(https?:\/\/|data:image\/)/i.test(v.trim()); };
  if (data && data.app === 'mphone' && data.type === 'stickers' && Array.isArray(data.cats)) {
    data.cats.forEach(function(c) {
      (c.items || []).forEach(function(x) { if (x && isUrl(x.url)) out.push({ name: String(x.name || '').slice(0, 30), url: x.url.trim(), cat: String(c.name || '默认') }); });
    });
    return out.length ? out : null;
  }
  var CAT_K = ['group', 'category', 'cat', 'groupName', 'folder', '分类', '分组'];
  var URL_KS = ['url', 'src', 'link', 'data', 'image', 'img', '链接', '图片'];
  var NAME_KS = ['name', 'title', 'desc', 'description', 'alt', '名字', '名称', '描述'];
  var pick = function(o, ks) { for (var i = 0; i < ks.length; i++) if (typeof o[ks[i]] === 'string' && o[ks[i]].trim()) return o[ks[i]].trim(); return ''; };
  (function walk(v, depth) {
    if (depth > 4 || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(function(x) { walk(x, depth + 1); }); return; }
    var url = pick(v, URL_KS), cat = pick(v, CAT_K);
    if (isUrl(url) && cat) { out.push({ name: pick(v, NAME_KS).slice(0, 30), url: url, cat: cat.slice(0, 20) }); return; }
    Object.keys(v).forEach(function(k) { walk(v[k], depth + 1); });
  })(data, 0);
  return out.length ? out : null;
}
// 按分类一次导入：分类没有就新建；同一个分类里链接一样的跳过
function stkImportGrouped(list) {
  var added = 0, skipped = 0, newCats = 0, last = null;
  list.forEach(function(x) {
    var cat = stkCatByName(x.cat);
    if (!cat) { cat = { id: stkNewId('sc'), name: x.cat }; stkData.cats.push(cat); newCats++; }
    last = cat;
    if (stkItemsOf(cat.id).some(function(s) { return s.url === x.url; })) { skipped++; return; }
    stkData.items.push({ id: stkNewId('sk'), name: stkUniqueName(x.name || stkNameFromUrl(x.url)), url: x.url, cat: cat.id });
    added++;
  });
  saveStickers();
  if (last && !stkCat(stkCurCat)) stkCurCat = last.id;
  renderStickerDrawer();
  stkImportOverlay.classList.remove('open');
  stkCacheQueue();
  showToast('✓ 导入了 ' + added + ' 个' + (newCats ? '，新建 ' + newCats + ' 个分类' : '') + (skipped ? '，' + skipped + ' 个已经有了' : ''), 'success');
}

// 读文档：txt 先按 UTF-8 读，读不通再按 GBK（Windows 记事本存的中文常见）
function stkReadDocText(file) {
  var name = file.name.toLowerCase();
  if (/\.docx$/.test(name)) return file.arrayBuffer().then(function(buf) { return readDocxText(buf, { links: true }); });
  if (/\.(doc|xls|xlsx|pdf)$/.test(name)) return Promise.reject(new Error('这种文档读不了，可以另存为 docx 或 txt 再导入'));
  return file.arrayBuffer().then(function(buf) {
    var text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (_) { text = new TextDecoder('gbk').decode(buf); }
    text = text.replace(/^\uFEFF/, '');
    if (/\.json$/.test(name) || /^\s*[\[{]/.test(text)) {
      try {
        var j = JSON.parse(text);
        var grouped = stkGroupedFromJson(j);
        if (grouped) return { grouped: grouped };
        return stkFromJson(j);
      } catch (_) {}
    }
    return text;
  });
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

// 从文档导入：认出来的「名字 链接」先填进下面的框里，看一眼、选好分类再点「导入」
document.getElementById('stkImportDoc').addEventListener('click', function() {
  pickFile('.txt,.md,.csv,.json,.docx,.html,.htm,text/plain,application/json', function(file) {
    stkReadDocText(file).then(function(text) {
      // 带分类的文件：按原来的分类直接全部导入（导完提示导了多少、新建了几个分类）
      if (text && text.grouped) { stkImportGrouped(text.grouped); return; }
      var list = stkParseLines(text);
      if (!list.length) { showToast('没在文档里找到图片链接', 'error'); return; }
      var cur = stkImportText.value.trim();
      stkImportText.value = (cur ? cur + '\n' : '') + list.map(function(x) { return x.name + ' ' + x.url; }).join('\n');
      stkImportText.scrollTop = stkImportText.scrollHeight;
      showToast('✓ 认出 ' + list.length + ' 个表情包，选好分类后点「导入」', 'success');
    }).catch(function(err) { showToast('✗ ' + (err.message || '读不了这个文档'), 'error'); });
  });
});
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
  stkCacheQueue();
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
  paintStkEditSee(s);
  // 之前图床不让读取的，打开时再试一次
  if (s.b64Fail) {
    delete s.b64Fail;
    paintStkEditSee(s);
    stkCacheQueue(function(x) { if (x === stkEditTarget) paintStkEditSee(x); });
  }
  refreshEditChips();
  stkEditOverlay.classList.add('open');
}
function paintStkEditSee(s) {
  document.getElementById('stkEditSee').textContent = s.b64 ? '✓ 已存好给 TA 看的小图' :
    s.b64Fail ? '图床不让读取这张图，TA 只能看到名字' : '正在存给 TA 看的小图…';
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
  openConfirm('删除表情包「' + s.name + '」？已经发出去的不受影响', function() {
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
  openConfirm('删除分类「' + c.name + '」' + (n ? '和里面的 ' + n + ' 个表情包' : '') + '？', function() {
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
var stkSeeOn = document.getElementById('stkSeeOn');
stkSeeOn.addEventListener('change', function() {
  if (!stkSetChar) return;
  stkSetCfg().see = this.checked;
  saveCharList();
});
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
  stkSeeOn.checked = !!stkCharCfg(stkSetChar).see;
  renderStkSetCats();
  stkSetOverlay.classList.add('open');
});
document.getElementById('stkSetClose').addEventListener('click', function() { stkSetOverlay.classList.remove('open'); });

// 点弹窗外面关掉
[stkImportOverlay, stkEditOverlay, stkCatOverlay, stkSetOverlay].forEach(function(ov) {
  closeOnBackdrop(ov);
});
