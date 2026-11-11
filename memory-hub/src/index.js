// 眠花糖机记忆库：部署在用户自己的 Cloudflare 账号里（Worker + D1），几个小手机、几台设备共用同一份角色核心（人设）和记忆，让角色在哪儿都是同一个 TA。
// 三个门：/ 网页（翻看、编辑）；/api/* 给眠花糖机同步用（/api/sync 推上来、/api/pull 拉下去）；/mcp 给别的小手机连（MCP，Streamable HTTP，不保持连接）。
// 第一次打开网页时设密码（只存加盐后的哈希）；/api 请求带「Authorization: Bearer 密码」。/mcp 用单独的连接码（网页里能看、能换），也认密码。
// /api/ping 不用密码，用来测连不连得上。

const VERSION = 4;

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
      if (p === '/mcp') return mcp(req, env.DB, url);
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
  // 第二版加的列：meta（各个小手机自己的附加信息，眠花糖机存记忆类型 long / precious、剧情空间这些，JSON 文本）
  try { await db.prepare("ALTER TABLE memories ADD COLUMN meta TEXT NOT NULL DEFAULT ''").run(); } catch (e) { /* 已经有了 */ }
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

async function mcpToken(db, reset) {
  let t = reset ? null : await getSetting(db, 'mcp_token');
  if (!t) { t = randomId(16); await setSetting(db, 'mcp_token', t); }
  return t;
}

// ---------- 接口 ----------
const KINDS = ['memory', 'fact', 'relation', 'core'];   // core 人设核心：一个角色一份，这个角色是谁（第三版加的）
const AI_KINDS = ['memory', 'fact', 'relation'];           // 角色自己能记的类型（人设核心只能用户改）
function cap(kind) { return kind === 'core' ? 30000 : 4000; }   // 一条最多多少字：人设可以长
const SYNC_MAX = 40;   // 一次最多推多少条（免费版每次请求能查数据库的次数有限，分批推）
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
      .bind(id, char.slice(0, 60), content.slice(0, cap(kind)), kind, String(b.source || '').slice(0, 40), parseInt(b.created_at, 10) || now, now).run();
    return json({ ok: true, id, updated_at: now });
  }
  const one = p.match(/^\/api\/memories\/([\w-]+)$/);
  if (one && m === 'PUT') {
    const b = await req.json().catch(() => ({}));
    const cur = await db.prepare('SELECT * FROM memories WHERE id = ?').bind(one[1]).first();
    if (!cur) return json({ ok: false, error: '没有这条' }, 404);
    const now = Date.now(), kind = KINDS.includes(b.kind) ? b.kind : cur.kind;
    await db.prepare('UPDATE memories SET char = ?, content = ?, kind = ?, updated_at = ?, deleted = 0 WHERE id = ?')
      .bind(String(b.char || cur.char).slice(0, 60), String(b.content || cur.content).slice(0, cap(kind)), kind, now, one[1]).run();
    return json({ ok: true, updated_at: now });
  }
  if (one && m === 'DELETE') {
    const now = Date.now();
    await db.prepare('UPDATE memories SET deleted = 1, updated_at = ? WHERE id = ?').bind(now, one[1]).run();
    return json({ ok: true, updated_at: now });
  }
  // 同步：眠花糖机把这次要推的（新的、改过的、删掉的）发上来；id 已经有的就更新，新的先看有没有一模一样的（别处已经推过）——有就告诉它用那条的 id
  if (p === '/api/sync' && m === 'POST') {
    const b = await req.json().catch(() => ({}));
    const changes = (Array.isArray(b.changes) ? b.changes : []).slice(0, SYNC_MAX).filter(c => c && c.id);
    const alias = {};
    if (changes.length) {
      const ids = changes.map(c => String(c.id));
      const ex = await db.prepare('SELECT id FROM memories WHERE id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).all();
      const have = new Set((ex.results || []).map(r => r.id));
      const fresh = changes.filter(c => !have.has(String(c.id)) && !c.deleted && c.content);
      const dupMap = {};
      if (fresh.length) {
        const ct = fresh.map(c => String(c.content).slice(0, cap(c.kind)));
        const d = await db.prepare('SELECT id, char, kind, content FROM memories WHERE deleted = 0 AND content IN (' + ct.map(() => '?').join(',') + ')').bind(...ct).all();
        (d.results || []).forEach(r => { dupMap[r.char + '\u0001' + r.kind + '\u0001' + r.content] = r.id; });
      }
      const now = Date.now(), stmts = [];
      changes.forEach(c => {
        const id = String(c.id).slice(0, 80), kind = KINDS.includes(c.kind) ? c.kind : 'memory';
        const char = String(c.char || '').slice(0, 60), content = String(c.content || '').slice(0, cap(kind)), meta = typeof c.meta === 'string' ? c.meta.slice(0, 2000) : JSON.stringify(c.meta || {});
        if (have.has(id)) {
          if (c.deleted) stmts.push(db.prepare('UPDATE memories SET deleted = 1, updated_at = ? WHERE id = ?').bind(now, id));
          else stmts.push(db.prepare('UPDATE memories SET char = ?, content = ?, kind = ?, meta = ?, deleted = 0, updated_at = ? WHERE id = ?').bind(char, content, kind, meta, now, id));
        } else if (!c.deleted && char && content) {
          const dup = dupMap[char + '\u0001' + kind + '\u0001' + content];
          if (dup) { alias[id] = dup; return; }
          stmts.push(db.prepare('INSERT INTO memories (id, char, content, kind, source, meta, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)')
            .bind(id, char, content, kind, String(c.source || '眠花糖机').slice(0, 40), meta, parseInt(c.created_at, 10) || now, now));
        }
      });
      if (stmts.length) await db.batch(stmts);
    }
    return json({ ok: true, alias });
  }
  // 拉：从上次同步的位置往后，按时间一页页给（连删掉的一起，好让别处也删掉）；after 是同一毫秒里排在前面的最后一个 id
  if (p === '/api/pull' && m === 'GET') {
    const since = parseInt(url.searchParams.get('since') || '0', 10), after = url.searchParams.get('after') || '';
    const r = await db.prepare('SELECT * FROM memories WHERE updated_at > ? OR (updated_at = ? AND id > ?) ORDER BY updated_at ASC, id ASC LIMIT 500').bind(since, since, after).all();
    return json({ ok: true, rows: r.results || [], now: Date.now() });
  }
  // 给别的小手机连的 MCP 地址和连接码（网页里看；reset 换一个新的，旧的就不能用了）
  if (p === '/api/mcp-info' && (m === 'GET' || m === 'POST')) {
    const t = await mcpToken(db, m === 'POST');
    const base = url.origin;
    return json({ ok: true, url: base + '/mcp', token: t, urlWithToken: base + '/mcp?token=' + t });
  }
  return json({ ok: false, error: '没有这个接口' }, 404);
}

