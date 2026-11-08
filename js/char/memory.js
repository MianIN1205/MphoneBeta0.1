// 眠花糖机 — 角色记忆：短期 / 长期 / 珍贵、关系里程碑、按相关程度想起、向量记忆

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
var MEM_SOURCE_NAME = { chat: '聊天', feed: '动态', self: 'TA 自己记的', user: '你加的', diary: '日记', import: '其他小手机', hub: '记忆库' };
// 从别的小手机导入的记忆（m.from = 来自哪里，比如「uwu 小手机」，见 js/char/archive.js）
// 从连通的记忆库拉下来的（source = hub，js/desk/memory-hub.js），别的小手机记的带着 m.from
function memSourceText(m) { return (m.source === 'import' || m.source === 'hub') && m.from ? '来自 ' + m.from : (MEM_SOURCE_NAME[m.source] || ''); }
function memWhereText(m) {
  return (m.scene === 'drama' ? '发生在剧情空间' : '') + (m.from && (m.source === 'import' || m.source === 'hub') ? (m.scene === 'drama' ? '，' : '') + '在' + m.from + '里' : '');
}
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
// data: { type, text, source, scene, time（导入时用原来聊天的时间）, from（导入自哪个小手机）, noMilestone（导入时最后统一整理）, dupAt（多像算重复，默认 0.85） }
function memAdd(char, data) {
  var text = String((data && data.text) || '').trim().slice(0, 300);
  if (!char || !text) return null;
  var cfg = memCfgOf(char), type = MEM_TYPE_NAME[data.type] ? data.type : 'long';
  var tv = memTokens(text);
  var dup = memList(char.id).filter(function(m) { return memCos(tv, memTokens(m.text)) > (data.dupAt || 0.85); })[0];
  if (dup) {
    if (!data.time) dup.time = Date.now();
    if (MEM_TYPE_RANK[type] > MEM_TYPE_RANK[dup.type]) { dup.type = type; delete dup.expires; }
    if (dup.type === 'short') dup.expires = Date.now() + cfg.shortDays * MEM_DAY;
    saveMemStore();
    return dup;
  }
  var m = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: type, text: text, time: data.time || Date.now(), source: data.source || 'chat' };
  if (data.scene === 'drama') m.scene = 'drama';   // 在剧情空间里记下的
  if (data.from) m.from = String(data.from).slice(0, 20);
  if (type === 'short') m.expires = Date.now() + cfg.shortDays * MEM_DAY;
  (memStore[char.id] = memStore[char.id] || []).push(m);
  saveMemStore();
  if (type !== 'short' && !data.noMilestone) setTimeout(function() { memMaybeMilestone(char); }, 0);
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
  var api = getApiCfg(char);
  if (!api.url || !api.key || !api.model) return;
  memBuildMilestone(char).catch(function(err) { console.warn('[Mphone] 整理关系里程碑失败:', err); });
}
// 记忆很多时（比如导入了别的小手机的记录）分成几批，每批接着上一批整理出的里程碑往下整理，一次不会塞太多
var MILESTONE_BATCH_TOKENS = 6000;
function memBuildMilestone(char) {
  var list = memImportant(char.id);
  if (!list.length) return Promise.reject(new Error('还没有长期或珍贵的记忆'));
  memMilestoneBusy[char.id] = true;
  var ms = memMilestones[char.id] || {};
  var lines = list.map(function(m) {
    var where = memWhereText(m);
    return '· ' + memDateText(m.time).split(' ')[0] + ' ' + m.text + (where ? '（' + where + '）' : '');
  });
  var batches = [[]], used = 0;
  lines.forEach(function(l) {
    var t = estTokens(l);
    if (used + t > MILESTONE_BATCH_TOKENS && batches[batches.length - 1].length) { batches.push([]); used = 0; }
    batches[batches.length - 1].push(l);
    used += t;
  });
  var chain = Promise.resolve(ms.text || '');
  batches.forEach(function(b) { chain = chain.then(function(prev) { return memMilestoneStep(char, prev, b); }); });
  return chain.then(function(text) {
    memMilestones[char.id] = { text: text.slice(0, 1500), time: Date.now(), basedOn: list.length };
    saveMilestones();
    if (memLibChar === char.id) renderMemLib();
    return text;
  }).then(function(t) { delete memMilestoneBusy[char.id]; return t; },
          function(e) { delete memMilestoneBusy[char.id]; throw e; });
}
function memMilestoneStep(char, prevText, lines) {
  var userName = (typeof resolveCharAccount === 'function' && resolveCharAccount(char).nickname) || '用户';
  var prompt = '你是记忆整理助手。下面是「' + memCharName(char) + '」和「' + userName + '」之间的长期记忆，请整理出他们关系里的重要节点（关系里程碑）。\n' +
    (prevText ? '\n之前整理过的里程碑：\n' + prevText + '\n' : '') +
    '\n长期记忆（按时间从早到晚）：\n' + lines.join('\n') +
    '\n\n要求：\n- 只保留会长期影响关系的事：初次认识、确认关系、重要约定、纪念日、第一次见面、同居、吵架后和好、分手或复合等\n' +
    '- 不写日常闲聊、一时的情绪和普通的喜好\n- 之前整理过的里程碑，没有被新的记忆推翻就保留\n' +
    '- 发生在剧情空间、或者在别的小手机里的事，在后面照原样注明\n- 每条一行，格式「时间 · 事件」，按时间先后，最多 12 条\n' +
    '- 只输出里程碑本身；如果还没有这样的节点，只输出「暂无」';
  return llmRequest([{ role: 'user', content: prompt }], { stream: false, cfg: getApiCfg(char) }).then(function(text) {
    text = String(text || '').trim();
    return /^暂无/.test(text) ? '' : text;
  });
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
    var precious = memList(char.id).filter(function(m) { return m.type === 'precious'; }).sort(function(a, b) { return a.time - b.time; }).slice(-12);
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
    if (precious.length) lines.push('💎 珍贵的回忆：\n' + precious.map(function(m) { var w = memWhereText(m); return '· ' + m.text + (w ? '（' + w + '）' : ''); }).join('\n'));
    if (rec.length) lines.push('想起来的记忆：\n' + rec.map(function(r) {
      var w = memWhereText(r.m);
      return '· ' + r.m.text + '（' + memAgo(r.m.time) + (r.m.type === 'short' ? '，最近的事' : '') + (w ? '，' + w : '') + '）';
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
