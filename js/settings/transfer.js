// 眠花糖机 — 从别的小手机搬家（设置 → 辅助功能 → 数据管理「别的小手机」）：选一个任意格式的备份，认出里面的角色、聊天记录、记忆、世界书、表情包，
// 列出来勾选、选好放到哪里（新建角色 / 合并到同名角色，聊天存成档案还是放进聊天），点「导入」才写进来（用户要的「不限格式内容」）
// · 认得的格式先走专门的读法：uwu / ovo 小手机的完整备份（.ee，js/char/migrate.js）、酒馆角色卡 PNG / JSON（js/char/import.js）；
//   其余的 JSON / 一行一个 JSON 按「长得像什么」去找：有名字 + 一大段人设的是角色，一串像消息的是聊天，带关键词 + 内容的是世界书条目，
//   图片链接 + 分类的是表情包，名字带 memory / 记忆 的是记忆；纯文字当聊天记录认（js/char/archive.js 的 arcParse）
// · 备份里的 API、密钥、密码一概不读
// · 认出来的东西：{ from, chars: [{ name, persona, avatar, msgs, mems, books, card }], books: [{ name, entries }], stickers: [{ name, url, cat }], loose: [{ msgs }] }

var XF_NAME_KS = ['name', 'charName', 'realName', 'remarkName', 'nickname', 'nickName', 'displayName', 'char_name', 'title', '名字', '角色名'];
var XF_PERSONA_KS = ['persona', 'charPersona', 'description', 'personality', 'setting', 'settings', 'systemPrompt', 'system_prompt', 'prompt', 'profile', 'bio', 'intro', 'desc', '人设', '设定'];
var XF_AVATAR_KS = ['avatar', 'charAvatar', 'avatarUrl', 'avatar_url', 'headImg', 'icon', 'image', 'img', 'photo'];
var XF_ID_KS = ['id', 'charId', 'characterId', 'chatId', 'roleId', 'contactId', 'chatIndex', 'uid'];
var XF_SECRET_RE = /api.?key|token|password|passwd|secret|authorization|cookie|^key$/i;
var XF_WB_RE = /world|lore|book|entries|世界书/i;
function xfStr(o, ks, min) { for (var i = 0; i < ks.length; i++) { var v = o[ks[i]]; if (typeof v === 'string' && v.trim().length >= (min || 1)) return v.trim(); } return ''; }

