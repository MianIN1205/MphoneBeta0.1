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
// 一条记忆最多多少字（2026-11-11 用户要的：长期 / 珍贵的放得下一整件事，不用切成好多碎条）；短期的还是短短一句
var MEM_TEXT_MAX = 2000, MEM_SHORT_MAX = 300;
function memTextMax(type) { return type === 'short' ? MEM_SHORT_MAX : MEM_TEXT_MAX; }

function saveMemStore() { mphoneStore.save('mphone_memories', memStore); }
// ---------- 情绪 + 感官线索（2026-11-11，「像人脑一样」的第一步，见 docs/记忆模式-像人脑一样.md） ----------
// 每条记忆可以带：emo 情绪（从下面的词里选）、emoW 强度 1～3、cues 线索（3～6 个这件事里具体的东西：看到 / 听到 / 闻到 / 吃到 / 摸到的、地点、物件）
// 想起时：她这次说的话里出现了线索 → 直接被勾起来；她现在的心情和记忆的情绪对得上 → 更容易想起；强度高的本来就更容易想起
var MEM_EMOS = ['甜', '心疼', '委屈', '生气', '害怕', '安心', '好笑', '想念', '害羞', '难过', '骄傲', '平静'];
// 从她最近说的话粗猜心情（不另外请求）
var MEM_MOOD_RE = { '甜': /喜欢你|爱你|亲亲|抱抱|么么|贴贴|宝贝/, '心疼': /生病|发烧|难受|好疼|头疼|累死|住院|受伤|没睡|失眠/, '委屈': /委屈|凭什么|冤枉|被骂|不公平/,
  '生气': /生气|气死|烦死|讨厌|火大/, '害怕': /害怕|好怕|吓死|恐怖|紧张|焦虑|不敢/, '安心': /安心|放心|踏实|有你在/, '好笑': /哈哈|笑死|hhh|233|好好笑/,
  '想念': /想你|想念|好久没|好想/, '害羞': /害羞|脸红|不好意思/, '难过': /难过|伤心|失落|想哭|心情不好|哭了/, '骄傲': /考过了|拿到了|成功了|做到了|升职|获奖|上岸/ };
function memNormEmo(s) { s = String(s || '').trim(); return MEM_EMOS.indexOf(s) >= 0 ? s : ''; }
function memNormCues(v) {
  var seen = {};
  return (Array.isArray(v) ? v : String(v || '').split(/[,，、|｜\/;；]/)).map(function(x) { return String(x).trim().slice(0, 12); })
    .filter(function(x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }).slice(0, 6);
}
function memMoodsOf(text) { return MEM_EMOS.filter(function(e) { return MEM_MOOD_RE[e] && MEM_MOOD_RE[e].test(text); }); }
// 把情绪、强度、线索写到一条记忆上（只写给了的）
function memSetTags(m, data) {
  var e = memNormEmo(data.emo);
  if (e) { m.emo = e; m.emoW = Math.max(1, Math.min(3, parseInt(data.emoW, 10) || 2)); }
  var c = memNormCues(data.cues);
  if (c.length) m.cues = memNormCues((m.cues || []).concat(c));
}
// 给 TA 看的一条：〔线索〕正文（情绪，多久前…）——像回想起当时的画面，不是背资料
function memLine(m, extra) {
  var tail = [m.emo || ''].concat(extra || []).filter(Boolean);
  return '· ' + (m.cues && m.cues.length ? '〔' + m.cues.join(' · ') + '〕' : '') + m.text + (tail.length ? '（' + tail.join('，') + '）' : '');
}
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
  var type = data && MEM_TYPE_NAME[data.type] ? data.type : 'long';
  var text = String((data && data.text) || '').trim().slice(0, memTextMax(type));
  if (!char || !text) return null;
  var cfg = memCfgOf(char);
  var tv = memTokens(text);
  var dup = memList(char.id).filter(function(m) { return memCos(tv, memTokens(m.text)) > (data.dupAt || 0.85); })[0];
  if (dup) {
    if (!data.time) dup.time = Date.now();
    if (MEM_TYPE_RANK[type] > MEM_TYPE_RANK[dup.type]) { dup.type = type; delete dup.expires; }
    if (dup.type === 'short') dup.expires = Date.now() + cfg.shortDays * MEM_DAY;
    memSetTags(dup, data);
    saveMemStore();
    return dup;
  }
  var m = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: type, text: text, time: data.time || Date.now(), source: data.source || 'chat' };
  if (data.scene === 'drama') m.scene = 'drama';   // 在剧情空间里记下的
  if (data.from) m.from = String(data.from).slice(0, 20);
  memSetTags(m, data);
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

