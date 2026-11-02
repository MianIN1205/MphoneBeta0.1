// 眠花糖机 — 聊天室消息显示：气泡、动作小字、引用、小时间、重新生成的版本切换、拍一拍、撤回提示、图片消息

// 消息头像：角色用角色头像，自己用本聊天选用账号的头像
function createMsgAvatar(role) {
  var av = document.createElement('div');
  av.className = 'chat-msg-avatar';
  var char = charList[openingChatCharIdx];
  if (role === 'user') {
    var acc = resolveCharAccount(char);
    paintAvatar(av, acc && acc.avatar, '');
  } else {
    paintCharAvatar(av, char);
  }
  return av;
}
function appendMsg(role, content, isTyping, targetListEl, targetEmptyEl) {
  var list  = targetListEl  || getActiveMsgListEl();
  var empty = targetEmptyEl || getActiveEmptyEl();
  if (empty) empty.style.display = 'none';
  var row = document.createElement('div');
  row.className = 'chat-msg-row ' + (role === 'user' ? 'user' : 'ai');
  row.appendChild(createMsgAvatar(role));
  var bubble = document.createElement('div');
  bubble.className = 'chat-msg-bubble';
  if (isTyping) bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  else setBubbleText(bubble, content, role !== 'user', list.id === 'chatMsgList');
  row.appendChild(bubble);
  list.appendChild(row);
  placeActionNotes(row);
  list.scrollTop = list.scrollHeight;
  return { row: row, bubble: bubble };
}

// 气泡文字；角色消息里「〔译〕」之后的内容显示为附加翻译
// isChat：聊天窗口里，角色用 *星号* 包住的动作描写拿到气泡外面，显示成灰色斜体小字（气泡里只留说的话）
function setBubbleText(bubble, content, isAi, isChat) {
  content = String(content || '');
  if (isAi) content = fillMacros(content, charList[openingChatCharIdx]);
  var i = isAi ? content.indexOf('〔译〕') : -1;
  var main = i < 0 ? content : content.slice(0, i).trim();
  var parts = (isAi && isChat) ? splitActions(main) : { before: [], text: main, after: [] };
  // 只有动作、没有说话：这条就只是一行动作小字
  var onlyAction = i < 0 && !parts.text && (parts.before.length + parts.after.length) > 0;
  bubble.classList.toggle('cr-action-only', onlyAction);
  if (onlyAction) parts = { before: [], text: parts.before.concat(parts.after).join(' '), after: [] };
  bubble.textContent = parts.text;
  bubble._actions = parts;
  if (i >= 0) {
    var tr = document.createElement('span');
    tr.className = 'cr-translation';
    tr.textContent = content.slice(i + 3).trim();
    bubble.appendChild(tr);
  }
  // 编辑消息时气泡已经在列表里：重新摆放动作小字
  if (bubble.parentNode && bubble.parentNode.parentNode) placeActionNotes(bubble.parentNode);
}

// 把 *动作* 和说的话分开：说话之前的动作放气泡上方，之后的放下方
function splitActions(text) {
  var out = { before: [], text: '', after: [] }, said = [];
  text.split(/(\*[^*\n]+\*)/).forEach(function(part) {
    if (/^\*[^*\n]+\*$/.test(part)) (said.length ? out.after : out.before).push(part.slice(1, -1).trim());
    else if (part.trim()) said.push(part.trim());
  });
  out.text = said.join('\n');
  return out;
}
function placeActionNotes(row) {
  (row._actionNotes || []).forEach(function(el) { el.remove(); });
  row._actionNotes = [];
  var bubble = row.querySelector('.chat-msg-bubble');
  var a = bubble && bubble._actions;
  if (!a || !row.parentNode) return;
  var make = function(t, pos) {
    var n = document.createElement('div');
    n.className = 'cr-action-note ' + pos;
    n.textContent = t;
    row._actionNotes.push(n);
    return n;
  };
  a.before.forEach(function(t) { row.parentNode.insertBefore(make(t, 'before'), row); });
  var next = row.nextSibling;
  a.after.forEach(function(t) { row.parentNode.insertBefore(make(t, 'after'), next); });
}

