// 眠花糖机 — 连通记忆库：和用户部署在自己 Cloudflare 上的「眠花糖机记忆库」（仓库里的 memory-hub/）自动同步，几个小手机、几台设备共用同一份记忆
// 用户要的核心是角色在哪儿都是同一个 TA，不被切成碎片。同步的东西：
// · 长期 / 珍贵记忆 ↔ 记忆库的「记忆」（短期的几天就忘，不同步）；别的小手机记下的「关系」也放进珍贵记忆（m.hubKind 记着原来的类型，推回去不变）
// · 聊出来的设定（char.selfFacts）↔「设定」
// · 关系里程碑（memMilestones）↔「关系」里固定的一条
// 角色按名字对上（MianIN 用 MIANIN_NAME，其他用本名，没有本名用备注）。离线优先：平时读的都是手机里这份，连不上就下次再同步。
// 地址、密码、同步进度存在 localStorage（不进备份，和云备份的令牌一样）：mphoneHubUrl / mphoneHubPass / mphoneHubAuto / mphoneHubState

var HUB_DEPLOY_URL = 'https://deploy.workers.cloudflare.com/?url=https://github.com/MianIN1205/MphoneBeta0.1/tree/main/memory-hub';
var HUB_PUSH_BATCH = 40;   // 和记忆库那边一次最多收的条数一样
function hubLs(k, v) {
  try { if (v === undefined) return localStorage.getItem(k) || ''; if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
  return '';
}
function hubCfg() { return { url: hubLs('mphoneHubUrl').replace(/\/+$/, ''), pass: hubLs('mphoneHubPass'), auto: hubLs('mphoneHubAuto') !== '0' }; }
function hubState() {
  var s = null;
  try { s = JSON.parse(hubLs('mphoneHubState') || 'null'); } catch (e) {}
  s = s || {};
  s.items = s.items || {}; s.alias = s.alias || {};
  return s;
}
function hubSaveState(s) { hubLs('mphoneHubState', JSON.stringify(s)); }
function hubHash(str) {
  var h = 5381;
  str = String(str);
  for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function hubCharKey(c) { return c ? (c.builtinAssistant && typeof MIANIN_NAME !== 'undefined' ? MIANIN_NAME : (c.charName || c.charAlias || '').trim()) : ''; }
function hubFindChar(name) {
  name = String(name || '').trim();
  if (!name) return null;
  return charList.filter(function(c) { return hubCharKey(c) === name; })[0] ||
    charList.filter(function(c) { return (c.charAlias || '').trim() === name || (c.charName || '').trim() === name; })[0] || null;
}
function hubApi(path, opt) {
  var cfg = hubCfg();
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
function hubSnapshot(state) {
  var out = {};
  var put = function(it) { var id = state.alias[it.id] || it.id; it.id = id; out[id] = it; };
  charList.forEach(function(c) {
    var key = hubCharKey(c);
    if (!key) return;
    (typeof memList === 'function' ? memList(c.id) : []).forEach(function(m) {
      if (m.type !== 'long' && m.type !== 'precious') return;
      var meta = { type: m.type };
      if (m.scene) meta.scene = m.scene;
      if (m.from) meta.from = m.from;
      if (m.source && m.source !== 'hub') meta.source = m.source;
      put({ id: m.id, char: key, kind: m.hubKind || 'memory', content: m.text, meta: meta, created_at: m.time, charId: c.id });
    });
    (c.selfFacts || []).forEach(function(f) {
      put({ id: 'f' + hubHash(key + '|' + f), char: key, kind: 'fact', content: f, meta: {}, created_at: 0, charId: c.id });
    });
    var ms = typeof memMilestones !== 'undefined' && memMilestones[c.id];
    if (ms && ms.text) put({ id: 'r' + hubHash(key), char: key, kind: 'relation', content: ms.text, meta: { milestone: true }, created_at: ms.time || 0, charId: c.id });
  });
  return out;
}
function hubItemHash(it) { return hubHash(it.kind + '|' + it.char + '|' + it.content + '|' + JSON.stringify(it.meta || {})); }

// 把记忆库里拉下来的一条放进手机里（新的、改过的、删掉的）
function hubApplyRow(row, state) {
  var c = hubFindChar(row.char);
  if (!c) return false;   // 手机里没有这个角色：先不管，记忆库里照样留着
  var meta = {};
  try { meta = row.meta ? JSON.parse(row.meta) : {}; } catch (e) {}
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
    cur.text = String(row.content).slice(0, 300);
    cur.type = type; delete cur.expires;
    if (row.kind !== 'memory') cur.hubKind = row.kind; else delete cur.hubKind;
  } else {
    var m = { id: row.id, type: type, text: String(row.content).slice(0, 300), time: row.created_at || row.updated_at, source: meta.source || 'hub' };
    if (meta.scene) m.scene = meta.scene;
    if (meta.from) m.from = meta.from;
    else if (!meta.source && row.source && row.source !== '眠花糖机') m.from = String(row.source).slice(0, 20);
    if (row.kind !== 'memory') m.hubKind = row.kind;
    list.push(m);
  }
  return 'mem';
}

var hubBusy = false, hubLastAt = 0, hubLastErr = '';
// 同步一次：先拉（别处的新东西放进手机），再推（手机里新的、改过的、删掉的）
function hubSync(manual) {
  var cfg = hubCfg();
  if (!cfg.url || !cfg.pass) { if (manual) showToast('还没连记忆库，先点「连接设置」', 'error'); return Promise.resolve(false); }
  if (hubBusy) return Promise.resolve(false);
  hubBusy = true; hubPaintStatus('正在同步…');
  var state = hubState(), changed = {}, pulled = {}, pushedN = 0, pulledN = 0;
  function pullPage() {
    return hubApi('/api/pull?since=' + (state.since || 0) + '&after=' + encodeURIComponent(state.after || '')).then(function(j) {
      j.rows.forEach(function(row) {
        // 自己推上去的那个版本（上一轮推的，时间排在拉的位置后面）：手机里已经是这样或者已经又改了 / 删了，不要再拉回来盖掉
        var known = state.items[row.id];
        if (!row.deleted && known && known.h === hubHash(row.kind + '|' + row.char + '|' + row.content + '|' + (row.meta || '{}'))) { state.since = row.updated_at; state.after = row.id; return; }
        var what = hubApplyRow(row, state);
        if (what) { changed[what] = true; pulled[row.id] = true; pulledN++; }
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
    var snap = hubSnapshot(state);
    // 刚拉下来的：照手机里现在的样子记下，免得又推回去
    Object.keys(pulled).forEach(function(id) { if (snap[id]) state.items[id] = { h: hubItemHash(snap[id]), c: snap[id].charId }; });
    var changes = [];
    Object.keys(snap).forEach(function(id) {
      var it = snap[id], h = hubItemHash(it);
      if (!state.items[id] || state.items[id].h !== h) changes.push({ id: id, char: it.char, kind: it.kind, content: it.content, meta: JSON.stringify(it.meta), created_at: it.created_at, _h: h, _c: it.charId });
    });
    // 手机里删掉的（角色还在才算删；整个角色删了不动记忆库，别的小手机还要用）
    Object.keys(state.items).forEach(function(id) {
      if (snap[id]) return;
      var rec = state.items[id];
      if (rec.c && charList.some(function(c) { return c.id === rec.c; })) changes.push({ id: id, deleted: true, _del: true });
      else delete state.items[id];
    });
    var i = 0;
    function pushNext() {
      if (i >= changes.length) return Promise.resolve();
      var batch = changes.slice(i, i + HUB_PUSH_BATCH);
      i += HUB_PUSH_BATCH;
      return hubApi('/api/sync', { method: 'POST', body: JSON.stringify({ changes: batch.map(function(c) { var o = Object.assign({}, c); delete o._h; delete o._c; delete o._del; return o; }) }) }).then(function(j) {
        var alias = j.alias || {};
        batch.forEach(function(c) {
          if (c._del) { delete state.items[c.id]; return; }
          var hid = alias[c.id] || c.id;
          if (alias[c.id]) state.alias[c.id] = hid;
          state.items[hid] = { h: c._h, c: c._c };
          pushedN++;
        });
        hubSaveState(state);
        return pushNext();
      });
    }
    return pushNext();
  }).then(function() {
    hubSaveState(state);
    hubLastAt = Date.now(); hubLastErr = '';
    hubLs('mphoneHubLastAt', String(hubLastAt));
    if (pulledN && typeof renderMemHome === 'function' && document.getElementById('appMemory').classList.contains('active')) { try { renderMemHome(); } catch (e) {} }
    if (manual) showToast('✓ 同步好了' + (pulledN || pushedN ? '：拉下来 ' + pulledN + ' 条，推上去 ' + pushedN + ' 条' : '，两边一样'), 'success');
    return true;
  }, function(err) {
    hubSaveState(state);
    hubLastErr = (err && err.message) || '连不上';
    if (manual) showToast('✗ 没同步上：' + hubLastErr, 'error');
    return false;
  }).then(function(ok) { hubBusy = false; hubPaintStatus(); return ok; });
}

// ---------- 自动同步：打开小手机、记忆有变化（等半分钟攒一攒）、每十分钟、切回小手机时 ----------
var hubTimer = null;
function hubSoon(ms) {
  var cfg = hubCfg();
  if (!cfg.url || !cfg.pass || !cfg.auto) return;
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
  if (!cfg.url) { el.textContent = '还没连。连上以后，几个小手机、几台设备上的角色共用同一份记忆。'; return; }
  var last = hubLastAt || parseInt(hubLs('mphoneHubLastAt') || '0', 10);
  el.textContent = '已连接 ' + cfg.url.replace(/^https?:\/\//, '') + (cfg.auto ? '，自动同步' : '，手动同步') +
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
  if (changedUrl) { hubLs('mphoneHubState', null); hubLs('mphoneHubLastAt', null); hubLastAt = 0; }   // 换了一个记忆库：从头对一遍
  hubOverlay.classList.remove('open');
  hubPaintStatus();
  hubSync(true);
});
document.getElementById('hubUnlink').addEventListener('click', function() {
  if (!hubCfg().url) { hubOverlay.classList.remove('open'); return; }
  openConfirm('断开记忆库？手机里的记忆不会删，记忆库里的也还在，之后可以再连', function() {
    ['mphoneHubUrl', 'mphoneHubPass', 'mphoneHubAuto', 'mphoneHubState', 'mphoneHubLastAt'].forEach(function(k) { hubLs(k, null); });
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