// ---------- 「TA 知道的你」：关于用户本人、不用回想就知道的事（喜好、口味、习惯、作息、在意的人…），每次聊天都带着 ----------
// 用户要的（「像人脑一样」第 4 条）：不强制写日记——写日记时顺带更新；没写日记的，小手机开着时一周整理一次（有新记忆才整理）。字数放宽，免得时间久了挤掉东西
var memKnow = mphoneStore.load('mphone_mem_know', {});   // 角色id → { text, time, basedOn }
var KNOW_MAX = 1500, KNOW_EVERY_MS = 7 * MEM_DAY;
var memKnowBusy = {};
function saveMemKnow() { mphoneStore.save('mphone_mem_know', memKnow); }
function memBuildKnow(char) {
  var list = memImportant(char.id);
  if (list.length < 3) return Promise.reject(new Error('长期和珍贵的记忆还太少'));
  memKnowBusy[char.id] = true;
  var old = memKnow[char.id] || {}, userName = (typeof resolveCharAccount === 'function' && resolveCharAccount(char).nickname) || '用户';
  // 记忆太多时只带最近的（按 token 截），之前整理过的那份会一起给，旧的事不会丢
  var lines = [], used = 0;
  for (var i = list.length - 1; i >= 0; i--) {
    var l = '· ' + list[i].text, t = estTokens(l);
    if (used + t > 9000) break;
    lines.unshift(l); used += t;
  }
  var prompt = '你是记忆整理助手。下面是「' + memCharName(char) + '」的长期记忆。请整理出「' + memCharName(char) + '」知道的关于「' + userName + '」本人的事：' +
    '像一个熟悉对方的人，不用回想就知道的那些——喜好和口味、讨厌和雷区、习惯和作息、身体情况、工作或学习、在意的人和宠物、重要的日子、说话的小习惯。\n' +
    (old.text ? '\n之前整理过的：\n' + old.text + '\n' : '') + '\n记忆：\n' + lines.join('\n') +
    '\n\n要求：\n- 只写关于' + userName + '本人的事实，不写发生过的事情经过、不写' + memCharName(char) + '自己\n- 只从上面的记忆里来，不编、不猜\n' +
    '- 之前整理过的，没有被新记忆推翻就保留；被推翻的改成新的\n- 按类别分几组，每条一句，短一点\n- 不超过 ' + KNOW_MAX + ' 字\n- 只输出整理好的内容；什么都没有就只输出「暂无」';
  return llmRequest([{ role: 'user', content: prompt }], { stream: false, cfg: getApiCfg(char) }).then(function(text) {
    text = String(text || '').trim();
    if (/^暂无/.test(text)) text = '';
    memKnow[char.id] = { text: text.slice(0, KNOW_MAX + 300), time: Date.now(), basedOn: list.length };
    saveMemKnow();
    if (typeof memLibChar !== 'undefined' && memLibChar === char.id && typeof renderMemLib === 'function') renderMemLib();
    return text;
  }).then(function(t) { delete memKnowBusy[char.id]; return t; }, function(e) { delete memKnowBusy[char.id]; throw e; });
}
// 要不要整理：写日记时（一天最多一次）或者离上次超过一周，而且有新的长期 / 珍贵记忆
function memMaybeKnow(char, byDiary) {
  var cfg = memCfgOf(char);
  if (!char || !char.id || char.isGroup || !cfg.on || memKnowBusy[char.id]) return Promise.resolve();
  var k = memKnow[char.id] || {}, n = memImportant(char.id).length, age = Date.now() - (k.time || 0);
  if (n < 3 || n <= (k.basedOn || 0) || age < (byDiary ? MEM_DAY : KNOW_EVERY_MS)) return Promise.resolve();
  var api = getApiCfg(char);
  if (!api.url || !api.key || !api.model) return Promise.resolve();
  return memBuildKnow(char).catch(function(err) { console.warn('[Mphone] 整理「TA 知道的你」失败:', err); });
}
// 小手机开着时每小时看一次，一个接一个来（不同时发一堆请求）
if (typeof onMphoneReady === 'function') onMphoneReady(function() {
  var tick = function() {
    var chars = charList.filter(function(c) { return !c.isGroup; }), i = 0;
    (function next() { if (i < chars.length) memMaybeKnow(chars[i++], false).then(next); })();
  };
  setTimeout(tick, 60000);
  setInterval(tick, 3600000);
});

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
    var s = (useEmb && m.emb && m.embModel === memEmbedModel) ? memEmbCos(qe.emb, m.emb) : memCos(qt, memTokens(m.text)), cue = '';
    if (!opts.all) {
      if (m.type === 'short') s += 0.03;   // 聊天时最近的事稍微优先（手动搜索时不加）
      // 线索被她的话勾起来：不管整段像不像，直接想起
      var hits = (m.cues || []).filter(function(c) { return c.length >= 2 && query.indexOf(c) >= 0; });
      if (hits.length) { s += 0.3 + 0.05 * (hits.length - 1); cue = hits[0]; }
      if (m.emo && opts.moods && opts.moods.indexOf(m.emo) >= 0) s += 0.1;   // 心情对得上
      if (m.emoW) s += 0.02 * (m.emoW - 1);   // 情绪越强越容易想起
    }
    return { m: m, s: s, cue: cue };
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
    var moods = memMoodsOf((hist || []).slice(-4).filter(function(m) { return m.role === 'user'; }).map(function(m) { return typeof m.content === 'string' ? m.content : ''; }).join('\n'));
    var rec = memRecall(char, memQueryOf(hist), cfg.topK, { skipPrecious: true, moods: moods });
    // 相关的不够数时，用最近记下的补上，问得比较笼统时也想得起东西
    if (rec.length < cfg.topK) {
      var have = rec.map(function(r) { return r.m; });
      memList(char.id).filter(function(m) { return m.type !== 'precious' && have.indexOf(m) < 0; })
        .sort(function(a, b) { return b.time - a.time; }).slice(0, cfg.topK - rec.length)
        .forEach(function(m) { rec.push({ m: m, s: 0 }); });
    }
    // 关系里程碑一直带着；其余按「记忆最多占用」放：超出时先少想起几条相关的，再少放几条最早的珍贵回忆
    var msText = (memMilestones[char.id] || {}).text || '', knowText = (memKnow[char.id] || {}).text || '';
    if (cfg.budget > 0 && typeof estTokens === 'function') {
      var cost = function() {
        return estTokens(msText) + estTokens(knowText) + estTokens(precious.map(function(m) { return m.text; }).join('\n')) +
          estTokens(rec.map(function(r) { return r.m.text; }).join('\n'));
      };
      while (rec.length && cost() > cfg.budget) rec.pop();
      while (precious.length > 1 && cost() > cfg.budget) precious.shift();
    }
    var lines = [], youName = (typeof resolveCharAccount === 'function' && resolveCharAccount(char).nickname) || '用户';
    if (knowText) lines.push('🌸 你知道的' + youName + '（熟悉的人不用回想就知道的事，自然地照顾到就好，不用提起）：\n' + knowText);
    if (msText) lines.push('📌 你们关系里的重要节点：\n' + msText);
    if (precious.length) lines.push('💎 珍贵的回忆：\n' + precious.map(function(m) { return memLine(m, [memWhereText(m)]); }).join('\n'));
    if (rec.length) lines.push('想起来的记忆：\n' + rec.map(function(r) {
      return memLine(r.m, [memAgo(r.m.time) + (r.m.type === 'short' ? '，最近的事' : ''), memWhereText(r.m), r.cue ? '是「' + r.cue + '」让你想起来的' : '']);
    }).join('\n'));
    if (lines.length) {
      // 讲清楚：这些是角色自己的记忆，「用户」指的是谁
      var userName = (typeof resolveCharAccount === 'function' && resolveCharAccount(char).nickname) || '用户';
      out = '【你的记忆】下面是你（' + (char.charAlias || char.charName || '你') + '）自己的记忆：是你亲身经历、自己记下、一直记得的事，不是别人给你的资料。〔〕里是那件事留在你心里的画面和细节，括号里写着当时的心情。' +
        '里面说的「用户」就是正在和你聊天的' + userName + '。回忆时用你自己的口吻自然地带进对话，不要逐条复述，也不要说「根据记忆」「资料显示」这类话。\n' + lines.join('\n');
    }
  }
  if (cfg.write) {
    var allowed = ['short', 'long', 'precious'].filter(function(t) { return cfg.types[t]; });
    if (allowed.length) {
      var desc = { short: '短期＝几天内有用的事', long: '长期＝要一直记得的事实、喜好和经历', precious: '珍贵＝特别重要、想永远珍藏的回忆' };
      out += (out ? '\n\n' : '') + '【记下新记忆】如果这次对话里出现了值得记住的新信息，在回复最后另起一行写 <记忆 类型="' +
        allowed.map(function(t) { return MEM_TYPE_NAME[t]; }).join('|') + '">一句话</记忆>，可以写多条，用户看不到（' +
        allowed.map(function(t) { return desc[t]; }).join('；') + '）。没有新东西就不写，已经记得的不要重复记。' +
        '长期和珍贵的可以多写三个属性，像人记住一件事时连着当时的感觉：情绪="' + MEM_EMOS.join('|') + '"（选一个）强度="1|2|3"（越强越难忘）线索="3～6 个这件事里具体的东西，用顿号隔开"（看到的、听到的、闻到的、吃到的、摸到的、地点、物件，只写这件事里真有的，不要编）。' +
        '比如 <记忆 类型="珍贵" 情绪="心疼" 强度="3" 线索="病房、蚊子、凌晨三点">她住院那晚一直说想回家</记忆>';
    }
  }
  return out;
}

