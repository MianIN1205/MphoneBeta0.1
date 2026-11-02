// 眠花糖机 — 其他小手机的聊天记录：导入成旧档案（只给你翻看，不发给 AI），分段整理成角色的长期记忆

// =============================================
// 旧档案：arcStore[角色id] = [{ id, from（来自哪里，比如「uwu 小手机」）, file, importTime, msgs, mem }]
// · msgs：[{ r: 'user' | 'char' | 'status' | 'sys', t: 文字, time, k: 'text' | 'sticker' | 'image' | 'voice' | …（其他种类照原名）, who（原文里的名字）, d: 1 = 剧情 }]
// · mem：整理成记忆的进度 { pos: 整理到第几条（不含）, count: 记下了几条, budget: 每段多长, careful: 逐段核对, withStatus: 带上状态栏, done, err, merged: 合并了几条重复的 }
// · 同一个地方再导出一次导进来时，已经导入过的消息（时间和内容都一样）会跳过，只存新的
// · 整理完自动把导入的记忆里说同一件事的合并成一条（arcConsolidate），细节都保留
// 整理时一段一段来：每段不超过 budget（估算 token），太长被拒就自动切小一半；中途失败停在那一段，下次点「继续」接着来
// =============================================
var arcStore = mphoneStore.load('mphone_archives', {});
var ARC_BUDGET = 5000;        // 每段聊天记录大约多少 token
var ARC_MIN_BUDGET = 600;
var arcRunning = {};          // 档案id → { stop, ctrl }
function saveArcStore() { mphoneStore.save('mphone_archives', arcStore); }
function arcListOf(charId) { return arcStore[charId] || []; }

