// 眠花糖机 — 其他小手机的聊天记录：导入成旧档案（只给你翻看，不发给 AI），分段整理成角色的长期记忆

// =============================================
// 旧档案：arcStore[角色id] = [{ id, from（小手机名字）, file, importTime, msgs, mem }]
// · msgs：[{ r: 'user' | 'char' | 'status' | 'sys', t: 文字, time, k: 'text' | 'sticker' | 'image' | 'voice' | …（其他种类照原名） }]
// · mem：整理成记忆的进度 { pos: 整理到第几条（不含）, count: 记下了几条, budget: 每段多长, careful: 逐段核对, withStatus: 带上状态栏, done, err }
// 整理时一段一段来：每段不超过 budget（估算 token），太长被拒就自动切小一半；中途失败停在那一段，下次点「继续」接着来
// =============================================
var arcStore = mphoneStore.load('mphone_archives', {});
var ARC_BUDGET = 5000;        // 每段聊天记录大约多少 token
var ARC_MIN_BUDGET = 600;
var arcRunning = {};          // 档案id → { stop, ctrl }
function saveArcStore() { mphoneStore.save('mphone_archives', arcStore); }
function arcListOf(charId) { return arcStore[charId] || []; }

// ---------- 读文件：认出是哪种格式 ----------
// 返回 { from, msgs, unknown: { 种类: 条数 } }；认不出时抛错
function arcParse(text, fileName, char) {
  var cName = (char && (char.charAlias || char.charName)) || '';
  var names = [char && char.charName, char && char.charAlias].filter(Boolean);
  var unknown = {};
  var trimmed = String(text || '').replace(/^﻿/, '').trim();
  var j = null;
  try { j = JSON.parse(trimmed); } catch (_) {}
  // uwu 小手机
  if (j && j.type === 'uwu-chat-history' && Array.isArray(j.history)) {
    return { from: 'uwu', msgs: j.history.map(function(h) { return arcFromUwu(h, unknown); }).filter(Boolean), unknown: unknown };
  }
  // 酒馆（SillyTavern）的 .jsonl：第一行是信息，后面每行一条消息
  if (!j && /^\{/.test(trimmed) && /\n\s*\{/.test(trimmed)) {
    var lines = trimmed.split(/\r?\n/).map(function(l) { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
    var st = lines.filter(function(o) { return 'mes' in o; });
    if (st.length) return { from: '酒馆', msgs: st.map(function(o) { return arcFromGeneric(o, names, unknown); }).filter(Boolean), unknown: unknown };
  }
  // 一般的 JSON：找最像聊天记录的那个数组
  if (j) {
    var arr = arcFindArray(j);
    if (arr) return { from: '', msgs: arr.map(function(o) { return arcFromGeneric(o, names, unknown); }).filter(Boolean), unknown: unknown };
    throw new Error('这个 JSON 里没找到聊天记录');
  }
  // 纯文字：每行「名字：内容」，前面可以带时间
  var out = [], cur = null;
  trimmed.split(/\r?\n/).forEach(function(line) {
    var m = line.match(/^\s*(?:[\[【(（]?(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?\s*\d{1,2}:\d{2}(?::\d{2})?|\d{1,2}:\d{2}(?::\d{2})?)[\]】)）]?\s*)?([^：:\s][^：:]{0,19})[：:]\s*(.*)$/);
    if (m && !/^https?$/i.test(m[2])) {
      var who = m[2].trim();
      cur = { r: arcIsChar(who, names) ? 'char' : 'user', t: m[3], time: arcTime(m[1]), k: 'text', who: who };
      arcKind(cur);
      out.push(cur);
    } else if (cur && line.trim()) {
      cur.t += '\n' + line.trim();
    }
  });
  if (!out.length) throw new Error('没认出聊天记录的格式');
  return { from: '', msgs: out, unknown: unknown };
}
function arcIsChar(who, names) {
  return names.some(function(n) { return n && (who === n || who.indexOf(n) >= 0 || n.indexOf(who) >= 0); });
}
function arcTime(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  var s = String(v).trim();
  if (/^\d+$/.test(s)) return arcTime(Number(s));
  var t = Date.parse(s.replace(/年|月/g, '-').replace(/日/, ' ').replace(/\//g, '-').replace(/\s+/g, ' '));
  if (isNaN(t)) t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}
// 「[表情包：摸头]」「[图片]」这类：记下种类
var ARC_KIND_NAME = { '表情包': 'sticker', '表情': 'sticker', '图片': 'image', '照片': 'image', '语音': 'voice' };
function arcKind(m) {
  var k = String(m.t || '').match(/^\s*\[(表情包|表情|图片|照片|语音|视频|转账|红包|位置|礼物|文件|通话|语音通话|视频通话)[：:\]]/);
  if (k) m.k = ARC_KIND_NAME[k[1]] || k[1];
  return m;
}
function arcFromUwu(h, unknown) {
  if (!h) return null;
  var text = typeof h.content === 'string' ? h.content : '';
  var extra = [];
  (Array.isArray(h.parts) ? h.parts : []).forEach(function(p) {
    if (!p) return;
    if (p.type === 'text') { if (!text) text = p.text || ''; return; }
    var known = { image: '图片', image_url: '图片', audio: '语音', voice: '语音', sticker: '表情包' }[p.type];
    if (!known) unknown[p.type || '未知'] = (unknown[p.type || '未知'] || 0) + 1;
    extra.push('[' + (known || p.type || '未知内容') + ']');
  });
  // 「[简然的消息：嗯 去吧]」只留里面的话
  var w = text.match(/^\s*\[([^\]]{1,30}?)的消息[：:]\s*([\s\S]*)\]\s*$/);
  if (w) text = w[2];
  if (!text && extra.length) text = extra.join(' ');
  var m = { r: h.role === 'user' ? 'user' : h.role === 'assistant' ? 'char' : 'sys', t: text, time: arcTime(h.timestamp), k: 'text' };
  if (h.isStatusUpdate) { m.r = 'status'; m.k = 'status'; m.t = arcStatusText(text); }
  else arcKind(m);
  if (!text && !extra.length) return null;
  if (!m.t.trim()) return null;
  return m;
}
// 状态栏：去掉 <JIANRAN> 这类标签和多余空行
function arcStatusText(s) {
  return String(s || '').replace(/<\/?[A-Za-z_][\w-]*[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
function arcFindArray(j) {
  var best = null;
  function score(arr) {
    if (!Array.isArray(arr) || !arr.length) return 0;
    return arr.slice(0, 20).filter(function(o) {
      return o && typeof o === 'object' && ('content' in o || 'mes' in o || 'text' in o || 'message' in o);
    }).length;
  }
  function walk(o, depth) {
    if (!o || typeof o !== 'object' || depth > 3) return;
    if (Array.isArray(o)) { var s = score(o); if (s && (!best || s > best.s || (s === best.s && o.length > best.a.length))) best = { s: s, a: o }; return; }
    Object.keys(o).forEach(function(k) { walk(o[k], depth + 1); });
  }
  walk(j, 0);
  return best && best.a;
}
function arcFromGeneric(o, names, unknown) {
  if (!o || typeof o !== 'object') return null;
  var c = o.content != null ? o.content : o.mes != null ? o.mes : o.text != null ? o.text : o.message;
  if (Array.isArray(c)) c = c.map(function(p) { return typeof p === 'string' ? p : p && p.type === 'text' ? p.text : '[' + ((p && p.type) || '未知内容') + ']'; }).join(' ');
  if (c == null || typeof c === 'object') return null;
  var who = o.name || o.sender || o.author || '';
  var role = o.role || (o.is_user === true ? 'user' : o.is_user === false ? 'assistant' : '');
  var r = role === 'user' ? 'user' : (role === 'assistant' || role === 'char' || role === 'model') ? 'char'
    : role === 'system' || o.is_system ? 'sys' : who ? (arcIsChar(String(who), names) ? 'char' : 'user') : 'user';
  var w = String(c).match(/^\s*\[([^\]]{1,30}?)的消息[：:]\s*([\s\S]*)\]\s*$/);
  var m = { r: r, t: w ? w[2] : String(c), time: arcTime(o.timestamp || o.time || o.send_date || o.date || o.createdAt || o.created_at), k: 'text' };
  arcKind(m);
  return m.t.trim() ? m : null;
}

// ---------- 统计（预览用） ----------
var ARC_KIND_LABEL = { text: '文字', sticker: '表情包', image: '图片', voice: '语音', status: '状态栏' };
function arcStats(msgs) {
  var s = { user: 0, char: 0, status: 0, sys: 0, kinds: {}, first: 0, last: 0 };
  msgs.forEach(function(m) {
    s[m.r] = (s[m.r] || 0) + 1;
    if (m.k !== 'text' && m.k !== 'status') s.kinds[m.k] = (s.kinds[m.k] || 0) + 1;
    if (m.time) { if (!s.first || m.time < s.first) s.first = m.time; if (m.time > s.last) s.last = m.time; }
  });
  return s;
}
function arcDay(t) { var d = new Date(t); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(); }
function arcRange(a) {
  var s = arcStats(a.msgs);
  return s.first ? (arcDay(s.first) === arcDay(s.last) ? arcDay(s.first) : arcDay(s.first) + ' – ' + arcDay(s.last)) : '没有时间';
}

// ---------- 分段 ----------
function arcNames(char) {
  var acc = typeof resolveCharAccount === 'function' ? resolveCharAccount(char) : {};
  return { c: (char && (char.charAlias || char.charName)) || '角色', u: (acc && acc.nickname) || '用户' };
}
function arcLineOf(m, n) {
  var hm = m.time ? pad(new Date(m.time).getHours()) + ':' + pad(new Date(m.time).getMinutes()) + ' ' : '';
  if (m.r === 'status') return hm + '（' + n.c + '的状态栏：' + m.t.replace(/\s*\n\s*/g, '；').slice(0, 600) + '）';
  if (m.r === 'sys') return hm + '（系统：' + m.t.slice(0, 300) + '）';
  return hm + (m.r === 'user' ? n.u : n.c) + '：' + m.t;
}
function arcDateOf(t) { var d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
// 从第 from 条开始切一段：返回 { end, text, time（这一段第一条的时间） }
function arcChunk(arc, from, budget, n) {
  var lines = [], used = 0, day = '', i = from, time = 0;
  for (; i < arc.msgs.length; i++) {
    var m = arc.msgs[i];
    if (m.r === 'status' && !arc.mem.withStatus) continue;
    var line = arcLineOf(m, n);
    var d = m.time ? arcDateOf(m.time) : '';
    if (d && d !== day) line = '【' + d + '】\n' + line;
    var t = estTokens(line);
    if (lines.length && used + t > budget) break;
    if (d) day = d;
    if (!time && m.time) time = m.time;
    lines.push(t > budget ? line.slice(0, budget) : line);
    used += t;
  }
  return { end: i, text: lines.join('\n'), time: time };
}
function arcChunkCount(arc, from, budget, n) {
  var c = 0, p = from || 0;
  while (p < arc.msgs.length) {
    var ch = arcChunk(arc, p, budget, n);
    if (ch.end <= p) break;
    if (ch.text) c++;
    p = ch.end;
  }
  return c;
}

// ---------- 整理成记忆 ----------
function arcRules(arc, n) {
  return '要求：\n' +
    '1. 一件事写一条，不要把几件事合成一句；这一段有多少值得记的就写多少条。\n' +
    '2. 写具体：保留时间、地点、称呼、名字、数字、物品、约定的内容、当时的原因和情绪；关键的原话用「」直接引用。\n' +
    '3. 不要写空泛的话，比如「两人聊得很开心」「分享了日常」「感情更好了」：要么写出具体是什么，要么不写。\n' +
    '4. 只写原文里有的，不要猜，不要补原文没有的细节；分清是谁说的、谁做的。\n' +
    '5. 普通寒暄、重复的问候、只有表情包的来回可以略过；但喜好和讨厌的东西、习惯、身体和生活状况、重要的日子、承诺和约定、各种「第一次」、争吵与和好、秘密、对彼此的称呼，一定要记。\n' +
    (arc.mem.withStatus ? '6. 状态栏里的心声、日记，只记有新信息的部分，注明是「' + n.c + '心里想的」。\n' : '') +
    '每条一行，格式：日期｜类型｜内容\n' +
    '· 日期写 YYYY-MM-DD，不知道就写 -\n' +
    '· 类型只能是「长期」或「珍贵」：珍贵只给告白、确认关系、重大的承诺、特别重要的第一次这种会一直珍藏的事，很少用\n' +
    '· 内容用第三人称，写「' + n.c + '」「' + n.u + '」，每条不超过 120 字\n' +
    '只输出这些行，不要别的话；这一段没有值得记的就只输出「无」。';
}
function arcExtractMsgs(arc, chunk, n, prev) {
  return [
    { role: 'system', content: '你是记忆整理助手。下面是「' + n.c + '」和「' + n.u + '」以前在「' + arc.from + '」小手机里的一段聊天记录（【】里是日期），请把里面值得记住的事整理成「' + n.c + '」的记忆。\n\n' + arcRules(arc, n) },
    { role: 'user', content: (prev.length ? '前面已经记下的（接着往下记，不要重复）：\n' + prev.join('\n') + '\n\n' : '') + '聊天记录：\n' + chunk.text }
  ];
}
function arcCheckMsgs(arc, chunk, n, draft) {
  return [
    { role: 'system', content: '你是记忆核对助手。下面是「' + n.c + '」和「' + n.u + '」在「' + arc.from + '」小手机里的一段聊天记录，以及从里面整理出的记忆。请对照原文逐条检查：\n' +
      '· 写错的（人物、时间、数字、谁说的谁做的弄反了）改正\n· 写得笼统、丢了细节的，补上具体内容\n· 漏掉的值得记的事，补上\n· 原文里没有的内容，删掉\n\n' +
      '输出检查后的完整列表。' + arcRules(arc, n) },
    { role: 'user', content: '聊天记录：\n' + chunk.text + '\n\n整理出的记忆：\n' + (draft.trim() || '无') }
  ];
}
// 解析「日期｜类型｜内容」
function arcParseMems(text, fallbackTime) {
  var out = [];
  String(text || '').split(/\r?\n/).forEach(function(l) {
    l = l.replace(/^\s*(?:[-·•*]|\d+[.、)])\s*/, '').trim();
    var m = l.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|-|—|未知)?\s*[｜|]\s*(长期|珍贵)\s*[｜|]\s*(.+)$/);
    if (!m) return;
    var t = 0;
    if (m[1] && /\d/.test(m[1])) { var p = m[1].split(/[-/.]/); t = new Date(+p[0], +p[1] - 1, +p[2], 12).getTime(); }
    out.push({ type: m[2] === '珍贵' ? 'precious' : 'long', text: m[3].trim(), time: t || fallbackTime || 0 });
  });
  return out;
}
function arcErrId(err) { return typeof explainError === 'function' ? explainError(err).id : ''; }
function arcWait(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function arcStartMemory(char, arc) {
  if (arcRunning[arc.id]) return;
  var api = getApiCfg(char);
  if (!api.url || !api.key || !api.model) { showToast('请先在设置里填好 API', 'error'); return; }
  var run = arcRunning[arc.id] = { stop: false, ctrl: null };
  var n = arcNames(char);
  arc.mem.err = '';
  arc.mem.budget = arc.mem.budget || ARC_BUDGET;
  saveArcStore();
  arcRefresh();
  var tries = 0;
  function save() { saveArcStore(); arcRefresh(); }
  function finish(msg, type) {
    delete arcRunning[arc.id];
    save();
    if (msg) showToast(msg, type);
  }
  function step() {
    if (run.stop) { finish('已暂停整理，下次可以接着来', 'plain'); return; }
    if (!arcStore[char.id] || arcListOf(char.id).indexOf(arc) < 0) { delete arcRunning[arc.id]; return; }   // 档案被删了
    var chunk = arcChunk(arc, arc.mem.pos, arc.mem.budget, n);
    if (chunk.end <= arc.mem.pos || !chunk.text) {
      arc.mem.done = true;
      arc.mem.pos = arc.msgs.length;
      finish('✓ 「' + arc.from + '」的记录整理完了，记下 ' + arc.mem.count + ' 条记忆', 'success');
      if (typeof memMaybeMilestone === 'function') memMaybeMilestone(char);
      return;
    }
    // 前面刚记下的几条，让这一段接着往下记、不重复
    var prev = (arc.mem.recent || []).slice(-6);
    var cfg = getApiCfg(char);
    var ask = function(msgs) {
      run.ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      return llmRequest(msgs, { stream: false, cfg: cfg, signal: run.ctrl && run.ctrl.signal, temperature: 0.3 }).then(function(t) { return String(t || '').trim(); });
    };
    ask(arcExtractMsgs(arc, chunk, n, prev)).then(function(draft) {
      if (!arc.mem.careful) return draft;
      return ask(arcCheckMsgs(arc, chunk, n, draft)).then(function(checked) {
        // 核对的结果解析不出东西（模型没按格式写）时，用第一遍的
        return arcParseMems(checked).length || /^无\s*$/.test(checked) ? checked : draft;
      });
    }).then(function(text) {
      var mems = arcParseMems(text, chunk.time);
      if (!mems.length && !/^无/.test(text)) throw Object.assign(new Error('整理结果的格式不对'), { arcFormat: true });
      // 和已有记忆很像的不会重复记，所以按记忆实际多了几条来算
      var before = memList(char.id).length;
      mems.forEach(function(x) {
        memAdd(char, { type: x.type, text: x.text, source: 'import', from: arc.from, time: x.time, noMilestone: true, dupAt: 0.93 });
      });
      arc.mem.count += Math.max(0, memList(char.id).length - before);
      arc.mem.recent = (arc.mem.recent || []).concat(mems.map(function(x) { return '· ' + x.text; })).slice(-6);
      arc.mem.pos = chunk.end;
      arc.mem.seg = (arc.mem.seg || 0) + 1;
      tries = 0;
      save();
      step();
    }).catch(function(err) {
      if (err && err.name === 'AbortError') { finish('已暂停整理，下次可以接着来', 'plain'); return; }
      var id = arcErrId(err);
      // 这一段太长：切小一半重来
      if ((id === 'context' || id === 'toolarge') && arc.mem.budget > ARC_MIN_BUDGET) {
        arc.mem.budget = Math.max(ARC_MIN_BUDGET, Math.floor(arc.mem.budget / 2));
        save();
        step();
        return;
      }
      // 偶尔的失败（太频繁、超时、服务器忙、空回复、格式不对）：等一会儿再试，最多 3 次
      if (tries < 3 && (err.arcFormat || ['ratelimit', 'timeout', 'server', 'network', 'empty'].indexOf(id) >= 0)) {
        tries++;
        arcWait(id === 'ratelimit' ? 20000 * tries : 4000 * tries).then(step);
        return;
      }
      arc.mem.err = typeof explainError === 'function' ? explainError(err).title : String(err && err.message || err);
      finish('✗ 整理停在这一段：' + arc.mem.err + '。点「继续整理」可以接着来', 'error');
    });
  }
  step();
}
function arcStopMemory(arc) {
  var run = arcRunning[arc.id];
  if (!run) return;
  run.stop = true;
  if (run.ctrl) try { run.ctrl.abort(); } catch (_) {}
}

// ---------- 角色设置「扩展」页：档案列表 ----------
function arcRefresh() {
  if (!appCharSetting.classList.contains('active') || editingCharIndex < 0) return;
  renderArchiveList(charList[editingCharIndex]);
}
function renderArchiveList(char) {
  var box = document.getElementById('arcList');
  if (!box) return;
  box.innerHTML = '';
  var list = char && char.id ? arcListOf(char.id) : [];
  if (!list.length) return;
  var n = arcNames(char);
  list.forEach(function(a) {
    var item = document.createElement('div');
    item.className = 'mem-sum-item arc-item';
    var head = document.createElement('div');
    head.className = 'mem-sum-head';
    var info = document.createElement('span');
    info.textContent = a.from + ' 小手机 · ' + a.msgs.length + ' 条 · ' + arcRange(a);
    var del = document.createElement('button');
    del.textContent = '删除';
    del.addEventListener('click', function() {
      openConfirm('删除这份档案？已经整理进记忆的不受影响', function() {
        arcStopMemory(a);
        arcStore[char.id] = arcListOf(char.id).filter(function(x) { return x !== a; });
        if (!arcStore[char.id].length) delete arcStore[char.id];
        saveArcStore();
        renderArchiveList(char);
      });
    });
    head.appendChild(info);
    head.appendChild(del);
    var st = document.createElement('div');
    st.className = 'arc-state';
    var running = !!arcRunning[a.id];
    var total = a.mem.done ? 0 : (a.mem.seg || 0) + arcChunkCount(a, a.mem.pos, a.mem.budget || ARC_BUDGET, n);
    st.textContent = a.mem.done ? '已整理成记忆，记下 ' + a.mem.count + ' 条'
      : running ? '整理中… 第 ' + Math.min((a.mem.seg || 0) + 1, total) + ' / ' + total + ' 段，已记下 ' + a.mem.count + ' 条'
      : a.mem.err ? '停在第 ' + ((a.mem.seg || 0) + 1) + ' / ' + total + ' 段：' + a.mem.err
      : a.mem.pos > 0 ? '整理了 ' + (a.mem.seg || 0) + ' / ' + total + ' 段，已记下 ' + a.mem.count + ' 条'
      : '还没整理成记忆';
    if (a.mem.err && !running) st.classList.add('err');
    var acts = document.createElement('div');
    acts.className = 'arc-acts';
    var view = document.createElement('button');
    view.textContent = '查看';
    view.addEventListener('click', function() { openArcView(char, a); });
    acts.appendChild(view);
    if (!a.mem.done) {
      var go = document.createElement('button');
      go.textContent = running ? '暂停' : a.mem.pos > 0 ? '继续整理' : '整理成记忆';
      go.addEventListener('click', function() {
        if (arcRunning[a.id]) { arcStopMemory(a); return; }
        if (a.mem.pos > 0) { arcStartMemory(char, a); return; }
        openArcMemCfg(char, a);
      });
      acts.appendChild(go);
    }
    item.appendChild(head);
    item.appendChild(st);
    item.appendChild(acts);
    box.appendChild(item);
  });
}

// ---------- 导入：选文件 → 预览 → 导入 ----------
var arcPrevOverlay = document.getElementById('arcPrevOverlay');
var arcPending = null;   // { char, parsed, file }
document.getElementById('arcImportBtn').addEventListener('click', function() {
  if (editingCharIndex < 0) { showToast('请先保存角色', 'error'); return; }
  var char = charList[editingCharIndex];
  pickFile('.json,.jsonl,.txt,.docx,application/json,text/plain', function(file) {
    var read = /\.docx$/i.test(file.name)
      ? file.arrayBuffer().then(function(b) { return readDocxText(b); })
      : file.text();
    read.then(function(t) {
      var parsed = arcParse(t, file.name, char);
      if (!parsed.msgs.length) throw new Error('里面没有聊天内容');
      parsed.msgs.sort(function(a, b) { return (a.time || 0) - (b.time || 0); });
      arcPending = { char: char, parsed: parsed, file: file.name, mode: 'import' };
      openArcPreview();
    }).catch(function(err) {
      showToast('✗ 读不出来：' + ((err && err.message) || '格式不认识'), 'error');
    });
  });
});
function arcSampleLine(m, n) {
  var who = m.r === 'user' ? n.u : m.r === 'char' ? n.c : m.r === 'status' ? n.c + '的状态栏' : '系统';
  var t = m.t.replace(/\s+/g, ' ');
  return who + '：' + (t.length > 60 ? t.slice(0, 60) + '…' : t);
}
function openArcPreview() {
  var p = arcPending, n = arcNames(p.char), msgs = p.parsed.msgs, s = arcStats(msgs);
  document.getElementById('arcPrevFrom').value = p.parsed.from || p.file.replace(/\.[^.]+$/, '').slice(0, 12);
  var lines = ['共 ' + msgs.length + ' 条：' + n.u + ' ' + s.user + ' 条 · ' + n.c + ' ' + s.char + ' 条' +
    (s.status ? ' · 状态栏 ' + s.status + ' 条' : '') + (s.sys ? ' · 系统 ' + s.sys + ' 条' : '')];
  var kinds = Object.keys(s.kinds).map(function(k) { return (ARC_KIND_LABEL[k] || k) + ' ' + s.kinds[k]; });
  if (kinds.length) lines.push('其中：' + kinds.join(' · '));
  lines.push('时间：' + (s.first ? arcDay(s.first) + ' – ' + arcDay(s.last) : '文件里没有时间'));
  var unk = Object.keys(p.parsed.unknown);
  if (unk.length) lines.push('认不出的内容：' + unk.map(function(k) { return k + ' ' + p.parsed.unknown[k] + ' 条'; }).join('、') + '（会显示成 [' + unk[0] + '] 这样）');
  document.getElementById('arcPrevInfo').textContent = lines.join('\n');
  // 每种挑两条看看导入后的样子
  var box = document.getElementById('arcPrevSamples');
  box.innerHTML = '';
  var seen = {};
  msgs.forEach(function(m) {
    var key = m.r + '|' + m.k;
    if ((seen[key] = (seen[key] || 0) + 1) > 2) return;
    var d = document.createElement('div');
    d.className = 'arc-sample ' + m.r;
    d.textContent = arcSampleLine(m, n);
    box.appendChild(d);
  });
  document.getElementById('arcPrevStatusRow').style.display = s.status ? '' : 'none';
  document.getElementById('arcPrevMem').checked = true;
  document.getElementById('arcPrevStatus').checked = true;
  document.getElementById('arcPrevCareful').checked = false;
  document.getElementById('arcPrevFromRow').style.display = '';
  document.getElementById('arcPrevMemRow').style.display = '';
  document.getElementById('arcPrevTitle').textContent = '导入预览';
  document.getElementById('arcPrevOk').textContent = '导入';
  arcPrevUpdate();
  arcPrevOverlay.classList.add('open');
}
function arcPrevUpdate() {
  var p = arcPending;
  if (!p) return;
  var mem = document.getElementById('arcPrevMem').checked;
  document.getElementById('arcPrevMemSub').style.display = mem ? '' : 'none';
  var fake = { msgs: p.parsed ? p.parsed.msgs : p.arc.msgs, mem: { withStatus: document.getElementById('arcPrevStatus').checked } };
  var segs = arcChunkCount(fake, 0, ARC_BUDGET, arcNames(p.char));
  var careful = document.getElementById('arcPrevCareful').checked;
  document.getElementById('arcPrevCost').textContent = mem
    ? '大约分成 ' + segs + ' 段，要调用 ' + (careful ? segs * 2 : segs) + ' 次接口（用这个角色现在用的模型）。整理时可以离开这个页面，但要开着小手机；中途可以暂停，下次接着来。'
    : '只存成档案，可以以后再整理。';
}
['arcPrevMem', 'arcPrevStatus', 'arcPrevCareful'].forEach(function(id) {
  document.getElementById(id).addEventListener('change', arcPrevUpdate);
});
// 已经导入的档案，之后再点「整理成记忆」：用同一个弹窗只选整理方式
function openArcMemCfg(char, arc) {
  arcPending = { char: char, arc: arc, mode: 'mem' };
  var s = arcStats(arc.msgs);
  document.getElementById('arcPrevTitle').textContent = '整理成记忆';
  document.getElementById('arcPrevInfo').textContent = arc.from + ' 小手机 · ' + arc.msgs.length + ' 条 · ' + arcRange(arc);
  document.getElementById('arcPrevSamples').innerHTML = '';
  document.getElementById('arcPrevFromRow').style.display = 'none';
  document.getElementById('arcPrevMemRow').style.display = 'none';
  document.getElementById('arcPrevMem').checked = true;
  document.getElementById('arcPrevStatusRow').style.display = s.status ? '' : 'none';
  document.getElementById('arcPrevStatus').checked = true;
  document.getElementById('arcPrevCareful').checked = false;
  document.getElementById('arcPrevOk').textContent = '开始整理';
  arcPrevUpdate();
  arcPrevOverlay.classList.add('open');
}
document.getElementById('arcPrevCancel').addEventListener('click', function() { arcPrevOverlay.classList.remove('open'); arcPending = null; });
closeOnBackdrop(arcPrevOverlay);
document.getElementById('arcPrevOk').addEventListener('click', function() {
  var p = arcPending;
  if (!p) return;
  var mem = document.getElementById('arcPrevMem').checked;
  var memCfg = { pos: 0, count: 0, seg: 0, budget: ARC_BUDGET, careful: document.getElementById('arcPrevCareful').checked,
    withStatus: document.getElementById('arcPrevStatus').checked, done: false, err: '' };
  var arc = p.arc;
  if (p.mode === 'import') {
    var from = document.getElementById('arcPrevFrom').value.trim().replace(/小手机$/, '') || '其他';
    arc = { id: 'arc' + Date.now().toString(36), from: from.slice(0, 12), file: p.file, importTime: Date.now(), msgs: p.parsed.msgs, mem: memCfg };
    (arcStore[p.char.id] = arcListOf(p.char.id)).push(arc);
  } else {
    arc.mem = Object.assign(arc.mem || {}, memCfg);
  }
  saveArcStore();
  arcPrevOverlay.classList.remove('open');
  arcPending = null;
  if (p.mode === 'import' && !mem) showToast('✓ 已存成档案', 'success');
  renderArchiveList(p.char);
  if (mem) arcStartMemory(p.char, arc);
});

// ---------- 查看档案：只读，往下滑加载更多，可以搜 ----------
var arcViewOverlay = document.getElementById('arcViewOverlay');
var arcView = null;   // { char, arc, list（筛选后的）, shown }
var ARC_PAGE = 150;
function openArcView(char, arc) {
  arcView = { char: char, arc: arc, list: arc.msgs, shown: 0 };
  document.getElementById('arcViewTitle').textContent = arc.from + ' 小手机 · ' + arc.msgs.length + ' 条';
  document.getElementById('arcViewSearch').value = '';
  arcViewReset();
  arcViewOverlay.classList.add('open');
}
function arcViewReset() {
  var box = document.getElementById('arcViewList');
  box.innerHTML = '';
  box.scrollTop = 0;
  arcView.shown = 0;
  arcView.day = '';
  if (!arcView.list.length) { box.innerHTML = '<div class="auto-hint desk-empty">没有找到</div>'; return; }
  arcViewMore();
}
function arcViewMore() {
  var v = arcView, box = document.getElementById('arcViewList'), n = arcNames(v.char);
  var end = Math.min(v.list.length, v.shown + ARC_PAGE);
  for (var i = v.shown; i < end; i++) {
    var m = v.list[i];
    if (m.time) {
      var d = arcDay(m.time);
      if (d !== v.day) {
        v.day = d;
        var dv = document.createElement('div');
        dv.className = 'arc-day';
        dv.textContent = d;
        box.appendChild(dv);
      }
    }
    var row = document.createElement('div');
    row.className = 'arc-msg ' + m.r;
    var meta = document.createElement('div');
    meta.className = 'arc-msg-meta';
    meta.textContent = (m.r === 'user' ? n.u : m.r === 'char' ? n.c : m.r === 'status' ? '状态栏' : '系统') +
      (m.time ? ' ' + pad(new Date(m.time).getHours()) + ':' + pad(new Date(m.time).getMinutes()) : '');
    var b = document.createElement('div');
    b.className = 'arc-msg-text';
    b.textContent = m.t;
    if (m.r === 'status') b.addEventListener('click', function() { this.classList.toggle('open'); });
    row.appendChild(meta);
    row.appendChild(b);
    box.appendChild(row);
  }
  v.shown = end;
}
document.getElementById('arcViewList').addEventListener('scroll', function() {
  if (arcView && arcView.shown < arcView.list.length && this.scrollTop + this.clientHeight > this.scrollHeight - 300) arcViewMore();
});
var arcSearchTimer = 0;
document.getElementById('arcViewSearch').addEventListener('input', function() {
  var q = this.value.trim().toLowerCase();
  clearTimeout(arcSearchTimer);
  arcSearchTimer = setTimeout(function() {
    if (!arcView) return;
    arcView.list = q ? arcView.arc.msgs.filter(function(m) { return m.t.toLowerCase().indexOf(q) >= 0; }) : arcView.arc.msgs;
    arcViewReset();
  }, 250);
});
document.getElementById('arcViewClose').addEventListener('click', function() { arcViewOverlay.classList.remove('open'); arcView = null; });
closeOnBackdrop(arcViewOverlay);