// 从角色输出里取出 <记忆> 并存下；返回去掉标记后的文字
var MEM_TAG_RE = /<记忆([^>]*)>([\s\S]*?)<\/记忆>/g;
// 标签里的属性：类型="长期" 情绪="心疼" 强度="2" 线索="病房、蚊子"（引号可有可无）
function memTagAttrs(s) {
  var o = {};
  String(s || '').replace(/([\u4e00-\u9fa5A-Za-z]+)\s*=\s*(?:["“'「]([^"”'」]*)["”'」]|([^\s>]+))/g, function(_, k, v1, v2) { o[k] = v1 != null ? v1 : v2; });
  return o;
}
var MEM_TYPE_BY_NAME = { '短期': 'short', '长期': 'long', '珍贵': 'precious' };
// scene：'drama' = 在剧情窗口里记下的
function memExtractTags(char, raw, scene) {
  var cfg = memCfgOf(char);
  return String(raw || '').replace(MEM_TAG_RE, function(_, attrs, text) {
    var a = memTagAttrs(attrs), type = MEM_TYPE_BY_NAME[String(a['类型'] || '').trim()] || 'long';
    if (char && cfg.on && cfg.write && cfg.types[type]) memAdd(char, { type: type, text: text, source: 'self', scene: scene, emo: a['情绪'], emoW: a['强度'], cues: a['线索'] });
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