// 渲染一条历史消息（含图片、引用、状态栏）；行元素记住对应的记录（_msg）和附属元素（_extras），方便编辑 / 删除
function renderHistMsg(m, list, empty) {
  list = list || getActiveMsgListEl();
  empty = empty || getActiveEmptyEl();
  // 以前角色忘了写 </status>，状态原样留在了消息文字里：拿出来放回状态栏
  if (m.role === 'assistant' && typeof m.content === 'string' && /<status>/i.test(m.content) && typeof takeStatus === 'function') {
    var st = takeStatus(m.content);
    m.content = st.text;
    if (st.status && !m.status) m.status = st.status;
    if (typeof saveHistories === 'function') setTimeout(saveHistories, 0);
  }
  // 和上一条相隔 5 分钟以上（或是这一屏第一条）时，先插一条居中的时间
  if (m.time) {
    if (!list._lastTime || m.time - list._lastTime >= 5 * 60000) {
      var sep = document.createElement('div');
      sep.className = 'cr-time-sep';
      sep.textContent = fmtMsgTime(m.time);
      list.appendChild(sep);
    }
    list._lastTime = m.time;
  }
  // 版本切换只留在最新一次回复上：后面来了别的消息，就收起前面的切换条
  if (list._altTime && !(m.role === 'assistant' && m.time === list._altTime)) {
    list.querySelectorAll('.cr-alt-switch').forEach(function(el) { el.remove(); });
    list._altTime = 0;
  }
  var thinkBar = m.think && m.role === 'assistant' ? renderThinkBar(m, list) : null;
  if (m.recalled && !m._flash) return renderRecallNotice(m, list, empty);
  if (m.pat) return renderPatNotice(m, list, empty);
  if (m.narr) return renderNarration(m, list, empty);
  if (m.action && typeof renderActionCard === 'function') return renderActionCard(m, list, empty);
  if (m.cal && typeof renderCalCard === 'function') return renderCalCard(m, list, empty);
  if (m.voice) {
    var vrow = createVoiceBubble(m, list, empty);
    if (m.quote) vrow._extras.push(appendQuoteBlock(list, m.quote, 'user'));
    return vrow;
  }
  var role = m.role === 'user' ? 'user' : 'ai';
  var r = m.imgSrc ? appendImgMsg(role, m.imgSrc, list, empty)
        : (m.sticker && typeof appendStickerMsg === 'function') ? appendStickerMsg(role, m, list, empty)
        : appendMsg(role, m.content, false, list, empty);
  r.row._msg = m;
  r.row._extras = thinkBar ? [thinkBar] : [];
  if (m.quote) r.row._extras.push(appendQuoteBlock(list, m.quote, role));
  if (m.alts && m.alts.length > 1) { r.row._extras.push(appendAltSwitch(list, m)); list._altTime = m.time || 1; }
  // 角色刚发就撤回的：先正常显示两秒半，再换成「撤回了一条消息」
  if (m._flash) {
    setTimeout(function() {
      delete m._flash;
      if (!r.row.parentNode) return;
      var notice = renderRecallNotice(m, list, null);
      list.insertBefore(notice, r.row);
      (r.row._extras || []).concat(r.row._actionNotes || []).forEach(function(el) { el.remove(); });
      r.row.remove();
    }, 2500);
  }
  return r.row;
}

// 聊天窗口：双方各自连着发的最后一条下面写一个小时间。中间隔了时间分隔、撤回、拍一拍、操作卡片也算新的一段。
// 消息列表一有变化就重新摆一遍（只动时间这一行）
function refreshMsgStamps(list) {
  var atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  list.querySelectorAll('.cr-msg-stamp').forEach(function(el) { el.remove(); });
  var prev = null, broken = false;
  var stamp = function(row) {
    var m = row._msg;
    if (!m || !m.time) return;
    // 放在这条消息自己的引用、版本切换、动作小字后面
    var owned = (row._extras || []).concat(row._actionNotes || []), at = row;
    while (at.nextSibling && owned.indexOf(at.nextSibling) >= 0) at = at.nextSibling;
    var d = new Date(m.time), el = document.createElement('div');
    el.className = 'cr-msg-stamp ' + (row.classList.contains('user') ? 'user' : 'ai');
    el.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    list.insertBefore(el, at.nextSibling);
  };
  Array.prototype.slice.call(list.children).forEach(function(el) {
    if (el.classList.contains('chat-msg-row')) {
      if (!el._msg) return;   // 打字中的气泡、报错提示
      if (prev && (broken || prev.classList.contains('user') !== el.classList.contains('user'))) stamp(prev);
      prev = el;
      broken = false;
    } else if (el.matches('.cr-time-sep, .cr-recall-notice, .cr-action-card, .cr-cal-card')) {
      broken = true;
    }
  });
  if (prev) stamp(prev);
  if (atBottom) list.scrollTop = list.scrollHeight;
}
(function() {
  var list = document.getElementById('chatMsgList');
  var queued = false;
  var obs = new MutationObserver(function() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function() {
      queued = false;
      obs.disconnect();
      refreshMsgStamps(list);
      obs.observe(list, { childList: true });
    });
  });
  obs.observe(list, { childList: true });
})();