// ---------- 读文件 ----------
function xfRead(file) {
  return file.slice(0, 4).arrayBuffer().then(function(b) {
    var u = new Uint8Array(b), gz = u[0] === 0x1f && u[1] === 0x8b;
    if (u[0] === 0x89 && u[1] === 0x50) return file.arrayBuffer().then(function(buf) {   // 酒馆角色卡图片
      var s = readPngCard(buf);
      if (!s) throw new Error('这张图片里没有角色卡');
      return xfDataUrl(file).then(function(av) { var r = xfEmpty(file); r.chars.push(xfFromCard(JSON.parse(s), av)); return r; });
    });
    if (u[0] === 0x50 && u[1] === 0x4b) {
      if (!/\.docx$/i.test(file.name)) throw new Error('压缩包（zip）还认不了，先解压，导入里面的文件');
      return file.arrayBuffer().then(readDocxText).then(function(t) { return xfFromText(t, file); });
    }
    // gzip：先当 uwu / ovo 的完整备份读（一行一行读，几百 MB 也不卡）；不是的话解压了按普通文件认
    var tryUwu = gz && typeof migScan === 'function' ? migScan(file).then(function(r) { return xfFromUwu(r, file); }, function() { return null; }) : Promise.resolve(null);
    return tryUwu.then(function(r) {
      if (r) return r;
      var st = file.stream();
      if (gz) st = st.pipeThrough(new DecompressionStream('gzip'));
      return new Response(st).text().then(function(t) { return xfFromText(t, file); });
    });
  });
}
function xfDataUrl(file) { return new Promise(function(res) { var r = new FileReader(); r.onload = function() { compressImage(r.result, 512, res); }; r.readAsDataURL(file); }); }
function xfEmpty(file) { return { from: String(file.name || '').replace(/\.[^.]+$/, '').slice(0, 16) || '别的小手机', file: file.name, chars: [], books: [], stickers: [], loose: [] }; }
function xfFromText(text, file) {
  var s = String(text || '').replace(/^﻿/, '').trim(), j = null;
  if (/^[\[{]/.test(s)) { try { j = JSON.parse(s); } catch (_) {} }
  if (!j && /^\{/.test(s)) {   // 一行一个 JSON
    var lines = s.split(/\r?\n/).map(function(l) { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
    if (lines.length > 1) j = lines;
  }
  var r = xfEmpty(file);
  if (j) { xfScan(j, r); return r; }
  // 纯文字：当一份聊天记录
  var a = arcParse(s, file.name, null);
  r.loose.push({ msgs: a.msgs });
  if (a.from) r.from = a.from;
  return r;
}

// uwu / ovo 的完整备份：角色资料 + 世界书，聊天记录要导入时再读（xfLoadMsgs）
function xfFromUwu(scan, file) {
  var r = xfEmpty(file), byId = {};
  r.from = 'uwu 小手机';
  scan.books.forEach(function(x) { byId[x.id] = x; });
  var used = {};
  scan.chars.forEach(function(c) {
    var mine = (c.wbIds || []).map(function(id) { used[id] = 1; return byId[id]; }).filter(Boolean).map(xfUwuEntry);
    r.chars.push({ name: c.name, realName: c.realName, persona: c.persona, avatar: c.avatar, msgCount: c.count, msgs: null, uwuIdx: c.idx, mems: [],
      books: mine.length ? [{ name: c.name, entries: mine }] : [] });
  });
  var by = {};
  scan.books.forEach(function(x) { if (used[x.id]) return; var cat = String(x.category || '').trim() || '未分类'; (by[cat] = by[cat] || []).push(xfUwuEntry(x)); });
  Object.keys(by).forEach(function(k) { r.books.push({ name: k, entries: by[k] }); });
  return r;
}
function xfUwuEntry(x) { return { name: String(x.name || '未命名').slice(0, 60), content: String(x.content), keywords: x.alwaysOn ? '' : wbImpKeys(x.keywords), pos: 'auto', enabled: !x.disabled }; }
function xfFromCard(card, avatar) {
  var d = cardToDraft(card, avatar || '');
  return { name: d.charName, persona: d.charPersona, avatar: d.charAvatar, openings: d.openings, msgs: [], mems: [],
    books: d.pendingWb ? [{ name: d.charName, entries: d.pendingWb.entries }] : [] };
}

// ---------- 按「长得像什么」去找 ----------
function xfScan(root, r) {
  var chars = [], groups = [], wbBox = new Map(), stk = (typeof stkGroupedFromJson === 'function' && stkGroupedFromJson(root)) || [], nodes = 0;
  function charOf(o) {
    if (o.spec && /chara_card/.test(o.spec) || (o.data && o.data.name && (o.data.description || o.data.first_mes))) { try { return xfFromCard(o, ''); } catch (_) { return null; } }
    var name = xfStr(o, XF_NAME_KS), persona = xfStr(o, XF_PERSONA_KS, 20);
    if (!name || name.length > 40 || !persona || arcLooksLikeMsg(o)) return null;
    var av = xfStr(o, XF_AVATAR_KS);
    return { name: name, persona: persona, avatar: /^(data:image\/|https?:\/\/)/.test(av) ? av : '', msgs: [], mems: [], books: [], ids: XF_ID_KS.map(function(k) { return o[k]; }).filter(function(v) { return v != null && v !== ''; }).map(String) };
  }
  function isEntry(o, key) {
    if (typeof o.content !== 'string' || !o.content.trim() || arcLooksLikeMsg(o)) return false;
    return 'keys' in o || 'key' in o || 'keywords' in o || 'keyword' in o || 'keysecondary' in o || XF_WB_RE.test(key || '');
  }
  // holder：直接装着这个东西的对象 / 数组（世界书条目按它分组）；ctx：外面最近的名字（世界书叫这个）
  (function walk(v, key, owner, holder, ctx, depth) {
    if (!v || typeof v !== 'object' || depth > 12 || ++nodes > 300000) return;
    if (Array.isArray(v)) {
      var msgLike = v.filter(arcLooksLikeMsg);
      if (v.length && msgLike.length >= Math.max(1, v.length * 0.6)) { groups.push({ objs: msgLike, owner: owner, key: String(key || '') }); return; }
      v.forEach(function(x) { walk(x, key, owner, v, ctx, depth + 1); });
      return;
    }
    var c = charOf(v);
    if (c) { chars.push(c); owner = c; }
    if (isEntry(v, key)) {
      var box = wbBox.get(holder) || { name: ctx, entries: [], owner: owner };
      box.entries.push({ name: String(v.comment || v.name || v.title || (Array.isArray(v.keys) && v.keys[0]) || '导入条目').slice(0, 60),
        keywords: v.constant || v.alwaysOn ? '' : wbImpKeys(v.keys || v.key || v.keywords || v.keyword), content: String(v.content),
        pos: typeof v.position === 'number' ? wbImpStPos(v.position) : 'auto', enabled: !(v.disable || v.disabled || v.enabled === false), cat: v.category });
      wbBox.set(holder, box);
      return;
    }
    var nm = xfStr(v, ['name', 'title']);
    if (nm && nm.length <= 30) ctx = nm;
    Object.keys(v).forEach(function(k) {
      if (XF_SECRET_RE.test(k)) return;   // 密钥、密码不碰
      var x = v[k];
      // 记忆：名字带 memory / 记忆 的一串文字或 { text / content }
      if (owner && /memor|记忆/i.test(k) && Array.isArray(x)) {
        x.forEach(function(m) { var t = typeof m === 'string' ? m : m && (m.text || m.content || m.memory); if (typeof t === 'string' && t.trim()) owner.mems.push(t.trim()); });
        return;
      }
      walk(x, k, owner, v, ctx || k, depth + 1);
    });
  })(root, '', null, root, '', 0);
  // 聊天归给谁：外面包着的角色、或者 id / 键名对得上的角色；都没有就是「不知道是谁的」
  groups.forEach(function(g) {
    var msgs = g.objs.map(function(o) { return arcFromGeneric(o, [], {}); }).filter(Boolean);
    if (!msgs.length) return;
    var who = g.owner || chars.filter(function(c) { return c.ids.indexOf(g.key) >= 0 || (g.objs[0] && XF_ID_KS.some(function(k) { return g.objs[0][k] != null && c.ids.indexOf(String(g.objs[0][k])) >= 0; })); })[0];
    if (who) who.msgs = who.msgs.concat(msgs); else r.loose.push({ msgs: msgs });
  });
  wbBox.forEach(function(b) {
    if (!b.entries.length) return;
    if (b.owner) { b.owner.books.push({ name: b.owner.name, entries: b.entries }); return; }
    var cats = {};
    b.entries.forEach(function(e) { var k = (e.cat && String(e.cat).trim()) || b.name || '导入的世界书'; delete e.cat; (cats[k] = cats[k] || []).push(e); });
    Object.keys(cats).forEach(function(k) { r.books.push({ name: k.slice(0, 30), entries: cats[k] }); });
  });
  r.chars = r.chars.concat(chars);
  r.stickers = stk;
  return r;
}

// ---------- 预览：勾选、选放到哪里 ----------
var xfState = null;
function xfSameChar(name) { return charList.filter(function(c) { return !c.isGroup && !c.builtinAssistant && (c.charName === name || c.charAlias === name); })[0] || null; }
function xfOpen() {
  pickFile('*/*', function(file) {
    xfFile = file;
    showToast('正在读「' + file.name + '」…', 'plain');
    xfRead(file).then(function(r) {
      var n = r.chars.length + r.books.length + r.loose.length + (r.stickers.length ? 1 : 0);
      if (!n) throw new Error('没认出能用的东西');
      r.chars.forEach(function(c) { c.on = true; var same = xfSameChar(c.realName || c.name); c.to = same ? same.id : 'new'; c.msgTo = 'arc'; c.memOn = true; c.wbOn = true; });
      r.books.forEach(function(b) { b.on = true; });
      r.loose.forEach(function(l) { l.on = true; l.to = ''; l.msgTo = 'arc'; });
      r.stkOn = true;
      xfState = r;
      xfRender();
    }).catch(function(err) { showToast('✗ ' + ((err && err.message) || '读不出来'), 'error'); });
  });
}
function xfRender() {
  var r = xfState, old = document.getElementById('xfOverlay');
  if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'xfOverlay';
  ov.className = 'mine-acc-overlay open';
  ov.innerHTML = '<div class="mine-acc-modal xf-modal"><div class="mine-acc-title">从别的小手机导入</div>' +
    '<div class="auto-hint" style="margin:0 0 8px;">从「' + escHtmlAsset(r.file) + '」里认出了这些，勾上要的、选好放到哪里，点「导入」才会写进来。API、密钥不会读。</div>' +
    '<div class="xf-list"></div><div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-a="no">取消</button><button class="mine-acc-btn mine-acc-btn-add" data-a="ok">导入</button></div></div>';
  var list = ov.querySelector('.xf-list');
  var sec = function(t) { var h = document.createElement('div'); h.className = 'xf-sec'; h.textContent = t; list.appendChild(h); };
  var row = function(obj, key, title, sub) {
    var el = document.createElement('label');
    el.className = 'xf-row';
    el.innerHTML = '<input type="checkbox"><span class="xf-main"><b></b><small></small></span>';
    el.querySelector('input').checked = obj[key];
    el.querySelector('input').addEventListener('change', function() { obj[key] = this.checked; });
    el.querySelector('b').textContent = title;
    el.querySelector('small').textContent = sub || '';
    list.appendChild(el);
    return el;
  };
  var pick = function(parent, obj, key, opts) {
    var s = document.createElement('select');
    s.className = 'xf-select';
    opts.forEach(function(o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); });
    s.value = obj[key];
    s.addEventListener('change', function() { obj[key] = this.value; });
    s.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); });
    parent.querySelector('.xf-main').appendChild(s);
  };
  var chatOpts = [['arc', '聊天存成档案'], ['chat', '聊天放进聊天窗口'], ['no', '聊天不要']];
  if (r.chars.length) sec('角色');
  r.chars.forEach(function(c) {
    var n = c.msgs ? c.msgs.length : (c.msgCount || 0);
    var el = row(c, 'on', c.name, [c.persona ? '人设 ' + c.persona.length + ' 字' : '', n ? '聊天 ' + n + ' 条' : '', c.mems.length ? '记忆 ' + c.mems.length + ' 条' : '',
      c.books.length ? '世界书 ' + c.books.reduce(function(a, b) { return a + b.entries.length; }, 0) + ' 条' : ''].filter(Boolean).join(' · '));
    var same = xfSameChar(c.realName || c.name);
    pick(el, c, 'to', [['new', '新建一个角色']].concat(same ? [[same.id, '合并到已有的「' + (same.charAlias || same.charName) + '」']] : []));
    if (n) pick(el, c, 'msgTo', chatOpts);
  });
  if (r.loose.length) sec('不知道是谁的聊天记录');
  r.loose.forEach(function(l, i) {
    var first = l.msgs.slice(0, 2).map(function(m) { return m.t.slice(0, 16); }).join(' / ');
    var el = row(l, 'on', '聊天记录 ' + (i + 1) + ' · ' + l.msgs.length + ' 条', first);
    var opts = [['', '选给哪个角色…']].concat(charList.filter(function(c) { return !c.isGroup; }).map(function(c) { return [c.id, c.charAlias || c.charName]; }))
      .concat(r.chars.map(function(c, k) { return ['x' + k, c.name + '（这次导入的）']; }));
    pick(el, l, 'to', opts);
    pick(el, l, 'msgTo', chatOpts.slice(0, 2));
  });
  if (r.books.length) sec('世界书');
  r.books.forEach(function(b) { row(b, 'on', b.name, b.entries.length + ' 条 · 放进同名文件夹'); });
  if (r.stickers.length) {
    sec('表情包');
    var cats = {}; r.stickers.forEach(function(s) { cats[s.cat] = 1; });
    row(r, 'stkOn', '表情包 ' + r.stickers.length + ' 个', Object.keys(cats).length + ' 个分类，按原来的分类导入');
  }
  ov.querySelector('[data-a="no"]').addEventListener('click', function() { ov.remove(); xfState = null; });
  ov.querySelector('[data-a="ok"]').addEventListener('click', function() { xfImport(ov); });
  (document.querySelector('.phone') || document.body).appendChild(ov);
}

// ---------- 导入 ----------
function xfToChat(m) { return { role: m.r === 'user' ? 'user' : 'assistant', content: m.t, time: m.time || Date.now() }; }
function xfPutMsgs(char, msgs, to, from) {
  if (!msgs || !msgs.length || to === 'no') return;
  if (to === 'chat') {
    var hist = chatHistories[char.id] = chatHistories[char.id] || [], seen = {};
    hist.forEach(function(m) { seen[(m.time || 0) + '|' + m.content] = 1; });
    msgs.filter(function(m) { return m.r !== 'sys'; }).map(xfToChat).forEach(function(m) { if (!seen[m.time + '|' + m.content]) hist.push(m); });
    hist.sort(function(a, b) { return (a.time || 0) - (b.time || 0); });
    char.inChat = true;
    return;
  }
  (arcStore[char.id] = arcStore[char.id] || []).push({ id: 'arc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), from: from, file: xfState.file, importTime: Date.now(), msgs: msgs,
    mem: { pos: 0, count: 0, seg: 0, budget: ARC_BUDGET, careful: false, withStatus: true, done: false, err: '' } });
}
function xfPutBooks(books, char) {
  var ids = [];
  books.forEach(function(b) {
    var f = wbFolders.filter(function(x) { return x.name === b.name; })[0];
    if (!f) { f = { id: genWbId('wf'), name: b.name }; wbFolders.push(f); }
    b.entries.forEach(function(e) {
      var ex = wbEntries.filter(function(x) { return x.name === e.name && x.content === e.content; })[0];
      if (!ex) { ex = Object.assign({ id: genWbId('wb'), folderId: f.id }, e); wbEntries.push(ex); }
      ids.push(ex.id);
    });
  });
  if (char && ids.length) {
    char.worldbookIds = (char.worldbookIds || []).concat(ids.filter(function(id) { return (char.worldbookIds || []).indexOf(id) < 0; }));
    if (char.dramaWb) ids.forEach(function(id) { if (char.dramaWb.ids.indexOf(id) < 0) char.dramaWb.ids.push(id); });
  }
}
function xfImport(ov) {
  var r = xfState, made = [], counts = { char: 0, msg: 0, mem: 0, wb: 0 };
  var btn = ov.querySelector('[data-a="ok"]');
  btn.disabled = true; btn.textContent = '导入中…';
  var keepEdit = editingCharIndex;
  // uwu 的聊天记录这时才读
  var loads = r.chars.map(function(c) {
    if (!c.on || c.msgs || c.msgTo === 'no' || c.uwuIdx == null) return Promise.resolve();
    return migReadHistory(xfFile, c.uwuIdx).then(function(m) { c.msgs = m; });
  });
  Promise.all(loads).then(function() {
    r.chars.forEach(function(c, k) {
      if (!c.on) return;
      var ch = c.to !== 'new' ? charList.filter(function(x) { return x.id === c.to; })[0] : null;
      if (!ch) {
        fillCharForm({ charName: c.realName || c.name, charAlias: c.name, charPersona: c.persona || '', charAvatar: c.avatar || '', openings: c.openings || [] });
        ch = readCharForm();
        ch.id = genCharId(); ch.inChat = false;
        charList.push(ch); syncCharCircle(ch);
        counts.char++;
      }
      made[k] = ch;
      xfPutMsgs(ch, c.msgs, c.msgTo, r.from);
      if (c.msgs && c.msgTo !== 'no') counts.msg += c.msgs.length;
      if (c.mems.length && typeof memAdd === 'function') c.mems.forEach(function(t) { if (memAdd(ch, { text: t, type: 'long', source: 'import', from: r.from })) counts.mem++; });
      if (c.books.length) { xfPutBooks(c.books, ch); counts.wb += c.books.reduce(function(a, b) { return a + b.entries.length; }, 0); }
    });
    r.loose.forEach(function(l) {
      if (!l.on || !l.to) return;
      var ch = l.to[0] === 'x' ? made[+l.to.slice(1)] : charList.filter(function(x) { return x.id === l.to; })[0];
      if (!ch) return;
      xfPutMsgs(ch, l.msgs, l.msgTo, r.from);
      counts.msg += l.msgs.length;
    });
    var books = r.books.filter(function(b) { return b.on; });
    if (books.length) { xfPutBooks(books, null); counts.wb += books.reduce(function(a, b) { return a + b.entries.length; }, 0); }
    saveWbEntries(); renderWbList(); saveArcStore(); saveHistories(); saveCharList(); renderChatCharList();
    if (r.stkOn && r.stickers.length) stkImportGrouped(r.stickers);
    editingCharIndex = keepEdit;
    ov.remove(); xfState = null;
    showToast('✓ 导入好了：' + [counts.char ? '新角色 ' + counts.char + ' 个' : '', counts.msg ? '聊天 ' + counts.msg + ' 条' : '', counts.mem ? '记忆 ' + counts.mem + ' 条' : '', counts.wb ? '世界书 ' + counts.wb + ' 条' : ''].filter(Boolean).join('，'), 'success');
  }).catch(function(err) { btn.disabled = false; btn.textContent = '导入'; showToast('✗ ' + ((err && err.message) || '导入失败'), 'error'); });
}
var xfFile = null;
document.getElementById('dataTransferRow').addEventListener('click', xfOpen);
