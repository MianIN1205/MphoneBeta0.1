// 眠花糖机 — 聊天对话室 — 消息发送与渲染

// =============================================
// 聊天对话室 — 消息发送与渲染
// =============================================
// 聊天 / 剧情记录按角色 id 存储（chatHistories 在 charList 旁加载），idx 为 charList 下标
function charKey(idx) { return charList[idx] ? charList[idx].id : '_none'; }
function getChatHistory(idx) { var k = charKey(idx); if (!chatHistories[k]) chatHistories[k] = []; return chatHistories[k]; }
function getDramaHistory(idx) { var k = charKey(idx); if (!dramaHistories[k]) dramaHistories[k] = []; return dramaHistories[k]; }
// 一条消息要保存的字段；alts 是「重新生成」留下的多个版本（每个版本是一组消息）
function stripMsg(m) {
  var o = { role: m.role, content: m.content, imgSrc: m.imgSrc, status: m.status, time: m.time,
            quote: m.quote, recalled: m.recalled, recalledText: m.recalledText,
            voice: m.voice, transcript: m.transcript, action: m.action };
  if (m.alts) {
    o.alts = m.alts.map(function(group) {
      return group.map(function(g) { return { role: g.role, content: g.content, status: g.status, time: g.time, action: g.action }; });
    });
    o.altIdx = m.altIdx;
  }
  return o;
}
function saveHistories() {
  // 只保存需要的字段（去掉运行时状态）；语音录音以 dataURL 保存，刷新后可以重新播放
  var strip = function(all) {
    var out = {};
    Object.keys(all).forEach(function(k) {
      out[k] = all[k].map(stripMsg);
    });
    return out;
  };
  mphoneStore.save('mphone_chat_histories', strip(chatHistories));
  mphoneStore.save('mphone_drama_histories', strip(dramaHistories));
}
function getActiveHistory(idx) {
  return (currentCrSubView === 'contacts') ? getDramaHistory(idx) : getChatHistory(idx);
}
function getActiveMsgListEl() {
  return document.getElementById(currentCrSubView === 'contacts' ? 'dramaMsgList' : 'chatMsgList');
}
function getActiveEmptyEl() {
  return document.getElementById(currentCrSubView === 'contacts' ? 'dramaRoomEmpty' : 'chatRoomEmpty');
}
function getApiCfg() {
  return {
    url:   (document.getElementById('apiUrl').value.trim()  || mphoneStore.load('mphone_api_url', null)     || ''),
    key:   (document.getElementById('apiKey').value.trim()  || mphoneStore.load('mphone_api_key', null)     || ''),
    model: (modelDisplay.textContent.trim() === '请选择模型' ? '' : modelDisplay.textContent.trim()),
    temp:  parseFloat(tempSlider.value || mphoneStore.load('mphone_temperature', null) || '0.8')
  };
}
// 按回合切分记录：一个回合 = 用户的一条或多条消息 + 之后角色的回复（开头若是角色消息，归入第一回合）
function splitRounds(hist) {
  var rounds = [], cur = null;
  hist.forEach(function(m) {
    if (m.role === 'user' && (!cur || cur.hasReply)) {
      cur = []; cur.hasReply = false; rounds.push(cur);
    } else if (!cur) {
      cur = []; cur.hasReply = false; rounds.push(cur);
    }
    if (m.role !== 'user') cur.hasReply = true;
    cur.push(m);
  });
  return rounds;
}

// 聊天回复的格式要求：语言 / 翻译 / 回复条数 / 状态栏（发消息和主动消息使用，动态不用）
function chatFormatRules(char) {
  var c = Object.assign({}, DEFAULT_CHAT_CFG, char.chatCfg || {});
  var look = Object.assign({}, DEFAULT_LOOK, char.look || {});
  var rules = [];
  if (c.lang && !/^(中文|汉语|简体中文|chinese)$/i.test(c.lang)) {
    rules.push('请使用' + c.lang + '回复。');
    if (c.translate) rules.push('每条消息的外语正文后另起一行，以「〔译〕」开头给出中文翻译。');
  }
  if (c.replyMax > 1) {
    rules.push('像发微信一样，把这次回复拆成 ' + (c.replyMin === c.replyMax ? c.replyMax : c.replyMin + '~' + c.replyMax) +
               ' 条消息，每两条之间单独一行写 |||');
  }
  if (look.statusOn) {
    var fields = look.statusFields.split(/[,，、]/).map(function(s) { return s.trim(); }).filter(Boolean);
    rules.push('在全部消息之后，另起一行输出你当前的状态：<status>' +
               fields.map(function(f) { return f + '：…'; }).join(' | ') + '</status>');
  }
  return rules.length ? [{ role: 'system', content: '【回复格式】' + rules.join('\n') }] : [];
}

