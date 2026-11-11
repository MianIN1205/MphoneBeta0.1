// 眠花糖机 — 群聊：几个角色和你在一个群里。群也放在 charList 里（isGroup: true, members: [角色 id]），
// 聊天室、记录、未读、通知、重新生成都直接用原来的；角色专属的功能（动态、星星、日记、记忆库、通讯录…）都跳过群（搜 isGroup）。
// 回复：一次请求写全群（用户定的），每行「名字：内容」，小手机拆成一条条、记在 m.speaker 上（js/chat/reply.js 的 sendMsg 接这里）
// groupCfg = { knows: { 角色id: false }（私聊时知不知道群里聊了什么，默认知道）, autoOn（没人说话时自己热闹）, autoGapH }

function isGroupChar(c) { return !!(c && c.isGroup); }
function groupLabel(c) { return c.charAlias || c.charName || (c.builtinAssistant && typeof MIANIN_NAME !== 'undefined' ? MIANIN_NAME : '角色'); }
// 群昵称（参考别的小手机，用户同意的）：同一个角色在这个群里叫什么；没改过就是平时的名字
function groupNick(g, c) { return (g && g.groupCfg && g.groupCfg.nicks && g.groupCfg.nicks[c.id]) || groupLabel(c); }
function groupMembers(g) {
  return (g.members || []).map(function(id) { return charList[findCharIdx(id)]; }).filter(function(c) { return c && !c.isGroup; });
}
function groupCfgOf(g) { return Object.assign({ knows: {}, autoOn: false, autoGapH: 1 }, g.groupCfg || {}); }
function groupsOf(char) { return charList.filter(function(g) { return g.isGroup && (g.members || []).indexOf(char.id) >= 0; }); }

// ---------- 头像：没换图片时用成员头像拼一个（最多 4 个） ----------
var _paintCharAvatarOne = paintCharAvatar;
paintCharAvatar = function(el, char) {
  var old = el.querySelector(':scope > .grp-av-grid');
  if (old) old.remove();
  el.classList.remove('grp-avatar');
  if (!char || !char.isGroup || char.charAvatar) { _paintCharAvatarOne(el, char); return; }
  el.classList.add('grp-avatar', 'avatar-img');   // avatar-img：不画默认小人
  el.style.background = '';
  el.style.backgroundImage = '';
  var grid = document.createElement('div');
  grid.className = 'grp-av-grid';
  groupMembers(char).slice(0, 4).forEach(function(m) {
    var cell = document.createElement('div');
    cell.className = 'grp-av-cell';
    if (m.charAvatar) cell.style.backgroundImage = 'url(' + m.charAvatar + ')';
    else { cell.textContent = groupLabel(m).charAt(0); if (m.charAvatarColor) cell.style.background = m.charAvatarColor; }
    grid.appendChild(cell);
  });
  grid.dataset.n = grid.children.length;
  el.appendChild(grid);
};
// 列表、横幅、通知里的预览：前面带上是谁说的
var _msgPreviewTextOne = msgPreviewText;
msgPreviewText = function(m) {
  var t = _msgPreviewTextOne(m);
  if (m && m.whisperChat) return '[悄悄话]';
  if (m && m.speaker && m.role === 'assistant' && !m.recalled) {
    var c = charList[findCharIdx(m.speaker)];
    if (c) t = groupLabel(c) + '：' + t;
  }
  return t;
};

