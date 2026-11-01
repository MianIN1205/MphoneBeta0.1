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
  var st = takeStatus(raw);
  raw = st.text; status = st.status;
  raw = raw.replace(/<签名>([\s\S]*?)<\/签名>/g, function(_, s) { headStatus = s.replace(/\s+/g, ' ').trim().slice(0, 20); return ''; });
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
    rc.headStatus = headStatus;
    saveCharList();
    if (charList[openingChatCharIdx] === rc) paintChatSubTitle(rc);
  }
  // 聊天窗口：TA 帮忙记的提醒 / 闹钟 / 日程，记进桌面「纪念日」，后面单独成一张卡片
  var calItems = [];
  if (rc && chatHistories[rc.id] === hist && typeof extractCalTags === 'function') raw = extractCalTags(rc, raw, calItems);
  if (rc && chatHistories[rc.id] === hist && !(rc.chatCfg && rc.chatCfg.actionOn)) {
    raw = raw.replace(/\*[^*\n]+\*/g, '').replace(/[ \t]{2,}/g, ' ');
  }
  var parts = raw.split(/\n?\s*\|\|\|\s*\n?/).map(function(p) { return p.trim(); }).filter(Boolean);
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
  if (added.length && recap) added[added.length - 1].recap = recap;
  actions.forEach(function(a) { added.push({ role: 'assistant', content: '', action: a, time: now }); });
  calItems.forEach(function(c) { added.push({ role: 'assistant', content: '', cal: c, time: now }); });
  var pc = charOfHistory(hist);
  if (patBack && pc && chatHistories[pc.id] === hist && pc.chatCfg && pc.chatCfg.patOn) added.push({ role: 'assistant', content: '', pat: 'user', time: now });
  added.forEach(function(m) {
    hist.push(m);
    if (list) renderHistMsg(m, list, empty);
    else delete m._flash;   // 没在看这个对话：回来时直接是撤回提示
  });
  if (status && typeof refreshStatusPanel === 'function') refreshStatusPanel();
  return added;
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

// 正在生成的回复（同一时间只有一条）：生成时 ❄️ 变成 ⏹，点一下停止
var genState = null;   // { ctrl: AbortController, char }
function setGenerating(on) {
  var b = document.querySelector('.cr-emoji-btn');
  b.classList.toggle('generating', on);
  b.textContent = on ? '⏹' : '❄️';
  b.setAttribute('aria-label', on ? '停止生成' : '请求回复');
}
function stopGenerating() { if (genState) genState.ctrl.abort(); }