// 酒馆通用写法：{{char}} = 角色名，{{user}} = 用户名（本聊天所用账号的昵称）；也认旧写法 <BOT> / <USER>。
// {{// 注释}} 和 {{trim}} 直接去掉，{{newline}} 换成换行
function fillMacros(text, char) {
  if (!text) return text;
  char = char || {};
  var charName = char.charAlias || char.charName || '角色';
  var userName = (typeof resolveCharAccount === 'function' && resolveCharAccount(char).nickname) || '用户';
  return String(text)
    .replace(/\{\{\/\/[\s\S]*?\}\}/g, '')
    .replace(/\{\{\s*trim\s*\}\}/gi, '')
    .replace(/\{\{\s*newline\s*\}\}/gi, '\n')
    .replace(/\{\{\s*char\s*\}\}|<BOT>/gi, charName)
    .replace(/\{\{\s*user\s*\}\}|<USER>/gi, userName);
}

// histOverride：指定使用的记录（自主活动 / 动态生成时用聊天记录），默认取当前子视图的记录
function buildMsgs(idx, histOverride) {
  var char = charList[idx] || {};
  var sys  = (document.getElementById('systemPromptTA') ? document.getElementById('systemPromptTA').value.trim() : '');
  var extra = '';
  if (char.charAlias || char.charName) extra += '你的名字是：' + (char.charAlias || char.charName) + '。\n';
  if (char.charPersona)  extra += '你的人设：\n' + char.charPersona + '\n';
  // USER：本聊天选用的账号（人设跟着账号走）+ 角色对该账号的专属印象
  var acc = resolveCharAccount(char);
  if (acc.nickname)      extra += '用户的名字是：' + acc.nickname + '。\n';
  if (char.userNickname) extra += '你对用户的称呼是：' + char.userNickname + '。\n';
  if (acc.persona)       extra += '用户的人设：\n' + acc.persona + '\n';
  var impression = impressionFor(char.userImpressions, acc.uid);
  if (impression)        extra += '你对用户的特别印象 / 设定：\n' + impression + '\n';
  var sysContent = (sys + (extra ? '\n\n---\n' + extra : '')).trim();
  var msgs = sysContent ? [{ role: 'system', content: sysContent }] : [];
  // 系统内置助手：应用说明 + 已开启的权限
  var assistantSys = (typeof assistantPrompt === 'function') ? assistantPrompt(char) : '';
  if (assistantSys) msgs.push({ role: 'system', content: assistantSys });
  // 社交圈：认识谁 + 能看到的最近动态
  var feedSys = (typeof feedContextFor === 'function') ? feedContextFor(char) : '';
  if (feedSys) msgs.push({ role: 'system', content: feedSys });

  var history = histOverride || getActiveHistory(idx);

  // 记忆（仅聊天记录）：全部总结 + 最大记忆范围内的回合；另外提醒 AI 重点关注注意力范围内的回合
  var attentionNote = null;
  var richFrom = Math.max(0, history.length - 20);   // 剧情等：最近 20 条附带真实媒体
  if (history === getChatHistory(idx)) {
    var mem = char.memory || {};
    if (mem.summaries && mem.summaries.length) {
      msgs.push({ role: 'system', content: '【记忆总结】以下是你们之前的聊天经过：\n' +
        mem.summaries.map(function(s) { return s.text; }).join('\n') });
    }
    var cc = Object.assign({}, DEFAULT_CHAT_CFG, char.chatCfg || {});
    var rounds = splitRounds(history).slice(-cc.maxMem);
    history = [].concat.apply([], rounds);
    // 注意力范围内的消息附带真实图片 / 语音，更早的只用文字说明（省流量和费用）
    richFrom = [].concat.apply([], rounds.slice(0, Math.max(0, rounds.length - cc.attention))).length;
    if (rounds.length > cc.attention) {
      attentionNote = { role: 'system', content: '【注意力】下面的聊天记录中，请重点关注并回应最近 ' + cc.attention +
        ' 个回合的内容；更早的部分只作为背景参考，不必逐条回应。' };
    }
  }

  // 世界书：按注入位置分组（前 = 紧跟系统提示，中 = 预设条目之后，后 = 聊天记录之后）
  var wbByPos = { before: [], middle: [], after: [] };
  getActiveWbEntries(char, history).forEach(function(e) {
    (wbByPos[e.pos] || wbByPos.before).push({ role: 'system', content: '【世界书 · ' + e.name + '】\n' + e.content });
  });
  msgs = msgs.concat(wbByPos.before);

  // 注入当前预设中已启用的提示词条目（按条目各自的 role 身份发送）
  var curPreset = stPresets && stPresets[stActivePresetIdx];
  if (curPreset && Array.isArray(curPreset.entries)) {
    curPreset.entries.forEach(function(entry) {
      if (entry && entry.enabled && entry.content && entry.content.trim()) {
        var r = (entry.role === 'user' || entry.role === 'assistant') ? entry.role : 'system';
        msgs.push({ role: r, content: entry.content.trim() });
      }
    });
  }
  msgs = msgs.concat(wbByPos.middle);

  // 若开启了思维链，按需注入思维链提示词
  if (cotEnableToggle && cotEnableToggle.checked && cotPromptTA && cotPromptTA.value.trim()) {
    msgs.push({ role: 'system', content: cotPromptTA.value.trim() });
  }

  var rawHist = history.map(function(m, i) {
    return { role: m.role, content: msgContentForAI(m, i >= richFrom) };
  });
  if (attentionNote) msgs.push(attentionNote);
  // 提示词、人设、预设、世界书里的 {{char}} / {{user}} 换成名字（聊天记录本身不动）
  var fill = function(m) { return typeof m.content === 'string' ? { role: m.role, content: fillMacros(m.content, char) } : m; };
  return msgs.map(fill).concat(rawHist, wbByPos.after.map(fill));
}
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
  else setBubbleText(bubble, content, role !== 'user');
  row.appendChild(bubble);
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
  return { row: row, bubble: bubble };
}

