// 眠花糖机 — 收到回复：拆成多条（|||、撤回、表情包、日程）、发送和生成中的 ⏹、重新生成

// 取出 <status>…</status>。角色有时忘了写结尾：遇到 |||、别的标记或者到结尾，就算状态结束
var STATUS_RE = /<status>([\s\S]*?)(?:<\/status>|(?=\|\|\||<\/?(?:签名|拍一拍|前情|记忆|日程|提醒|闹钟|撤回)[\s>\/])|$)/i;
function takeStatus(text) {
  var status = '';
  text = String(text || '').replace(STATUS_RE, function(_, s) { status = s.trim(); return ''; });
  return { text: text.replace(/\s+$/, ''), status: status };
}

// 把角色的一次原始回复拆成多条消息（||| 分隔）并取出 <status>，写入记录并显示
function commitAssistantReply(hist, raw, list, empty) {
  var status = '', headStatus = '', recap = '', patBack = false;
  var th = takeThink(raw);   // 思维链：摘出来存在第一条上，不显示成气泡（见 js/chat/prompt.js）
  raw = th.text;
  var st = takeStatus(raw);
  raw = st.text; status = st.status;
  // 状态栏：角色照规则写，用正则认出来（只在聊天窗口）
  var sc = charOfHistory(hist), sLook = sc && chatHistories[sc.id] === hist ? Object.assign({}, DEFAULT_LOOK, sc.look || {}) : null;
  var sSpec = sLook && sLook.statusOn ? statusSpec(sLook) : null;
  if (sSpec && typeof statusRegexTake === 'function') {
    var rt = statusRegexTake(sSpec, status || raw);
    if (rt.status) { if (!status) raw = rt.text; status = rt.status; }
  }
  raw = raw.replace(/<签名>([\s\S]*?)<\/签名>/g, function(_, s) { headStatus = s.replace(/\s+/g, ' ').trim().slice(0, 20); return ''; });
  var charBio = '';
  raw = raw.replace(/<个性签名>([\s\S]*?)(<\/个性签名>|$)/g, function(_, s) { charBio = s.replace(/\s+/g, ' ').trim().slice(0, 30); return ''; });
  raw = raw.replace(/<拍一拍\s*\/?>(\s*<\/拍一拍>)?/g, function() { patBack = true; return ''; });
  // 剧情回复里藏着的前情：记在这一轮最后一条消息上，不显示
  raw = raw.replace(/<前情>([\s\S]*?)<\/前情>/g, function(_, s) { recap = s.replace(/\s+/g, ' ').trim().slice(0, 80); return ''; });
  // 内置助手的操作块（添加世界书、改样式…）单独成为确认卡片
  var actions = [];
  if (typeof extractAssistantActions === 'function') raw = extractAssistantActions(hist, raw, actions);
  // 角色悄悄记下的记忆：存进记忆库，不显示
  if (typeof memExtractTags === 'function') {
    var hc = charOfHistory(hist);
    raw = memExtractTags(hc, raw, hc && dramaHistories[hc.id] === hist ? 'drama' : 'chat');
  }
  // 聊天窗口关了动描：新回复里 *星号* 包住的动作描写直接去掉（已经存下的消息不动）
  var rc = charOfHistory(hist);
  if (rc && headStatus && chatHistories[rc.id] === hist) {
    if (rc.headStatus !== headStatus) rc.headStatusAt = Date.now();   // 「此刻」那排圆圈用：签名换了就亮一圈（js/chat/moments.js）
    rc.headStatus = headStatus;
    saveCharList();
    if (charList[openingChatCharIdx] === rc) paintChatSubTitle(rc);
  }
  if (rc && charBio && chatHistories[rc.id] === hist && rc.charBio !== charBio) { rc.charBio = charBio; rc.charBioAt = Date.now(); saveCharList(); }
  // 聊天窗口：TA 帮忙记的提醒 / 闹钟 / 日程，记进桌面「纪念日」，后面单独成一张卡片
  var calItems = [];
  if (rc && chatHistories[rc.id] === hist && typeof extractCalTags === 'function') raw = extractCalTags(rc, raw, calItems);
  if (rc && chatHistories[rc.id] === hist && !(rc.chatCfg && rc.chatCfg.actionOn)) {
    raw = raw.replace(actionRe(), '').replace(/[ \t]{2,}/g, ' ');
  }
  // 剧情配图：<配图>这一幕的画面</配图> 拿出来，回复后面单独一条（设置里剧情配图选了生图才会写）
  var illus = '', isDramaHist = !!(rc && dramaHistories[rc.id] === hist);
  raw = raw.replace(/<配图>([\s\S]*?)(<\/配图>|$)/g, function(_, s) { illus = s.replace(/\s+/g, ' ').trim(); return ''; });
  var parts = raw.split(/\n?\s*\|\|\|\s*\n?/).map(function(p) { return p.trim(); }).filter(Boolean);
  // 聊天窗口：角色发的照片 <照片>画面</照片> 拆成单独一条（js/chat/img-use.js）
  if (rc && chatHistories[rc.id] === hist && typeof photoSplitParts === 'function') parts = photoSplitParts(parts, hist);
  // 聊天窗口：像微信那样一句一个气泡（每次回复条数设成 1 的角色除外）
  if (rc && chatHistories[rc.id] === hist && Object.assign({}, DEFAULT_CHAT_CFG, rc.chatCfg || {}).replyMax > 1 && !(typeof charBigBubble === 'function' && charBigBubble(rc))) parts = chatSplitLines(parts);   // 仿siya：一整个大气泡，不拆
  // 聊天窗口：<撤回>…</撤回> 拆成单独一条，先显示两秒再变成撤回提示
  if (rc && chatHistories[rc.id] === hist) parts = splitRecallParts(parts);
  // 聊天窗口：回复里的「[表情包：名字]」拆成单独的表情包消息（见 js/chat/stickers.js）
  if (rc && chatHistories[rc.id] === hist && typeof stickerSplitParts === 'function') parts = stickerSplitParts(parts, rc);
  if (!parts.length && status) parts = ['…'];
  var now = Date.now();
  var added = parts.map(function(p) {
    return typeof p === 'string' ? { role: 'assistant', content: p, time: now } : Object.assign({ role: 'assistant', time: now }, p);
  });
  if (added.length && status) added[added.length - 1].status = status;
  if (added.length && th.think) added[0].think = th.think;
  if (added.length && recap) added[added.length - 1].recap = recap;
  actions.forEach(function(a) { added.push({ role: 'assistant', content: '', action: a, time: now }); });
  calItems.forEach(function(c) { added.push({ role: 'assistant', content: '', cal: c, time: now }); });
  if (illus && isDramaHist && typeof imgUse === 'function' && imgUse('drama') === 'gen') added.push({ role: 'assistant', content: '[配图] ' + illus, textImg: illus, illus: true, time: now });
  var pc = charOfHistory(hist);
  if (patBack && pc && chatHistories[pc.id] === hist && pc.chatCfg && pc.chatCfg.patOn) added.push({ role: 'assistant', content: '', pat: 'user', time: now });
  added.forEach(function(m) {
    hist.push(m);
    if (list) renderHistMsg(m, list, empty);
    else delete m._flash;   // 没在看这个对话：回来时直接是撤回提示
  });
  if (status && typeof refreshStatusPanel === 'function') refreshStatusPanel();
  // 照片、配图：生图模式下排队画出来（画好前先是文字图片）
  if (typeof genPendingPhotos === 'function' && rc && imgUse(isDramaHist ? 'drama' : 'chat') === 'gen') genPendingPhotos(hist, added.filter(function(m) { return m.textImg; }));
  return added;
}

