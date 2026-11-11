// 眠花糖机 — 连通记忆库：和用户部署在自己 Cloudflare 上的「眠花糖机记忆库」（仓库里的 memory-hub/）自动同步，几个小手机、几台设备共用同一份记忆
// 用户要的核心是角色在哪儿都是同一个 TA，不被切成碎片。同步的东西：
// · 长期 / 珍贵记忆 ↔ 记忆库的「记忆」（短期的几天就忘，不同步）；别的小手机记下的「关系」也放进珍贵记忆（m.hubKind 记着原来的类型，推回去不变）
// · 聊出来的设定（char.selfFacts）↔「设定」
// · 关系里程碑（memMilestones）↔「关系」里固定的一条
// · 人设（char.charPersona）↔「人设核心」一个角色一份（id = p + 哈希）：两边不一样时不自己覆盖，弹窗问用哪个 / 先不同步（没选的那份留在 char.personaPrev，连接设置里能返回上个版本）；这边人设空着时直接用记忆库的；
//   MianIN 的人设锁死在代码里，不同步；这边清空人设、记忆库里那份被删，都不动另一边；超过 HUB_CORE_MAX 字的不同步（免得被截断）
// 角色按名字对上（MianIN 用 MIANIN_NAME，其他用本名，没有本名用备注）。离线优先：平时读的都是手机里这份，连不上就下次再同步。
// 地址、密码、同步进度存在 localStorage（不进备份，和云备份的令牌一样）：mphoneHubUrl / mphoneHubPass / mphoneHubAuto / mphoneHubState