// 气泡文字；角色消息里「〔译〕」之后的内容显示为附加翻译
function setBubbleText(bubble, content, isAi) {
  content = String(content || '');
  if (isAi) content = fillMacros(content, charList[openingChatCharIdx]);
  var i = isAi ? content.indexOf('〔译〕') : -1;
  if (i < 0) { bubble.textContent = content; return; }
  bubble.textContent = content.slice(0, i).trim();
  var tr = document.createElement('span');
  tr.className = 'cr-translation';
  tr.textContent = content.slice(i + 3).trim();
  bubble.appendChild(tr);
}

// 气泡下方的状态栏卡片
function appendStatusCard(list, text) {
  var card = document.createElement('div');
  card.className = 'cr-status-card';
  card.textContent = text.split('|').map(function(s) { return s.trim(); }).filter(Boolean).join('\n');
  list.appendChild(card);
  list.scrollTop = list.scrollHeight;
  return card;
}

// 渲染一条历史消息（含图片、引用、状态栏）；行元素记住对应的记录（_msg）和附属元素（_extras），方便编辑 / 删除
function renderHistMsg(m, list, empty) {
  list = list || getActiveMsgListEl();
  empty = empty || getActiveEmptyEl();
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
  if (m.recalled) return renderRecallNotice(m, list, empty);
  if (m.action && typeof renderActionCard === 'function') return renderActionCard(m, list, empty);
  if (m.voice) {
    var vrow = createVoiceBubble(m, list, empty);
    if (m.quote) vrow._extras.push(appendQuoteBlock(list, m.quote, 'user'));
    return vrow;
  }
  var role = m.role === 'user' ? 'user' : 'ai';
  var r = m.imgSrc ? appendImgMsg(role, m.imgSrc, list, empty) : appendMsg(role, m.content, false, list, empty);
  r.row._msg = m;
  r.row._extras = [];
  if (m.quote) r.row._extras.push(appendQuoteBlock(list, m.quote, role));
  if (m.status) r.row._extras.push(appendStatusCard(list, m.status));
  if (m.alts && m.alts.length > 1) { r.row._extras.push(appendAltSwitch(list, m)); list._altTime = m.time || 1; }
  return r.row;
}

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
  if (!last || last.role !== 'assistant' || last.recalled || last.voice || last.imgSrc) return { start: i, msgs: [] };
  i--;
  while (i > 0 && last.time && hist[i - 1].role === 'assistant' && !hist[i - 1].recalled && hist[i - 1].time === last.time) i--;
  return { start: i, msgs: hist.slice(i) };
}