// ---------- MCP：给别的小手机连（JSON-RPC，一问一答，不保持连接） ----------
// 小手机连上后，它的 AI 能自己调用：了解自己（get_character）、回忆（recall）、记下（remember）、改（update_memory）、忘掉（forget）、看有哪些角色（list_characters）
const MCP_INSTRUCTIONS = '这是用户的「眠花糖机记忆库」，几个小手机共用同一份角色记忆，让角色在哪里都是同一个人。' +
  '每次新的对话开始、或者不确定自己是怎样的人、和用户之间发生过什么时，先用 get_character 取出你自己的人设核心、设定、关系和最近的记忆，照着保持一致；人设核心就是你是谁，它和这边给你的人设有出入时，以人设核心为准；' +
  '聊到具体的事想不起来时用 recall 搜一搜；用户告诉你重要的事、你们之间发生了值得记住的事、你第一次说出关于自己的新设定时，用 remember 记下来（一件事一条，写清时间和具体细节）。' +
  '记忆是你自己的经历，自然地用，不要对用户说「我查了记忆库」。char 参数写你自己的名字。';
const MCP_TOOLS = [
  { name: 'get_character', description: '了解你自己：取出这个角色在记忆库里的人设核心（你是谁）、全部设定、和用户的关系、最近的记忆。新对话开始时先调用。Get this character\'s core persona, settings, relationship and recent memories.',
    inputSchema: { type: 'object', properties: { char: { type: 'string', description: '角色名字（你自己的名字）' } }, required: ['char'] } },
  { name: 'recall', description: '回忆：按关键词搜这个角色的记忆。Search memories by keywords.',
    inputSchema: { type: 'object', properties: { char: { type: 'string', description: '角色名字' }, query: { type: 'string', description: '想找的内容，几个关键词' }, limit: { type: 'number', description: '最多几条，默认 8' } }, required: ['char', 'query'] } },
  { name: 'remember', description: '记下一条：用户说的重要的事、你们之间发生的事（kind=memory）、关于你自己的新设定（kind=fact）、你们关系的变化（kind=relation）。一件事一条，写清时间和细节。Save a memory.',
    inputSchema: { type: 'object', properties: { char: { type: 'string', description: '角色名字' }, content: { type: 'string', description: '要记的内容' }, kind: { type: 'string', enum: ['memory', 'fact', 'relation'], description: '类型，默认 memory' } }, required: ['char', 'content'] } },
  { name: 'update_memory', description: '改一条记忆（内容变了、记错了）。id 在 get_character / recall 的结果里。Update a memory by id.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, content: { type: 'string' } }, required: ['id', 'content'] } },
  { name: 'forget', description: '删掉一条记忆（只在用户明确要求忘掉，或者这条完全错了时用）。Delete a memory by id.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'list_characters', description: '看记忆库里有哪些角色、各有多少条。List characters.',
    inputSchema: { type: 'object', properties: {} } }
];
async function mcp(req, db, url) {
  if (req.method === 'GET') return cors(new Response('这是 MCP 地址，要用 POST 连（Streamable HTTP）', { status: 405, headers: { allow: 'POST' } }));
  if (req.method === 'DELETE') return cors(new Response(null, { status: 204 }));
  if (req.method !== 'POST') return cors(new Response(null, { status: 405, headers: { allow: 'POST' } }));
  // 连接码：?token= 或 Authorization: Bearer（连接码或密码都行）
  const given = url.searchParams.get('token') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const ok = given && (given === await mcpToken(db) || await authed(new Request(url, { headers: { authorization: 'Bearer ' + given } }), db));
  if (!ok) return json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: '连接码不对（在记忆库网页里看）' } }, 401);
  const body = await req.json().catch(() => null);
  if (!body) return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: '不是 JSON' } }, 400);
  // 哪个小手机连的：initialize 时记在会话 id 里（不存服务器，小手机之后每次都带回来），记下的记忆标「来自 它」
  let app = '';
  try { app = decodeURIComponent(atob(req.headers.get('mcp-session-id') || '')); } catch (e) {}
  let sessionId = '';
  const handle = async (msg) => {
    if (!msg || typeof msg !== 'object') return { jsonrpc: '2.0', id: null, error: { code: -32600, message: '请求不对' } };
    const id = msg.id === undefined ? null : msg.id;
    if (msg.id === undefined) return null;   // 通知，不用回
    try {
      if (msg.method === 'initialize') {
        const ci = (msg.params && msg.params.clientInfo) || {};
        sessionId = btoa(encodeURIComponent(String(ci.name || 'MCP').slice(0, 40)));
        return { jsonrpc: '2.0', id, result: { protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-03-26', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'mphone-memory', version: String(VERSION) }, instructions: MCP_INSTRUCTIONS } };
      }
      if (msg.method === 'ping') return { jsonrpc: '2.0', id, result: {} };
      if (msg.method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } };
      if (msg.method === 'tools/call') {
        const name = msg.params && msg.params.name, args = (msg.params && msg.params.arguments) || {};
        const text = await mcpTool(db, name, args, app);
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } };
      }
      return { jsonrpc: '2.0', id, error: { code: -32601, message: '没有这个方法：' + msg.method } };
    } catch (e) {
      if (msg.method === 'tools/call') return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '出错了：' + ((e && e.message) || e) }], isError: true } };
      return { jsonrpc: '2.0', id, error: { code: -32603, message: String((e && e.message) || e) } };
    }
  };
  const out = Array.isArray(body) ? (await Promise.all(body.map(handle))).filter(Boolean) : await handle(body);
  if (!out || (Array.isArray(out) && !out.length)) return cors(new Response(null, { status: 202 }));
  const res = json(out);
  if (sessionId) res.headers.set('mcp-session-id', sessionId);
  res.headers.set('access-control-expose-headers', 'mcp-session-id');
  return res;
}
async function findChar(db, name) {
  name = String(name || '').trim();
  if (!name) throw new Error('要写角色名字（char）');
  const r = await db.prepare('SELECT DISTINCT char FROM memories WHERE deleted = 0').all();
  const all = (r.results || []).map(x => x.char);
  const norm = s => s.toLowerCase().replace(/[\s·・_\-]/g, '');
  return all.find(c => c === name) || all.find(c => norm(c) === norm(name)) || (all.length === 1 ? all[0] : name);   // 专属记忆库只有一个角色：怎么叫都是 TA
}
function day(t) { const d = new Date(t + 8 * 3600000); return d.toISOString().slice(0, 10); }   // 按北京时间写日期
function memLine(m) { return '- [' + day(m.created_at) + '] ' + m.content + '（id: ' + m.id + (m.source ? '，来自 ' + m.source : '') + '）'; }
// 关键词：按空格和标点分开；中文长词再拆成两个字一组，说法不完全一样也能对上一部分
function keywords(q) {
  const out = new Set();
  String(q || '').toLowerCase().split(/[\s,，。！？!?、；;：:“”"'（）()【】\[\]]+/).filter(Boolean).forEach(w => {
    out.add(w);
    if (/[\u4e00-\u9fff]/.test(w) && w.length > 2) for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2));
  });
  return [...out];
}
async function mcpTool(db, name, a, app) {
  if (name === 'list_characters') {
    const r = await db.prepare('SELECT char, COUNT(*) AS n FROM memories WHERE deleted = 0 GROUP BY char ORDER BY n DESC').all();
    const rows = r.results || [];
    return rows.length ? rows.map(x => x.char + '：' + x.n + ' 条').join('\n') : '记忆库还是空的';
  }
  if (name === 'get_character') {
    const char = await findChar(db, a.char);
    const r = await db.prepare('SELECT * FROM memories WHERE deleted = 0 AND char = ? ORDER BY updated_at DESC').bind(char).all();
    const rows = r.results || [];
    if (!rows.length) return '记忆库里还没有「' + char + '」的记忆。可以用 list_characters 看看有哪些角色名字。';
    const core = rows.filter(m => m.kind === 'core')[0];   // 有好几份时用最近改过的那份
    const facts = rows.filter(m => m.kind === 'fact'), rel = rows.filter(m => m.kind === 'relation'), mem = rows.filter(m => m.kind === 'memory');
    const parts = ['【' + char + '】记忆库里一共 ' + rows.length + ' 条'];
    if (core) parts.push('【人设核心（你是谁。在哪个小手机里都照这个来）】\n' + core.content);
    if (facts.length) parts.push('【设定（关于你自己）】\n' + facts.slice(0, 80).map(memLine).join('\n'));
    if (rel.length) parts.push('【和用户的关系】\n' + rel.slice(0, 20).map(memLine).join('\n'));
    if (mem.length) parts.push('【最近的记忆】（共 ' + mem.length + ' 条，这里是最近 20 条，更早的用 recall 搜）\n' + mem.slice(0, 20).map(memLine).join('\n'));
    return parts.join('\n\n');
  }
  if (name === 'recall') {
    const char = await findChar(db, a.char), kw = keywords(a.query), limit = Math.min(30, Math.max(1, parseInt(a.limit, 10) || 8));
    const r = await db.prepare('SELECT * FROM memories WHERE deleted = 0 AND char = ? AND kind != \'core\' ORDER BY updated_at DESC LIMIT 3000').bind(char).all();
    const scored = (r.results || []).map(m => { const t = m.content.toLowerCase(); return { m, s: kw.reduce((n, k) => n + (t.includes(k) ? (k.length > 1 ? 2 : 1) : 0), 0) }; })
      .filter(x => x.s > 0).sort((x, y) => y.s - x.s || y.m.updated_at - x.m.updated_at).slice(0, limit);
    return scored.length ? scored.map(x => memLine(x.m)).join('\n') : '没找到和「' + a.query + '」有关的记忆。';
  }
  if (name === 'remember') {
    const char = await findChar(db, a.char), content = String(a.content || '').trim();
    if (!content) throw new Error('content 是空的');
    const kind = AI_KINDS.includes(a.kind) ? a.kind : 'memory';
    const dup = await db.prepare('SELECT id FROM memories WHERE deleted = 0 AND char = ? AND content = ?').bind(char, content).first();
    if (dup) return '这条已经记过了（id: ' + dup.id + '）';
    const now = Date.now(), id = 'm' + now.toString(36) + randomId(4);
    await db.prepare('INSERT INTO memories (id, char, content, kind, source, meta, created_at, updated_at, deleted) VALUES (?, ?, ?, ?, ?, \'\', ?, ?, 0)')
      .bind(id, char.slice(0, 60), content.slice(0, 4000), kind, String(app || 'MCP').slice(0, 40), now, now).run();
    return '记下了（id: ' + id + '）';
  }
  if (name === 'update_memory') {
    const cur = await db.prepare('SELECT id, kind FROM memories WHERE id = ? AND deleted = 0').bind(String(a.id || '')).first();
    if (!cur) throw new Error('没有这条（id 不对）');
    if (cur.kind === 'core') throw new Error('人设核心只有用户能改');
    await db.prepare('UPDATE memories SET content = ?, updated_at = ? WHERE id = ?').bind(String(a.content || '').slice(0, 4000), Date.now(), cur.id).run();
    return '改好了';
  }
  if (name === 'forget') {
    const r = await db.prepare('UPDATE memories SET deleted = 1, updated_at = ? WHERE id = ? AND deleted = 0 AND kind != \'core\'').bind(Date.now(), String(a.id || '')).run();
    return r.meta && r.meta.changes ? '删掉了' : '没有这条（id 不对）';
  }
  throw new Error('没有这个工具：' + name);
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
.mem.core { border-color: var(--accent); }
.mem.core .mem-text { max-height: 8em; overflow: hidden; -webkit-mask-image: linear-gradient(#000 60%, transparent); mask-image: linear-gradient(#000 60%, transparent); }
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
details.card { margin-bottom: 12px; }
details.card summary { cursor: pointer; color: var(--accent); font-size: 14px; }
.kv { margin-top: 10px; font-size: 12.5px; color: var(--sub); }
.kv code { display: block; margin-top: 4px; padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,0.9); color: var(--ink); word-break: break-all; font-size: 12.5px; }
.kv .row { margin-top: 6px; }
.kv button { padding: 6px 12px; font-size: 12.5px; }
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
    <details class="card" id="mcpBox">
      <summary>给别的小手机连（MCP）</summary>
      <div class="kv">在别的小手机的 MCP 设置里，地址填下面这个（已经带上连接码，填这一个就行）：<code id="mcpUrlTok">…</code>
        <div class="row"><button id="copyUrlTok">复制</button></div></div>
      <div class="kv">如果那个小手机有单独填「请求头 / Token」的地方，也可以地址填<code id="mcpUrl">…</code>请求头填 <b>Authorization</b>，值填<code id="mcpTok">…</code>
        <div class="row"><button id="copyTok">复制值</button></div></div>
      <div class="kv">连接码泄露了就换一个，换了以后旧的就连不上了，要去各个小手机里重新填。<div class="row"><button id="resetTok">换一个连接码</button></div></div>
    </details>
    <details class="card" id="ioBox">
      <summary>导入 / 导出</summary>
      <div class="kv">导入：选一个整理好的文件（.json），里面的人设核心、设定、关系、记忆一次放进来。同样的内容不会放两遍；文件里有人设核心时，会换掉这个角色现在的那份。
        <div class="row"><button id="impPick">选文件导入</button><button id="expAll">导出全部</button></div>
        <input type="file" id="impFile" accept=".json,.txt,application/json" class="hide">
        <div class="msg" id="impMsg"></div></div>
      <div class="kv">导出：把记忆库里现在的全部存成一个文件，留着当备份，也能再导进别的记忆库。</div>
    </details>
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
    <select id="editKind"><option value="core">人设核心（TA 是谁，一个角色一份）</option><option value="memory">记忆（发生过的事）</option><option value="fact">设定（关于 TA 自己）</option><option value="relation">关系（你们之间）</option></select>
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
var KIND = { core: '人设核心', memory: '记忆', fact: '设定', relation: '关系' };
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
function copy(t) { if (navigator.clipboard) navigator.clipboard.writeText(t).then(function() { alert('复制好了'); }, function() { prompt('手动复制一下', t); }); else prompt('手动复制一下', t); }
function paintMcp(j) { $('mcpUrlTok').textContent = j.urlWithToken; $('mcpUrl').textContent = j.url; $('mcpTok').textContent = 'Bearer ' + j.token; }
function loadMcp() { api('/api/mcp-info').then(paintMcp).catch(function() {}); }
$('copyUrlTok').onclick = function() { copy($('mcpUrlTok').textContent); };
$('copyTok').onclick = function() { copy($('mcpTok').textContent); };
$('resetTok').onclick = function() { if (confirm('换一个新的连接码？旧的马上不能用了')) api('/api/mcp-info', { method: 'POST' }).then(paintMcp); };
function load() {
  api('/api/memories').then(function(j) {
    all = j.memories; show('mainBox'); render(); loadMcp();
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
  list = list.filter(function(m) { return m.kind === 'core'; }).concat(list.filter(function(m) { return m.kind !== 'core'; }));   // 人设核心排最前面
  $('subLine').textContent = '共 ' + all.length + ' 条，' + names.length + ' 个角色';
  $('list').innerHTML = list.length ? '' : '<div class="empty">' + (all.length ? '没有对上的' : '还没有记忆，点右下角的 ＋ 记第一条') + '</div>';
  list.forEach(function(m) {
    var d = document.createElement('div'); d.className = 'card mem' + (m.kind === 'core' ? ' core' : '');
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
// ---------- 导入 / 导出 ----------
// 文件：{ app: 'mphone-memory', items: [{ char, kind: core / fact / relation / memory, content, time }] }（直接一个数组也行；time 是日期字符串或毫秒数，可以不写）
// id 用内容算出来（同一条再导一次还是同一个 id）；人设核心一个角色一份：已经有就换掉那份，没有就用 p + 名字的哈希（和眠花糖机推上来的是同一个 id）
function hash(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
$('impPick').onclick = function() { $('impFile').click(); };
$('impFile').onchange = function() {
  var f = this.files[0]; this.value = '';
  if (!f) return;
  var rd = new FileReader();
  rd.onload = function() { runImport(String(rd.result)); };
  rd.readAsText(f);
};
function runImport(text) {
  var j;
  try { j = JSON.parse(text); } catch (e) { $('impMsg').textContent = '这个文件读不懂（要 .json）'; return; }
  var items = Array.isArray(j) ? j : (j && (j.items || j.memories)) || [];
  var list = [], n = { core: 0, fact: 0, relation: 0, memory: 0 }, seen = {};
  items.forEach(function(x) {
    if (!x) return;
    var char = String(x.char || (j && j.char) || '').trim(), content = String(x.content || x.text || '').trim(), kind = KIND[x.kind] ? x.kind : 'memory';
    if (!char || !content) return;
    var id = 'i' + hash(char + '|' + kind + '|' + content);
    if (kind === 'core') { var cur = all.filter(function(m) { return m.kind === 'core' && m.char === char; })[0]; id = cur ? cur.id : 'p' + hash(char); }
    if (seen[id]) return; seen[id] = 1;
    var t = x.time || x.date || x.created_at, at = typeof t === 'number' ? t : (t ? Date.parse(t) : 0);
    list.push({ id: id, char: char, kind: kind, content: content, source: String(x.source || '导入'), meta: x.meta || {}, created_at: at || Date.now() });   // meta.type = precious 的进小手机时是珍贵记忆
    n[kind]++;
  });
  if (!list.length) { $('impMsg').textContent = '文件里没找到能导入的内容'; return; }
  if (!confirm('要导入 ' + list.length + ' 条：人设核心 ' + n.core + '、设定 ' + n.fact + '、关系 ' + n.relation + '、记忆 ' + n.memory + '。' + (n.core ? '已有的人设核心会换成文件里的。' : '') + '继续吗？')) return;
  var i = 0;
  function next() {
    if (i >= list.length) { $('impMsg').textContent = '导入好了，一共 ' + list.length + ' 条'; load(); return; }
    $('impMsg').textContent = '正在导入 ' + i + ' / ' + list.length + '…';
    var batch = list.slice(i, i + 40); i += 40;
    api('/api/sync', { method: 'POST', body: JSON.stringify({ changes: batch }) }).then(next, function(e) { $('impMsg').textContent = '导到一半断了：' + e.message + '（再导一次就行，已经进去的不会重复）'; load(); });
  }
  next();
}
$('expAll').onclick = function() {
  var data = { app: 'mphone-memory', exported: new Date().toISOString(), items: all.map(function(m) { var meta = {}; try { meta = m.meta ? JSON.parse(m.meta) : {}; } catch (e) {} return { char: m.char, kind: m.kind, content: m.content, time: m.created_at, source: m.source, meta: meta }; }) };
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = '记忆库-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
};
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
