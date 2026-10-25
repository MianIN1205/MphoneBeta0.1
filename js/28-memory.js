// 眠花糖机 — 记忆系统 + 记忆库

// =============================================
// 记忆系统：每个角色一套记忆，聊天和动态里的事都能记进来
// · 短期：几天内有用的事，到期自动忘掉；长期：一直记得的事实和经历；珍贵：特别重要的回忆，每次聊天都会想起
// · 读取：每次回复前，按和最近对话的相关程度想起几条（本地文字相似度；开了向量记忆且填了向量模型时用接口的向量）
// · 写入：角色在回复里写 <记忆 类型="长期">…</记忆>，应用悄悄存下（用户看不到）；角色发动态、评论也会记成短期记忆
// · 权限：角色设置「扩展」页（memCfg）；记忆库界面里可以查看、搜索、添加、修改、删除
// =============================================
var memStore = mphoneStore.load('mphone_memories', {});   // { 角色id: [{ id, type, text, time, source, expires, emb, embModel }] }
var memEmbedModel = mphoneStore.load('mphone_mem_embed_model', '');
var MEM_TYPE_NAME = { short: '短期', long: '长期', precious: '珍贵' };
var MEM_TYPE_RANK = { short: 0, long: 1, precious: 2 };
var MEM_SOURCE_NAME = { chat: '聊天', feed: '动态', self: 'TA 自己记的', user: '你加的', diary: '日记' };
var MEM_DAY = 86400000;

function saveMemStore() { mphoneStore.save('mphone_memories', memStore); }
function memCfgOf(char) {
  var m = Object.assign({}, DEFAULT_MEM_CFG, (char && char.memCfg) || {});
  m.types = Object.assign({}, DEFAULT_MEM_CFG.types, m.types || {});
  return m;
}