// 「重新生成」留下的多个版本：‹ 2/3 › 切换
function appendAltSwitch(list, m) {
  var box = document.createElement('div');
  box.className = 'cr-alt-switch';
  var prev = document.createElement('button'), next = document.createElement('button');
  prev.textContent = '‹'; next.textContent = '›';
  var label = document.createElement('span');
  label.textContent = (m.altIdx + 1) + '/' + m.alts.length;
  prev.disabled = m.altIdx <= 0;
  next.disabled = m.altIdx >= m.alts.length - 1;
  prev.addEventListener('click', function(e) { e.stopPropagation(); switchAlt(m, -1); });
  next.addEventListener('click', function(e) { e.stopPropagation(); switchAlt(m, 1); });
  box.appendChild(prev); box.appendChild(label); box.appendChild(next);
  list.appendChild(box);
  return box;
}

// 最新一次回复的那组消息（同一次回复拆成的多条时间相同）；重新生成 / 切换版本只作用在这一组上
function trailingReplyGroup(hist) {
  var i = hist.length, last = hist[i - 1];
  var userRecalled = function(m) { return m.recalled && m.recalledBy !== 'char'; };
  if (!last || last.role !== 'assistant' || userRecalled(last) || last.voice || last.imgSrc) return { start: i, msgs: [] };
  i--;
  while (i > 0 && last.time && hist[i - 1].role === 'assistant' && !userRecalled(hist[i - 1]) && hist[i - 1].time === last.time) i--;
  return { start: i, msgs: hist.slice(i) };
}

function cloneGroup(group) {
  return group.map(function(g) {
    return { role: g.role, content: g.content, sticker: g.sticker, status: g.status, time: g.time, recap: g.recap, pat: g.pat, cal: g.cal, think: g.think,
             recalled: g.recalled, recalledText: g.recalledText, recalledBy: g.recalledBy,
             action: g.action ? JSON.parse(JSON.stringify(g.action)) : undefined };
  });
}

function switchAlt(m, dir) {
  var hist = getChatHistory(openingChatCharIdx).indexOf(m) >= 0 ? getChatHistory(openingChatCharIdx) : getDramaHistory(openingChatCharIdx);
  var g = trailingReplyGroup(hist);
  if (g.msgs[0] !== m) { showToast('只能切换最新一条回复的版本', 'error'); return; }
  var to = m.altIdx + dir;
  if (to < 0 || to >= m.alts.length) return;
  var group = cloneGroup(m.alts[to]);
  group[0].alts = m.alts;
  group[0].altIdx = to;
  hist.splice(g.start, g.msgs.length);
  Array.prototype.push.apply(hist, group);
  saveHistories();
  renderRoomLists(openingChatCharIdx);
}

// 拍一拍（聊天窗口，角色设置「聊天」页打开后生效）：双击头像拍一拍，中间出现一行小字；不自动请求回复，按 ❄️ 时角色就知道
// m.pat：'char' = 你拍了拍角色，'self' = 你拍了拍自己，'user' = 角色拍了拍你；m.patSuffix = 拍的时候用的后缀
function patNoticeText(m) {
  var char = charList[openingChatCharIdx] || {}, name = char.charAlias || char.charName || '对方';
  if (m.pat === 'self') return '你拍了拍自己';
  if (m.pat === 'user') return '「' + name + '」拍了拍你';
  return '你拍了拍「' + name + '」' + (m.patSuffix || '');
}
function patTextForAI(m) {
  if (m.pat === 'self') return '（用户拍了拍自己）';
  if (m.pat === 'user') return '（你拍了拍用户）';
  return '（用户拍了拍你' + (m.patSuffix || '') + '）';
}
function renderPatNotice(m, list, empty) {
  if (empty) empty.style.display = 'none';
  var el = document.createElement('div');
  el.className = 'cr-recall-notice cr-pat-notice';
  el.textContent = patNoticeText(m);
  el._msg = m;
  el._extras = [];
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
  return el;
}
// 剧情开场白：居中的旁白块（不是谁说的话），长按和普通消息一样（见 js/chat/opening.js）
function renderNarration(m, list, empty) {
  if (empty) empty.style.display = 'none';
  var row = document.createElement('div');
  row.className = 'chat-msg-row cr-narr-row';
  var b = document.createElement('div');
  b.className = 'chat-msg-bubble cr-narr';
  b.textContent = fillMacros(m.content || '', charList[openingChatCharIdx]);
  row.appendChild(b);
  row._msg = m;
  row._extras = [];
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
  return row;
}
// 思维链折叠条：Prompt → 思维链 开了「在聊天里显示思考」才有，放在那次回复的第一条前面，点开看思考全文
function renderThinkBar(m, list) {
  if (!mphoneStore.load('mphone_cot_show', false)) return null;
  var bar = document.createElement('div');
  bar.className = 'cr-think-bar';
  var head = document.createElement('div');
  head.className = 'cr-think-head';
  head.textContent = '💭 思考';
  var body = document.createElement('div');
  body.className = 'cr-think-body';
  body.textContent = m.think;
  head.addEventListener('click', function() { bar.classList.toggle('open'); });
  bar.appendChild(head);
  bar.appendChild(body);
  list.appendChild(bar);
  return bar;
}
function patShake(av) {
  if (!av) return;
  av.classList.remove('cr-pat-shake');
  void av.offsetWidth;
  av.classList.add('cr-pat-shake');
  if (navigator.vibrate) { try { navigator.vibrate(20); } catch (_) {} }
}
// 双击头像：两次点击间隔 350ms 以内
var patLastTap = { el: null, time: 0 };
document.getElementById('chatMsgList').addEventListener('click', function(e) {
  var av = e.target.closest && e.target.closest('.chat-msg-avatar');
  if (!av) return;
  var now = Date.now();
  if (patLastTap.el !== av || now - patLastTap.time > 350) { patLastTap = { el: av, time: now }; return; }
  patLastTap = { el: null, time: 0 };
  var char = charList[openingChatCharIdx];
  var cfg = Object.assign({}, DEFAULT_CHAT_CFG, (char && char.chatCfg) || {});
  if (!char || !cfg.patOn) return;
  var row = av.closest('.chat-msg-row');
  var self = !!(row && row.classList.contains('user'));
  var m = { role: 'user', content: '', pat: self ? 'self' : 'char', patSuffix: self ? '' : (cfg.patSuffix || ''), time: now };
  getChatHistory(openingChatCharIdx).push(m);
  renderHistMsg(m, document.getElementById('chatMsgList'), document.getElementById('chatRoomEmpty'));
  saveHistories();
  patShake(av);
});