var HUB_DEPLOY_URL = 'https://deploy.workers.cloudflare.com/?url=https://github.com/MianIN1205/MphoneBeta0.1/tree/main/memory-hub';
var HUB_PUSH_BATCH = 40;   // 和记忆库那边一次最多收的条数一样
var HUB_CORE_MAX = 30000;  // 人设核心最多多少字（和记忆库那边一样）
function hubLs(k, v) {
  try { if (v === undefined) return localStorage.getItem(k) || ''; if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
  return '';
}
function hubCfg() { return { url: hubLs('mphoneHubUrl').replace(/\/+$/, ''), pass: hubLs('mphoneHubPass'), auto: hubLs('mphoneHubAuto') !== '0' }; }
// 同步进度按记忆库的网址分开存：{ hubs: { 网址: { since, after, items, alias } } }（以前只有一个记忆库时是直接存的那一份，读到时放到默认记忆库名下）
function hubStateAll() {
  var a = null;
  try { a = JSON.parse(hubLs('mphoneHubState') || 'null'); } catch (e) {}
  a = a || {};
  if (!a.hubs) { var old = a, u = hubCfg().url; a = { hubs: {} }; if (u && (old.items || old.since)) a.hubs[u] = old; }
  return a;
}
function hubState(url) {
  url = url || hubCfg().url;
  var s = hubStateAll().hubs[url] || {};
  s.items = s.items || {}; s.alias = s.alias || {};
  s._url = url;
  return s;
}
function hubSaveState(s) {
  var a = hubStateAll(), o = Object.assign({}, s);
  delete o._url; delete o._solo;
  a.hubs[s._url || hubCfg().url] = o;
  hubLs('mphoneHubState', JSON.stringify(a));
}
function hubDropState(url) { var a = hubStateAll(); delete a.hubs[url]; hubLs('mphoneHubState', JSON.stringify(a)); }
// ---------- 每个角色用哪个记忆库（用户要的：整个小手机都同步就成了云同步，专属的记忆库要能只连一个角色） ----------
// localStorage mphoneHubChars = { 角色id: { mode: 'own' 单独的 / 'off' 不同步, url, pass } }，没写的跟「默认记忆库」（连接设置里填的那个，可以不填）。不进备份
function hubCharMap() { try { return JSON.parse(hubLs('mphoneHubChars') || '{}') || {}; } catch (e) { return {}; } }
function hubTargetOf(c) {
  var m = hubCharMap()[c.id], d = hubCfg();
  if (m && m.mode === 'off') return null;
  if (m && m.mode === 'own' && m.url && m.pass) return { url: m.url, pass: m.pass };
  return d.url && d.pass ? { url: d.url, pass: d.pass } : null;
}
// 这次要同步的记忆库，各自带着归它管的角色：[{ url, pass, chars }]
function hubTargets() {
  var by = {}, out = [];
  charList.forEach(function(c) {
    if (c.isGroup) return;
    var t = hubTargetOf(c);
    if (!t) return;
    if (!by[t.url]) { by[t.url] = { url: t.url, pass: t.pass, chars: [] }; out.push(by[t.url]); }
    by[t.url].chars.push(c);
  });
  // 单独连的、库里只有这一个角色：算 TA 的专属库
  var map = hubCharMap();
  out.forEach(function(t) { if (t.chars.length === 1 && (map[t.chars[0].id] || {}).mode === 'own') t.solo = t.chars[0]; });
  return out;
}
function hubHash(str) {
  var h = 5381;
  str = String(str);
  for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function hubCharKey(c) {
  var nm = c && hubCharMap()[c.id] && hubCharMap()[c.id].name;   // 连接设置里写的「在记忆库里叫」
  if (nm) return String(nm).trim();
  return c ? (c.builtinAssistant && typeof MIANIN_NAME !== 'undefined' ? MIANIN_NAME : (c.charName || c.charAlias || '').trim()) : ''; }
function hubFindChar(name, chars) {
  name = String(name || '').trim();
  chars = chars || charList;
  if (!name) return null;
  var low = name.toLowerCase();
  return chars.filter(function(c) { return hubCharKey(c) === name; })[0] ||
    chars.filter(function(c) { return hubCharKey(c).toLowerCase() === low; })[0] ||
    chars.filter(function(c) { return (c.charAlias || '').trim() === name || (c.charName || '').trim() === name; })[0] || null;
}
function hubApi(path, opt, target) {
  var cfg = target || hubCfg();   // target：这次连的是哪个记忆库（不写就是默认的）
  opt = opt || {};
  opt.headers = Object.assign({ 'content-type': 'application/json', authorization: 'Bearer ' + cfg.pass }, opt.headers || {});
  return fetch(cfg.url + path, opt).then(function(r) {
    return r.json().catch(function() { return {}; }).then(function(j) {
      if (!r.ok || !j.ok) throw new Error(r.status === 401 ? '密码不对' : (j.error || ('出错了 ' + r.status)));
      return j;
    });
  });
}

// 手机里现在这份（要和记忆库对上的部分），按记忆库的 id 排好：{ id: { id, char, kind, content, meta, created_at, charId } }
function hubSnapshot(state, chars, url) {
  var out = {};
  var put = function(it) { var id = state.alias[it.id] || it.id; it.id = id; out[id] = it; };
  (chars || charList).forEach(function(c) { if (c.isGroup) return;   // 群聊不算
    var key = (state._solo === c && state.soloName) || hubCharKey(c);
    if (!key) return;
    (typeof memList === 'function' ? memList(c.id) : []).forEach(function(m) {
      if (m.type !== 'long' && m.type !== 'precious') return;
      if (m.hubSrc && url && m.hubSrc !== url) return;   // 从别的记忆库拉下来的：只属于那个库，不推到这里（默认库和专属库互不影响）
      var meta = { type: m.type };
      if (m.scene) meta.scene = m.scene;
      if (m.from) meta.from = m.from;
      if (m.source && m.source !== 'hub') meta.source = m.source;
      if (m.emo) { meta.emo = m.emo; meta.emoW = m.emoW || 2; }   // 情绪和线索放 meta 里，别的小手机、MCP 也拿得到
      if (m.cues && m.cues.length) meta.cues = m.cues;
      put({ id: m.id, char: key, kind: m.hubKind || 'memory', content: m.text, meta: meta, created_at: m.time, charId: c.id });
    });
    (c.selfFacts || []).forEach(function(f) {
      put({ id: 'f' + hubHash(key + '|' + f), char: key, kind: 'fact', content: f, meta: {}, created_at: 0, charId: c.id });
    });
    var ms = typeof memMilestones !== 'undefined' && memMilestones[c.id];
    if (ms && ms.text) put({ id: 'r' + hubHash(key), char: key, kind: 'relation', content: ms.text, meta: { milestone: true }, created_at: ms.time || 0, charId: c.id });
    var persona = c.builtinAssistant ? '' : String(c.charPersona || '');
    if (persona.trim() && persona.length <= HUB_CORE_MAX && !c.hubCorePending) put({ id: 'p' + hubHash(key), char: key, kind: 'core', content: persona, meta: {}, created_at: 0, charId: c.id });
  });
  return out;
}
function hubRec(it, h) { var r = { h: h, c: it.charId }; if (it.kind === 'core') r.k = 'core'; return r; }
function hubItemHash(it) { return hubHash(it.kind + '|' + it.char + '|' + it.content + '|' + JSON.stringify(it.meta || {})); }

// 把记忆库里拉下来的一条放进手机里（新的、改过的、删掉的）
function hubApplyRow(row, state, chars) {
  // 专属记忆库（只归一个角色）：库里的东西都是 TA 的，不看名字（名字写法不一样也对得上）
  var c = state._solo || hubFindChar(row.char, chars);
  if (!c) return false;   // 手机里没有这个角色（或者这个角色不归这个记忆库）：先不管，记忆库里照样留着
  var meta = {};
  try { meta = row.meta ? JSON.parse(row.meta) : {}; } catch (e) {}
  if (row.kind === 'core') {   // 人设核心：不一样时先记下，同步完弹窗问用哪个
    if (c.builtinAssistant || row.deleted || !String(row.content || '').trim()) return false;
    var mine = c.charPersona || '';
    if (mine === row.content) { delete c.hubCorePending; return 'char'; }
    if (!mine.trim()) { c.charPersona = row.content; delete c.hubCorePending; return 'char'; }
    c.hubCorePending = { text: row.content, id: row.id, at: Date.now(), hub: state._url };
    return 'char';
  }
  if (row.kind === 'fact') {
    var facts = c.selfFacts || [];
    if (row.deleted) c.selfFacts = facts.filter(function(f) { return f !== row.content; });
    else if (facts.indexOf(row.content) < 0) c.selfFacts = facts.concat(row.content).slice(-80);
    return 'char';
  }
  if (row.kind === 'relation' && meta.milestone) {
    if (!row.deleted && typeof memMilestones !== 'undefined') {
      var old = memMilestones[c.id] || {};
      memMilestones[c.id] = { text: String(row.content).slice(0, 1500), time: row.updated_at, basedOn: old.basedOn || 0 };
    }
    return 'ms';
  }
  // 记忆（别的小手机记下的「关系」也当成珍贵记忆放进来）
  var list = memStore[c.id] = memStore[c.id] || [];
  var localId = Object.keys(state.alias).filter(function(k) { return state.alias[k] === row.id; })[0] || row.id;
  var cur = list.filter(function(m) { return m.id === localId || m.id === row.id; })[0];
  if (row.deleted) {
    if (cur) memStore[c.id] = list.filter(function(m) { return m !== cur; });
    return 'mem';
  }
  var type = meta.type === 'precious' || row.kind === 'relation' ? 'precious' : 'long';
  if (cur) {
    cur.text = String(row.content).slice(0, typeof memTextMax === 'function' ? memTextMax(type) : 300);
    cur.type = type; delete cur.expires;
    if (row.kind !== 'memory') cur.hubKind = row.kind; else delete cur.hubKind;
    if (typeof memSetTags === 'function') memSetTags(cur, { emo: meta.emo, emoW: meta.emoW, cues: meta.cues });
  } else {
    var m = { id: row.id, type: type, text: String(row.content).slice(0, typeof memTextMax === 'function' ? memTextMax(type) : 300), time: row.created_at || row.updated_at, source: meta.source || 'hub', hubSrc: state._url };
    if (meta.scene) m.scene = meta.scene;
    if (meta.from) m.from = meta.from;
    else if (!meta.source && row.source && row.source !== '眠花糖机') m.from = String(row.source).slice(0, 20);
    if (row.kind !== 'memory') m.hubKind = row.kind;
    if (typeof memSetTags === 'function') memSetTags(m, { emo: meta.emo, emoW: meta.emoW, cues: meta.cues });
    list.push(m);
  }
  return 'mem';
}

var hubBusy = false, hubLastAt = 0, hubLastErr = '';
// 同步一次：每个记忆库轮着来，先拉（别处的新东西放进手机），再推（手机里新的、改过的、删掉的）；一个连不上不耽误别的
function hubSync(manual) {
  var targets = hubTargets();
  if (!targets.length) { if (manual) showToast('还没连记忆库，先点「连接设置」', 'error'); return Promise.resolve(false); }
  if (hubBusy) return Promise.resolve(false);
  hubBusy = true; hubPaintStatus('正在同步…');
  var tot = { pulled: 0, pushed: 0 }, errs = [], i = 0;
  function next() {
    if (i >= targets.length) return Promise.resolve();
    var t = targets[i++];
    return hubSyncOne(t, tot).then(null, function(err) { errs.push((err && err.message) || '连不上'); }).then(next);
  }
  return next().then(function() {
    var ok = errs.length < targets.length;   // 至少有一个同步上了
    if (ok) { hubLastAt = Date.now(); hubLs('mphoneHubLastAt', String(hubLastAt)); }
    hubLastErr = errs.length ? errs[0] + (targets.length > 1 ? '（' + errs.length + ' / ' + targets.length + ' 个记忆库）' : '') : '';
    if (tot.pulled && typeof renderMemHome === 'function' && document.getElementById('appMemory').classList.contains('active')) { try { renderMemHome(); } catch (e) {} }
    if (manual && !errs.length) showToast('✓ 同步好了' + (tot.pulled || tot.pushed ? '：拉下来 ' + tot.pulled + ' 条，推上去 ' + tot.pushed + ' 条' : '，两边一样'), 'success');
    else if (manual) showToast('✗ 没同步上：' + hubLastErr, 'error');
    return ok;
  }).then(function(ok) { hubBusy = false; hubPaintStatus(); setTimeout(function() { hubCoreAsk(); }, 0); return ok; });
}
// 和一个记忆库同步：t = { url, pass, chars 归它管的角色 }
function hubSyncOne(t, tot) {
  var state = hubState(t.url), changed = {}, pulled = {};
  function pullPage() {
    return hubApi('/api/pull?since=' + (state.since || 0) + '&after=' + encodeURIComponent(state.after || ''), null, t).then(function(j) {
      j.rows.forEach(function(row) {
        // 自己推上去的那个版本（上一轮推的，时间排在拉的位置后面）：手机里已经是这样或者已经又改了 / 删了，不要再拉回来盖掉
        var known = state.items[row.id];
        if (!row.deleted && known && known.h === hubHash(row.kind + '|' + row.char + '|' + row.content + '|' + (row.meta || '{}'))) { state.since = row.updated_at; state.after = row.id; return; }
        state._solo = t.solo || null;
        if (t.solo && row.char && !row.deleted) state.soloName = row.char;   // 专属库里 TA 叫什么：推上去时也用这个名字，免得同一个人存成两个名字
        var what = hubApplyRow(row, state, t.chars);
        if (what) { changed[what] = true; pulled[row.id] = true; tot.pulled++; }
        if (row.deleted) delete state.items[row.id];
        state.since = row.updated_at; state.after = row.id;
      });
      if (j.rows.length >= 500) return pullPage();
    });
  }
  return pullPage().then(function() {
    if (changed.mem) saveMemStore();
    if (changed.char) saveCharList();
    if (changed.ms && typeof saveMilestones === 'function') saveMilestones();
    state._solo = t.solo || null;
    var snap = hubSnapshot(state, t.chars, t.url);
    // 刚拉下来的：照手机里现在的样子记下，免得又推回去
    Object.keys(pulled).forEach(function(id) { if (snap[id]) state.items[id] = hubRec(snap[id], hubItemHash(snap[id])); });
    var changes = [];
    Object.keys(snap).forEach(function(id) {
      var it = snap[id], h = hubItemHash(it);
      if (!state.items[id] || state.items[id].h !== h) changes.push({ id: id, char: it.char, kind: it.kind, content: it.content, meta: JSON.stringify(it.meta), created_at: it.created_at, _h: h, _c: it.charId, _k: it.kind });
    });
    // 手机里删掉的（角色还在、而且还归这个记忆库管才算删；整个角色删了、或者角色改连别的记忆库了，都不动这个记忆库里的）
    Object.keys(state.items).forEach(function(id) {
      if (snap[id]) return;
      var rec = state.items[id];
      if (rec.k === 'core') { delete state.items[id]; return; }   // 这边清空了人设：不去删记忆库里的核心
      if (rec.c && t.chars.some(function(c) { return c.id === rec.c; })) changes.push({ id: id, deleted: true, _del: true });
      else delete state.items[id];
    });
    var i = 0;
    function pushNext() {
      if (i >= changes.length) return Promise.resolve();
      var batch = changes.slice(i, i + HUB_PUSH_BATCH);
      i += HUB_PUSH_BATCH;
      return hubApi('/api/sync', { method: 'POST', body: JSON.stringify({ changes: batch.map(function(c) { var o = Object.assign({}, c); delete o._h; delete o._c; delete o._k; delete o._del; return o; }) }) }, t).then(function(j) {
        var alias = j.alias || {};
        batch.forEach(function(c) {
          if (c._del) { delete state.items[c.id]; return; }
          var hid = alias[c.id] || c.id;
          if (alias[c.id]) state.alias[c.id] = hid;
          state.items[hid] = hubRec({ charId: c._c, kind: c._k }, c._h);
          tot.pushed++;
        });
        hubSaveState(state);
        return pushNext();
      });
    }
    return pushNext();
  }).then(function() { hubSaveState(state); }, function(err) { hubSaveState(state); throw err; });
}

// ---------- 人设核心：两边不一样时问用哪个（用户要的：不自己覆盖），没选的那份留着，能「返回上个版本」 ----------
// char.hubCorePending = { text 记忆库里的, id, at, later 点了先不同步 }：没选之前这个角色的人设不推也不换；char.personaPrev = { text, at } 上个版本
function hubCoreName(c) { return c.charAlias || c.charName || ''; }
function hubCoreWhenIdle(fn) { if (hubBusy) setTimeout(function() { hubCoreWhenIdle(fn); }, 800); else fn(); }
function hubCoreResolve(c, useHub) {
  hubCoreWhenIdle(function() {
    var p = c.hubCorePending;
    if (!p) return;
    var st = hubState(p.hub || (hubTargetOf(c) || {}).url), myId = 'p' + hubHash((p.hub && st.soloName) || hubCharKey(c));
    if (p.id && p.id !== myId) { st.alias[myId] = p.id; hubSaveState(st); }   // 记忆库里那份是别处建的：接着用它的 id，不另起一条
    c.personaPrev = { text: useHub ? c.charPersona : p.text, at: Date.now() };
    if (useHub) c.charPersona = p.text;
    delete c.hubCorePending;
    saveCharList();
    hubSync(false);
  });
}
function hubCoreRevert(c) {
  if (!c.personaPrev) return;
  openConfirm('把「' + hubCoreName(c) + '」的人设换回上个版本？', function() {
    hubCoreWhenIdle(function() {
      var cur = c.charPersona || '';
      c.charPersona = c.personaPrev.text;
      c.personaPrev = { text: cur, at: Date.now() };   // 现在这份留着，还能再换回来
      saveCharList();
      hubPaintCoreList();
      showToast('✓ 换回上个版本了', 'success');
      hubSync(false);
    });
  }, { desc: '现在这份会留着，之后还能再换回来。连着记忆库的话，记忆库里也跟着换。', okText: '换回去' });
}
var hubCoreDlg = null;
function hubCoreAsk(c) {
  if (hubCoreDlg) return;
  c = c || charList.filter(function(x) { return x.hubCorePending && !x.hubCorePending.later; })[0];
  if (!c || !c.hubCorePending) return;
  var ov = hubCoreDlg = document.createElement('div');
  ov.className = 'mine-acc-overlay open hub-core-dlg';
  ov.innerHTML = '<div class="mine-acc-modal hub-modal"><div class="mine-acc-title"></div>' +
    '<div class="auto-hint" style="margin:0 2px 8px;">选一个作为保存的版本。没选的那份会留着，之后能在「连接设置」里返回上个版本。</div>' +
    '<div class="field-label">这台手机里的</div><div class="hub-mcp-url hub-core-text" data-k="mine"></div>' +
    '<div class="field-label">记忆库里的</div><div class="hub-mcp-url hub-core-text" data-k="hub"></div>' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-a="later">先不同步</button>' +
    '<button class="mine-acc-btn mine-acc-btn-close" data-a="mine">用手机的</button>' +
    '<button class="mine-acc-btn mine-acc-btn-add" data-a="hub">用记忆库的</button></div></div>';
  ov.querySelector('.mine-acc-title').textContent = '「' + hubCoreName(c) + '」的人设有两个版本';
  ov.querySelector('[data-k="mine"]').textContent = c.charPersona || '';
  ov.querySelector('[data-k="hub"]').textContent = c.hubCorePending.text;
  ov.addEventListener('click', function(e) {
    var a = e.target && e.target.getAttribute && e.target.getAttribute('data-a');
    if (!a) return;
    ov.remove(); hubCoreDlg = null;
    if (a === 'later') { c.hubCorePending.later = true; saveCharList(); }
    else hubCoreResolve(c, a === 'hub');
    hubPaintCoreList();
    setTimeout(function() { hubCoreAsk(); }, 300);   // 还有别的角色也不一样：接着问
  });
  (document.querySelector('.phone') || document.body).appendChild(ov);
}
// 连接设置里的一小块：每个角色用哪个记忆库（默认的 / 单独的 / 不同步），点一行改
function hubPaintCharList() {
  var box = document.getElementById('hubCharList');
  if (!box) {
    box = document.createElement('div'); box.id = 'hubCharList';
    var msg = document.getElementById('hubMsg');
    msg.parentNode.insertBefore(box, msg);
  }
  box.innerHTML = '';
  var chars = charList.filter(function(c) { return !c.isGroup; });
  if (!chars.length) return;
  var lab = document.createElement('div'); lab.className = 'field-label'; lab.textContent = '每个角色用哪个记忆库';
  var hint = document.createElement('div'); hint.className = 'auto-hint'; hint.style.margin = '0 2px 6px';
  hint.textContent = '没单独设置的角色用上面填的默认记忆库（上面可以不填）。想给某个角色一个只属于 TA 的记忆库，点 TA 那一行。';
  var list = document.createElement('div'); list.className = 'hub-char-list';
  var map = hubCharMap();
  chars.forEach(function(c) {
    var m = map[c.id] || {}, row = document.createElement('div'); row.className = 'auto-row';
    var name = document.createElement('span'); name.className = 'auto-row-label'; name.textContent = hubCoreName(c);
    var btn = document.createElement('button'); btn.className = 'pf-radio-btn';
    btn.textContent = m.mode === 'off' ? '不同步' : m.mode === 'own' ? '单独的' : '默认的' + (m.name ? '·' + m.name : '');
    if (m.mode === 'own') btn.classList.add('selected');
    btn.addEventListener('click', function() { hubCharDialog(c); });
    row.appendChild(name); row.appendChild(btn); list.appendChild(row);
  });
  box.appendChild(lab); box.appendChild(hint); box.appendChild(list);
}
function hubCharDialog(c) {
  var m = hubCharMap()[c.id] || {}, mode = m.mode || '';
  var ov = document.createElement('div');
  ov.className = 'mine-acc-overlay open hub-core-dlg';
  ov.innerHTML = '<div class="mine-acc-modal hub-modal"><div class="mine-acc-title"></div>' +
    '<div class="pf-radio-row" data-k="modes"><button class="pf-radio-btn" data-val="">默认的</button><button class="pf-radio-btn" data-val="own">单独的</button><button class="pf-radio-btn" data-val="off">不同步</button></div>' +
    '<div class="auto-hint" data-k="hint" style="margin:6px 2px 8px;"></div>' +
    '<div data-k="own"><div class="field-label">记忆库网址</div><input class="field-input" data-k="url" type="url" placeholder="https://……workers.dev" autocomplete="off" spellcheck="false">' +
    '<div class="field-label">密码</div><input class="field-input" data-k="pass" type="password" placeholder="在那个记忆库网页里设的密码" autocomplete="off"></div>' +
    '<div data-k="nameBox"><div class="field-label">在记忆库里叫</div><input class="field-input" data-k="name" maxlength="40" autocomplete="off">' +
    '<div class="auto-hint" style="margin:4px 2px 0;">记忆库靠名字认出是谁。别的小手机里 TA 叫别的名字时填这里，两边写一样就对上了。单独的记忆库不用填，里面的都算 TA 的。</div></div>' +
    '<div class="auto-hint" data-k="msg" style="margin:8px 2px 0;color:#c25a7e;min-height:16px;"></div>' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-a="cancel">取消</button><button class="mine-acc-btn mine-acc-btn-close" data-a="test">测试连接</button><button class="mine-acc-btn mine-acc-btn-add" data-a="save">保存</button></div></div>';
  var q = function(k) { return ov.querySelector('[data-k="' + k + '"]'); };
  var HINT = { '': '和别的角色一起，用连接设置里填的默认记忆库。', own: '只属于 TA 的记忆库：TA 的人设、记忆只和这一个同步，别的角色不会进来。再部署一份记忆库、打开它的网址设好密码，把网址和密码填在下面。', off: 'TA 的人设和记忆只留在这台手机里，不同步到任何记忆库。' };
  var paint = function() {
    q('modes').querySelectorAll('.pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.val === mode); });
    q('hint').textContent = HINT[mode];
    q('own').style.display = mode === 'own' ? '' : 'none';
    q('nameBox').style.display = mode === '' ? '' : 'none';
    ov.querySelector('[data-a="test"]').style.display = mode === 'own' ? '' : 'none';
  };
  ov.querySelector('.mine-acc-title').textContent = '「' + hubCoreName(c) + '」用哪个记忆库';
  q('url').value = m.url || ''; q('pass').value = m.pass || '';
  q('name').value = m.name || ''; q('name').placeholder = (c.builtinAssistant && typeof MIANIN_NAME !== 'undefined' ? MIANIN_NAME : (c.charName || c.charAlias || '').trim()) + '（不填就用这个）';
  paint();
  var form = function() {
    var url = q('url').value.trim().replace(/\/+$/, '').replace(/\/(api\/ping|mcp)$/, '');
    if (url && !/^https?:\/\//.test(url)) url = 'https://' + url;
    return { url: url, pass: q('pass').value };
  };
  ov.addEventListener('click', function(e) {
    var t = e.target, a = t.getAttribute && t.getAttribute('data-a');
    if (t.dataset && t.dataset.val !== undefined && t.classList.contains('pf-radio-btn')) { mode = t.dataset.val; paint(); return; }
    if (a === 'cancel') { ov.remove(); return; }
    if (a === 'test') {
      var f = form();
      if (!f.url) { shakeEl(q('url')); return; }
      q('msg').textContent = '正在连…';
      hubTry(f).then(function() { q('msg').textContent = '✓ 连上了'; }, function(err) { q('msg').textContent = '✗ ' + (err.message === 'Failed to fetch' ? '连不上（网址不对，或者现在网络到不了）' : err.message); });
      return;
    }
    if (a === 'save') {
      var map = hubCharMap(), f2 = form();
      if (mode === 'own') {
        if (!f2.url) { shakeEl(q('url')); return; }
        if (!f2.pass) { shakeEl(q('pass')); return; }
        map[c.id] = { mode: 'own', url: f2.url, pass: f2.pass };
      } else if (mode === 'off') map[c.id] = { mode: 'off' };
      else { var nm2 = q('name').value.trim(); if (nm2) map[c.id] = { name: nm2.slice(0, 40) }; else delete map[c.id]; }
      hubLs('mphoneHubChars', JSON.stringify(map));
      delete c.hubCorePending;   // 换了记忆库：之前没选完的人设版本不算了
      // TA 现在归的那个记忆库从头再拉一遍，把 TA 的东西都拿下来（别的角色已经对过的不会重复）
      var now = hubTargetOf(c);
      if (now) hubCoreWhenIdle(function() { var st = hubState(now.url); st.since = 0; st.after = ''; hubSaveState(st); hubSync(true); });
      ov.remove();
      hubPaintCharList(); hubPaintStatus();
    }
  });
  (document.querySelector('.phone') || document.body).appendChild(ov);
}
// 连接设置里的一小块：哪些角色的人设还没选版本、哪些能返回上个版本
function hubPaintCoreList() {
  var box = document.getElementById('hubCoreList');
  if (!box) {
    box = document.createElement('div'); box.id = 'hubCoreList';
    var msg = document.getElementById('hubMsg');
    msg.parentNode.insertBefore(box, msg);
  }
  box.innerHTML = '';
  var rows = charList.filter(function(c) { return !c.isGroup && !c.builtinAssistant && (c.hubCorePending || (c.personaPrev && c.personaPrev.text)); });
  if (!rows.length) return;
  var lab = document.createElement('div'); lab.className = 'field-label'; lab.textContent = '人设版本';
  box.appendChild(lab);
  rows.forEach(function(c) {
    var row = document.createElement('div'); row.className = 'auto-row';
    var name = document.createElement('span'); name.className = 'auto-row-label';
    name.textContent = hubCoreName(c) + (c.hubCorePending ? '（和记忆库里的不一样，还没同步）' : '');
    var btn = document.createElement('button'); btn.className = 'pf-radio-btn';
    btn.textContent = c.hubCorePending ? '选版本' : '返回上个版本';
    btn.addEventListener('click', function() { if (c.hubCorePending) hubCoreAsk(c); else hubCoreRevert(c); });
    row.appendChild(name); row.appendChild(btn); box.appendChild(row);
  });
}

// ---------- 自动同步：打开小手机、记忆有变化（等半分钟攒一攒）、每十分钟、切回小手机时 ----------
var hubTimer = null;
function hubSoon(ms) {
  if (!hubCfg().auto || !hubTargets().length) return;
  clearTimeout(hubTimer);
  hubTimer = setTimeout(function() { hubSync(false); }, ms || 30000);
}
if (typeof saveMemStore === 'function') {
  var hubOrigSaveMem = saveMemStore;
  saveMemStore = function() { hubOrigSaveMem.apply(this, arguments); if (!hubBusy) hubSoon(30000); };
}
if (typeof saveMilestones === 'function') {
  var hubOrigSaveMs = saveMilestones;
  saveMilestones = function() { hubOrigSaveMs.apply(this, arguments); if (!hubBusy) hubSoon(30000); };
}
if (typeof saveCharList === 'function') {   // 聊出来的设定存在角色上
  var hubOrigSaveChars = saveCharList;
  saveCharList = function() { hubOrigSaveChars.apply(this, arguments); if (!hubBusy) hubSoon(30000); };
}
onMphoneReady(function() { hubSoon(8000); hubPaintStatus(); });
setInterval(function() { hubSoon(1000); }, 10 * 60000);
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && Date.now() - hubLastAt > 2 * 60000) hubSoon(3000);
});

// ---------- 界面：记忆库首页的「连通记忆库」卡片 + 设置弹窗 ----------
function hubPaintStatus(text) {
  var el = document.getElementById('hubStatus');
  if (!el) return;
  var cfg = hubCfg();
  if (text) { el.textContent = text; return; }
  var targets = hubTargets();
  if (!targets.length) { el.textContent = '还没连。连上以后，几个小手机、几台设备上的角色共用同一份记忆。'; return; }
  var last = hubLastAt || parseInt(hubLs('mphoneHubLastAt') || '0', 10);
  el.textContent = '已连接 ' + (targets.length > 1 ? targets.length + ' 个记忆库' : targets[0].url.replace(/^https?:\/\//, '')) + (cfg.auto ? '，自动同步' : '，手动同步') +
    (last ? '。上次同步：' + (typeof fmtAgo === 'function' ? fmtAgo(last) : new Date(last).toLocaleString()) : '') +
    (hubLastErr ? '。刚才没同步上：' + hubLastErr + '（连上了会再试）' : '');
}
var hubOverlay = document.getElementById('hubOverlay');
function hubMsg(t) { document.getElementById('hubMsg').textContent = t || ''; }
function hubLoadMcp() {
  var wrap = document.getElementById('hubMcpWrap');
  if (!hubCfg().url) { wrap.style.display = 'none'; return; }
  hubApi('/api/mcp-info').then(function(j) {
    document.getElementById('hubMcpUrl').textContent = j.urlWithToken;
    wrap.style.display = '';
  }, function() { wrap.style.display = 'none'; });
}
document.getElementById('hubOpenSet').addEventListener('click', function() {
  var cfg = hubCfg();
  document.getElementById('hubUrl').value = cfg.url;
  document.getElementById('hubPass').value = cfg.pass;
  document.getElementById('hubAuto').checked = cfg.auto;
  hubMsg('');
  hubLoadMcp();
  hubPaintCharList();
  hubPaintCoreList();
  hubOverlay.classList.add('open');
});
closeOnBackdrop(hubOverlay);
document.getElementById('hubDeploy').addEventListener('click', function() { window.open(HUB_DEPLOY_URL, '_blank'); });
function hubReadForm() {
  var url = document.getElementById('hubUrl').value.trim().replace(/\/+$/, '').replace(/\/(api\/ping|mcp)$/, '');
  if (url && !/^https?:\/\//.test(url)) url = 'https://' + url;
  return { url: url, pass: document.getElementById('hubPass').value };
}
function hubTry(f) {
  return fetch(f.url + '/api/ping').then(function(r) { return r.json(); }).then(function(j) {
    if (!j || j.app !== 'mphone-memory') throw new Error('这个网址不是眠花糖机记忆库');
    if (!j.claimed) throw new Error('记忆库还没设密码，先打开它的网址设一个');
    return fetch(f.url + '/api/chars', { headers: { authorization: 'Bearer ' + f.pass } }).then(function(r) {
      if (r.status === 401) throw new Error('密码不对');
      return r.json();
    });
  });
}
document.getElementById('hubTest').addEventListener('click', function() {
  var f = hubReadForm();
  if (!f.url) { shakeEl(document.getElementById('hubUrl')); return; }
  hubMsg('正在连…');
  hubTry(f).then(function(j) {
    var n = (j.chars || []).reduce(function(s, c) { return s + c.count; }, 0);
    hubMsg('✓ 连上了。记忆库里现在有 ' + (j.chars || []).length + ' 个角色、' + n + ' 条。点「保存」就开始同步。');
  }, function(e) { hubMsg('✗ ' + (e.message === 'Failed to fetch' ? '连不上（网址不对，或者现在网络到不了，试试开梯子）' : e.message)); });
});
document.getElementById('hubSave').addEventListener('click', function() {
  var f = hubReadForm();
  if (!f.url) { shakeEl(document.getElementById('hubUrl')); return; }
  if (!f.pass) { shakeEl(document.getElementById('hubPass')); return; }
  var changedUrl = f.url !== hubCfg().url;
  hubLs('mphoneHubUrl', f.url); hubLs('mphoneHubPass', f.pass);
  hubLs('mphoneHubAuto', document.getElementById('hubAuto').checked ? null : '0');
  if (changedUrl) { hubLs('mphoneHubLastAt', null); hubLastAt = 0; }   // 换了一个记忆库：各有各的进度（按网址存），新的那个从头对一遍
  hubOverlay.classList.remove('open');
  hubPaintStatus();
  hubSync(true);
});
document.getElementById('hubUnlink').addEventListener('click', function() {
  if (!hubCfg().url) { hubOverlay.classList.remove('open'); return; }
  openConfirm('断开默认记忆库？单独给角色连的不受影响。手机里的记忆不会删，记忆库里的也还在，之后可以再连', function() {
    hubDropState(hubCfg().url);   // 只断开默认的这个；单独给角色连的记忆库不动
    ['mphoneHubUrl', 'mphoneHubPass', 'mphoneHubAuto', 'mphoneHubLastAt'].forEach(function(k) { hubLs(k, null); });
    hubLastAt = 0; hubLastErr = '';
    hubOverlay.classList.remove('open');
    hubPaintStatus();
  });
});
document.getElementById('hubMcpCopy').addEventListener('click', function() {
  var t = document.getElementById('hubMcpUrl').textContent;
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(function() { showToast('✓ 已复制', 'success'); }, function() { showToast('✗ 复制失败，长按上面的地址自己复制', 'error'); });
});
document.getElementById('hubSyncNow').addEventListener('click', function() { hubSync(true); });
document.getElementById('hubOpenWeb').addEventListener('click', function() {
  var u = hubCfg().url;
  if (!u) { showToast('还没连记忆库，先点「连接设置」', 'error'); return; }
  window.open(u, '_blank');
});
hubPaintStatus();