function cloneGroup(group) {
  return group.map(function(g) {
    return { role: g.role, content: g.content, status: g.status, time: g.time,
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

// 撤回提示：「你撤回了一条消息 重新编辑」
function renderRecallNotice(m, list, empty) {
  if (empty) empty.style.display = 'none';
  var el = document.createElement('div');
  el.className = 'cr-recall-notice';
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
  q.textContent = quote.author + '：' + quote.text;
  list.appendChild(q);
  return q;
}

// 发给 AI / 用于总结的消息文字：撤回的只告诉它「撤回了一条消息」，引用的附上引用内容
function msgTextForAI(m) {
  if (m.recalled) return '[用户撤回了一条消息]';
  if (m.action && typeof actionTextForAI === 'function') return actionTextForAI(m.action);
  var c = m.voice ? ('[语音消息]' + (m.transcript ? '：' + m.transcript : '')) : (m.content || (m.imgSrc ? '[图片消息]' : ''));
  if (m.quote) c = '「引用 ' + m.quote.author + '：' + m.quote.text + '」\n' + c;
  return c;
}

// 发给 AI 的消息内容。rich = 是否附带真实媒体（只对注意力范围内的用户消息）：
// 图片 → 识图格式的真实图片；语音 →「发送音频」模式下附带录音（发送前转成 WAV），否则用转写文字
function msgContentForAI(m, rich) {
  var text = msgTextForAI(m);
  if (!rich || m.role !== 'user' || m.recalled) return text;
  if (m.imgSrc && mediaCfg.vision) {
    var parts = [];
    if (m.quote) parts.push({ type: 'text', text: '「引用 ' + m.quote.author + '：' + m.quote.text + '」' });
    parts.push({ type: 'image_url', image_url: { url: m.imgSrc } });
    return parts;
  }
  if (m.voice && mediaCfg.voiceMode === 'audio') {
    return [{ type: 'text', text: text }, { type: 'input_audio', _voiceSrc: m.voice.src }];
  }
  return text;
}

// 把角色的一次原始回复拆成多条消息（||| 分隔）并取出 <status>，写入记录并显示
function commitAssistantReply(hist, raw, list, empty) {
  var status = '';
  raw = String(raw || '').replace(/<status>([\s\S]*?)<\/status>/i, function(_, s) { status = s.trim(); return ''; });
  // 内置助手的操作块（添加世界书、改样式…）单独成为确认卡片
  var actions = [];
  if (typeof extractAssistantActions === 'function') raw = extractAssistantActions(hist, raw, actions);
  var parts = raw.split(/\n?\s*\|\|\|\s*\n?/).map(function(p) { return p.trim(); }).filter(Boolean);
  if (!parts.length && status) parts = ['…'];
  var now = Date.now();
  var added = parts.map(function(p) { return { role: 'assistant', content: p, time: now }; });
  if (added.length && status) added[added.length - 1].status = status;
  actions.forEach(function(a) { added.push({ role: 'assistant', content: '', action: a, time: now }); });
  added.forEach(function(m) {
    hist.push(m);
    if (list) renderHistMsg(m, list, empty);
  });
  return added;
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
  var cfg = getApiCfg();
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
    }
    saveHistories();
    renderChatCharList();
    // 切到后台时弹系统通知
    if (typeof notifyNewMessages === 'function') notifyNewMessages(replyChar, added);
    return added;
  }

  // 聊天视图附加回复格式要求（剧情视图不拆条、不加状态栏）；发送前把录音转成音频数据
  resolveMediaParts(buildMsgs(openingChatCharIdx).concat(isChatView ? chatFormatRules(charList[replyCharIdx]) : []))
  .then(function(messages) {
    return fetch(cfg.url.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, messages: messages, temperature: cfg.temp, stream: true }),
      signal: ctrl.signal
    });
  })
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) {
      var msg = res.status;
      try { var e = JSON.parse(t); msg = (e.error && e.error.message) || msg; } catch(_) {}
      throw new Error(msg);
    });
    var reader = res.body.getReader(), decoder = new TextDecoder('utf-8'), lineBuf = '';
    typing.bubble.innerHTML = '';
    // 处理一行 SSE 数据（行可能跨网络分块，需先拼接完整再解析）
    function handleLine(line) {
      line = line.trim();
      if (!line || line === 'data: [DONE]' || line.indexOf('data:') !== 0) return;
      try {
        var delta = JSON.parse(line.slice(5).trim()).choices[0].delta;
        var piece = (delta && delta.content) || '';
        if (piece) {
          aiText += piece;
          // 操作块不直接显示原始代码，写完后会变成确认卡片
          typing.bubble.textContent = aiText.replace(/<mphone-action>[\s\S]*?(<\/mphone-action>|$)/g, '⚙️').trim();
          if (activeList) activeList.scrollTop = 999999;
        }
      } catch(_) {}
    }
    function finishStream() {
      if (lineBuf) { handleLine(lineBuf); lineBuf = ''; }
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
    function read() {
      return reader.read().then(function(result) {
        if (result.done) { finishStream(); return; }
        lineBuf += decoder.decode(result.value, { stream: true });
        var lines = lineBuf.split('\n');
        lineBuf = lines.pop();
        lines.forEach(handleLine);
        return read();
      });
    }
    return read();
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
var crSendBtn = document.querySelector('.cr-send-btn');
var crInput   = document.getElementById('crInput');

// 追加用户消息到历史和界面（不触发 AI）；有待发送的引用就一起带上
function appendUserMsg(text) {
  if (!text || openingChatCharIdx === -1) return;
  var m = { role: 'user', content: text, time: Date.now() };
  if (pendingQuote) { m.quote = pendingQuote; clearQuote(); }
  getActiveHistory(openingChatCharIdx).push(m);
  saveHistories();
  renderHistMsg(m);
}

// ---------- 引用：输入框上方的引用条 ----------
var pendingQuote = null;   // { author, text }
function setQuote(q) {
  pendingQuote = q;
  document.getElementById('crQuoteText').textContent = '引用 ' + q.author + '：' + q.text;
  document.getElementById('crQuoteBar').classList.add('open');
  crInput.focus();
}
function clearQuote() {
  pendingQuote = null;
  document.getElementById('crQuoteBar').classList.remove('open');
}
document.getElementById('crQuoteClose').addEventListener('click', clearQuote);

// cr-send-btn（↵ 图标）：在输入框光标处插入换行，不发送
crSendBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  var start = crInput.selectionStart, end = crInput.selectionEnd;
  crInput.value = crInput.value.substring(0, start) + '\n' + crInput.value.substring(end);
  crInput.selectionStart = crInput.selectionEnd = start + 1;
  crInput.dispatchEvent(new Event('input'));
  crInput.focus();
});

// 键盘 Enter（无 Shift）：将输入框内容作为一条用户消息发送，不触发 AI
crInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    var text = crInput.value.trim();
    if (!text) return;
    appendUserMsg(text);
    crInput.value = ''; crInput.style.height = '';
  }
});

crInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 80) + 'px'; });

// ❄️ 请求回复：触发 AI 调用，使用已有历史，不追加用户消息
document.querySelector('.cr-emoji-btn').addEventListener('click', function(e) {
  e.stopPropagation();
  if (genState) { stopGenerating(); return; }
  if (openingChatCharIdx !== -1) sendMsg('', true);
});