// ---------- 发给 AI 的内容 ----------
function groupNowText() {
  var d = new Date(), wk = '日一二三四五六'.charAt(d.getDay());
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + wk + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
// {{char}} 换成群里所有角色的名字
function groupFill(g, text) {
  return fillMacros(text, { charAlias: groupMembers(g).map(groupLabel).join('、'), userAccountUid: g.userAccountUid });
}
function buildGroupMsgs(g, history) {
  var members = groupMembers(g), acc = resolveCharAccount(g);
  var sys = document.getElementById('systemPromptTA') ? document.getElementById('systemPromptTA').value.trim() : '';
  var roster = members.map(function(c) {
    var persona = c.builtinAssistant && typeof MIANIN_PERSONA !== 'undefined' ? MIANIN_PERSONA : c.charPersona;
    var tags = (groupAdmins(g).indexOf(c.id) >= 0 ? '（群管理员）' : '') + (groupMuteUntil(g, c.id) ? '（正在被禁言，' + new Date(groupMuteUntil(g, c.id)).getHours() + ':' + pad(new Date(groupMuteUntil(g, c.id)).getMinutes()) + ' 以前不能发言）' : '');
    var nick = groupNick(g, c) !== groupLabel(c) ? '（群昵称：' + groupNick(g, c) + '）' : '';
    var s = '【' + groupLabel(c) + '】' + nick + tags + '\n' + (persona ? fillMacros(persona, c) : '（没有写人设）');
    if ((c.selfFacts || []).length) s += '\n聊天里补充过的设定：' + c.selfFacts.join('；');
    if (c.userNickname) s += '\nTA 对{{user}}的称呼：' + c.userNickname;
    var imp = typeof impressionFor === 'function' ? impressionFor(c.userImpressions, acc.uid) : '';
    if (imp) s += '\nTA 对{{user}}的印象：' + imp;
    return s;
  }).join('\n\n');
  var userInfo = (acc.nickname ? '名字：' + acc.nickname + '\n' : '') + (acc.persona ? '人设：\n' + acc.persona + '\n' : '');
  var names = members.map(groupLabel);
  var msgs = [{ role: 'system', content: groupFill(g, (MPHONE_FICTION_NOTE + (sys ? '\n\n' + sys : '')).trim()) }];
  msgs.push({ role: 'system', content: groupFill(g,
    '【群聊】现在是在一个微信群「' + (g.charName || '群聊') + '」里，群里有{{user}}和 ' + names.join('、') + '。' +
    '这一次你要同时扮演群里的这 ' + names.length + ' 个角色（{{user}}是真人，由真人自己说话，绝对不要替{{user}}说话，也不要写{{user}}的反应）。' +
    '每个角色按自己的人设、口吻和说话习惯来，大家彼此认识，可以互相接话、调侃、@ 对方，也都在和{{user}}聊天。' +
    '\n\n【群成员的资料】\n' + roster + (userInfo ? '\n\n【{{user}}的资料】\n' + userInfo : '')) });
  // 世界书：按「是谁的」分开放（用户问过不适合某个角色怎么办）：所有成员都关联的是大家的背景；
  // 只有部分人关联的标明只和 TA 们有关，别的角色不知道、不用。同一条只放一次
  var seen = {}, wbList = [], ruleSeen = {}, wbRuleList = [];
  [g].concat(members).forEach(function(c) {   // 群自己关联的（便捷拓展栏里选的）算大家都知道
    if (typeof getActiveWbEntries !== 'function') return;
    getActiveWbEntries(c, history, false).forEach(function(e) {
      var k = e.id || (e.name + '\n' + e.content);
      if (e.rule) { if (!ruleSeen[k]) { ruleSeen[k] = 1; wbRuleList.push('【' + e.name + '】\n' + e.content); } return; }   // 写法要求：不算背景，单独一段
      if (!seen[k]) { seen[k] = { text: '【' + e.name + '】\n' + e.content, owners: [] }; wbList.push(seen[k]); }
      if (c === g) seen[k].owners = members.slice();
      else if (seen[k].owners.indexOf(c) < 0) seen[k].owners.push(c);
    });
  });
  if (wbRuleList.length && typeof WB_RULE_WRAP !== 'undefined') msgs.push({ role: 'system', content: groupFill(g, WB_RULE_WRAP + '\n\n' + wbRuleList.join('\n\n')) });
  var wbGroups = {}, wbOrder = [];
  wbList.forEach(function(w) {
    var key = w.owners.length >= members.length ? '' : w.owners.map(groupLabel).join('、');
    if (!wbGroups[key]) { wbGroups[key] = []; wbOrder.push(key); }
    wbGroups[key].push(w.text);
  });
  wbOrder.sort(function(a, b) { return a ? (b ? 0 : 1) : -1; });
  wbOrder.forEach(function(key) {
    var head = key ? '【只和 ' + key + ' 有关的背景】下面这些是 ' + key + ' 那边的设定，只有 TA 心里清楚、只用在 TA 身上；群里其他角色不知道这些，也不要让他们用上。\n\n'
                   : '【大家都知道的背景】\n\n';
    msgs.push({ role: 'system', content: groupFill(g, WB_WRAP + '\n\n' + head + wbGroups[key].join('\n\n')) });
  });
  var notice = (g.groupCfg && g.groupCfg.notice || '').trim();
  if (notice) msgs.push({ role: 'system', content: groupFill(g, '【群公告】（置顶在群里，所有人都看过、都知道，大家照着它来）\n' + notice) });
  msgs.push({ role: 'system', content: '【现在】' + groupNowText() + '。心里有数就好，不用主动报时间。' });
  // 记录：最近的，按 token 裁掉更早的；角色的话写成「名字：内容」，同一轮连着的合在一起
  var hist = history.slice(-80), total = 0, from = hist.length;
  while (from > 0 && total < 16000) { from--; total += msgTokens(hist[from]); }
  hist = hist.slice(total >= 16000 ? from + 1 : from);
  var richFrom = Math.max(0, hist.length - 20), out = [];
  hist.forEach(function(m, i) {
    if (m.role === 'assistant') {
      var who = m.speaker ? charList[findCharIdx(m.speaker)] : null;
      var line = m.whisperChat ? msgTextForAI(m) : (who ? groupLabel(who) : names[0] || '群友') + '：' + msgTextForAI(m);
      var last = out[out.length - 1];
      if (last && last.role === 'assistant') last.content += '\n' + line; else out.push({ role: 'assistant', content: line });
    } else out.push({ role: 'user', content: msgContentForAI(m, i >= richFrom, g) });
  });
  var fileSys = typeof filesContextFor === 'function' ? filesContextFor(hist) : null;
  return msgs.concat(fileSys ? [fileSys] : [], out);
}
function groupReplyN(g) { var n = GROUP_REPLY_N[groupCfgOf(g).replyN] || GROUP_REPLY_N.mid; return n[0] + '～' + n[1]; }
function groupActionOn(g) { return !!(g.chatCfg && g.chatCfg.actionOn); }
// 悄悄话的样子（用户要的）：聊天中间居中一行小字（和拍一拍一样），点开是一个小窗口，里面是 TA 们俩的对话
function whisperNames(m) { var g = charList[openingChatCharIdx], w = m.whisperChat, n = function(id) { var c = charList[findCharIdx(id)]; return c ? groupNick(g && g.isGroup ? g : null, c) : '群友'; }; return [n(w.a), n(w.b)]; }
function renderWhisperNotice(m, list, empty) {
  if (empty) empty.style.display = 'none';
  var el = document.createElement('div');
  el.className = 'cr-recall-notice cr-pat-notice cr-whisper-notice';
  var nm = whisperNames(m);
  el.textContent = '🤫 ' + nm[0] + ' 和 ' + nm[1] + ' 说了几句悄悄话';   // 后面朝下的小箭头在 css 里
  el.addEventListener('click', function(e) { e.stopPropagation(); openWhisperChat(m); });
  el._msg = m; el._extras = [];
  list.appendChild(el);
  crStick(list);
  return el;
}
function openWhisperChat(m) {
  var w = m.whisperChat, nm = whisperNames(m);
  var ov = groupModal('<div class="mine-acc-title"></div><div class="wsp-hint">TA 们以为别人看不到</div><div class="wsp-list"></div>' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-add" data-act="ok">知道了</button></div>');
  ov.querySelector('.mine-acc-title').textContent = nm[0] + ' 和 ' + nm[1] + ' 的悄悄话';
  var box = ov.querySelector('.wsp-list');
  w.lines.forEach(function(l) {
    var row = document.createElement('div');
    row.className = 'wsp-row' + (l.who === w.b ? ' right' : '');
    var av = document.createElement('div');
    av.className = 'chat-char-card-avatar wsp-av';
    paintCharAvatar(av, charList[findCharIdx(l.who)]);
    var b = document.createElement('div');
    b.className = 'wsp-bubble';
    b.textContent = l.text;
    row.appendChild(av); row.appendChild(b);
    box.appendChild(row);
  });
  ov.querySelector('[data-act="ok"]').addEventListener('click', function() { ov.remove(); });
}
function whisperTextForAI(m) {
  var w = m.whisperChat, n = function(id) { var c = charList[findCharIdx(id)]; return c ? groupLabel(c) : '群友'; };
  return '（' + n(w.a) + '和' + n(w.b) + '私下说了悄悄话，别人看不到：' + w.lines.map(function(l) { return n(l.who) + '：' + l.text; }).join('；') + '）';
}
// 悄悄话（群设置里开）：两个成员私下说几句，用户看得到
function groupWhisperRule(g) {
  if (!groupCfgOf(g).whisper) return '';
  return '\n偶尔（很少，真有私下想说的话时）两个成员会说悄悄话（TA 们以为别人看不到，其实{{user}}看得到）：单独一行写 <悄悄话 从="说话的人" 给="听的人">内容</悄悄话>，不要每次都写。';
}
// 有管理员时才告诉 TA 们能禁言（只能禁普通成员）
function groupModRule(g) {
  var admins = groupAdmins(g).map(function(id) { return charList[findCharIdx(id)]; }).filter(Boolean).map(groupLabel);
  if (!admins.length) return '';
  return '\n群管理员（' + admins.join('、') + '）真的有必要时（有人刷屏、吵过头）可以禁言普通成员，不能禁言群主和别的管理员：在 TA 那一行里写 <禁言 对象="名字" 分钟="30"/>，解除写 <解除禁言 对象="名字"/>。很少用，开玩笑也别随便禁。';
}
function groupModTag(g, actorId, kind, attrs) {
  var who = (String(attrs).match(/对象\s*=\s*["“「]([^"”」]+)/) || [])[1];
  var target = who && groupMembers(g).filter(function(c) { return [c.charAlias, c.charName, groupLabel(c)].indexOf(who.trim()) >= 0; })[0];
  if (!target) return;
  if (kind === '禁言') groupSetMute(g, actorId, target.id, Math.min(30 * 1440, Math.max(1, parseInt((String(attrs).match(/分钟\s*=\s*["“「]?(\d+)/) || [])[1], 10) || 10)));
  else groupSetMute(g, actorId, target.id, 0);
}
function groupFormatRules(g) {
  var names = groupSpeakers(g).map(groupLabel);   // 被禁言的不能说话
  return [{ role: 'system', content: groupFill(g,
    '【群聊回复格式】接着群里的聊天往下说：不是每个人每次都要开口，谁会接这个话题谁就说，一共 ' + groupReplyN(g) + ' 条，像真的群聊一样有来有回、有人插话。' +
    '每条单独一行，开头写说话人的名字和冒号（名字只能是：' + names.join('、') + '），比如：\n' +
    names.slice(0, 2).map(function(n, i) { return n + '：' + (i ? '我在我在！' : '在吗。'); }).join('\n') +
    '\n' + (typeof gpTagRule === 'function' ? gpTagRule() : '') + groupModRule(g) + groupWhisperRule(g) + '\n同一个人连着说几句可以写在一行里，每句照常写标点，小手机会按句子分成气泡。像平时发微信一样说话，口语、短句；' + (groupActionOn(g) ? '想写动作、神态时用 *星号* 包起来放在那个人那一行里（会显示成灰色小字），不写旁白和括号说明' : '不写旁白、动作描写和括号说明') + '，不替{{user}}说话。') }];
}

// ---------- 成员各用自己的模型（群设置里开，参考别的小手机）：一个个人单独问一遍，后面的人看得到前面的人刚说了什么 ----------
function groupSoloOn(g) { return !!groupCfgOf(g).solo; }
function groupSoloText(g, hist, signal) {
  var who = groupSpeakers(g).slice().sort(function() { return Math.random() - 0.5; }).slice(0, 6), acc = '', lastErr = null;
  var others = groupMembers(g);
  return who.reduce(function(p, c) {
    return p.then(function() {
      if (signal && signal.aborted) throw Object.assign(new Error('已停止'), { name: 'AbortError' });
      var cfg = getApiCfg(c);
      if (!cfg.url || !cfg.key || !cfg.model) cfg = getApiCfg(g);
      cfg.cot = 'off';
      var name = groupLabel(c);
      var msgs = buildGroupMsgs(g, hist).concat(groupFormatRules(g));
      if (acc) msgs.push({ role: 'assistant', content: acc.trim() });
      msgs.push(activityAsk('这一次只写「' + name + '」一个人在群里要说的话（接着上面大家刚说的往下），每行以「' + name + '：」开头，0～3 条；按 TA 自己的性格来，觉得不用开口就只输出一个字：无。'));
      return llmRequest(msgs, { stream: false, signal: signal, cfg: cfg }).then(function(text) {
        text = typeof takeThink === 'function' ? takeThink(text).text : String(text || '');
        if (/^\s*[（(]?\s*无\s*[)）]?[。.]?\s*$/.test(text)) return;
        // 只要 TA 自己的话：没写名字的补上；写成别人说的丢掉
        text.split('\n').forEach(function(line) {
          if (!line.trim()) return;
          var m = line.match(/^\s*@?([^：:\n]{1,20}?)\s*[：:]/), other = m && others.filter(function(o) { return o !== c && [o.charAlias, o.charName, groupLabel(o), groupNick(g, o)].indexOf(m[1].trim()) >= 0; })[0];
          if (other) return;
          acc += '\n' + (m && [c.charAlias, c.charName, name, groupNick(g, c)].indexOf(m[1].trim()) >= 0 ? line : name + '：' + line.trim());
        });
      }, function(err) { if (err && err.name === 'AbortError') throw err; lastErr = err; });
    });
  }, Promise.resolve()).then(function() {
    if (!acc.trim() && lastErr) throw lastErr;
    return acc.trim();
  });
}

// ---------- 收到回复：按「名字：」拆给每个成员 ----------
function groupCommitReply(g, hist, raw, list) {
  raw = typeof takeThink === 'function' ? takeThink(raw).text : String(raw || '');
  // 投票 / 红包 / 抽奖的标签先换成占位，免得下面被当成别的标签去掉（js/chat/group-play.js）
  var plays = [], mods = [], whispers = {}, whisperOrder = [];
  if (typeof GP_TAG_RE !== 'undefined') raw = raw.replace(GP_TAG_RE, function(_, kind, attrs, body) { plays.push([kind, attrs, body]); return '\u0001P' + (plays.length - 1) + '\u0001'; });
  // 管理员禁言 / 解除禁言普通成员：<禁言 对象="名字" 分钟="30"/>、<解除禁言 对象="名字"/>，也先换成占位，谁写的就算谁动手
  raw = raw.replace(/<悄悄话([^>]*)>([\s\S]*?)<\/悄悄话>/g, function(_, attrs, body) { plays.push(['%悄悄话', attrs, body]); return '\u0001P' + (plays.length - 1) + '\u0001'; });
  raw = raw.replace(/<(禁言|解除禁言)([^>]*?)\/?>(\s*<\/\1>)?/g, function(_, kind, attrs) { plays.push(['@' + kind, attrs, '']); return '\u0001P' + (plays.length - 1) + '\u0001'; });
  raw = raw.replace(/<status>[\s\S]*?(<\/status>|$)/gi, '').replace(/<([一-鿿A-Za-z]+)[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<[一-鿿]+[^>]*\/>/g, '');
  var members = groupMembers(g), byName = {};
  members.forEach(function(c) {
    [c.charAlias, c.charName, groupLabel(c), groupNick(g, c)].concat(c.builtinAssistant && typeof MIANIN_NAME !== 'undefined' ? [MIANIN_NAME] : []).forEach(function(n) { if (n) byName[String(n).trim()] = c.id; });
  });
  var userName = resolveCharAccount(g).nickname || '';
  var segs = [], cur = null, skip = false;
  raw.split('\n').forEach(function(line) {
    var m = line.match(/^\s*[【\[]?\s*@?([^：:\]】\n]{1,20}?)\s*[\]】]?\s*[：:]\s*(.*)$/);
    var name = m && m[1].trim();
    if (m && byName[name] && groupMuteUntil(g, byName[name])) { skip = true; cur = null; return; }   // 被禁言的人说的不要
    if (m && byName[name]) { cur = { id: byName[name], text: m[2] }; segs.push(cur); skip = false; return; }
    if (m && (name === userName || name === '{{user}}' || name === '用户')) { skip = true; cur = null; return; }   // 替用户说的话不要
    if (skip || !line.trim()) return;
    if (!cur) { var sp0 = groupSpeakers(g)[0]; if (!sp0) return; cur = { id: sp0.id, text: '' }; segs.push(cur); }
    cur.text += (cur.text ? '\n' : '') + line;
  });
  var now = Date.now(), added = [];
  segs.forEach(function(s) {
    if (!s.id || !s.text.trim()) return;
    s.text.split(/\u0001P(\d+)\u0001/).forEach(function(piece, k) {
      if (k % 2) {   // 占位：这个人发起的投票 / 红包 / 抽奖
        var t = plays[+piece];
        if (t && t[0].charAt(0) === '@') { mods.push([s.id, t[0].slice(1), t[1]]); return; }
        if (t && t[0].charAt(0) === '%') {   // 悄悄话：谁说、对谁说看标签上写的
          var att = function(n) { var mm = String(t[1]).match(new RegExp(n + '\\s*=\\s*["“「]([^"”」]+)')); return mm ? byName[mm[1].trim()] : null; };
          var wf = att('从') || s.id, wt = att('给'), body = String(t[2] || '').replace(/\s+/g, ' ').trim();
          if (!wt || wt === wf || !body || groupMuteUntil(g, wf)) return;
          // 同一对人这一轮的悄悄话合成一段（谁先说谁是 a）
          var key = [wf, wt].sort().join('|');
          if (!whispers[key]) { whispers[key] = { a: wf, b: wt, lines: [] }; whisperOrder.push(key); }
          whispers[key].lines.push({ who: wf, text: body });
          return;
        }   // 管理员动手：等这轮的话都发出来再生效
        var play = t && gpFromTag(t[0], t[1], t[2], g, s.id);
        if (play) added.push({ role: 'assistant', content: '[' + GP_NAMES[play.kind] + '] ' + (play.q || play.prize || play.wish), play: play, speaker: s.id, time: now });
        return;
      }
      var text = (groupActionOn(g) ? piece : piece.replace(actionRe(), '')).replace(/[ \t]{2,}/g, ' ').trim();   // 动作描写看群设置
      if (!text) return;
      var who = members.filter(function(c) { return c.id === s.id; })[0], ps = chatSplitLines([text]);
      if (typeof stickerSplitParts === 'function') ps = stickerSplitParts(ps, who);   // 表情包：这个成员能发的变成表情包，对不上的拿掉
      ps.forEach(function(p) {
        if (p && typeof p === 'object' && p.sticker) { added.push(Object.assign({ role: 'assistant', speaker: s.id, time: now }, p)); return; }
        if (typeof p !== 'string' || !p.trim() || CHAT_MARK_RE.test(p.trim())) return;
        added.push({ role: 'assistant', content: p, speaker: s.id, time: now });
      });
    });
  });
  whisperOrder.forEach(function(k) { var w = whispers[k]; added.push({ role: 'assistant', content: '', speaker: w.a, whisperChat: w, time: now }); });
  added.forEach(function(m) { hist.push(m); if (list) renderHistMsg(m, list, null); });
  added.forEach(function(m) { if (m.play && typeof gpAfterAdd === 'function') gpAfterAdd(g, m); });
  mods.forEach(function(x) { groupModTag(g, x[0], x[1], x[2]); });
  return added;
}

// ---------- 私聊时知道群里聊了什么（每个成员能单独关掉，用户要的） ----------
function groupContextLine(char) {
  if (!char || char.isGroup) return '';
  var out = [];
  groupsOf(char).forEach(function(g) {
    if (groupCfgOf(g).knows[char.id] === false) return;
    var h = (chatHistories[g.id] || []).filter(function(m) { return !m.pat && !m.action && !m.cal && Date.now() - (m.time || 0) < 3 * 86400000 && (!m.whisperChat || m.whisperChat.a === char.id || m.whisperChat.b === char.id); }).slice(-12);   // 别人的悄悄话不知道
    if (!h.length) return;
    var userName = resolveCharAccount(g).nickname || '{{user}}';
    out.push('【群聊「' + (g.charName || '群聊') + '」】你也在这个群里（群里还有' + groupMembers(g).filter(function(c) { return c !== char; }).map(groupLabel).join('、') + '），最近群里聊了：\n' +
      h.map(function(m) {
        var who = m.role === 'user' ? userName : (m.speaker === char.id ? '你' : groupLabel(charList[findCharIdx(m.speaker)] || {}));
        return who + '：' + String(msgTextForAI(m)).replace(/\s+/g, ' ').slice(0, 80);
      }).join('\n'));
  });
  return out.slice(0, 2).join('\n');
}

// ---------- 新建群聊（消息页右上 + →「新建群聊」） ----------
function groupModal(html, cls) {
  var ov = document.createElement('div');
  ov.className = 'mine-acc-overlay open';
  ov.innerHTML = '<div class="mine-acc-modal grp-modal ' + (cls || '') + '">' + html + '</div>';
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  (document.querySelector('.phone') || document.body).appendChild(ov);
  return ov;
}
function groupMemberChips(box, picked, onChange) {
  box.innerHTML = '';
  charList.forEach(function(c) {
    if (c.isGroup) return;
    var chip = document.createElement('span');
    chip.className = 'feed-visible-chip' + (picked.indexOf(c.id) >= 0 ? ' on' : '');
    chip.textContent = groupLabel(c);
    chip.addEventListener('click', function() {
      var k = picked.indexOf(c.id);
      if (k >= 0) picked.splice(k, 1); else picked.push(c.id);
      chip.classList.toggle('on', k < 0);
      if (onChange) onChange();
    });
    box.appendChild(chip);
  });
}
function openNewGroup() {
  var picked = [];
  var ov = groupModal('<div class="mine-acc-title">新建群聊</div>' +
    '<input class="pet-edit-input" maxlength="20" placeholder="群名（不写就用大家的名字）" data-f="name">' +
    '<div class="grp-label">拉谁进群（至少两个）</div><div class="feed-visible-list grp-chips"></div>' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-act="cancel">取消</button><button class="mine-acc-btn mine-acc-btn-add" data-act="ok">建好了</button></div>');
  groupMemberChips(ov.querySelector('.grp-chips'), picked);
  ov.querySelector('[data-act="cancel"]').addEventListener('click', function() { ov.remove(); });
  ov.querySelector('[data-act="ok"]').addEventListener('click', function() {
    if (picked.length < 2) { shakeEl(ov.querySelector('.grp-chips')); showToast('至少拉两个角色进群', 'error'); return; }
    var name = ov.querySelector('[data-f="name"]').value.trim();
    var g = { id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), isGroup: true, members: picked.slice(),
              charName: name || picked.map(function(id) { return groupLabel(charList[findCharIdx(id)]); }).join('、').slice(0, 20),
              charAlias: '', inChat: true, chatTouchedAt: Date.now(), chatCfg: { quickBar: true }, groupCfg: { knows: {}, autoOn: false, autoGapH: 1 } };
    charList.push(g);
    saveCharList();
    ov.remove();
    renderChatCharList();
    var card = document.querySelector('#chatCharList .chat-char-card[data-index="' + (charList.length - 1) + '"]');
    if (card) card.click();
  });
}
msgPlusItems[1].addEventListener('click', function(e) {
  e.stopPropagation();
  msgPlusPopup.classList.remove('open');
  openNewGroup();
});

// ---------- 群设置（聊天室右上角齿轮）：整页，样子和角色设置一样（用户要的，不要小窗口） ----------
var GROUP_GAPS = [[0.5, '半小时'], [1, '1 小时'], [3, '3 小时'], [8, '大半天']];
var appGroupSetting = document.getElementById('appGroupSetting');
var grpEdit = null;   // 正在改的：{ g, picked, knows, avImg, gap }
function grpPaintAv() {
  var e = grpEdit;
  paintCharAvatar(document.getElementById('grpAvatarBox'), Object.assign({}, e.g, { charAvatar: e.avImg }));
}
function grpPaintKnows() {
  var e = grpEdit, box = document.getElementById('grpKnows');
  box.innerHTML = '';
  (e.g.members || []).forEach(function(id) {
    var c = charList[findCharIdx(id)];
    if (!c) return;
    var chip = document.createElement('span');
    chip.className = 'feed-visible-chip' + (e.knows[id] === false ? '' : ' on');
    chip.textContent = groupLabel(c);
    chip.addEventListener('click', function() { e.knows[id] = e.knows[id] === false; chip.classList.toggle('on', e.knows[id] !== false); });
    box.appendChild(chip);
  });
}
function grpPaintGap() {
  var box = document.getElementById('grpAutoGap');
  box.innerHTML = '';
  GROUP_GAPS.forEach(function(gp) {
    var b = document.createElement('button');
    b.className = 'pf-radio-btn' + (gp[0] === grpEdit.gap ? ' selected' : '');
    b.textContent = gp[1];
    b.addEventListener('click', function() { grpEdit.gap = gp[0]; grpPaintGap(); });
    box.appendChild(b);
  });
  document.getElementById('grpAutoMore').style.display = document.getElementById('grpAutoOn').checked ? '' : 'none';
}
function openGroupSetting(g) {
  var cfg = groupCfgOf(g);
  grpEdit = { g: g, picked: (g.members || []).slice(), knows: Object.assign({}, cfg.knows), avImg: g.charAvatar || '', gap: cfg.autoGapH,
              replyN: cfg.replyN || 'mid',
              bg: Object.assign({}, DEFAULT_CHAT_BG, g.chatBg || {}), bubble: Object.assign({}, DEFAULT_BUBBLE, g.bubble || {}) };
  document.getElementById('grpName').value = g.charName || '';
  document.getElementById('grpNotice').value = cfg.notice || '';
  document.getElementById('grpAutoOn').checked = !!cfg.autoOn;
  document.getElementById('grpActionOn').checked = !!(g.chatCfg && g.chatCfg.actionOn);
  document.getElementById('grpQuickBar').checked = !!(g.chatCfg && g.chatCfg.quickBar);
  document.getElementById('grpWhisper').checked = !!cfg.whisper;
  document.getElementById('grpSolo').checked = !!cfg.solo;
  document.getElementById('grpShowAv').checked = !(g.look && g.look.showAvatar === false);
  document.getElementById('grpCss').value = g.customCss || '';
  document.getElementById('grpOpacity').value = grpEdit.bubble.opacity;
  grpPaintMembers(); grpPaintKnows(); grpPaintAv(); grpPaintGap(); grpPaintBasic(); grpPaintLook();
  grpGoPage(0, false);
  appGroupSetting.querySelector('.settings-content').scrollTop = 0;
  appGroupSetting.classList.add('active');
}
// 一排小选项（选一个）
function grpOptRow(box, opts, cur, onPick) {
  box.innerHTML = '';
  opts.forEach(function(o) {
    var b = document.createElement('button');
    b.className = 'pf-radio-btn' + (o[0] === cur ? ' selected' : '');
    b.textContent = o[1];
    b.addEventListener('click', function() { onPick(o[0]); });
    box.appendChild(b);
  });
}
var GROUP_REPLY_N = { few: [2, 4, '少一点'], mid: [3, 6, '适中'], many: [5, 10, '热闹'] };
function grpPaintBasic() {
  var e = grpEdit;
  grpOptRow(document.getElementById('grpReplyN'), Object.keys(GROUP_REPLY_N).map(function(k) { var n = GROUP_REPLY_N[k]; return [k, n[2] + '（' + n[0] + '～' + n[1] + '）']; }), e.replyN, function(v) { e.replyN = v; grpPaintBasic(); });
}
var GROUP_BG_COLORS = ['#FFF0F5', '#F3F0FF', '#EEF5FF', '#F2FAF5', '#FFFFFF', '#F2F2F2'];
function grpPaintLook() {
  var e = grpEdit;
  var prev = document.getElementById('grpBgPrev');
  prev.style.background = e.bg.image ? 'url(' + e.bg.image + ') center / cover' : (e.bg.color || DEFAULT_CHAT_BG.color);
  var colors = document.getElementById('grpBgColors');
  colors.innerHTML = '';
  GROUP_BG_COLORS.forEach(function(c) {
    var d = document.createElement('span');
    d.className = 'grp-dot' + (!e.bg.image && e.bg.color === c ? ' on' : '');
    d.style.background = c;
    d.addEventListener('click', function() { e.bg = { color: c, image: '' }; grpPaintLook(); });
    colors.appendChild(d);
  });
  var bc = document.getElementById('grpBubbleColors');
  bc.innerHTML = '';
  BUBBLE_PRESETS.forEach(function(pair, i) {
    var d = document.createElement('span');
    d.className = 'grp-pair' + (e.bubble.preset === i ? ' on' : '');
    d.innerHTML = '<i></i><i></i>';
    d.children[0].style.background = pair[0]; d.children[1].style.background = pair[1];
    d.addEventListener('click', function() { e.bubble.preset = i; grpPaintLook(); });
    bc.appendChild(d);
  });
  grpOptRow(document.getElementById('grpBubbleTpl'), BUBBLE_TPLS.filter(function(t) { return t.id === 'plain' || (t.chat && !/^siya/.test(t.id)); })   /* 群里不放仿siya（用户要的） */.map(function(t) { return [t.id, t.name]; }), e.bubble.tpl || 'plain', function(v) { e.bubble.tpl = v; grpPaintLook(); });
  document.getElementById('grpOpacityVal').textContent = e.bubble.opacity + '%';
}
document.getElementById('grpOpacity').addEventListener('input', function() { if (grpEdit) { grpEdit.bubble.opacity = parseInt(this.value, 10); grpPaintLook(); } });
document.getElementById('grpBgImg').addEventListener('click', function() {
  if (!grpEdit) return;
  openImgPicker(function(src) { grpEdit.bg = { color: grpEdit.bg.color, image: src }; grpPaintLook(); },
    { onReset: function() { grpEdit.bg = Object.assign({}, DEFAULT_CHAT_BG); grpPaintLook(); } });
});
// ---------- 三页：群资料 / 聊天 / 美化（和角色设置一样，点标签或左右滑） ----------
var grpPages = document.getElementById('grpPages'), grpSlider = document.getElementById('grpToggleSlider');
function grpSetTab(pos, animate) {
  document.querySelectorAll('#grpTabs .cs-tab').forEach(function(t) { t.classList.toggle('active', +t.dataset.page === Math.round(pos)); });
  var w = (document.querySelector('#grpTabs .cs-tab') || {}).offsetWidth || 52;
  grpSlider.style.transition = animate ? 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
  grpSlider.style.transform = 'translateX(' + (pos * w) + 'px)';
}
function grpGoPage(i, smooth) {
  if (smooth === false) { grpPages.style.scrollBehavior = 'auto'; grpPages.scrollLeft = i * grpPages.clientWidth; grpPages.style.scrollBehavior = ''; }
  else grpPages.scrollTo({ left: i * grpPages.clientWidth, behavior: 'smooth' });
  grpSetTab(i, smooth !== false);
}
document.querySelectorAll('#grpTabs .cs-tab').forEach(function(t) { t.addEventListener('click', function() { grpGoPage(+this.dataset.page); }); });
grpPages.addEventListener('scroll', function() { grpSetTab(grpPages.scrollLeft / Math.max(1, grpPages.clientWidth), false); });

// ---------- 群成员：头像 + 名字一格格，最后一个 +；点或长按一个人：设管理员 / 禁言 / 踢出群聊（用户要的，马上生效） ----------
function groupAdmins(g) { return (g.groupCfg && g.groupCfg.admins) || []; }
function groupMuteUntil(g, id) { var t = g.groupCfg && g.groupCfg.mutes && g.groupCfg.mutes[id]; return t && t > Date.now() ? t : 0; }
function groupSpeakers(g) { return groupMembers(g).filter(function(c) { return !groupMuteUntil(g, c.id); }); }   // 没被禁言、能说话的
// 群里冒一行小字提示（和拍一拍一样居中），AI 也看得到
function groupNote(g, text, ai) {
  var m = { role: 'user', content: '', note: text, noteAI: '（' + (ai || text) + '）', time: Date.now() };
  var hist = chatHistories[g.id] = chatHistories[g.id] || [];
  hist.push(m);
  if (appChatRoom.classList.contains('active') && charList[openingChatCharIdx] === g && currentCrSubView !== 'contacts') renderHistMsg(m, document.getElementById('chatMsgList'), document.getElementById('chatRoomEmpty'));
  saveHistories();
}
function grpSaveCfg(g, patch) { g.groupCfg = Object.assign({}, g.groupCfg || {}, patch); saveCharList(); }
function grpPaintMembers() {
  var e = grpEdit, g = e.g, box = document.getElementById('grpMembers');
  box.innerHTML = '';
  var tile = function(av, name, tag, onTap) {
    var t = document.createElement('div');
    t.className = 'grp-mem';
    t.appendChild(av);
    var n = document.createElement('div'); n.className = 'grp-mem-name'; n.textContent = name; t.appendChild(n);
    if (tag) { var b = document.createElement('i'); b.className = 'grp-mem-tag'; b.textContent = tag; t.appendChild(b); }
    if (onTap) t.addEventListener('click', onTap);   // 点一下就是全部操作的列表（用户要的，不分点和长按）
    box.appendChild(t);
    return t;
  };
  var meAv = document.createElement('div'); meAv.className = 'chat-char-card-avatar grp-mem-av';
  var acc = resolveCharAccount(g); paintAvatar(meAv, acc && acc.avatar, '');
  tile(meAv, '我', '群主');
  groupMembers(g).forEach(function(c) {
    var av = document.createElement('div'); av.className = 'chat-char-card-avatar grp-mem-av';
    paintCharAvatar(av, c);
    var mute = groupMuteUntil(g, c.id), admin = groupAdmins(g).indexOf(c.id) >= 0;
    var t = tile(av, groupNick(g, c), mute ? '禁言中' : admin ? '管理员' : '', function() { grpMemberMenu(g, c); });
    if (mute) t.classList.add('muted');
  });
  var add = document.createElement('div'); add.className = 'grp-mem-av grp-mem-add'; add.textContent = '+';
  tile(add, '邀请', '', function() { grpInvite(g); });
}
function grpInvite(g) {
  var out = charList.filter(function(c) { return !c.isGroup && (g.members || []).indexOf(c.id) < 0; });
  if (!out.length) { showToast('角色们都在群里啦', 'plain'); return; }
  var picked = [];
  var ov = groupModal('<div class="mine-acc-title">邀请进群</div><div class="feed-visible-list grp-chips"></div>' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-act="cancel">取消</button><button class="mine-acc-btn mine-acc-btn-add" data-act="ok">邀请</button></div>');
  var chips = ov.querySelector('.grp-chips');
  out.forEach(function(c) {
    var chip = document.createElement('span');
    chip.className = 'feed-visible-chip';
    chip.textContent = groupLabel(c);
    chip.addEventListener('click', function() { var k = picked.indexOf(c.id); if (k >= 0) picked.splice(k, 1); else picked.push(c.id); chip.classList.toggle('on', k < 0); });
    chips.appendChild(chip);
  });
  ov.querySelector('[data-act="cancel"]').addEventListener('click', function() { ov.remove(); });
  ov.querySelector('[data-act="ok"]').addEventListener('click', function() {
    if (!picked.length) { shakeEl(chips); return; }
    ov.remove();
    g.members = (g.members || []).concat(picked);
    saveCharList();
    var names = picked.map(function(id) { return groupLabel(charList[findCharIdx(id)]); }).join('、');
    groupNote(g, '你邀请「' + names + '」加入了群聊', '{{user}}邀请' + names + '加入了群聊');
    grpAfterMemberChange(g);
  });
}
// 禁言多久：自己填数字 + 选单位，下面几个常用的点一下填好
var GROUP_MUTE_UNITS = [[1, '分钟'], [60, '小时'], [1440, '天']];
function groupMuteLeft(until) { return durText(Math.max(60000, until - Date.now())); }
function grpMuteTime(g, c) {
  var unit = 1;
  var ov = groupModal('<div class="mine-acc-title"></div>' +
    '<div class="grp-mute-row"><input class="pet-edit-input" type="number" min="1" step="1" value="10" data-f="n"><div class="grp-opts" data-f="unit"></div></div>' +
    '<div class="grp-opts" data-f="quick"></div>' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-act="cancel">取消</button><button class="mine-acc-btn mine-acc-btn-add" data-act="ok">禁言</button></div>');
  ov.querySelector('.mine-acc-title').textContent = '禁言「' + groupLabel(c) + '」多久';
  var nIn = ov.querySelector('[data-f="n"]');
  var paint = function() { grpOptRow(ov.querySelector('[data-f="unit"]'), GROUP_MUTE_UNITS, unit, function(v) { unit = v; paint(); }); };
  paint();
  grpOptRow(ov.querySelector('[data-f="quick"]'), [[10, '10 分钟'], [60, '1 小时'], [720, '12 小时'], [1440, '1 天']], -1, function(v) {
    unit = v >= 1440 ? 1440 : v >= 60 ? 60 : 1; nIn.value = v / unit; paint();
  });
  ov.querySelector('[data-act="cancel"]').addEventListener('click', function() { ov.remove(); });
  ov.querySelector('[data-act="ok"]').addEventListener('click', function() {
    var min = Math.round(parseFloat(nIn.value) * unit);
    if (!(min >= 1) || min > 30 * 1440) { shakeEl(nIn); showToast('写 1 分钟到 30 天之间', 'error'); return; }
    ov.remove();
    groupSetMute(g, null, c.id, min);
  });
}
// 群里的管理权限（用户要的细节）：群主（你）能禁言所有人；管理员只能禁言 / 解除普通成员，不能动群主和别的管理员。
// actorId 为 null 是你（群主）；是角色 id 时就是那位管理员在群里动手（回复里的 <禁言> 标签）
function groupCanMute(g, actorId, targetId) {
  if (!actorId) return true;
  var admins = groupAdmins(g);
  return admins.indexOf(actorId) >= 0 && admins.indexOf(targetId) < 0 && targetId !== actorId && (g.members || []).indexOf(targetId) >= 0;
}
function groupSetMute(g, actorId, targetId, minutes) {
  if (!groupCanMute(g, actorId, targetId)) return false;
  var who = actorId ? '「' + groupLabel(charList[findCharIdx(actorId)] || {}) + '」' : '你', whoAI = actorId ? groupLabel(charList[findCharIdx(actorId)] || {}) : '{{user}}';
  var name = groupLabel(charList[findCharIdx(targetId)] || {});
  var mutes = Object.assign({}, (g.groupCfg && g.groupCfg.mutes) || {});
  if (minutes > 0) {
    mutes[targetId] = Date.now() + minutes * 60000;
    var len = durText(minutes * 60000);
    groupNote(g, who + '把「' + name + '」禁言了 ' + len, whoAI + '把' + name + '禁言了' + len + '，这段时间' + name + '不能在群里发言');
  } else {
    if (!mutes[targetId]) return false;
    delete mutes[targetId];
    groupNote(g, who + '解除了「' + name + '」的禁言', whoAI + '解除了' + name + '的禁言，' + name + '现在可以说话了');
  }
  grpSaveCfg(g, { mutes: mutes });
  grpAfterMemberChange(g);
  return true;
}
function grpMemberMenu(g, c) {
  var name = groupLabel(c), admin = groupAdmins(g).indexOf(c.id) >= 0, mute = groupMuteUntil(g, c.id);
  var ov = groupModal('<div class="mine-acc-title"></div><div class="grp-menu"></div>' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-act="cancel">取消</button></div>');
  ov.querySelector('.mine-acc-title').textContent = name;
  var menu = ov.querySelector('.grp-menu');
  var item = function(text, fn, danger) {
    var b = document.createElement('button');
    b.className = 'grp-menu-item' + (danger ? ' danger' : '');
    b.textContent = text;
    b.addEventListener('click', function() { ov.remove(); fn(); });
    menu.appendChild(b);
  };
  item('去私聊', function() {
    closeGroupSetting();
    if (typeof openFromNotification === 'function') openFromNotification({ open: 'chat', charId: c.id });
  });
  item(admin ? '取消管理员' : '设为管理员', function() {
    var list = groupAdmins(g).filter(function(id) { return id !== c.id; });
    if (!admin) list.push(c.id);
    grpSaveCfg(g, { admins: list });
    groupNote(g, admin ? '你取消了「' + name + '」的管理员' : '你把「' + name + '」设为了管理员', admin ? '{{user}}取消了' + name + '的群管理员' : '{{user}}把' + name + '设为了群管理员');
    grpAfterMemberChange(g);
  });
  // 一个「禁言」按钮，时间自己定；只有正在被禁言的人才显示「解除禁言」（用户要的）。你是群主，谁都能禁
  if (mute) item('解除禁言（还剩 ' + groupMuteLeft(mute) + '）', function() { groupSetMute(g, null, c.id, 0); });
  else item('禁言', function() { grpMuteTime(g, c); });
  item('改群昵称', function() {
    var ov2 = groupModal('<div class="mine-acc-title"></div><input class="pet-edit-input" maxlength="12" placeholder="空着就用平时的名字">' +
      '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-act="cancel">取消</button><button class="mine-acc-btn mine-acc-btn-add" data-act="ok">好了</button></div>');
    ov2.querySelector('.mine-acc-title').textContent = '「' + name + '」在群里叫什么';
    var inp = ov2.querySelector('input');
    inp.value = (g.groupCfg && g.groupCfg.nicks && g.groupCfg.nicks[c.id]) || '';
    ov2.querySelector('[data-act="cancel"]').addEventListener('click', function() { ov2.remove(); });
    ov2.querySelector('[data-act="ok"]').addEventListener('click', function() {
      var v = inp.value.trim().slice(0, 12), nicks = Object.assign({}, (g.groupCfg && g.groupCfg.nicks) || {});
      if (v && v !== name) nicks[c.id] = v; else delete nicks[c.id];
      ov2.remove();
      grpSaveCfg(g, { nicks: nicks });
      groupNote(g, '「' + name + '」的群昵称改成了「' + groupNick(g, c) + '」', '{{user}}把' + name + '的群昵称改成了' + groupNick(g, c));
      grpAfterMemberChange(g);
    });
    setTimeout(function() { inp.focus(); }, 50);
  });
  item('踢出群聊', function() {
    if ((g.members || []).length <= 2) { showToast('群里至少要留两个角色', 'error'); return; }
    openConfirm('把「' + name + '」踢出群聊？', function() {
      g.members = (g.members || []).filter(function(id) { return id !== c.id; });
      var cfg = g.groupCfg || {};
      grpSaveCfg(g, { admins: (cfg.admins || []).filter(function(id) { return id !== c.id; }) });
      groupNote(g, '你把「' + name + '」移出了群聊', '{{user}}把' + name + '移出了群聊，' + name + '已经不在群里了');
      grpAfterMemberChange(g);
    }, { okText: '踢出' });
  }, true);
  ov.querySelector('[data-act="cancel"]').addEventListener('click', function() { ov.remove(); });
}
function grpAfterMemberChange(g) {
  if (grpEdit && grpEdit.g === g) { grpPaintMembers(); grpPaintKnows(); grpPaintAv(); }
  if (charList[openingChatCharIdx] === g) { chatRoomTitle.textContent = groupTitle(g); paintChatSubTitle(g); }
  renderChatCharList();
}
function closeGroupSetting() { appGroupSetting.classList.remove('active'); grpEdit = null; }
document.getElementById('backGroupSetting').addEventListener('click', closeGroupSetting);
document.getElementById('grpAutoOn').addEventListener('change', grpPaintGap);
document.getElementById('grpAvatarBox').addEventListener('click', function() {
  if (!grpEdit) return;
  openImgPicker(function(src) { grpEdit.avImg = src; grpPaintAv(); }, { onReset: function() { grpEdit.avImg = ''; grpPaintAv(); } });
});
document.getElementById('groupSaveBtn').addEventListener('click', function() {
  var e = grpEdit;
  if (!e) return;
  var nameIn = document.getElementById('grpName');
  if (!nameIn.value.trim()) { shakeEl(nameIn); return; }
  var g = e.g;
  g.charName = nameIn.value.trim().slice(0, 20);
  g.charAvatar = e.avImg;
  Object.keys(e.knows).forEach(function(id) { if ((g.members || []).indexOf(id) < 0) delete e.knows[id]; });
  var notice = document.getElementById('grpNotice').value.trim().slice(0, 500), oldNotice = ((g.groupCfg && g.groupCfg.notice) || '').trim();
  if (notice !== oldNotice) groupNote(g, notice ? '你修改了群公告' : '你清空了群公告', notice ? '{{user}}修改了群公告，新的群公告是：' + notice : '{{user}}清空了群公告');
  g.groupCfg = Object.assign({}, g.groupCfg || {}, { whisper: document.getElementById('grpWhisper').checked, solo: document.getElementById('grpSolo').checked, notice: notice, knows: e.knows, autoOn: document.getElementById('grpAutoOn').checked, autoGapH: e.gap, replyN: e.replyN });   // 管理员、禁言是马上生效的，不覆盖
  g.chatCfg = Object.assign({}, g.chatCfg || {}, { actionOn: document.getElementById('grpActionOn').checked, quickBar: document.getElementById('grpQuickBar').checked });
  g.chatBg = e.bg;
  g.bubble = e.bubble;
  g.look = Object.assign({}, g.look || {}, { showAvatar: document.getElementById('grpShowAv').checked });
  g.customCss = document.getElementById('grpCss').value;
  saveCharList();
  closeGroupSetting();
  if (charList[openingChatCharIdx] === g) { chatRoomTitle.textContent = groupTitle(g); applyChatRoomStyle(g); renderRoomLists(openingChatCharIdx); }
  renderChatCharList();
  showToast('✓ 群设置已保存', 'success');
});
document.getElementById('grpClear').addEventListener('click', function() {
  var g = grpEdit && grpEdit.g;
  if (!g) return;
  openConfirm('清空群里的聊天记录？', function() {
    chatHistories[g.id] = [];
    saveHistories();
    if (charList[openingChatCharIdx] === g) renderRoomLists(openingChatCharIdx);
    renderChatCharList();
    showToast('已清空', 'success');
  }, { desc: '清空后找不回来' });
});
document.getElementById('grpDelete').addEventListener('click', function() {
  var g = grpEdit && grpEdit.g;
  if (!g) return;
  openConfirm('解散群聊「' + (g.charName || '') + '」？', function() {
    var i = charList.indexOf(g);
    if (i < 0) return;
    closeGroupSetting();
    if (openingChatCharIdx === i) { appChatRoom.classList.remove('active'); openingChatCharIdx = -1; }
    else if (openingChatCharIdx > i) openingChatCharIdx--;
    charList.splice(i, 1);
    delete chatHistories[g.id]; delete dramaHistories[g.id]; delete chatUnread[g.id];
    saveCharList(); saveHistories(); mphoneStore.save('mphone_unread', chatUnread);
    renderChatCharList();
    showToast('群聊已解散', 'plain');
  }, { desc: '聊天记录会一起删掉' });
});
function groupTitle(g) { return (g.charName || '群聊') + '（' + (groupMembers(g).length + 1) + '）'; }
// 聊天室齿轮：群打开群设置（抢在角色设置前面）
chatRoomSettingsBtn.addEventListener('click', function(e) {
  var g = charList[openingChatCharIdx];
  if (!isGroupChar(g)) return;
  e.stopImmediatePropagation();
  openGroupSetting(g);
}, true);

// ---------- 主动消息：有人遇到想和大家分享、讨论的事时在群里说（用户要的条件；群设置里开，默认关） ----------
// 群里安静够久了才问一次：结合成员们今天的生活（js/char/life.js 的 TA 的今天），有想分享的就说，没有就回「无」、不打扰
function groupAutoTick() {
  if (document.visibilityState !== 'visible') return;
  var h = new Date().getHours();
  if (h >= 1 && h < 7) return;   // 半夜不吵
  charList.forEach(function(g) {
    if (!g.isGroup) return;
    var cfg = groupCfgOf(g);
    if (!cfg.autoOn || groupMembers(g).length < 2 || genBusyChar(g)) return;
    if (appChatRoom.classList.contains('active') && charList[openingChatCharIdx] === g) return;   // 正看着就等你说
    var hist = chatHistories[g.id] || [], last = hist.length ? hist[hist.length - 1].time || 0 : (g.chatTouchedAt || 0);
    var gapMs = cfg.autoGapH * 3600000;
    if (Date.now() - last < gapMs || Date.now() - (g._autoTried || 0) < Math.max(30 * 60000, gapMs)) return;   // 问过没事的，再等一个间隔
    g._autoTried = Date.now();
    groupAutoTalk(g);
  });
}
function groupAutoTalk(g) {
  var cfg = getApiCfg(g);
  if (!cfg.url || !cfg.key || !cfg.model) return;
  var hist = chatHistories[g.id] = chatHistories[g.id] || [];
  var ctrl = new AbortController(), key = genKey(g, true);
  genStates[key] = { ctrl: ctrl, char: g, typing: null, previews: function() { return []; }, auto: true };
  syncGenBtn();
  var quiet = hist.length ? durText(Date.now() - (hist[hist.length - 1].time || Date.now())) : '';
  var ask = activityAsk((groupTodayText(g) ? groupTodayText(g) + '\n' : '') +
    '群里' + (quiet ? '已经安静了 ' + quiet : '还没人说过话') + '。看看群里有没有谁遇到了想和这几个人分享、讨论的事（今天生活里发生的、看到想到的、和之前群里聊过的有关的，或者想问问大家意见的）。' +
    '有的话就由 TA 在群里说起，别人自然地接几句，一共 2～6 条，用上面的格式写，不要重复之前聊过的；只是为了说话而说话、没有真想分享的事，就只输出一个字：无');
  cfg.cot = 'off';
  llmRequest(buildGroupMsgs(g, hist).concat(groupFormatRules(g), [ask]), { stream: false, signal: ctrl.signal, cfg: cfg }).then(function(text) {
    var st = genStates[key];
    if (st && st.typing) st.typing.row.remove();
    delete genStates[key];
    syncGenBtn();
    if (/^\s*[（(]?\s*无\s*[)）]?[。.]?\s*$/.test(String(text || ''))) return;   // 没什么想分享的，不打扰
    var showing = appChatRoom.classList.contains('active') && charList[openingChatCharIdx] === g && currentCrSubView !== 'contacts';
    var list = showing ? document.getElementById('chatMsgList') : null, mark = list ? list.lastChild : null;
    var added = groupCommitReply(g, hist, text, list);
    if (list && added.length > 1) crRevealOneByOne(list, mark, 0);
    if (!showing && added.length) {
      chatUnread[g.id] = (chatUnread[g.id] || 0) + added.length;
      mphoneStore.save('mphone_unread', chatUnread);
      if (typeof showInAppNotice === 'function') showInAppNotice(g, added);
      if (typeof notifyNewMessages === 'function') notifyNewMessages(g, added);
    }
    saveHistories();
    renderChatCharList();
  }).catch(function() {
    var st = genStates[key];
    if (st && st.typing) st.typing.row.remove();
    delete genStates[key];
    syncGenBtn();
  });
}
setInterval(groupAutoTick, 5 * 60000);
// 成员们今天已经发生的事（TA 的今天，只给主动消息看）
function groupTodayText(g) {
  if (typeof lifeDays === 'undefined' || typeof lifeDayKey !== 'function') return '';
  var hm = typeof lifeHm === 'function' ? lifeHm(Date.now()) : '99:99';
  var lines = groupMembers(g).map(function(c) {
    var d = lifeDays[c.id];
    if (!d || d.date !== lifeDayKey()) return '';
    var done = (d.items || []).filter(function(it) { return String(it.time) <= hm; }).map(function(it) { return it.time + ' ' + it.text; });
    return done.length ? groupLabel(c) + '：' + done.join('；') : '';
  }).filter(Boolean);
  return lines.length ? '【大家今天的生活】（每个人自己的事，别人不一定知道）\n' + lines.join('\n') : '';
}

// 这个脚本加载前消息列表已经画过一次：重画一遍，群的拼图头像、预览里的名字才出来
renderChatCharList();