// 聊天窗口分气泡（用户要简单、精确、什么情况都适用）：一个气泡 = 一句话。
// · 句子在 。！？!?…～~ 这些句末标点处断开（引号、括号、*动作* 里面不断）；||| 也算断开
// · TA 换了行、但这一行没说完（结尾是字或逗号），就接着下一行，不会从一句话中间断开（以前「拉严 / 实点」「守着你 / 呢」，用户反馈过）
// · 一句太长（超过 CHAT_BUBBLE_SPLIT 字）才在逗号处再分；只有 *动作* 的一句跟着下一句（显示成气泡外的灰色小字）；「〔译〕」跟着上一条
// · 句号存着（这样 TA 在聊天记录里看到的是好好的句子），显示时把句尾单个「。」藏掉（render.js）
// 把 mark 后面新画出来的几条先藏起来，中间放「正在输入」，一条一条亮出来（每条跟着它的动作小字、小时间）
function crBubbleGap(t) { return 350 + Math.min(String(t || '').length * 30, 900); }   // 下一条冒出来前停多久（上一条越长停越久）
function crRevealOneByOne(list, mark, shown) {
  var els = [], el = mark ? mark.nextSibling : list.firstChild;
  for (; el; el = el.nextSibling) els.push(el);
  // 一组 = 一条消息连同它前面的动作小字（还有群里的名字、时间分隔）和后面的小字、小时间；
  // 以前前面的动作小字被分进了上一条，会先冒出来、气泡隔一会儿才跟上，看着不自然（用户说的）
  var groups = [], g = null, lead = false;
  var isLead = function(e) { return e.classList && (e.classList.contains('cr-speaker') || e.classList.contains('cr-time-sep') || (e.classList.contains('cr-action-note') && e.classList.contains('before'))); };
  els.forEach(function(e) {
    var row = e.classList && e.classList.contains('chat-msg-row');
    if (!g || (isLead(e) && !lead) || (row && !lead)) { g = []; groups.push(g); }
    lead = isLead(e);
    g.push(e);
  });
  var from = Math.max(1, shown || 0);
  if (groups.length <= from) { crStick(list); return; }
  groups.slice(from).forEach(function(gr) { gr.forEach(function(e) { e.style.display = 'none'; }); });
  crStick(list);
  var dots = appendMsg('ai', '', true, list).row, i = from;
  list.insertBefore(dots, groups[from - 1][groups[from - 1].length - 1].nextSibling);
  (function next() {
    if (i >= groups.length || !dots.parentNode) { dots.remove(); return; }
    var gr = groups[i];
    setTimeout(function() {
      gr.forEach(function(e) { e.style.display = ''; });
      list.insertBefore(dots, gr[gr.length - 1].nextSibling);
      if (list._away && typeof crPillPaint === 'function') { (list._newRows = list._newRows || []).push(gr[0]); crPillPaint(list); }
      crStick(list);
      i++;
      if (i >= groups.length) dots.remove(); else next();
    }, i === from && shown ? 300 : crBubbleGap(groups[i - 1].map(function(e) { return e.classList && e.classList.contains('chat-msg-row') ? e.textContent : ''; }).join('')));
  })();
}
function chatLineDone(s) {
  s = String(s).trim();
  if (/\*$/.test(s)) return true;   // 以 *动作* 收尾
  return !/[一-鿿A-Za-z0-9，、,；;：:（(「『“‘《【]$/.test(s);   // 以字、逗号、前括号结尾 = 这句还没说完
}
function chatSentences(seg) {
  var out = [], buf = '', depth = 0, spans = actionSpans(seg), OPEN = '「『“‘（(【《', CLOSE = '」』”’）)】》';
  for (var i = 0; i < seg.length; i++) {
    var ch = seg[i];
    buf += ch;
    if (inSpans(spans, i)) continue;   // *动作* 里面不断开
    if (OPEN.indexOf(ch) >= 0) depth++;
    else if (CLOSE.indexOf(ch) >= 0) depth = Math.max(0, depth - 1);
    var next = seg[i + 1] || '';
    if (depth === 0 && /[。！？!?…～~]/.test(ch) && !/[。！？!?…～~」』”’）)]/.test(next)) { if (buf.trim()) out.push(buf.trim()); buf = ''; }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
function chatSplitLines(parts) {
  var out = [];
  parts.forEach(function(p) {
    if (typeof p !== 'string' || msgHtmlLike(p)) { out.push(p); return; }   // 带 HTML 的整条不拆，免得拆坏
    p = p.replace(new RegExp(ACTION_SRC_ML, 'g'), function(a) { return a.replace(/\s*\n+\s*/g, ' '); });   // *动作* 中间换了行的接回一行
    var lines = p.split(/\n+/).map(function(l) { return l.trim(); }).filter(Boolean);
    // 只有 (1h)、(read)、（已读）这种记号的行不要：角色偶尔学着标时间 / 已读，小手机自己会显示隔了多久
    lines = lines.filter(function(l) { return !CHAT_MARK_RE.test(l); }).map(function(l) {
      return /\*\s*[\u4e00-\u9fff][^*]*$/.test(l.replace(actionRe(), '')) ? l + '*' : l;   // 动作只写了前半个星号（忘了收尾）的补上；颜文字里的星号不管
    });
    var hasTr = lines.some(function(l) { return /^〔译〕/.test(l); });
    // 没说完的行接上下一行
    var segs = [], buf = '';
    lines.forEach(function(l) {
      if (/^〔译〕/.test(l)) { if (buf) { segs.push(buf); buf = ''; } segs.push(l); return; }
      buf = buf ? buf + (/[A-Za-z0-9]$/.test(buf) && /^[A-Za-z0-9]/.test(l) ? ' ' : '') + l : l;
      if (hasTr || chatLineDone(buf)) { segs.push(buf); buf = ''; }   // 带翻译的照行分，不按句子切（翻译要对着原文）
    });
    if (buf) segs.push(buf);
    var pending = '';
    segs.forEach(function(seg) {
      if (/^〔译〕/.test(seg)) { if (out.length && typeof out[out.length - 1] === 'string') out[out.length - 1] += '\n' + seg; return; }
      (hasTr ? [seg] : chatSentences(seg)).forEach(function(t) {
        if (ACTION_LINE_RE.test(t)) { pending += (pending ? ' ' : '') + t; return; }
        out.push((pending ? pending + ' ' : '') + t);
        pending = '';
      });
    });
    if (pending) {
      if (out.length && typeof out[out.length - 1] === 'string') out[out.length - 1] += ' ' + pending;
      else out.push(pending);
    }
  });
  // 一句太长的，再在逗号处分开
  var res = [];
  out.forEach(function(p) { if (typeof p === 'string' && !msgHtmlLike(p)) chatSplitLong(p).forEach(function(x) { res.push(x); }); else res.push(p); });
  return res;
}
// 断句交给 TA 自己（用 ||| 分条，提示词里写清楚）；小手机只管一件事：某一条超过 CHAT_BUBBLE_SPLIT 字时，才在句号、逗号处帮忙断开（用户要简单、不堆规矩）。
// 拆的时候：先按句号、问号、感叹号断句，还长就按逗号、顿号、分号断，
// 再把太碎的小段拼回去，每条尽量不超过 CHAT_BUBBLE_MAX 字。引号、括号里面不断开；有链接、表情包、翻译的不动
var CHAT_BUBBLE_SPLIT = 30;   // 超过这么多字才帮着拆
var CHAT_BUBBLE_MAX = 20;     // 拆开后每条尽量不超过这么多字
var CHAT_MARK_RE = /^(?:[(（\[【]\s*(?:read|已读|未读|\d+\s*(?:h|hr|hrs|hours?|min|mins|m|s|d|天|小时|分钟|分|秒)(?:\s*later)?)\s*[)）\]】]\s*)+$/i;
function chatSplitLong(p) {
  var m = p.match(new RegExp('^((?:' + ACTION_SRC + '\\s*)*)([\\s\\S]*)$')), lead = m[1], body = m[2].trim();
  if (body.length <= CHAT_BUBBLE_SPLIT || !/[\u4e00-\u9fff]/.test(body) || /https?:|\[表情包|〔译〕|<\/?[a-z撤日]/i.test(body)) return [p];
  // 切成小段：在句末标点后、或者（引号外的）逗号顿号分号后断开，标点留在前一段
  var pieces = [], buf = '', depth = 0, spans = actionSpans(body);
  var OPEN = '「『“‘（(【《', CLOSE = '」』”’）)】》';
  for (var i = 0; i < body.length; i++) {
    var ch = body[i];
    buf += ch;
    if (inSpans(spans, i)) continue;   // *动作* 里面不断开
    if (OPEN.indexOf(ch) >= 0) depth++;
    else if (CLOSE.indexOf(ch) >= 0) depth = Math.max(0, depth - 1);
    var next = body[i + 1] || '';
    var endSentence = /[。！？!?～~]/.test(ch) && !/[。！？!?～~」』”’）)]/.test(next);
    var endClause = /[，、；,;]/.test(ch);
    if (depth === 0 && (endSentence || endClause)) { pieces.push({ t: buf, hard: endSentence }); buf = ''; }
  }
  if (buf.trim()) pieces.push({ t: buf, hard: true });
  // 拼回去：一句话（到句末标点）没超过上限就整句一条；超过了才在逗号处断
  var chunks = [], cur = '';
  pieces.forEach(function(pc) {
    var t = pc.t.trim();
    if (!t) return;
    if (cur && (cur + t).length > CHAT_BUBBLE_MAX) { chunks.push(cur); cur = ''; }
    cur += t;
    if (pc.hard) { chunks.push(cur); cur = ''; }
  });
  if (cur) chunks.push(cur);
  // 句尾的逗号、顿号、分号去掉；只剩一两个字的并到下一条前面
  chunks = chunks.map(function(c) { return c.replace(/[，、；,;]+$/, '').trim(); }).filter(Boolean);
  var merged = [];
  chunks.forEach(function(c) {
    var last = merged[merged.length - 1];
    if (last !== undefined && last.length <= 2 && (last + c).length <= CHAT_BUBBLE_MAX + 4) merged[merged.length - 1] = last + ' ' + c;
    else merged.push(c);
  });
  if (!merged.length) return [p];
  if (lead) merged[0] = lead.trim() + ' ' + merged[0];
  return merged;
}

// 角色回复里的 <撤回>内容</撤回>：拆成单独一条「刚发就撤回」的消息
function splitRecallParts(parts) {
  var out = [];
  parts.forEach(function(p) {
    if (typeof p !== 'string' || p.indexOf('<撤回>') < 0) { out.push(p); return; }
    var last = 0, re = /<撤回>([\s\S]*?)<\/撤回>/g, m;
    while ((m = re.exec(p))) {
      var before = p.slice(last, m.index).trim(), text = m[1].trim();
      if (before) out.push(before);
      if (text) out.push({ content: text, recalled: true, recalledBy: 'char', recalledText: text, _flash: true });
      last = re.lastIndex;
    }
    var rest = p.slice(last).replace(/<\/?撤回>/g, '').trim();
    if (rest) out.push(rest);
  });
  return out;
}

// 正在生成的回复：每个角色的聊天、剧情窗口各管各的，可以同时给不同角色（或同一个角色的聊天和剧情）请求回复（用户要的）。
// 键是「角色id:chat / drama」；❄️ / ⏹ 只看当前打开的这个窗口
var genStates = {};   // 键 → { ctrl: AbortController, char, typing, previews() }
function genKey(char, isChat) { return (char && char.id) + (isChat ? ':chat' : ':drama'); }
function genHere() {
  var c = charList[openingChatCharIdx];
  return c ? genStates[genKey(c, currentCrSubView !== 'contacts')] || null : null;
}
function genBusyChar(char) { return !!(char && (genStates[genKey(char, true)] || genStates[genKey(char, false)])); }
function syncGenBtn() {
  var b = document.querySelector('.cr-emoji-btn'), on = !!genHere();
  b.classList.toggle('generating', on);
  b.textContent = on ? '⏹' : '❄️';
  b.setAttribute('aria-label', on ? '停止生成' : '请求回复');
}
function stopGenerating() { var g = genHere(); if (g) g.ctrl.abort(); }
// 重新打开一个还在生成的窗口时，把它的「正在输入」和已经冒出来的预览气泡放回列表最下面
function genReattach() {
  var c = charList[openingChatCharIdx];
  if (c) [true, false].forEach(function(isChat) {
    var g = genStates[genKey(c, isChat)], list = document.getElementById(isChat ? 'chatMsgList' : 'dramaMsgList');
    if (!g || !list) return;
    // 主动消息生成时还没有「正在输入」：打开 TA 的聊天时才画（这时头像才是 TA 的）
    if (!g.typing) g.typing = appendMsg('ai', '', true, list);
    else if (g.typing.row.parentNode === list) return;
    g.previews().forEach(function(r) { list.appendChild(r); });
    list.appendChild(g.typing.row);
    var empty = list._empty; if (empty) empty.style.display = 'none';
    crStick(list);
  });
  syncGenBtn();
}

// onDone(added)：回复结束后调用，added 是写入记录的角色消息（失败或停止且没有内容时为空数组）
function sendMsg(userText, requestOnly, onDone) {
  var cfg = getApiCfg(charList[openingChatCharIdx]);
  if (!cfg.url || !cfg.key) { showErrNotice(new Error('请先在设置中填写 API 地址和密钥'), null, getActiveEmptyEl(), cfg); if (onDone) onDone([]); return; }
  if (!cfg.model)           { showErrNotice(new Error('请先选择模型'), null, getActiveEmptyEl(), cfg); if (onDone) onDone([]); return; }
  var hist = getActiveHistory(openingChatCharIdx);
  var replyCharIdx = openingChatCharIdx;
  var replyChar = charList[replyCharIdx];
  var isGrp = !!(replyChar && replyChar.isGroup);   // 群聊：一次写全群，按「名字：」拆给每个成员（js/chat/group.js）
  var isChatView = hist === getChatHistory(replyCharIdx);
  var gKey = genKey(replyChar, isChatView);
  if (genStates[gKey]) { showToast('正在回复中，可以先点 ⏹ 停止', 'error'); if (onDone) onDone([]); return; }
  var listId = isChatView ? 'chatMsgList' : 'dramaMsgList';
  if (!requestOnly && userText) { var um = { role: 'user', content: userText, time: Date.now() }; hist.push(um); renderHistMsg(um); saveHistories(); }
  var typing = appendMsg('ai', '', true);
  var ctrl = new AbortController();
  var aiText = '';
  genStates[gKey] = { ctrl: ctrl, char: replyChar, typing: typing, previews: function() { return previewRows; } };
  syncGenBtn();
  // 这个角色的聊天室开着（不管在看聊天还是剧情）就画进对应的列表；切去别的角色时不碰那边的列表
  function roomOpen() { return appChatRoom.classList.contains('active') && charList[openingChatCharIdx] === replyChar; }
  function scrollLive() { var L = typing.row.parentNode; if (L) crStick(L); }

  // 出错：还在这个对话里就在列表里放一行小字（点开看原因）；已经离开了就在顶部提示一下是谁回复失败。
  // 报错条记在这份记录里，回来时还在原处
  function showReplyError(err) {
    if (roomOpen()) { showErrNotice(err, document.getElementById(listId), null, cfg, hist); return; }
    errRemember(hist, err, cfg);
    showToast('「' + ((replyChar && (replyChar.charAlias || replyChar.charName)) || '角色') + '」回复失败：' + explainError(err).title, 'error');
  }

  function endGen() {
    if (genStates[gKey] && genStates[gKey].ctrl === ctrl) { delete genStates[gKey]; syncGenBtn(); }
  }
  // 打字气泡换成正式消息（可能拆成多条、带状态栏）。回复到达时如果已经离开这个对话，
  // 只写进记录并记为未读；切走又切回来时打字气泡已被重绘掉，就画到当前列表里
  function deliver(text) {
    typing.row.remove();
    var shownCount = previewRows.length;   // 已经冒出来的几条：收完以后这些直接显示，剩下的接着一条条出
    clearPreview();
    var showing = roomOpen();
    var list = showing ? document.getElementById(listId) : null;
    if (showing && typeof crMarkOtherView === 'function') crMarkOtherView(isChatView);
    if (showing && !isChatView && currentCrSubView === 'contacts' && typeof crDramaSeen === 'function') crDramaSeen(replyChar);
    if (!isGrp && typeof peekTakeLockTag === 'function') text = peekTakeLockTag(replyChar, text);   // TA 决定改手机密码
    if (!isGrp && typeof starTakeTag === 'function') text = starTakeTag(replyChar, text);   // 悄悄叠的星星放进星星瓶
    if (!isGrp && typeof lifeTakeTags === 'function') text = lifeTakeTags(replyChar, text);   // 待关心、已关心、补人设
    if (!isGrp && typeof assetTakeTags === 'function') text = assetTakeTags(replyChar, text);   // 记下持有（js/chat/assets.js）
    var mark = list ? list.lastChild : null;
    var added = isGrp ? groupCommitReply(replyChar, hist, text, list) : commitAssistantReply(hist, text, list, null);
    if (isChatView && !isGrp && added.length && typeof peekCaughtDone === 'function') peekCaughtDone(replyChar);   // 发现查手机的事已经提过了
    // 假流式（用户要的）：回复是一次性整段到的（接口不是边写边出、没冒过预览气泡），聊天窗口里也一条一条蹦出来
    if (list && isGrp && added.length > 1) crRevealOneByOne(list, mark, 0);   // 群里大家一条条说
    else if (list && isChatView && bubbleStream && typeof assistCfg !== 'undefined' && assistCfg.fakeStream && added.length > Math.max(1, shownCount)) crRevealOneByOne(list, mark, shownCount);
    else if (list) crStick(list);
    if (!showing && added.length && replyChar) {
      chatUnread[replyChar.id] = (chatUnread[replyChar.id] || 0) + added.length;
      mphoneStore.save('mphone_unread', chatUnread);
      if (typeof showInAppNotice === 'function') showInAppNotice(replyChar, added);
    }
    saveHistories();
    renderChatCharList();
    // 切到后台时弹系统通知
    if (typeof notifyNewMessages === 'function') notifyNewMessages(replyChar, added);
    return added;
  }

  // 聊天窗口边生成边出气泡：写完一行（或 |||）就先冒出一个气泡，正在写的那句只显示「正在输入」的小点
  // 这些气泡只是预览，回复完整收到后换成正式的消息（拆法和 commitAssistantReply 一样，看起来不会跳）
  var rcCfg = Object.assign({}, DEFAULT_CHAT_CFG, (replyChar && replyChar.chatCfg) || {});
  var bubbleStream = !isGrp && isChatView && rcCfg.replyMax > 1 && !(typeof charBigBubble === 'function' && charBigBubble(replyChar));   // 仿siya 不一句句冒出来
  var previewRows = [], previewParts = [], previewTimer = 0, previewAt = 0;
  function clearPreview() {
    clearTimeout(previewTimer);
    previewRows.forEach(function(r) { (r._actionNotes || []).forEach(function(x) { x.remove(); }); r.remove(); });
    previewRows = []; previewParts = [];
  }
  function previewStream(shown) {
    // 写完一句（句末标点）、一行或 ||| 就先冒出来
    var lastEnd = -1; shown.replace(/[。！？!?…～~][」』”’）)]*/g, function(m0, at) { lastEnd = at + m0.length - 1; return m0; });
    var cut = Math.max(shown.lastIndexOf('\n'), shown.lastIndexOf('|||') >= 0 ? shown.lastIndexOf('|||') + 2 : -1, lastEnd);
    if (cut < 0) return;
    var done = shown.slice(0, cut + 1);
    // 没写完的标记、表情包、撤回先不显示，等正式消息
    done = done.replace(/<撤回>[\s\S]*?(<\/撤回>|$)/g, '').replace(/\[表情包[:：][^\]\n]*\]?/g, '').replace(/<[^>\n]*$/, '');
    if (!rcCfg.actionOn) done = done.replace(actionRe(), '').replace(/[ \t]{2,}/g, ' ');
    var parts = chatSplitLines(done.split(/\n?\s*\|\|\|\s*\n?/).map(function(p) { return p.trim(); }).filter(Boolean));
    // 一行刚写完、后面的「〔译〕」或者跟着的动作还没到时，最后一条可能还会变：先不出
    if (parts.length && ACTION_LINE_RE.test(String(parts[parts.length - 1]))) parts.pop();
    var same = previewParts.every(function(p, i) { return parts[i] === p; });
    if (!same) clearPreview();
    var list = typing.row.parentNode;
    if (!list) return;
    // 一次只冒一条，和上一条隔一会儿（接口一下子给了好几句时也一条条出来，用户要的「假流式」）；没轮到的过一会儿再来
    // 设置里开了「回复一条条蹦出来」才这样，关着时写好一句就出一句（以前的样子）
    var fake = typeof assistCfg !== 'undefined' && assistCfg.fakeStream;
    clearTimeout(previewTimer);
    var wait = fake && previewParts.length ? crBubbleGap(previewParts[previewParts.length - 1]) - (Date.now() - previewAt) : 0;
    if (wait > 0) { previewTimer = setTimeout(function() { previewStream(shown); }, wait); return; }
    for (var i = previewParts.length, upto = fake ? previewParts.length + 1 : parts.length; i < parts.length && i < upto; i++) {
      previewParts.push(parts[i]);
      if (typeof parts[i] !== 'string' || !parts[i]) continue;
      var r = appendMsg('ai', parts[i], false, list);
      r.row.classList.add('cr-stream-preview');
      previewRows.push(r.row);
      list.appendChild(typing.row);   // 「正在输入」一直在最下面
      previewAt = Date.now();
    }
    if (parts.length > previewParts.length) previewTimer = setTimeout(function() { previewStream(shown); }, crBubbleGap(previewParts[previewParts.length - 1]));
  }

  // 聊天视图附加回复格式要求（剧情视图不拆条、不加状态栏）；请求按接口类型自动适配（见 js/core/llm.js）
  var started = false;
  function finishStream() {
    endGen();
    if (aiText) {
      var added = deliver(aiText);
      if (isChatView && !isGrp) maybeAutoSummarize(replyCharIdx);
      // 只在「聊天」子视图回复后按概率触发动态（剧情不触发）
      if (isChatView && !isGrp) maybeAutoPostAfterChat(replyCharIdx);
      if (onDone) onDone(added);
    } else {
      typing.row.remove();
      clearPreview();
      showReplyError(new Error('未收到回复内容'));
      if (onDone) onDone([]);
    }
  }
  // 开了 MCP 时把工具交给模型；用工具的过程显示在打字气泡里
  var mcpTools = (!isGrp && typeof mcpActiveTools === 'function') ? mcpActiveTools() : [];
  // 开了向量记忆时先算好这次对话的向量（失败就用本地相似度）
  (!isGrp && typeof memPrepare === 'function' ? memPrepare(replyChar, hist) : Promise.resolve()).then(function() {
    if (typeof cotModeFor === 'function') cfg.cot = cotModeFor(replyChar, !isChatView);   // 这个角色这个窗口的思考方式（llm.js 的 llmThinkOff 看它）
    return llmRequest(buildMsgs(replyCharIdx).concat(isChatView ? chatFormatRules(charList[replyCharIdx]) : dramaFormatRules(charList[replyCharIdx]), cotRules(!isChatView, replyChar)), {
    stream: true,
    signal: ctrl.signal,
    cfg: cfg,
    tools: mcpTools,
    callTool: mcpTools.length ? mcpCallFromLLM : null,
    toolLabel: function(name) { var hit = mcpToolMap[name]; return hit ? (hit.tool.title || hit.tool.name) : name; },
    onStatus: function(text) { typing.bubble.textContent = text; scrollLive(); },
    onText: function(full) {
      aiText = full;
      if (isGrp) { scrollLive(); return; }   // 群聊：收完再一条条出来，中间只显示「正在输入」
      // 导入的酒馆状态栏那段不在聊天里冒出来
      var liveText = (isChatView && typeof statusStreamCut === 'function') ? statusStreamCut(replyChar, aiText) : aiText;
      // 操作块不直接显示原始代码，写完后会变成确认卡片
      var shown = liveText.replace(/<(thinking|think)>[\s\S]*?(<\/(thinking|think)>|$)/gi, '')
        .replace(/<mphone-action>[\s\S]*?(<\/mphone-action>|$)/g, '⚙️')
        .replace(/<记忆[\s\S]*?(<\/记忆>|$)/g, '').replace(/<签名[\s\S]*?(<\/签名>|$)/g, '').replace(/<个性签名[\s\S]*?(<\/个性签名>|$)/g, '').replace(/<(待关心|已关心|补人设|记下持有)[\s\S]*?(<\/(待关心|已关心|补人设|记下持有)>|$)/g, '').replace(/<改密码[\s\S]*?(<\/改密码>|$)/g, '').replace(/<星星>[\s\S]*?(<\/星星>|$)/g, '').replace(/<(照片|配图)>[\s\S]*?(<\/(照片|配图)>|$)/g, '').replace(/<前情[\s\S]*?(<\/前情>|$)/g, '').replace(/<拍一拍[^>]*>(<\/拍一拍>)?/g, '')
        .replace(/<status>[\s\S]*?(<\/status>|$)/gi, '').replace(/<(日程|提醒|闹钟)[\s\S]*?(<\/(日程|提醒|闹钟)>|$)/g, '').trim();
      if (bubbleStream && shown.indexOf('⚙️') < 0) {
        // 聊天窗口：写完的句子一个一个冒出来，打字气泡保持小点
        if (started) { typing.bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>'; started = false; }
        previewStream(liveText.replace(/<(thinking|think)>[\s\S]*?(<\/(thinking|think)>|$)/gi, '')
          .replace(/<记忆[\s\S]*?(<\/记忆>|$)/g, '').replace(/<签名[\s\S]*?(<\/签名>|$)/g, '').replace(/<个性签名[\s\S]*?(<\/个性签名>|$)/g, '').replace(/<(待关心|已关心|补人设|记下持有)[\s\S]*?(<\/(待关心|已关心|补人设|记下持有)>|$)/g, '').replace(/<改密码[\s\S]*?(<\/改密码>|$)/g, '').replace(/<星星>[\s\S]*?(<\/星星>|$)/g, '').replace(/<(照片|配图)>[\s\S]*?(<\/(照片|配图)>|$)/g, '').replace(/<前情[\s\S]*?(<\/前情>|$)/g, '').replace(/<拍一拍[^>]*>(<\/拍一拍>)?/g, '')
          .replace(/<status>[\s\S]*?(<\/status>|$)/gi, '').replace(/<(日程|提醒|闹钟)[\s\S]*?(<\/(日程|提醒|闹钟)>|$)/g, ''));
      } else {
        if (!started) { typing.bubble.innerHTML = ''; started = true; }
        typing.bubble.textContent = shown;
      }
      scrollLive();
    }
  });
  })
  .then(function(full) {
    if (full) aiText = full;
    finishStream();
  })
  .catch(function(err) {
    endGen();
    // 已收到的部分内容保留下来；手动停止时不显示错误
    var added = aiText ? deliver(aiText) : (typing.row.remove(), clearPreview(), []);
    if (err.name !== 'AbortError') showReplyError(err);
    if (onDone) onDone(added);
  });
}

// 重新生成最新一组回复：旧的回复留作版本，可以用 ‹ › 切换
function regenerateLast() {
  var hist = getActiveHistory(openingChatCharIdx);
  var g = trailingReplyGroup(hist);
  if (!g.msgs.length) { showToast('没有可以重新生成的回复', 'error'); return; }
  if (genHere()) { showToast('正在回复中', 'error'); return; }
  var first = g.msgs[0];
  var alts = first.alts ? first.alts.slice() : [cloneGroup(g.msgs)];
  if (first.alts) alts[first.altIdx] = cloneGroup(g.msgs);
  var oldGroup = g.msgs;
  hist.splice(g.start, g.msgs.length);
  renderRoomLists(openingChatCharIdx);
  sendMsg('', true, function(added) {
    if (!added.length) {
      // 没生成出内容：放回原来的回复
      var cur = trailingReplyGroup(hist);
      if (!cur.msgs.length) Array.prototype.push.apply(hist, oldGroup);
    } else {
      alts.push(cloneGroup(added));
      added[0].alts = alts;
      added[0].altIdx = alts.length - 1;
    }
    saveHistories();
    if (appChatRoom.classList.contains('active') && getActiveHistory(openingChatCharIdx) === hist) renderRoomLists(openingChatCharIdx);
  });
}