// 撤回提示：「你撤回了一条消息 重新编辑」
// 角色的消息：你撤回的「你撤回了 TA 的一条消息 查看」；TA 自己撤回的「TA 撤回了一条消息 偷看」（角色设置里允许偷看时）
function renderRecallNotice(m, list, empty) {
  if (empty) empty.style.display = 'none';
  var el = document.createElement('div');
  el.className = 'cr-recall-notice';
  if (m.role === 'assistant') {
    var char = charList[openingChatCharIdx] || {}, name = char.charAlias || char.charName || '对方';
    var byUser = m.recalledBy === 'user';
    el.appendChild(document.createTextNode(byUser ? '你撤回了「' + name + '」的一条消息' : '「' + name + '」撤回了一条消息'));
    var cfg = Object.assign({}, DEFAULT_CHAT_CFG, char.chatCfg || {});
    if (m.recalledText && (byUser || cfg.recallPeek)) {
      var peek = document.createElement('span');
      peek.className = 'cr-recall-reedit';
      peek.textContent = byUser ? '查看' : '偷看';
      peek.addEventListener('click', function() {
        var shown = el.querySelector('.cr-recall-peek-text');
        if (shown) { shown.remove(); return; }
        var t = document.createElement('span');
        t.className = 'cr-recall-peek-text';
        t.textContent = fillMacros(m.recalledText, char);
        el.appendChild(t);
      });
      el.appendChild(peek);
    }
    el._msg = m;
    el._extras = [];
    list.appendChild(el);
    list.scrollTop = list.scrollHeight;
    return el;
  }
  el.appendChild(document.createTextNode('你撤回了一条消息'));
  if (m.recalledText) {
    var re = document.createElement('span');
    re.className = 'cr-recall-reedit';
    re.textContent = '重新编辑';
    re.addEventListener('click', function() {
      crInput.value = m.recalledText;
      crInput.dispatchEvent(new Event('input'));
      crInput.focus();
    });
    el.appendChild(re);
  }
  el._msg = m;
  el._extras = [];
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
  return el;
}

// 引用块：显示在被发送的消息下方
function appendQuoteBlock(list, quote, role) {
  var q = document.createElement('div');
  q.className = 'cr-quote ' + (role === 'user' ? 'user' : 'ai');
  q.textContent = quote.author + '：' + fillMacros(quote.text, charList[openingChatCharIdx]);   // 以前存下的引用可能还带着 {{user}}
  list.appendChild(q);
  return q;
}

function appendImgMsg(role, imgSrc, targetListEl, targetEmptyEl) {
  var list  = targetListEl  || getActiveMsgListEl();
  var empty = targetEmptyEl || getActiveEmptyEl();
  if (empty) empty.style.display = 'none';
  var row = document.createElement('div');
  row.className = 'chat-msg-row ' + (role === 'user' ? 'user' : 'ai');
  row.appendChild(createMsgAvatar(role));
  var bubble = document.createElement('div');
  bubble.className = 'chat-msg-bubble img-bubble';
  var img = document.createElement('img');
  img.src = imgSrc;
  img.alt = '图片消息';
  bubble.appendChild(img);
  row.appendChild(bubble);
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
  return { row: row, bubble: bubble };
}