// ---------- 读文件：认出是哪种格式 ----------
// 认得：uwu 小手机、眠花糖机自己的角色备份、ChatGPT / Claude 官网导出、酒馆 .jsonl、各种 JSON（找像消息的东西）、
//       CSV、微信 / QQ 那种「名字 时间」下一行是内容的 txt、每行「名字：内容」的 txt / md / docx
// 返回 { from（来自哪里）, msgs, unknown: { 认不出的种类: 条数 } }；msgs 里的 who 是原文里的名字，预览里可以点名字改「谁是 TA」
var ARC_USER_ROLES = /^(user|human|me|self|you|用户|我|自己)$/i;
var ARC_CHAR_ROLES = /^(assistant|ai|bot|model|char|character|gpt|chatgpt|claude|gemini|角色|对方)$/i;
var ARC_WRAP_RE = /^\s*\[([^\]]{1,30}?)的消息[：:]\s*([\s\S]*)\]\s*$/;   // uwu：「[简然的消息：嗯 去吧]」
var ARC_DATE = '\\d{4}[-/.年]\\d{1,2}[-/.月]\\d{1,2}日?';
var ARC_HM = '\\d{1,2}:\\d{2}(?::\\d{2})?';
function arcParse(text, fileName, char) {
  var names = [char && char.charName, char && char.charAlias].filter(Boolean);
  var unknown = {};
  var s = String(text || '').replace(/^\uFEFF/, '').trim();
  var j = null;
  if (/^[\[{]/.test(s)) try { j = JSON.parse(s); } catch (_) {}
  var res = j ? arcParseJson(j, names, unknown)
    : (/^\{/.test(s) && arcParseJsonl(s, names, unknown)) ||
      (/\.csv$/i.test(fileName || '') && arcParseCsv(s, names, unknown)) ||
      arcParseText(s, names, unknown);
  if (!res || !res.msgs.length) throw new Error(j ? '这个 JSON 里没找到聊天记录' : '没认出聊天记录的格式');
  res.unknown = unknown;
  return res;
}
function arcIsChar(who, names) {
  who = String(who || '').trim();
  return !!who && names.some(function(n) { return n && (who === n || who.indexOf(n) >= 0 || n.indexOf(who) >= 0); });
}
function arcTime(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v < 1e12 ? Math.round(v * 1000) : v;
  var s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return arcTime(Number(s));
  s = s.replace(/(\d)\s*(am|pm)\b/i, '$1 $2');   // 酒馆：June 1, 2026 10:00am
  var t = Date.parse(s);
  if (isNaN(t)) t = Date.parse(s.replace(/年|月/g, '-').replace(/日/, ' ').replace(/\//g, '-').replace(/\s+/g, ' ').trim().replace(' ', 'T'));
  if (isNaN(t)) t = Date.parse(s.replace(/年|月/g, '/').replace(/日/, ' ').replace(/-/g, '/'));
  return isNaN(t) ? 0 : t;
}
// 「[表情包：摸头]」「[图片]」这类：记下种类
var ARC_KIND_NAME = { '表情包': 'sticker', '表情': 'sticker', '动画表情': 'sticker', '图片': 'image', '照片': 'image', '语音': 'voice' };
function arcKind(m) {
  var k = String(m.t || '').match(/^\s*[\[【](表情包|动画表情|表情|图片|照片|语音|视频|转账|红包|位置|礼物|文件|通话|语音通话|视频通话|链接|音乐)[：:\]】]/);
  if (k) m.k = ARC_KIND_NAME[k[1]] || k[1];
  return m;
}
// 把各种写法的「内容」变成文字
function arcTextOf(c, unknown) {
  if (c == null) return '';
  if (typeof c === 'string') return c;
  if (typeof c === 'number') return String(c);
  if (Array.isArray(c)) return c.map(function(p) { return arcTextOf(p, unknown); }).filter(Boolean).join(' ');
  if (typeof c === 'object') {
    if (c.type && c.type !== 'text' && c.text == null) {
      var known = { image: '图片', image_url: '图片', audio: '语音', input_audio: '语音', voice: '语音', sticker: '表情包', file: '文件', video: '视频' }[c.type];
      if (!known && unknown) unknown[c.type] = (unknown[c.type] || 0) + 1;
      return '[' + (known || c.type) + ']';
    }
    if (c.text != null) return arcTextOf(c.text, unknown);
    if (c.parts) return arcTextOf(c.parts, unknown);
    if (c.content != null) return arcTextOf(c.content, unknown);
    if (c.value != null) return arcTextOf(c.value, unknown);
  }
  return '';
}
function arcRoleOf(role, who, names) {
  role = String(role || '').trim();
  if (/^(system)$/i.test(role)) return 'sys';
  if (/^(tool|function)$/i.test(role)) return '';
  if (ARC_USER_ROLES.test(role)) return 'user';
  if (ARC_CHAR_ROLES.test(role)) return 'char';
  who = String(who || '').trim();
  if (arcIsChar(who, names) || arcIsChar(role, names)) return 'char';
  if (ARC_CHAR_ROLES.test(who)) return 'char';
  return 'user';
}
function arcFromUwu(h, unknown) {
  if (!h) return null;
  var text = typeof h.content === 'string' ? h.content : '';
  var extra = [];
  (Array.isArray(h.parts) ? h.parts : []).forEach(function(p) {
    if (!p) return;
    if (p.type === 'text') { if (!text) text = p.text || ''; return; }
    extra.push(arcTextOf(p, unknown) || '[未知内容]');
  });
  var who = '';
  var w = text.match(ARC_WRAP_RE);
  if (w) { who = w[1]; text = w[2]; }
  if (!text && extra.length) text = extra.join(' ');
  if (!String(text).trim()) return null;
  var m = { r: h.role === 'user' ? 'user' : h.role === 'assistant' ? 'char' : 'sys', t: text, time: arcTime(h.timestamp), k: 'text' };
  if (who) m.who = who;
  if (h.isStatusUpdate) { m.r = 'status'; m.k = 'status'; m.t = arcStatusText(text); delete m.who; }
  else arcKind(m);
  return m.t.trim() ? m : null;
}
// 状态栏：去掉 <JIANRAN> 这类标签和多余空行
function arcStatusText(s) {
  return String(s || '').replace(/<\/?[A-Za-z_][\w-]*[^>]*>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
// 一般的消息对象（酒馆、Claude 导出、各种小手机的 JSON）
var ARC_TEXT_KEYS = ['content', 'mes', 'text', 'message', 'msg', 'body', 'value'];
var ARC_WHO_KEYS = ['name', 'sender_name', 'senderName', 'nickname', 'sender', 'from', 'speaker', 'author', 'user', 'role'];
var ARC_TIME_KEYS = ['timestamp', 'time', 'send_date', 'sendTime', 'send_time', 'date', 'createdAt', 'created_at', 'create_time', 'createTime', 'ts'];
function arcPick(o, keys) { for (var i = 0; i < keys.length; i++) if (o[keys[i]] != null && o[keys[i]] !== '') return o[keys[i]]; return null; }
function arcLooksLikeMsg(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  var c = arcPick(o, ARC_TEXT_KEYS);
  if (c == null || (typeof c === 'object' && !Array.isArray(c) && !c.parts && c.text == null && c.content == null)) return false;
  return 'role' in o || 'is_user' in o || 'isUser' in o || 'sender' in o || 'author' in o || 'name' in o || 'from' in o || 'speaker' in o || 'nickname' in o || 'sender_name' in o || 'senderName' in o || 'type' in o && /^(user|assistant|human|ai|bot)$/i.test(o.type);
}
function arcFromGeneric(o, names, unknown) {
  if (!o || typeof o !== 'object') return null;
  if (o.isStatusUpdate) return arcFromUwu(o, unknown);
  var text = arcTextOf(arcPick(o, ARC_TEXT_KEYS), unknown);
  var whoV = arcPick(o, ARC_WHO_KEYS);
  var who = whoV && typeof whoV === 'object' ? (whoV.name || whoV.nickname || whoV.role || '') : (whoV || '');
  var role = o.role || o.sender_type || (o.author && o.author.role) || (o.is_user === true || o.isUser === true ? 'user' : o.is_user === false || o.isUser === false ? 'assistant' : '') ||
    (/^(user|assistant|human|ai|bot)$/i.test(o.type || '') ? o.type : '');
  if (o.is_system) role = 'system';
  var w = String(text).match(ARC_WRAP_RE);
  if (w) { if (!who || who === role) who = w[1]; text = w[2]; }
  var r = arcRoleOf(role, who, names);
  if (!r || !String(text).trim()) return null;
  var m = { r: r, t: String(text), time: arcTime(arcPick(o, ARC_TIME_KEYS)), k: 'text' };
  who = String(who || '').trim();
  if (who && !ARC_USER_ROLES.test(who) && !ARC_CHAR_ROLES.test(who) && who !== 'system') m.who = who.slice(0, 30);
  return arcKind(m);
}
function arcParseJson(j, names, unknown) {
  // uwu 小手机
  if (j.type === 'uwu-chat-history' && Array.isArray(j.history))
    return { from: 'uwu 小手机', msgs: j.history.map(function(h) { return arcFromUwu(h, unknown); }).filter(Boolean) };
  // 眠花糖机自己的角色备份：聊天和剧情都带上（剧情的标上）
  if (j.app === 'mphone' && j.type === 'char') {
    var mine = [];
    [['chat', 0], ['drama', 1]].forEach(function(x) {
      (j[x[0]] || []).forEach(function(h) {
        if (!h || h.hidden) return;
        var t = h.recalled ? '[撤回了一条消息]' : h.imgSrc ? '[图片]' : h.voice ? '[语音]' + (h.transcript || '') : arcTextOf(h.content, unknown);
        if (!String(t).trim()) return;
        var m = arcKind({ r: h.role === 'user' ? 'user' : h.role === 'assistant' ? 'char' : 'sys', t: String(t), time: arcTime(h.time), k: 'text' });
        if (x[1]) m.d = 1;
        mine.push(m);
      });
    });
    return { from: '眠花糖机', msgs: mine };
  }
  // ChatGPT 官网导出：每个对话一个 mapping（一棵树），把里面的消息都取出来
  var gpt = [];
  (function walk(o, depth) {
    if (!o || typeof o !== 'object' || depth > 3) return;
    if (o.mapping && typeof o.mapping === 'object' && !Array.isArray(o.mapping)) {
      Object.keys(o.mapping).forEach(function(k) {
        var msg = o.mapping[k] && o.mapping[k].message;
        if (!msg || !msg.author) return;
        var r = arcRoleOf(msg.author.role, msg.author.name, names);
        if (r !== 'user' && r !== 'char') return;
        var t = arcTextOf(msg.content, unknown);
        if (String(t).trim()) gpt.push(arcKind({ r: r, t: t, time: arcTime(msg.create_time), k: 'text' }));
      });
      return;
    }
    (Array.isArray(o) ? o : Object.keys(o).map(function(k) { return o[k]; })).forEach(function(v) { walk(v, depth + 1); });
  })(j, 0);
  if (gpt.length) return { from: 'ChatGPT', msgs: gpt };
  // 其他：把所有「像一条消息」的对象找出来（多个对话的也一起），找到就不再往里钻
  var found = [], isClaude = false;
  (function walk(o, depth) {
    if (!o || typeof o !== 'object' || depth > 7) return;
    if (arcLooksLikeMsg(o)) { found.push(o); return; }
    if (!Array.isArray(o) && Array.isArray(o.chat_messages)) isClaude = true;
    (Array.isArray(o) ? o : Object.keys(o).map(function(k) { return o[k]; })).forEach(function(v) { walk(v, depth + 1); });
  })(j, 0);
  var msgs = found.map(function(o) { return arcFromGeneric(o, names, unknown); }).filter(Boolean);
  if (msgs.length) return { from: isClaude ? 'Claude' : found.some(function(o) { return 'mes' in o; }) ? '酒馆' : '', msgs: msgs };
  return null;
}
// 一行一个 JSON（酒馆的 .jsonl）
function arcParseJsonl(s, names, unknown) {
  var objs = s.split(/\r?\n/).map(function(l) { l = l.trim(); if (!l) return null; try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
  if (objs.length < 2) return null;
  var msgs = objs.map(function(o) { return arcLooksLikeMsg(o) ? arcFromGeneric(o, names, unknown) : null; }).filter(Boolean);
  return msgs.length ? { from: objs.some(function(o) { return 'mes' in o; }) ? '酒馆' : '', msgs: msgs } : null;
}
// CSV：认表头（名字 / 内容 / 时间），没有表头时按「名字,内容」或「时间,名字,内容」
function arcCsvRows(s) {
  var rows = [], row = [], cell = '', q = false;
  for (var i = 0; i < s.length; i++) {
    var c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(function(r) { return r.some(function(x) { return x.trim(); }); });
}
function arcParseCsv(s, names, unknown) {
  var rows = arcCsvRows(s);
  if (rows.length < 2) return null;
  var head = rows[0].map(function(h) { return h.trim().toLowerCase(); });
  var col = function(re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; };
  var ti = col(/^(time|date|timestamp|时间|日期|发送时间)$/), wi = col(/^(name|sender|role|author|from|speaker|nickname|发送者|发言人|角色|昵称|姓名|名字|说话人)$/), ci = col(/^(content|text|message|msg|body|内容|消息|正文|聊天内容)$/);
  var start = 1;
  if (ci < 0) { start = 0; var w = rows[0].length; ci = w - 1; wi = w >= 2 ? w - 2 : -1; ti = w >= 3 ? 0 : -1; }
  var msgs = rows.slice(start).map(function(r) {
    var o = { content: r[ci] || '', name: wi >= 0 ? r[wi] : '', time: ti >= 0 ? r[ti] : '' };
    return arcFromGeneric(o, names, unknown);
  }).filter(Boolean);
  return msgs.length ? { from: '', msgs: msgs } : null;
}
// 纯文字（txt / md / docx）
function arcParseText(s, names, unknown) {
  var out = [], cur = null, curDate = '';
  var reDay = new RegExp('^[\\s\\-—=*#]*(' + ARC_DATE + ')(?:\\s*(?:星期|周)[一二三四五六日天])?[\\s\\-—=*#]*$');
  var reHeadA = new RegExp('^\\s*(' + ARC_DATE + '\\s+' + ARC_HM + ')\\s+([^：:\\s][^：:]{0,29}?)\\s*$');   // QQ：2026-06-01 12:00:00 眠眠(12345)
  var reHeadB = new RegExp('^\\s*([^：:\\s][^：:]{0,29}?)\\s+(' + ARC_DATE + '\\s+' + ARC_HM + ')\\s*$');   // 微信：眠眠 2026-06-01 12:00
  var reLine = new RegExp('^\\s*(?:[\\[【(（]?(' + ARC_DATE + '\\s*' + ARC_HM + '|' + ARC_HM + ')[\\]】)）]?\\s*)?([^：:\\s][^：:]{0,19})[：:]\\s*(.*)$');
  var clean = function(who) { return who.replace(/[(（<][^)）>]*[)）>]\s*$/, '').replace(/^[*_#>\s]+|[*_\s]+$/g, '').trim(); };
  var when = function(t) { return /^\d{1,2}:\d{2}/.test(t || '') && curDate ? arcTime(curDate + ' ' + t) : arcTime(t); };
  var push = function(who, t, time) {
    cur = arcKind({ r: arcRoleOf('', who, names), t: t, time: time, k: 'text', who: who });
    out.push(cur);
  };
  s.split(/\r?\n/).forEach(function(raw) {
    var line = raw.replace(/^\s*>\s?/, '');
    var m;
    if ((m = line.match(reDay))) { curDate = m[1]; return; }
    if ((m = line.match(reHeadA))) { push(clean(m[2]), '', arcTime(m[1])); return; }
    if ((m = line.match(reHeadB)) && !/[，。！？,.!?]/.test(m[1])) { push(clean(m[1]), '', arcTime(m[2])); return; }
    if ((m = line.replace(/\*\*([^*]{1,30})\*\*/, '$1').match(reLine)) && !/^https?$/i.test(m[2])) { push(clean(m[2]), m[3], when(m[1])); return; }
    if (cur && line.trim()) cur.t += (cur.t ? '\n' : '') + line.trim();
  });
  out = out.filter(function(m) { return m.t.trim(); });
  // 只出现一次的「名字」多半是正文里带冒号的一句话（比如「注意：…」），并回上一条
  var cnt = {};
  out.forEach(function(m) { cnt[m.who] = (cnt[m.who] || 0) + 1; });
  if (Object.keys(cnt).length > 2 && out.length > 20) {
    var kept = [];
    out.forEach(function(m) {
      if (cnt[m.who] > 1 || !kept.length) kept.push(m);
      else kept[kept.length - 1].t += '\n' + m.who + '：' + m.t;
    });
    out = kept;
  }
  out.forEach(function(m) { arcKind(m); });
  return out.length ? { from: '', msgs: out } : null;
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
  return hm + (m.d ? '（剧情）' : '') + (m.r === 'user' ? n.u : n.c) + '：' + m.t;
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
    { role: 'system', content: '你是记忆整理助手。下面是「' + n.c + '」和「' + n.u + '」以前在「' + arc.from + '」里的一段聊天记录（【】里是日期），请把里面值得记住的事整理成「' + n.c + '」的记忆。\n\n' + arcRules(arc, n) },
    { role: 'user', content: (prev.length ? '前面已经记下的（接着往下记，不要重复）：\n' + prev.join('\n') + '\n\n' : '') + '聊天记录：\n' + chunk.text }
  ];
}
function arcCheckMsgs(arc, chunk, n, draft) {
  return [
    { role: 'system', content: '你是记忆核对助手。下面是「' + n.c + '」和「' + n.u + '」在「' + arc.from + '」里的一段聊天记录，以及从里面整理出的记忆。请对照原文逐条检查：\n' +
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
    if (run.stop) { finish('已暂停，下次可以接着整理', 'plain'); return; }
    if (!arcStore[char.id] || arcListOf(char.id).indexOf(arc) < 0) { delete arcRunning[arc.id]; return; }   // 档案被删了
    var chunk = arcChunk(arc, arc.mem.pos, arc.mem.budget, n);
    if (chunk.end <= arc.mem.pos || !chunk.text) {
      arc.mem.pos = arc.msgs.length;
      arc.mem.dedup = true;
      save();
      // 最后把导入的记忆里说同一件事的合并一下；合并失败也不要紧，原来的都还在
      arcConsolidate(char).catch(function(err) { console.warn('[Mphone] 合并重复记忆失败:', err); return 0; }).then(function(merged) {
        arc.mem.done = true;
        delete arc.mem.dedup;
        arc.mem.merged = (arc.mem.merged || 0) + (merged || 0);
        finish('✓ 整理完了，记下 ' + arc.mem.count + ' 条' + (merged ? '，合并 ' + merged + ' 条重复' : ''), 'success');
        if (typeof memMaybeMilestone === 'function') memMaybeMilestone(char);
      });
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
      if (err && err.name === 'AbortError') { finish('已暂停，下次可以接着整理', 'plain'); return; }
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
      finish('✗ 整理暂停：' + arc.mem.err, 'error');
    });
  }
  step();
}
// ---------- 合并重复：导入的记忆里说同一件事的合并成一条 ----------
// 先在本地按文字相似度把「可能在说同一件事」的分成小组（同一个来源、同在剧情或聊天里的才放一起），
// 再让模型逐组判断：同一件事合并、细节全部保留；不是同一件事的原样分开。结果条数没变少或解析不出来的组，保持原样
var ARC_DUP_SIM = 0.42;
var ARC_DUP_GROUP_MAX = 8;
var arcDedupBusy = {};
function arcDupGroups(char) {
  var by = {};
  memList(char.id).forEach(function(m) {
    if (m.source !== 'import' || m.type === 'short') return;
    (by[(m.from || '') + '|' + (m.scene || '')] = by[(m.from || '') + '|' + (m.scene || '')] || []).push(m);
  });
  var groups = [];
  Object.keys(by).forEach(function(key) {
    var arr = by[key].slice().sort(function(a, b) { return a.time - b.time; });
    // 比较时去掉日期和数字：不然「6月1日去了图书馆」和「6月2日感冒了」会因为日期像而被分到一组
    var tok = arr.map(function(m) { return memTokens(m.text.replace(/[\d０-９]+\s*[-/.:：年月日号点]?/g, ' ')); });
    var parent = arr.map(function(_, i) { return i; });
    var find = function(i) { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
    for (var i = 0; i < arr.length; i++) {
      for (var j = i + 1; j < arr.length && j < i + 800; j++) {
        if (memCos(tok[i], tok[j]) > ARC_DUP_SIM) parent[find(j)] = find(i);
      }
    }
    var sets = {};
    arr.forEach(function(m, i) { (sets[find(i)] = sets[find(i)] || []).push(m); });
    Object.keys(sets).forEach(function(k) {
      var s = sets[k];
      for (var x = 0; x < s.length; x += ARC_DUP_GROUP_MAX) {
        var g = s.slice(x, x + ARC_DUP_GROUP_MAX);
        if (g.length > 1) groups.push(g);
      }
    });
  });
  return groups;
}
function arcConsolidate(char) {
  if (arcDedupBusy[char.id]) return Promise.resolve(0);
  var groups = arcDupGroups(char);
  if (!groups.length) return Promise.resolve(0);
  arcDedupBusy[char.id] = true;
  var n = arcNames(char), merged = 0;
  // 分批：每批不超过 3500 左右
  var batches = [[]], used = 0;
  groups.forEach(function(g) {
    var t = estTokens(g.map(function(m) { return m.text; }).join('\n'));
    if (used + t > 3500 && batches[batches.length - 1].length) { batches.push([]); used = 0; }
    batches[batches.length - 1].push(g);
    used += t;
  });
  var sys = '你是记忆整理助手。下面是「' + n.c + '」的记忆，按组列出；同一组里的几条可能在说同一件事。请逐组处理：\n' +
    '· 说的是同一件事、同一个事实的，合并成一条；合并后要保留每一条里的全部细节（日期、地点、称呼、数字、物品、原话、原因、情绪），一个都不能丢\n' +
    '· 只是相似、其实是不同的事（比如不同日子发生的、不同的约定），保持分开，原样输出\n' +
    '· 不要编造原文没有的内容；原来是「珍贵」的，合并后还是「珍贵」\n' +
    '每条一行，格式：组号｜日期｜类型｜内容（日期写 YYYY-MM-DD，取这件事最早的日期；类型只能是「长期」或「珍贵」；内容用第三人称，不超过 160 字）。每一组都要输出，只输出这些行。';
  var chain = Promise.resolve();
  batches.forEach(function(batch) {
    chain = chain.then(function() {
      var user = batch.map(function(g, gi) {
        return '【第' + (gi + 1) + '组】\n' + g.map(function(m) {
          return '· ' + arcDateOf(m.time) + '｜' + (m.type === 'precious' ? '珍贵' : '长期') + '｜' + m.text;
        }).join('\n');
      }).join('\n\n');
      return llmRequest([{ role: 'system', content: sys }, { role: 'user', content: user }], { stream: false, cfg: getApiCfg(char), temperature: 0.2 }).then(function(text) {
        var out = {};
        String(text || '').split(/\r?\n/).forEach(function(l) {
          var m = l.replace(/^\s*[-·•*]\s*/, '').match(/^(?:第)?(\d+)(?:组)?\s*[｜|]\s*(.+)$/);
          if (!m) return;
          var p = arcParseMems(m[2]);
          if (p.length) (out[m[1]] = out[m[1]] || []).push(p[0]);
        });
        batch.forEach(function(g, gi) {
          var got = out[gi + 1];
          if (!got || !got.length || got.length >= g.length) return;   // 没合并或者没写，原样留着
          var first = g.reduce(function(a, b) { return a.time < b.time ? a : b; });
          // 原来有珍贵的：合并后至少留一条珍贵（模型没标的话，给第一条）
          if (g.some(function(m) { return m.type === 'precious'; }) && !got.some(function(x) { return x.type === 'precious'; })) got[0].type = 'precious';
          var list = memStore[char.id] || [];
          memStore[char.id] = list.filter(function(m) { return g.indexOf(m) < 0; });
          got.forEach(function(x, xi) {
            var nm = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + xi, type: x.type === 'precious' ? 'precious' : 'long',
              text: x.text.slice(0, 300), time: x.time || first.time, source: 'import', from: first.from };
            if (first.scene) nm.scene = first.scene;
            memStore[char.id].push(nm);
          });
          merged += g.length - got.length;
        });
        saveMemStore();
      });
    });
  });
  return chain.then(function() { delete arcDedupBusy[char.id]; return merged; },
                    function(e) { delete arcDedupBusy[char.id]; if (merged) saveMemStore(); throw e; });
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
    info.textContent = '来自 ' + a.from + ' · ' + a.msgs.length + ' 条 · ' + arcRange(a);
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
    st.textContent = a.mem.done ? '已整理成记忆，记下 ' + a.mem.count + ' 条' + (a.mem.merged ? '，合并了 ' + a.mem.merged + ' 条重复的' : '')
      : running && a.mem.dedup ? '快好了，正在合并重复的记忆…'
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
  pickFile('.json,.jsonl,.txt,.md,.csv,.docx,application/json,text/plain,text/csv,text/markdown', function(file) {
    var read = /\.docx$/i.test(file.name)
      ? file.arrayBuffer().then(function(b) { return readDocxText(b); })
      : file.text();
    read.then(function(t) {
      var parsed = arcParse(t, file.name, char);
      if (!parsed.msgs.length) throw new Error('里面没有聊天内容');
      parsed.msgs.sort(function(a, b) { return (a.time || 0) - (b.time || 0); });
      // 之前导入过的消息（时间和内容都一样）跳过，只留新的
      var seen = arcSeenKeys(char.id), all = parsed.msgs.length;
      parsed.msgs = parsed.msgs.filter(function(m) { return !(m.time && seen[arcMsgKey(m)]); });
      parsed.skipped = all - parsed.msgs.length;
      if (!parsed.msgs.length) { showToast('这些记录之前都导入过了', 'plain'); return; }
      arcPending = { char: char, parsed: parsed, file: file.name, mode: 'import' };
      openArcPreview();
    }).catch(function(err) {
      showToast('✗ 读不出来：' + ((err && err.message) || '格式不认识'), 'error');
    });
  });
});
function arcMsgKey(m) { return m.time + '|' + String(m.t).slice(0, 40); }
function arcSeenKeys(charId) {
  var k = {};
  arcListOf(charId).forEach(function(a) { a.msgs.forEach(function(m) { if (m.time) k[arcMsgKey(m)] = 1; }); });
  return k;
}
function arcSampleLine(m, n) {
  var who = m.r === 'user' ? n.u : m.r === 'char' ? n.c : m.r === 'status' ? n.c + '的状态栏' : '系统';
  var t = m.t.replace(/\s+/g, ' ');
  return who + '：' + (t.length > 60 ? t.slice(0, 60) + '…' : t);
}
function openArcPreview() {
  var p = arcPending;
  document.getElementById('arcPrevFrom').value = p.parsed.from || p.file.replace(/\.[^.]+$/, '').slice(0, 16);
  document.getElementById('arcPrevMem').checked = true;
  document.getElementById('arcPrevStatus').checked = true;
  document.getElementById('arcPrevCareful').checked = false;
  document.getElementById('arcPrevFromRow').style.display = '';
  document.getElementById('arcPrevMemRow').style.display = '';
  document.getElementById('arcPrevTitle').textContent = '导入预览';
  document.getElementById('arcPrevOk').textContent = '导入';
  arcPrevRender();
  arcPrevOverlay.classList.add('open');
}
function arcPrevRender() {
  var p = arcPending, n = arcNames(p.char), msgs = p.parsed.msgs, s = arcStats(msgs);
  var lines = ['共 ' + msgs.length + ' 条：' + n.u + ' ' + s.user + ' 条 · ' + n.c + ' ' + s.char + ' 条' +
    (s.status ? ' · 状态栏 ' + s.status + ' 条' : '') + (s.sys ? ' · 系统 ' + s.sys + ' 条' : '')];
  var kinds = Object.keys(s.kinds).map(function(k) { return (ARC_KIND_LABEL[k] || k) + ' ' + s.kinds[k]; });
  if (kinds.length) lines.push('其中：' + kinds.join(' · '));
  lines.push('时间：' + (s.first ? arcDay(s.first) + ' – ' + arcDay(s.last) : '文件里没有时间'));
  var unk = Object.keys(p.parsed.unknown);
  if (unk.length) lines.push('认不出的内容：' + unk.map(function(k) { return k + ' ' + p.parsed.unknown[k] + ' 条'; }).join('、') + '（会显示成 [' + unk[0] + '] 这样）');
  if (p.parsed.skipped) lines.push('另外有 ' + p.parsed.skipped + ' 条之前导入过，这次跳过');
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
  arcPrevWho(n);
  document.getElementById('arcPrevStatusRow').style.display = s.status ? '' : 'none';
  arcPrevUpdate();
}
// 原文里有名字时：列出每个名字，粉色的算 TA 说的，点一下切换（认错了可以改过来）
function arcPrevWho(n) {
  var box = document.getElementById('arcPrevWho'), msgs = arcPending.parsed.msgs, whos = {};
  box.innerHTML = '';
  msgs.forEach(function(m) {
    if (!m.who || (m.r !== 'user' && m.r !== 'char')) return;
    var w = whos[m.who] = whos[m.who] || { n: 0, c: 0 };
    w.n++;
    if (m.r === 'char') w.c++;
  });
  var keys = Object.keys(whos).sort(function(a, b) { return whos[b].n - whos[a].n; }).slice(0, 12);
  box.style.display = keys.length ? '' : 'none';
  if (!keys.length) return;
  var hint = document.createElement('div');
  hint.className = 'auto-hint';
  hint.textContent = '粉色的名字算「' + n.c + '」说的，其他算「' + n.u + '」说的；认错了点一下改';
  box.appendChild(hint);
  var row = document.createElement('div');
  row.className = 'feed-visible-list';
  keys.forEach(function(k) {
    var isChar = whos[k].c * 2 > whos[k].n;
    var chip = document.createElement('span');
    chip.className = 'feed-visible-chip' + (isChar ? ' on' : '');
    chip.textContent = k + ' ' + whos[k].n;
    chip.addEventListener('click', function() {
      msgs.forEach(function(m) { if (m.who === k && (m.r === 'user' || m.r === 'char')) m.r = isChar ? 'user' : 'char'; });
      arcPrevRender();
    });
    row.appendChild(chip);
  });
  box.appendChild(row);
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
  document.getElementById('arcPrevInfo').textContent = '来自 ' + arc.from + ' · ' + arc.msgs.length + ' 条 · ' + arcRange(arc);
  document.getElementById('arcPrevSamples').innerHTML = '';
  document.getElementById('arcPrevWho').style.display = 'none';
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
    var from = document.getElementById('arcPrevFrom').value.trim().replace(/^来自\s*/, '') || '其他小手机';
    arc = { id: 'arc' + Date.now().toString(36), from: from.slice(0, 16), file: p.file, importTime: Date.now(), msgs: p.parsed.msgs, mem: memCfg };
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
  document.getElementById('arcViewTitle').textContent = '来自 ' + arc.from + ' · ' + arc.msgs.length + ' 条';
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
    meta.textContent = (m.d ? '剧情 · ' : '') + (m.r === 'user' ? n.u : m.r === 'char' ? n.c : m.r === 'status' ? '状态栏' : '系统') +
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