// ---------- 本地向量：中日韩文按字、英文按词，加上相邻两个的组合，算余弦相似度 ----------
function memTokens(text) {
  var out = {}, w = String(text || '').toLowerCase().match(/[a-z0-9]+|[一-鿿぀-ヿ가-힯]/g) || [];
  w.forEach(function(t, i) {
    out[t] = (out[t] || 0) + (t.length > 1 ? 1 : 0.5);
    if (i + 1 < w.length) { var bg = t + '|' + w[i + 1]; out[bg] = (out[bg] || 0) + 1; }
  });
  return out;
}
function memCos(a, b) {
  var dot = 0, na = 0, nb = 0, k;
  for (k in a) { na += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; }
  for (k in b) nb += b[k] * b[k];
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
function memEmbCos(a, b) {
  var dot = 0, na = 0, nb = 0;
  for (var i = 0; i < a.length && i < b.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// 一个角色当前的记忆（顺手清掉到期的短期记忆）
function memList(charId) {
  var list = memStore[charId] || [], now = Date.now();
  var kept = list.filter(function(m) { return !(m.type === 'short' && m.expires && m.expires < now); });
  if (kept.length !== list.length) { memStore[charId] = kept; saveMemStore(); }
  return kept;
}
// 记下一条；和已有的很像时只更新时间（类型取更重要的那个）
function memAdd(char, data) {
  var text = String((data && data.text) || '').trim().slice(0, 300);
  if (!char || !text) return null;
  var cfg = memCfgOf(char), type = MEM_TYPE_NAME[data.type] ? data.type : 'long';
  var tv = memTokens(text);
  var dup = memList(char.id).filter(function(m) { return memCos(tv, memTokens(m.text)) > 0.85; })[0];
  if (dup) {
    dup.time = Date.now();
    if (MEM_TYPE_RANK[type] > MEM_TYPE_RANK[dup.type]) { dup.type = type; delete dup.expires; }
    if (dup.type === 'short') dup.expires = Date.now() + cfg.shortDays * MEM_DAY;
    saveMemStore();
    return dup;
  }
  var m = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: type, text: text, time: Date.now(), source: data.source || 'chat' };
  if (data.scene === 'drama') m.scene = 'drama';   // 在剧情空间里记下的
  if (type === 'short') m.expires = Date.now() + cfg.shortDays * MEM_DAY;
  (memStore[char.id] = memStore[char.id] || []).push(m);
  saveMemStore();
  if (type !== 'short') setTimeout(function() { memMaybeMilestone(char); }, 0);
  return m;
}

// ---------- 关系里程碑：把零散的长期 / 珍贵记忆整理成你们关系里的重要节点，每次聊天都会想起 ----------
// 长期和珍贵的记忆每多 10 条自动整理一次（角色设置「扩展」页可以关掉），也可以在记忆库里点「重新整理」或直接改
var memMilestones = mphoneStore.load('mphone_mem_milestones', {});   // 角色id → { text, time, basedOn }
var MILESTONE_EVERY = 10;
var memMilestoneBusy = {};
function saveMilestones() { mphoneStore.save('mphone_mem_milestones', memMilestones); }
function memImportant(id) {
  return memList(id).filter(function(m) { return m.type !== 'short'; }).sort(function(a, b) { return a.time - b.time; });
}
function memMaybeMilestone(char) {
  var cfg = memCfgOf(char);
  if (!char || !char.id || !cfg.on || !cfg.milestone || memMilestoneBusy[char.id]) return;
  var ms = memMilestones[char.id] || {};
  if (memImportant(char.id).length - (ms.basedOn || 0) < MILESTONE_EVERY) return;
  var api = getApiCfg();
  if (!api.url || !api.key || !api.model) return;
  memBuildMilestone(char).catch(function(err) { console.warn('[Mphone] 整理关系里程碑失败:', err); });
}
function memBuildMilestone(char) {
  var list = memImportant(char.id);
  if (!list.length) return Promise.reject(new Error('还没有长期或珍贵的记忆'));
  memMilestoneBusy[char.id] = true;
  var ms = memMilestones[char.id] || {};
  var userName = (typeof resolveCharAccount === 'function' && resolveCharAccount(char).nickname) || '用户';
  var prompt = '你是记忆整理助手。下面是「' + memCharName(char) + '」和「' + userName + '」之间的长期记忆，请整理出他们关系里的重要节点（关系里程碑）。\n' +
    (ms.text ? '\n之前整理过的里程碑：\n' + ms.text + '\n' : '') +
    '\n长期记忆（按时间从早到晚）：\n' + list.map(function(m) {
      return '· ' + memDateText(m.time).split(' ')[0] + ' ' + m.text + (m.scene === 'drama' ? '（剧情空间）' : '');
    }).join('\n') +
    '\n\n要求：\n- 只保留会长期影响关系的事：初次认识、确认关系、重要约定、纪念日、第一次见面、同居、吵架后和好、分手或复合等\n' +
    '- 不写日常闲聊、一时的情绪和普通的喜好\n- 之前整理过的里程碑，没有被新的记忆推翻就保留\n' +
    '- 发生在剧情空间的事在后面注明（剧情空间）\n- 每条一行，格式「时间 · 事件」，按时间先后，最多 12 条\n' +
    '- 只输出里程碑本身；如果还没有这样的节点，只输出「暂无」';
  return llmRequest([{ role: 'user', content: prompt }], { stream: false }).then(function(text) {
    text = String(text || '').trim();
    if (/^暂无/.test(text)) text = '';
    memMilestones[char.id] = { text: text.slice(0, 1500), time: Date.now(), basedOn: list.length };
    saveMilestones();
    if (memLibChar === char.id) renderMemLib();
    return text;
  }).then(function(t) { delete memMilestoneBusy[char.id]; return t; },
          function(e) { delete memMilestoneBusy[char.id]; throw e; });
}

// ---------- 想起：按相关程度挑几条 ----------
var memQueryEmb = {};   // 角色id → { text, emb }（发消息前用向量模型算好）
function memVectorOn(char) { return !!(char && char.chatCfg && char.chatCfg.vectorOn && memEmbedModel); }
function memRecall(char, query, k, opts) {
  opts = opts || {};
  var list = memList(char.id).filter(function(m) { return !opts.skipPrecious || m.type !== 'precious'; });
  if (!String(query || '').trim()) return list.slice().sort(function(a, b) { return b.time - a.time; }).slice(0, k).map(function(m) { return { m: m, s: 0 }; });
  var qe = memQueryEmb[char.id], useEmb = memVectorOn(char) && qe && qe.text === query;
  var qt = memTokens(query);
  return list.map(function(m) {
    var s = (useEmb && m.emb && m.embModel === memEmbedModel) ? memEmbCos(qe.emb, m.emb) : memCos(qt, memTokens(m.text));
    if (m.type === 'short' && !opts.all) s += 0.03;   // 聊天时最近的事稍微优先（手动搜索时不加）
    return { m: m, s: s };
  }).filter(function(x) { return opts.all || x.s > (useEmb ? 0.25 : 0.06); })
    .sort(function(a, b) { return b.s - a.s; }).slice(0, k);
}
function memAgo(t) {
  var d = Math.floor((Date.now() - t) / MEM_DAY);
  return d <= 0 ? '今天' : d === 1 ? '昨天' : d < 30 ? d + ' 天前' : Math.floor(d / 30) + ' 个月前';
}
function memQueryOf(hist) {
  return (hist || []).slice(-4).map(function(m) { return msgTextForAI(m); }).join('\n');
}

// 发给角色的【记忆】：珍贵的全部 + 相关的几条 + 怎样记下新记忆
function memoryContextFor(char, hist) {
  if (!char || !char.id) return '';
  var cfg = memCfgOf(char);
  if (!cfg.on) return '';
  var out = '';
  if (cfg.read) {
    var precious = memList(char.id).filter(function(m) { return m.type === 'precious'; }).slice(-12);
    var rec = memRecall(char, memQueryOf(hist), cfg.topK, { skipPrecious: true });
    // 相关的不够数时，用最近记下的补上，问得比较笼统时也想得起东西
    if (rec.length < cfg.topK) {
      var have = rec.map(function(r) { return r.m; });
      memList(char.id).filter(function(m) { return m.type !== 'precious' && have.indexOf(m) < 0; })
        .sort(function(a, b) { return b.time - a.time; }).slice(0, cfg.topK - rec.length)
        .forEach(function(m) { rec.push({ m: m, s: 0 }); });
    }
    // 关系里程碑一直带着；其余按「记忆最多占用」放：超出时先少想起几条相关的，再少放几条最早的珍贵回忆
    var msText = (memMilestones[char.id] || {}).text || '';
    if (cfg.budget > 0 && typeof estTokens === 'function') {
      var cost = function() {
        return estTokens(msText) + estTokens(precious.map(function(m) { return m.text; }).join('\n')) +
          estTokens(rec.map(function(r) { return r.m.text; }).join('\n'));
      };
      while (rec.length && cost() > cfg.budget) rec.pop();
      while (precious.length > 1 && cost() > cfg.budget) precious.shift();
    }
    var lines = [];
    if (msText) lines.push('📌 你们关系里的重要节点：\n' + msText);
    if (precious.length) lines.push('💎 珍贵的回忆：\n' + precious.map(function(m) { return '· ' + m.text + (m.scene === 'drama' ? '（发生在剧情空间）' : ''); }).join('\n'));
    if (rec.length) lines.push('想起来的记忆：\n' + rec.map(function(r) {
      return '· ' + r.m.text + '（' + memAgo(r.m.time) + (r.m.type === 'short' ? '，最近的事' : '') + (r.m.scene === 'drama' ? '，发生在剧情空间' : '') + '）';
    }).join('\n'));
    if (lines.length) {
      // 讲清楚：这些是角色自己的记忆，「用户」指的是谁
      var userName = (typeof resolveCharAccount === 'function' && resolveCharAccount(char).nickname) || '用户';
      out = '【你的记忆】下面是你（' + (char.charAlias || char.charName || '你') + '）自己的记忆：是你亲身经历、自己记下、一直记得的事，不是别人给你的资料。' +
        '里面说的「用户」就是正在和你聊天的' + userName + '。回忆时用你自己的口吻自然地带进对话，不要逐条复述，也不要说「根据记忆」「资料显示」这类话。\n' + lines.join('\n');
    }
  }
  if (cfg.write) {
    var allowed = ['short', 'long', 'precious'].filter(function(t) { return cfg.types[t]; });
    if (allowed.length) {
      var desc = { short: '短期＝几天内有用的事', long: '长期＝要一直记得的事实、喜好和经历', precious: '珍贵＝特别重要、想永远珍藏的回忆' };
      out += (out ? '\n\n' : '') + '【记下新记忆】如果这次对话里出现了值得记住的新信息，在回复最后另起一行写 <记忆 类型="' +
        allowed.map(function(t) { return MEM_TYPE_NAME[t]; }).join('|') + '">一句话</记忆>，可以写多条，用户看不到（' +
        allowed.map(function(t) { return desc[t]; }).join('；') + '）。没有新东西就不写，已经记得的不要重复记。';
    }
  }
  return out;
}

// 从角色输出里取出 <记忆> 并存下；返回去掉标记后的文字
var MEM_TAG_RE = /<记忆(?:\s+类型\s*=\s*["“'「]?([^"”'」>\s]*)["”'」]?)?\s*>([\s\S]*?)<\/记忆>/g;
var MEM_TYPE_BY_NAME = { '短期': 'short', '长期': 'long', '珍贵': 'precious' };
// scene：'drama' = 在剧情窗口里记下的
function memExtractTags(char, raw, scene) {
  var cfg = memCfgOf(char);
  return String(raw || '').replace(MEM_TAG_RE, function(_, t, text) {
    var type = MEM_TYPE_BY_NAME[String(t || '').trim()] || 'long';
    if (char && cfg.on && cfg.write && cfg.types[type]) memAdd(char, { type: type, text: text, source: 'self', scene: scene });
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
}
// 动态里的事记成短期记忆
function memLogFeed(char, text) {
  var cfg = memCfgOf(char);
  if (char && cfg.on && cfg.feed && text) memAdd(char, { type: 'short', text: text, source: 'feed' });
}

// ---------- 向量模型（接口 /embeddings，用主 API 的地址和密钥） ----------
function memEmbed(texts) {
  var cfg = getApiCfg();
  if (!cfg.url || !cfg.key) return Promise.reject(new Error('请先填写主 API'));
  if (llmProvider(cfg) === 'anthropic') return Promise.reject(new Error('Claude 官方接口没有向量模型'));
  return fetch(cfg.url.replace(/\/+$/, '') + '/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
    body: JSON.stringify({ model: memEmbedModel, input: texts })
  }).then(function(res) {
    if (!res.ok) return apiError(res);
    return res.json();
  }).then(function(j) {
    var data = (j && j.data) || [];
    data.sort(function(a, b) { return (a.index || 0) - (b.index || 0); });
    if (data.length !== texts.length) throw new Error('向量数量不对');
    return data.map(function(d) { return d.embedding; });
  });
}
// 发消息前：算好这次对话的向量，顺便给还没有向量的记忆补上（失败就用本地相似度）
function memPrepare(char, hist) {
  var cfg = memCfgOf(char);
  if (!char || !cfg.on || !cfg.read || !memVectorOn(char)) return Promise.resolve();
  var query = memQueryOf(hist);
  if (!query.trim()) return Promise.resolve();
  var missing = memList(char.id).filter(function(m) { return !(m.emb && m.embModel === memEmbedModel); }).slice(-63);
  return memEmbed([query].concat(missing.map(function(m) { return m.text; }))).then(function(embs) {
    memQueryEmb[char.id] = { text: query, emb: embs[0] };
    missing.forEach(function(m, i) { m.emb = embs[i + 1]; m.embModel = memEmbedModel; });
    if (missing.length) saveMemStore();
  }).catch(function(err) { console.warn('[Mphone] 向量记忆暂时不可用，改用本地相似度:', err); });
}

// =============================================
// 记忆库界面：首页每个角色一张卡片（一行两张），点进去看这个角色的珍贵 / 长期 / 短期记忆
// =============================================
var memLibChar = '', memLibFilter = 'precious';
function memCharById(id) { return charList.filter(function(c) { return c.id === id; })[0] || null; }
function memCounts(id) {
  var n = { precious: 0, long: 0, short: 0 };
  memList(id).forEach(function(m) { n[m.type] = (n[m.type] || 0) + 1; });
  return n;
}
function memCharName(c) { return (c && (c.charAlias || c.charName)) || '未命名'; }

function showMemHome() {
  memLibChar = '';
  document.getElementById('memHome').style.display = '';
  document.getElementById('memDetail').style.display = 'none';
  document.getElementById('memTitle').textContent = '记忆库';
  document.getElementById('memAddBtn').style.visibility = 'hidden';
  renderMemHome();
}
function renderMemHome() {
  var grid = document.getElementById('memCharGrid');
  grid.innerHTML = '';
  if (!charList.length) { grid.innerHTML = '<div class="auto-hint desk-empty">还没有角色</div>'; return; }
  charList.forEach(function(c) {
    var n = memCounts(c.id), total = n.precious + n.long + n.short;
    var card = document.createElement('div');
    card.className = 'mem-char-card';
    var name = document.createElement('div');
    name.className = 'mem-char-name';
    name.textContent = memCharName(c);
    var stats = document.createElement('div');
    stats.className = 'mem-char-stats';
    stats.textContent = total ? '💎 ' + n.precious + ' · 长期 ' + n.long + ' · 短期 ' + n.short : '还没有记忆';
    card.appendChild(name);
    card.appendChild(stats);
    card.addEventListener('click', function() { openMemDetail(c.id); });
    grid.appendChild(card);
  });
}
function openMemDetail(id) {
  memLibChar = id;
  document.getElementById('memHome').style.display = 'none';
  document.getElementById('memDetail').style.display = '';
  document.getElementById('memTitle').textContent = memCharName(memCharById(id)) + ' 的记忆';
  document.getElementById('memAddBtn').style.visibility = '';
  renderMemLib();
}

// 某个角色的记忆列表（按类型分页，新的在前）
function renderMemLib() {
  var char = memCharById(memLibChar);
  if (!char) { showMemHome(); return; }
  renderMemMilestone(char);
  document.querySelectorAll('#memFilterRow .pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.f === memLibFilter); });
  var n = memCounts(char.id), cfg = memCfgOf(char);
  document.getElementById('memStats').textContent = '珍贵 ' + n.precious + ' · 长期 ' + n.long + ' · 短期 ' + n.short +
    (cfg.on ? '' : '（这个角色在「扩展」页关掉了记忆库，TA 暂时想不起来）');
  var box = document.getElementById('memList');
  box.innerHTML = '';
  var list = memList(char.id).filter(function(m) { return m.type === memLibFilter; })
    .sort(function(a, b) { return b.time - a.time; });
  if (!list.length) {
    box.innerHTML = '<div class="auto-hint desk-empty">还没有' + MEM_TYPE_NAME[memLibFilter] + '记忆。聊天时 TA 会自己记下，你也可以点右上角「添加」。</div>';
    return;
  }
  list.forEach(function(m) {
    var card = document.createElement('div');
    card.className = 'mem-card type-' + m.type;
    var head = document.createElement('div');
    head.className = 'mem-card-head';
    var badge = document.createElement('span');
    badge.className = 'mem-badge ' + m.type;
    badge.textContent = (m.type === 'precious' ? '💎 ' : '') + MEM_TYPE_NAME[m.type];
    var meta = document.createElement('span');
    meta.className = 'mem-meta';
    meta.textContent = (MEM_SOURCE_NAME[m.source] || '') + (m.scene === 'drama' ? ' · 剧情空间' : '') + ' · ' + memAgo(m.time) +
      (m.type === 'short' && m.expires ? ' · ' + Math.max(1, Math.ceil((m.expires - Date.now()) / MEM_DAY)) + ' 天后忘掉' : '');
    head.appendChild(badge);
    head.appendChild(meta);
    var text = document.createElement('div');
    text.className = 'mem-text';
    text.textContent = m.text;
    var acts = document.createElement('div');
    acts.className = 'anniv-acts';
    function btn(label, on, fn) {
      var b = document.createElement('button');
      b.className = 'anniv-flag' + (on ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', fn);
      acts.appendChild(b);
      return b;
    }
    btn(m.type === 'precious' ? '💎 取消珍贵' : '💎 设为珍贵', m.type === 'precious', function() {
      m.type = m.type === 'precious' ? 'long' : 'precious';
      delete m.expires;
      saveMemStore();
      renderMemLib();
    });
    btn('编辑', false, function() { openMemEdit(char, m); });
    btn('删除', false, function() {
      openPfEntryDel('删除这条记忆？', function() {
        memStore[char.id] = memList(char.id).filter(function(x) { return x !== m; });
        saveMemStore();
        renderMemLib();
      });
    }).classList.add('anniv-del');
    card.appendChild(head);
    card.appendChild(text);
    card.appendChild(acts);
    box.appendChild(card);
  });
}
document.querySelectorAll('#memFilterRow .pf-radio-btn').forEach(function(b) {
  b.addEventListener('click', function() { memLibFilter = this.dataset.f; renderMemLib(); });
});
// 记忆库里的关系里程碑卡片：看、改、重新整理
function renderMemMilestone(char) {
  var ms = memMilestones[char.id] || {};
  document.getElementById('memMilestoneText').value = ms.text || '';
  document.getElementById('memMilestoneMeta').textContent = ms.time ? '整理于' + memAgo(ms.time) : '';
}
document.getElementById('memMilestoneRebuild').addEventListener('click', function() {
  var char = memCharById(memLibChar), btn = this;
  if (!char || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '整理中…';
  memBuildMilestone(char).then(function(t) {
    showToast(t ? '✓ 整理好了' : '还没有能算作里程碑的事', t ? 'success' : '');
  }).catch(function(err) {
    showToast('✗ 没整理成：' + err.message, 'error');
  }).then(function() {
    btn.disabled = false;
    btn.textContent = '重新整理';
  });
});
document.getElementById('memMilestoneSave').addEventListener('click', function() {
  var char = memCharById(memLibChar);
  if (!char) return;
  var old = memMilestones[char.id] || {};
  memMilestones[char.id] = { text: document.getElementById('memMilestoneText').value.trim(), time: Date.now(),
    basedOn: old.basedOn !== undefined ? old.basedOn : memImportant(char.id).length };
  saveMilestones();
  renderMemMilestone(char);
  showToast('✓ 已保存', 'success');
});
document.getElementById('dockMemory').addEventListener('click', function() {
  document.getElementById('memEmbedModel').value = memEmbedModel;
  showMemHome();
});
// 在某个角色的记忆里点返回：先回到角色卡片
document.getElementById('backMemory').addEventListener('click', function(e) {
  if (document.getElementById('memDetail').style.display !== 'none') {
    e.stopImmediatePropagation();
    showMemHome();
  }
}, true);

// ---------- 问问 TA 记得什么：用平时聊天一样的方式问，看 TA 能不能想起来、知不知道这是自己的记忆 ----------
var memAskOverlay = document.getElementById('memAskOverlay');
function memStripTags(text) { return String(text || '').replace(MEM_TAG_RE, '').replace(/\n{3,}/g, '\n\n').trim(); }
document.getElementById('memAskBtn').addEventListener('click', function() {
  var idx = findCharIdx(memLibChar), char = charList[idx];
  if (!char) return;
  var askText = document.getElementById('memAskText');
  document.getElementById('memAskTitle').textContent = memCharName(char) + ' 记得的事';
  askText.textContent = '正在问 TA…';
  memAskOverlay.classList.add('open');
  var q = '（私下问你一下）你还记得关于我、关于我们的哪些事？用你自己的话说说，挑你觉得最重要的讲，简短一点。';
  var msgs = buildMsgs(idx, getChatHistory(idx).concat([{ role: 'user', content: q }]));
  callApiOnce(msgs).then(function(text) {
    askText.textContent = fillMacros(memStripTags(text), char) || '（TA 没有回答）';
  }, function(err) {
    askText.textContent = '没问成：' + err.message;
  });
});
document.getElementById('memAskClose').addEventListener('click', function() { memAskOverlay.classList.remove('open'); });
memAskOverlay.addEventListener('click', function(e) { if (e.target === memAskOverlay) memAskOverlay.classList.remove('open'); });

// ---------- 导出为 Word（.docx）：按重要程度（珍贵 → 长期 → 短期）分组，组内按时间从早到晚 ----------
var MEM_CRC_TABLE = (function() {
  var t = [];
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function memCrc32(bytes) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) c = MEM_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// 不压缩的 zip（docx 就是 zip 包）
function memZip(files) {
  var enc = new TextEncoder(), parts = [], central = [], offset = 0;
  files.forEach(function(f) {
    var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = memCrc32(data);
    var h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    var c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  });
  var cdSize = central.reduce(function(s, p) { return s + p.length; }, 0);
  var e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
  return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
function memXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
// 一段文字：{ text, size（半磅）, bold, color, after（段后间距）, pageBreak }
function memDocxPara(p) {
  if (p.pageBreak) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  var rPr = '<w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei" w:hAnsi="Microsoft YaHei"/>' +
    (p.bold ? '<w:b/>' : '') + (p.color ? '<w:color w:val="' + p.color + '"/>' : '') + '<w:sz w:val="' + (p.size || 22) + '"/></w:rPr>';
  var runs = String(p.text).split('\n').map(function(line, i) {
    return (i ? '<w:r>' + rPr + '<w:br/></w:r>' : '') + '<w:r>' + rPr + '<w:t xml:space="preserve">' + memXml(line) + '</w:t></w:r>';
  }).join('');
  return '<w:p><w:pPr><w:spacing w:after="' + (p.after == null ? 120 : p.after) + '" w:line="320" w:lineRule="auto"/></w:pPr>' + runs + '</w:p>';
}
function memBuildDocx(paras) {
  var body = paras.map(memDocxPara).join('');
  return memZip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>' }
  ]);
}
function memDateText(t) {
  var d = new Date(t);
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
// 一个角色的段落
function memDocxCharParas(char) {
  var paras = [
    { text: memCharName(char) + ' 的记忆', size: 36, bold: true, color: 'C0506A', after: 60 },
    { text: '导出时间：' + memDateText(Date.now()) + '　·　按重要程度排列，同类按时间从早到晚', size: 18, color: '998888', after: 240 }
  ];
  var msText = (memMilestones[char.id] || {}).text;
  if (msText) {
    paras.push({ text: '📌 关系里程碑', size: 28, bold: true, color: '5A4249', after: 120 });
    msText.split('\n').forEach(function(l) { if (l.trim()) paras.push({ text: l.trim(), size: 22, after: 80 }); });
    paras.push({ text: '', size: 22, after: 160 });
  }
  var all = memList(char.id);
  ['precious', 'long', 'short'].forEach(function(type) {
    var list = all.filter(function(m) { return m.type === type; }).sort(function(a, b) { return a.time - b.time; });
    paras.push({ text: (type === 'precious' ? '💎 珍贵的记忆' : MEM_TYPE_NAME[type] + '记忆') + '（' + list.length + ' 条）', size: 28, bold: true, color: '5A4249', after: 120 });
    if (!list.length) paras.push({ text: '（还没有）', size: 20, color: 'AAAAAA', after: 200 });
    list.forEach(function(m) {
      paras.push({ text: memDateText(m.time) + '　·　' + (MEM_SOURCE_NAME[m.source] || '') +
        (m.type === 'short' && m.expires ? '　·　' + memDateText(m.expires) + ' 忘掉' : ''), size: 18, color: '998888', after: 20 });
      paras.push({ text: m.text, size: 22, after: 160 });
    });
  });
  return paras;
}
// 保存文件：手机上走系统分享（可存到文件），电脑上直接下载
function memSaveFile(blob, name) {
  var file = new File([blob], name, { type: blob.type });
  var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).catch(function() {});
    return;
  }
  var url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
}
function memExportDocx(chars) {
  var paras = [];
  chars.forEach(function(c, i) {
    if (i) paras.push({ pageBreak: true });
    paras = paras.concat(memDocxCharParas(c));
  });
  var d = new Date(), stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  memSaveFile(memBuildDocx(paras), (chars.length === 1 ? memCharName(chars[0]) + '的记忆_' : '全部角色的记忆_') + stamp + '.docx');
  showToast('✓ 已导出 Word 文档', 'success');
}
document.getElementById('memLibExport').addEventListener('click', function() {
  var c = memCharById(memLibChar);
  if (c) memExportDocx([c]);
});
document.getElementById('memExportAll').addEventListener('click', function() {
  if (charList.length) memExportDocx(charList);
});

// 添加 / 编辑一条记忆
var memEditOverlay = document.getElementById('memEditOverlay');
var memEditing = null, memEditType = 'long';
function setMemEditType(t) {
  memEditType = t;
  document.querySelectorAll('#memEditType .pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.type === t); });
}
function openMemEdit(char, m) {
  memEditing = { char: char, m: m || null };
  document.getElementById('memEditTitle').textContent = m ? '编辑记忆' : '添加记忆';
  document.getElementById('memEditText').value = m ? m.text : '';
  setMemEditType(m ? m.type : memLibFilter);
  memEditOverlay.classList.add('open');
}
document.querySelectorAll('#memEditType .pf-radio-btn').forEach(function(b) {
  b.addEventListener('click', function() { setMemEditType(this.dataset.type); });
});
document.getElementById('memAddBtn').addEventListener('click', function() {
  var char = memCharById(memLibChar);
  if (char) openMemEdit(char, null);
});
document.getElementById('memEditCancel').addEventListener('click', function() { memEditOverlay.classList.remove('open'); });
memEditOverlay.addEventListener('click', function(e) { if (e.target === memEditOverlay) memEditOverlay.classList.remove('open'); });
document.getElementById('memEditSave').addEventListener('click', function() {
  var ta = document.getElementById('memEditText'), text = ta.value.trim();
  if (!text) { shakeEl(ta); return; }
  var e = memEditing;
  if (e.m) {
    if (e.m.text !== text) { e.m.text = text.slice(0, 300); delete e.m.emb; delete e.m.embModel; }
    e.m.type = memEditType;
    if (memEditType === 'short') { if (!e.m.expires) e.m.expires = Date.now() + memCfgOf(e.char).shortDays * MEM_DAY; }
    else delete e.m.expires;
    saveMemStore();
  } else {
    memAdd(e.char, { type: memEditType, text: text, source: 'user' });
  }
  memEditOverlay.classList.remove('open');
  renderMemLib();
});

// 向量模型：保存 / 测试
document.getElementById('memEmbedSave').addEventListener('click', function() {
  memEmbedModel = document.getElementById('memEmbedModel').value.trim();
  mphoneStore.save('mphone_mem_embed_model', memEmbedModel);
  showToast(memEmbedModel ? '✓ 已保存向量模型' : '已清空，改用本地相似度', 'success');
});
document.getElementById('memEmbedTest').addEventListener('click', function() {
  var hint = document.getElementById('memEmbedHint');
  memEmbedModel = document.getElementById('memEmbedModel').value.trim();
  if (!memEmbedModel) { hint.textContent = '先填一个向量模型名'; return; }
  hint.textContent = '正在测试…';
  memEmbed(['今天天气很好', '今天阳光明媚', '我想吃火锅']).then(function(e) {
    var near = memEmbCos(e[0], e[1]), far = memEmbCos(e[0], e[2]);
    hint.textContent = '✓ 可以用：向量长度 ' + e[0].length + '，相近的两句相似度 ' + near.toFixed(2) + '，不相干的 ' + far.toFixed(2);
  }, function(err) { hint.textContent = '✗ 不能用：' + err.message; });
});