// onDone(added)：回复结束后调用，added 是写入记录的角色消息（失败或停止且没有内容时为空数组）
function sendMsg(userText, requestOnly, onDone) {
  var cfg = getApiCfg(charList[openingChatCharIdx]);
  if (!cfg.url || !cfg.key) { appendMsg('ai', '⚠️ 请先在设置中填写 API 地址和密钥，点击「当前应用」保存。', false); if (onDone) onDone([]); return; }
  if (!cfg.model)           { appendMsg('ai', '⚠️ 请先选择模型。', false); if (onDone) onDone([]); return; }
  if (genState) { showToast('正在回复中，可以先点 ⏹ 停止', 'error'); if (onDone) onDone([]); return; }
  var hist = getActiveHistory(openingChatCharIdx);
  var replyCharIdx = openingChatCharIdx;
  var replyChar = charList[replyCharIdx];
  var activeList = getActiveMsgListEl();
  var isChatView = hist === getChatHistory(replyCharIdx);
  if (!requestOnly && userText) { var um = { role: 'user', content: userText, time: Date.now() }; hist.push(um); renderHistMsg(um); saveHistories(); }
  var typing = appendMsg('ai', '', true);
  var ctrl = new AbortController();
  var aiText = '';
  genState = { ctrl: ctrl, char: replyChar };
  setGenerating(true);

  function endGen() {
    if (genState && genState.ctrl === ctrl) { genState = null; setGenerating(false); }
  }
  // 打字气泡换成正式消息（可能拆成多条、带状态栏）。回复到达时如果已经离开这个对话，
  // 只写进记录并记为未读；切走又切回来时打字气泡已被重绘掉，就画到当前列表里
  function deliver(text) {
    typing.row.remove();
    var showing = appChatRoom.classList.contains('active') && charList[openingChatCharIdx] === replyChar &&
                  getActiveHistory(openingChatCharIdx) === hist;
    var list = showing ? getActiveMsgListEl() : null;
    var added = commitAssistantReply(hist, text, list, null);
    if (list) list.scrollTop = list.scrollHeight;
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

  // 聊天视图附加回复格式要求（剧情视图不拆条、不加状态栏）；请求按接口类型自动适配（见 js/core/llm.js）
  var started = false;
  function finishStream() {
    endGen();
    if (aiText) {
      var added = deliver(aiText);
      if (isChatView) maybeAutoSummarize(replyCharIdx);
      // 只在「聊天」子视图回复后按概率触发动态（剧情不触发）
      if (isChatView) maybeAutoPostAfterChat(replyCharIdx);
      if (onDone) onDone(added);
    } else {
      typing.row.remove();
      appendMsg('ai', '⚠️ 未收到回复内容', false).bubble.classList.add('error');
      if (onDone) onDone([]);
    }
  }
  // 开了 MCP 时把工具交给模型；用工具的过程显示在打字气泡里
  var mcpTools = (typeof mcpActiveTools === 'function') ? mcpActiveTools() : [];
  // 开了向量记忆时先算好这次对话的向量（失败就用本地相似度）
  (typeof memPrepare === 'function' ? memPrepare(replyChar, hist) : Promise.resolve()).then(function() {
    return llmRequest(buildMsgs(replyCharIdx).concat(isChatView ? chatFormatRules(charList[replyCharIdx]) : dramaFormatRules(charList[replyCharIdx])), {
    stream: true,
    signal: ctrl.signal,
    cfg: cfg,
    tools: mcpTools,
    callTool: mcpTools.length ? mcpCallFromLLM : null,
    toolLabel: function(name) { var hit = mcpToolMap[name]; return hit ? (hit.tool.title || hit.tool.name) : name; },
    onStatus: function(text) { typing.bubble.textContent = text; if (activeList) activeList.scrollTop = 999999; },
    onText: function(full) {
      if (!started) { typing.bubble.innerHTML = ''; started = true; }
      aiText = full;
      // 操作块不直接显示原始代码，写完后会变成确认卡片
      typing.bubble.textContent = aiText.replace(/<mphone-action>[\s\S]*?(<\/mphone-action>|$)/g, '⚙️')
        .replace(/<记忆[\s\S]*?(<\/记忆>|$)/g, '').replace(/<签名[\s\S]*?(<\/签名>|$)/g, '').replace(/<前情[\s\S]*?(<\/前情>|$)/g, '').replace(/<拍一拍[^>]*>(<\/拍一拍>)?/g, '')
        .replace(/<status>[\s\S]*?(<\/status>|$)/gi, '').replace(/<(日程|提醒|闹钟)[\s\S]*?(<\/(日程|提醒|闹钟)>|$)/g, '').trim();
      if (activeList) activeList.scrollTop = 999999;
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
    var added = aiText ? deliver(aiText) : (typing.row.remove(), []);
    if (err.name !== 'AbortError') appendMsg('ai', '⚠️ 请求失败：' + err.message, false).bubble.classList.add('error');
    if (onDone) onDone(added);
  });
}

// 重新生成最新一组回复：旧的回复留作版本，可以用 ‹ › 切换
function regenerateLast() {
  var hist = getActiveHistory(openingChatCharIdx);
  var g = trailingReplyGroup(hist);
  if (!g.msgs.length) { showToast('没有可以重新生成的回复', 'error'); return; }
  if (genState) { showToast('正在回复中', 'error'); return; }
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
