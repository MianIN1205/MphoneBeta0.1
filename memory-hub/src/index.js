// 眠花糖机记忆库（最小版）：部署在用户自己的 Cloudflare 账号里（Worker + D1），几个小手机、几台设备共用同一份角色记忆。
// 三个门：/ 网页（翻看、编辑）；/api/* 给眠花糖机同步用（之后加）；/mcp 给别的小手机连（之后加）。
// 第一次打开网页时设密码（只存加盐后的哈希）；之后所有 /api 请求都要带「Authorization: Bearer 密码」。/api/ping 不用密码，用来测连不连得上。

const VERSION = 1;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    try {
      if (!env.DB) return json({ ok: false, error: '没有连上数据库（D1 的绑定名要叫 DB）' }, 500);
      await ensureSchema(env.DB);
      const p = url.pathname.replace(/\/+$/, '') || '/';
      if (p === '/api/ping') return json({ ok: true, app: 'mphone-memory', version: VERSION, claimed: !!(await getSetting(env.DB, 'key_hash')), time: Date.now() });
      if (p === '/api/setup' && req.method === 'POST') return setup(req, env.DB);
      if (p.startsWith('/api/')) {
        if (!(await authed(req, env.DB))) return json({ ok: false, error: '密码不对' }, 401);
        return api(req, env.DB, p, url);
      }
      if (p === '/') return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      return json({ ok: false, error: '没有这个地址' }, 404);
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, 500);
    }
  }
};

// ---------- 数据库 ----------
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT)'),
    db.prepare('CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, char TEXT NOT NULL, content TEXT NOT NULL, kind TEXT NOT NULL DEFAULT \'memory\', source TEXT NOT NULL DEFAULT \'\', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_mem_char ON memories (char, updated_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_mem_updated ON memories (updated_at)')
  ]);
  schemaReady = true;
}
async function getSetting(db, k) {
  const r = await db.prepare('SELECT v FROM settings WHERE k = ?').bind(k).first();
  return r ? r.v : null;
}
async function setSetting(db, k, v) {
  await db.prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, v).run();
}

// ---------- 密码 ----------
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function randomId(n) {
  const a = new Uint8Array(n || 12);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function setup(req, db) {
  if (await getSetting(db, 'key_hash')) return json({ ok: false, error: '已经设过密码了' }, 403);
  const body = await req.json().catch(() => ({}));
  const pass = String(body.password || '');
  if (pass.length < 6) return json({ ok: false, error: '密码至少 6 位' }, 400);
  const salt = randomId(16);
  await setSetting(db, 'key_salt', salt);
  await setSetting(db, 'key_hash', await sha256(salt + ':' + pass));
  return json({ ok: true });
}
async function authed(req, db) {
  const h = req.headers.get('authorization') || '';
  const pass = h.replace(/^Bearer\s+/i, '');
  if (!pass) return false;
  const salt = await getSetting(db, 'key_salt'), hash = await getSetting(db, 'key_hash');
  if (!salt || !hash) return false;
  return (await sha256(salt + ':' + pass)) === hash;
}

// ---------- 接口 ----------
const KINDS = ['memory', 'fact', 'relation'];
async function api(req, db, p, url) {
  const m = req.method;
  if (p === '/api/chars' && m === 'GET') {
    const r = await db.prepare('SELECT char, COUNT(*) AS count, MAX(updated_at) AS updated FROM memories WHERE deleted = 0 GROUP BY char ORDER BY updated DESC').all();
    return json({ ok: true, chars: r.results || [] });
  }
  if (p === '/api/memories' && m === 'GET') {
    const char = url.searchParams.get('char'), q = url.searchParams.get('q'), since = parseInt(url.searchParams.get('since') || '0', 10);
    let sql = 'SELECT * FROM memories WHERE 1 = 1', args = [];
    if (!since) sql += ' AND deleted = 0';
    else { sql += ' AND updated_at > ?'; args.push(since); }   // 同步时连删掉的也给，好让别处也删掉
    if (char) { sql += ' AND char = ?'; args.push(char); }
    if (q) { sql += ' AND content LIKE ?'; args.push('%' + q + '%'); }
    sql += ' ORDER BY updated_at DESC LIMIT 2000';
    const r = await db.prepare(sql).bind(...args).all();
    return json({ ok: true, memories: r.results || [], now: Date.now() });
  }
  if (p === '/api/memories' && m === 'POST') {
    const b = await req.json().catch(() => ({}));
    const char = String(b.char || '').trim(), content = String(b.content || '').trim();
    if (!char || !content) return json({ ok: false, error: '要写是哪个角色、记什么' }, 400);
    const now = Date.now(), id = String(b.id || ('m' + now.toString(36) + randomId(4)));
    const kind = KINDS.includes(b.kind) ? b.kind : 'memory';
    await db.prepare('INSERT INTO memories (id, char, content, kind, source, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, 0)')
      .bind(id, char.slice(0, 60), content.slice(0, 4000), kind, String(b.source || '').slice(0, 40), parseInt(b.created_at, 10) || now, now).run();
    return json({ ok: true, id, updated_at: now });
  }
  const one = p.match(/^\/api\/memories\/([\w-]+)$/);
  if (one && m === 'PUT') {
    const b = await req.json().catch(() => ({}));
    const cur = await db.prepare('SELECT * FROM memories WHERE id = ?').bind(one[1]).first();
    if (!cur) return json({ ok: false, error: '没有这条' }, 404);
    const now = Date.now();
    await db.prepare('UPDATE memories SET char = ?, content = ?, kind = ?, updated_at = ?, deleted = 0 WHERE id = ?')
      .bind(String(b.char || cur.char).slice(0, 60), String(b.content || cur.content).slice(0, 4000), KINDS.includes(b.kind) ? b.kind : cur.kind, now, one[1]).run();
    return json({ ok: true, updated_at: now });
  }
  if (one && m === 'DELETE') {
    const now = Date.now();
    await db.prepare('UPDATE memories SET deleted = 1, updated_at = ? WHERE id = ?').bind(now, one[1]).run();
    return json({ ok: true, updated_at: now });
  }
  return json({ ok: false, error: '没有这个接口' }, 404);
}

function cors(res) {
  res.headers.set('access-control-allow-origin', '*');
  res.headers.set('access-control-allow-headers', 'authorization, content-type, mcp-session-id, mcp-protocol-version');
  res.headers.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
  return res;
}
function json(o, status) {
  return cors(new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }));
}

