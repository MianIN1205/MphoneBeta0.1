// 眠花糖机 — 表情包：用图床链接导入、分类、用名字辅助识别；打字时联想表情包；聊天里发送和显示，角色也能按名字发表情包

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
  var URL_K = /^(url|src|link|href|image|img|path|uri|地址|链接|图片)$/i;
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

// docx：正文文字，挂在文字上的超链接也把地址读出来
function stkReadDocx(buf) {
  var rels = {};
  return zipReadEntry(buf, function(n) { return n === 'word/_rels/document.xml.rels'; }).then(function(b) {
    new TextDecoder().decode(b).replace(/<Relationship\b[^>]*>/g, function(tag) {
      var id = (tag.match(/\bId="([^"]+)"/) || [])[1], t = (tag.match(/\bTarget="([^"]+)"/) || [])[1];
      if (id && t && /^https?:/i.test(t)) rels[id] = t.replace(/&amp;/g, '&');
      return '';
    });
  }, function() {}).then(function() {
    return zipReadEntry(buf, function(n) { return n === 'word/document.xml'; });
  }).then(function(bytes) {
    var text = new TextDecoder().decode(bytes)
      .replace(/<w:hyperlink\b[^>]*r:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/g, function(all, id, inner) {
        var url = rels[id];
        return url && inner.replace(/<[^>]+>/g, '').indexOf(url) < 0 ? inner + '<w:t> ' + url + ' </w:t>' : inner;
      })
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '');
    var ta = document.createElement('textarea');
    ta.innerHTML = text;   // 解码 &amp; 等实体
    // 老式 Word 的超链接是「HYPERLINK "地址"」域代码
    return ta.value.replace(/\bHYPERLINK\s+"?([^"\s]+)"?/g, ' $1 ');
  });
}

// 读文档：txt 先按 UTF-8 读，读不通再按 GBK（Windows 记事本存的中文常见）
function stkReadDocText(file) {
  var name = file.name.toLowerCase();
  if (/\.docx$/.test(name)) return file.arrayBuffer().then(stkReadDocx);
  if (/\.(doc|xls|xlsx|pdf)$/.test(name)) return Promise.reject(new Error('这种文档读不了，可以另存为 docx 或 txt 再导入'));
  return file.arrayBuffer().then(function(buf) {
    var text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (_) { text = new TextDecoder('gbk').decode(buf); }
    text = text.replace(/^\uFEFF/, '');
    if (/\.json$/.test(name) || /^\s*[\[{]/.test(text)) {
      try { return stkFromJson(JSON.parse(text)); } catch (_) {}
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
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.classList.remove('open'); });
});