// ---------- 网页 ----------
// 单独打开就能翻看、编辑；样子都用 :root 上的颜色变量写，之后可以整个换掉
const PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>记忆库</title>
<style>
:root {
  --bg: linear-gradient(160deg, #FFE6EF 0%, #F6E7F6 50%, #DFE7FB 100%);
  --card: rgba(255,255,255,0.78);
  --ink: #4a3b42; --sub: #a08e98; --accent: #d0708f; --accent-soft: #fbe3ec; --line: rgba(200,160,180,0.25);
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body { background: var(--bg); background-attachment: fixed; color: var(--ink); font: 15px/1.6 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; }
.wrap { max-width: 640px; margin: 0 auto; padding: 18px 16px 90px; }
h1 { font-size: 20px; font-weight: 600; margin: 8px 2px 4px; letter-spacing: 1px; }
.sub { color: var(--sub); font-size: 12.5px; margin: 0 2px 14px; }
.card { background: var(--card); border: 1px solid rgba(255,255,255,0.8); border-radius: 16px; padding: 14px 16px; box-shadow: 0 4px 18px rgba(150,100,130,0.08); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
input, textarea, select { width: 100%; font: inherit; color: inherit; background: rgba(255,255,255,0.9); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; outline: none; }
textarea { min-height: 140px; resize: vertical; }
button { font: inherit; border: none; border-radius: 12px; padding: 10px 16px; cursor: pointer; background: var(--accent-soft); color: var(--accent); }
button.primary { background: var(--accent); color: #fff; }
.row { display: flex; gap: 8px; align-items: center; }
.chips { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 10px; scrollbar-width: none; }
.chip { flex: 0 0 auto; padding: 6px 14px; border-radius: 999px; background: rgba(255,255,255,0.7); color: var(--sub); font-size: 13.5px; }
.chip.on { background: var(--accent); color: #fff; }
.mem { margin-top: 10px; cursor: pointer; }
.mem-text { white-space: pre-wrap; word-break: break-word; }
.mem-meta { display: flex; gap: 10px; margin-top: 6px; font-size: 11.5px; color: var(--sub); }
.tag { padding: 0 8px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); }
.empty { text-align: center; color: var(--sub); padding: 40px 0; font-size: 13.5px; }
.fab { position: fixed; right: 20px; bottom: 24px; width: 54px; height: 54px; border-radius: 50%; font-size: 26px; padding: 0; background: var(--accent); color: #fff; box-shadow: 0 6px 18px rgba(208,112,143,0.35); }
.mask { position: fixed; inset: 0; background: rgba(60,40,55,0.28); display: none; align-items: flex-end; justify-content: center; }
.mask.open { display: flex; }
.sheet { width: 100%; max-width: 640px; background: #fff9fb; border-radius: 20px 20px 0 0; padding: 18px 16px 24px; }
.sheet h2 { font-size: 16px; margin: 0 0 12px; font-weight: 600; }
.sheet .row { margin-top: 10px; }
.sheet label { font-size: 12.5px; color: var(--sub); display: block; margin: 10px 2px 4px; }
.msg { color: var(--accent); font-size: 13px; min-height: 20px; margin-top: 8px; }
.hide { display: none !important; }
</style>
</head>
<body>
<div class="wrap">
  <h1>记忆库</h1>
  <div class="sub" id="subLine">几个小手机共用的同一份记忆</div>

  <div class="card hide" id="setupBox">
    <div>第一次打开，先设一个密码（至少 6 位）。之后在眠花糖机和别的小手机里连这个记忆库，都用这个密码。</div>
    <input type="password" id="setupPass" placeholder="密码" style="margin-top:10px">
    <input type="password" id="setupPass2" placeholder="再输一次" style="margin-top:8px">
    <div class="row" style="margin-top:10px"><button class="primary" id="setupBtn" style="flex:1">设好了</button></div>
    <div class="msg" id="setupMsg"></div>
  </div>

  <div class="card hide" id="loginBox">
    <div>输入密码打开记忆库</div>
    <input type="password" id="loginPass" placeholder="密码" style="margin-top:10px">
    <div class="row" style="margin-top:10px"><button class="primary" id="loginBtn" style="flex:1">打开</button></div>
    <div class="msg" id="loginMsg"></div>
  </div>

  <div class="hide" id="mainBox">
    <div class="chips" id="chars"></div>
    <input id="search" placeholder="搜一搜记忆里的字">
    <div id="list"></div>
  </div>
</div>
<button class="fab hide" id="addBtn" aria-label="记一条">＋</button>

<div class="mask" id="editMask">
  <div class="sheet">
    <h2 id="editTitle">记一条</h2>
    <label>角色</label>
    <input id="editChar" placeholder="角色名字，比如：简然" maxlength="60">
    <label>类型</label>
    <select id="editKind"><option value="memory">记忆（发生过的事）</option><option value="fact">设定（关于 TA 自己）</option><option value="relation">关系（你们之间）</option></select>
    <label>内容</label>
    <textarea id="editText" placeholder="写具体一点：什么时候、发生了什么、TA 怎么想"></textarea>
    <div class="row"><button id="editDel">删除</button><span style="flex:1"></span><button id="editCancel">取消</button><button class="primary" id="editSave">保存</button></div>
    <div class="msg" id="editMsg"></div>
  </div>
</div>

<script>
var $ = function(id) { return document.getElementById(id); };
var pass = '', curChar = '', all = [], editing = null;
try { pass = localStorage.getItem('mmPass') || ''; } catch (e) {}
var KIND = { memory: '记忆', fact: '设定', relation: '关系' };
function api(path, opt) {
  opt = opt || {};
  opt.headers = Object.assign({ 'content-type': 'application/json', authorization: 'Bearer ' + pass }, opt.headers || {});
  return fetch(path, opt).then(function(r) { return r.json().then(function(j) { if (!j.ok) { var e = new Error(j.error || ('出错了 ' + r.status)); e.status = r.status; throw e; } return j; }); });
}
function show(id) { ['setupBox', 'loginBox', 'mainBox'].forEach(function(x) { $(x).classList.toggle('hide', x !== id); }); $('addBtn').classList.toggle('hide', id !== 'mainBox'); }
function fmt(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function start() {
  fetch('/api/ping').then(function(r) { return r.json(); }).then(function(j) {
    if (!j.claimed) return show('setupBox');
    if (!pass) return show('loginBox');
    load();
  }).catch(function(e) { $('subLine').textContent = '连不上：' + e.message; });
}
function load() {
  api('/api/memories').then(function(j) {
    all = j.memories; show('mainBox'); render();
  }).catch(function(e) {
    if (e.status === 401) { pass = ''; try { localStorage.removeItem('mmPass'); } catch (x) {} show('loginBox'); $('loginMsg').textContent = '密码不对，再试一次'; }
    else $('subLine').textContent = '读不出来：' + e.message;
  });
}
function render() {
  var chars = {};
  all.forEach(function(m) { chars[m.char] = (chars[m.char] || 0) + 1; });
  var names = Object.keys(chars);
  if (curChar && !chars[curChar]) curChar = '';
  $('chars').innerHTML = '';
  [['', '全部 ' + all.length]].concat(names.map(function(n) { return [n, n + ' ' + chars[n]]; })).forEach(function(c) {
    var b = document.createElement('button'); b.className = 'chip' + (c[0] === curChar ? ' on' : ''); b.textContent = c[1];
    b.onclick = function() { curChar = c[0]; render(); }; $('chars').appendChild(b);
  });
  var q = $('search').value.trim();
  var list = all.filter(function(m) { return (!curChar || m.char === curChar) && (!q || m.content.indexOf(q) >= 0); });
  $('subLine').textContent = '共 ' + all.length + ' 条，' + names.length + ' 个角色';
  $('list').innerHTML = list.length ? '' : '<div class="empty">' + (all.length ? '没有对上的' : '还没有记忆，点右下角的 ＋ 记第一条') + '</div>';
  list.forEach(function(m) {
    var d = document.createElement('div'); d.className = 'card mem';
    d.innerHTML = '<div class="mem-text"></div><div class="mem-meta"><span class="tag"></span><span class="who"></span><span class="when"></span><span class="src"></span></div>';
    d.querySelector('.mem-text').textContent = m.content;
    d.querySelector('.tag').textContent = KIND[m.kind] || '记忆';
    d.querySelector('.who').textContent = m.char;
    d.querySelector('.when').textContent = fmt(m.updated_at);
    d.querySelector('.src').textContent = m.source ? '来自 ' + m.source : '';
    d.onclick = function() { openEdit(m); };
    $('list').appendChild(d);
  });
}
function openEdit(m) {
  editing = m || null;
  $('editTitle').textContent = m ? '改一改' : '记一条';
  $('editChar').value = m ? m.char : curChar;
  $('editKind').value = m ? m.kind : 'memory';
  $('editText').value = m ? m.content : '';
  $('editDel').classList.toggle('hide', !m);
  $('editMsg').textContent = '';
  $('editMask').classList.add('open');
}
$('setupBtn').onclick = function() {
  var a = $('setupPass').value, b = $('setupPass2').value;
  if (a.length < 6) return $('setupMsg').textContent = '密码至少 6 位';
  if (a !== b) return $('setupMsg').textContent = '两次不一样';
  fetch('/api/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: a }) })
    .then(function(r) { return r.json(); }).then(function(j) {
      if (!j.ok) return $('setupMsg').textContent = j.error;
      pass = a; try { localStorage.setItem('mmPass', a); } catch (e) {} load();
    });
};
$('loginBtn').onclick = function() { pass = $('loginPass').value; try { localStorage.setItem('mmPass', pass); } catch (e) {} load(); };
$('search').oninput = render;
$('addBtn').onclick = function() { openEdit(null); };
$('editCancel').onclick = function() { $('editMask').classList.remove('open'); };
$('editMask').onclick = function(e) { if (e.target === $('editMask')) $('editMask').classList.remove('open'); };
$('editSave').onclick = function() {
  var body = { char: $('editChar').value.trim(), kind: $('editKind').value, content: $('editText').value.trim(), source: '记忆库网页' };
  if (!body.char || !body.content) return $('editMsg').textContent = '角色和内容都要写';
  var req = editing ? api('/api/memories/' + editing.id, { method: 'PUT', body: JSON.stringify(body) }) : api('/api/memories', { method: 'POST', body: JSON.stringify(body) });
  req.then(function() { $('editMask').classList.remove('open'); load(); }).catch(function(e) { $('editMsg').textContent = '没存上：' + e.message; });
};
$('editDel').onclick = function() {
  if (!editing || !confirm('删掉这条？')) return;
  api('/api/memories/' + editing.id, { method: 'DELETE' }).then(function() { $('editMask').classList.remove('open'); load(); }).catch(function(e) { $('editMsg').textContent = '没删掉：' + e.message; });
};
start();
</script>
</body>
</html>`;
