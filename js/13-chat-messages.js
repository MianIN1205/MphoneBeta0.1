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
// 传入角色且它在便捷拓展栏选了模型预设时，用那套预设（见 29-quick-bar.js）
function getApiCfg(char) {
  var p = (char && typeof charApiPreset === 'function') ? charApiPreset(char) : null;
  if (p) return { url: p.url || '', key: p.key || '', model: p.model || '', temp: isNaN(parseFloat(p.temp)) ? 0.8 : parseFloat(p.temp) };
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

// 角色名下面那行小字：角色在聊天回复里写 <签名>…</签名> 就更新，没写过时用默认的
var CHAT_SUB_DEFAULT = '嗯嗯你说我在听';
function paintChatSubTitle(char) {
  document.getElementById('chatRoomSubTitle').textContent = (char && char.headStatus) || CHAT_SUB_DEFAULT;
}

// 聊天回复的格式要求：语言 / 翻译 / 回复条数 / 状态栏（发消息和主动消息使用，动态不用）
function chatFormatRules(char) {
  var c = Object.assign({}, DEFAULT_CHAT_CFG, char.chatCfg || {});
  var look = Object.assign({}, DEFAULT_LOOK, char.look || {});
  var rules = [];
  // 线上聊天的说话方式（系统提示里关于动作、心理描写的要求只用在剧情空间）
  if (c.actionOn) {
    rules.push('现在是线上聊天：像发微信一样说话，用短句、口语化，以对话为主。可以偶尔用 *星号* 包住一小句你自己这边的动作或神态（比如 *盯着屏幕笑了一下*），不写长段的心理和环境描写。');
  } else {
    rules.push('现在是线上聊天：像发微信一样说话，用短句、口语化，一条消息一般不超过两三句。只写你发出去的聊天内容，不写动作、神态、心理和环境描写，也不要用 *星号* 或括号写旁白（系统提示里关于动作、心理描写的要求只适用于剧情空间）。');
  }
  if (c.lang && !/^(中文|汉语|简体中文|chinese)$/i.test(c.lang)) {
    rules.push('请使用' + c.lang + '回复。');
    if (c.translate) rules.push('每条消息的外语正文后另起一行，以「〔译〕」开头给出中文翻译。');
  }
  if (c.replyMax > 1) {
    rules.push('像发微信一样，把这次回复拆成 ' + (c.replyMin === c.replyMax ? c.replyMax : c.replyMin + '~' + c.replyMax) +
               ' 条消息，每两条之间单独一行写 |||');
  }
  // 名字下面那行小字：状态变了才写，跟着这次回复一起带回来
  rules.push('如果你此刻的状态有变化（在做什么、心情），在全部消息最后另起一行写 <签名>不超过 12 个字</签名>，' +
             '它会显示在聊天界面你名字的下面，像微信状态一样（比如「在赶地铁」「有点困了」）。现在显示的是「' +
             (char.headStatus || CHAT_SUB_DEFAULT) + '」，没变就不用写。');
  if (look.statusOn && look.statusTpl) {
    rules.push('在全部消息之后，另起一行用 <status></status> 包住你当前的状态。状态按下面的 HTML 模板输出：' +
               '保留模板里的标签和样式，只把内容换成你此刻的真实状态。\n' + fillMacros(look.statusTpl, char));
  } else if (look.statusOn) {
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

// 另一个窗口最近发生的事（聊天窗口带剧情空间的，剧情窗口带线上聊天的总结和最近记录），标明是在哪边发生的
var CROSS_SCENE_MSGS = 12;
function crossSceneContext(idx, isDrama) {
  var char = charList[idx] || {};
  var other = isDrama ? getChatHistory(idx) : getDramaHistory(idx);
  var charName = char.charAlias || char.charName || '角色';
  var userName = resolveCharAccount(char).nickname || '用户';
  var lines = other.filter(function(m) { return !m.action; }).slice(-CROSS_SCENE_MSGS).map(function(m) {
    var t = String(msgTextForAI(m)).replace(/\s+/g, ' ').trim();
    if (t.length > 150) t = t.slice(0, 150) + '…';
    return (m.role === 'user' ? userName : charName) + '：' + t;
  }).filter(function(l) { return !/：$/.test(l); });
  if (isDrama) {
    var sums = ((char.memory || {}).summaries || []).map(function(s) { return s.text; });
    if (!sums.length && !lines.length) return '';
    return '【线上聊天的前情】以下是你们在线上聊天里的经过（那时你们隔着手机屏幕）：\n' +
      (sums.length ? sums.join('\n') + (lines.length ? '\n最近的聊天：\n' : '') : '') + lines.join('\n');
  }
  if (!lines.length) return '';
  return '【剧情空间里最近发生的事】你记得这些，但那是在剧情空间里发生的；现在你们在线上聊天，仍然隔着屏幕：\n' + lines.join('\n');
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
  var isDrama = history === getDramaHistory(idx);

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

  // 记忆库：珍贵的回忆 + 和最近对话相关的记忆 + 怎样记下新记忆（权限在角色设置「扩展」页）
  var memSys = (typeof memoryContextFor === 'function') ? memoryContextFor(char, history) : '';
  if (memSys) msgs.push({ role: 'system', content: memSys });

  // 世界书：按注入位置分组（前 = 紧跟系统提示，中 = 预设条目之后，后 = 聊天记录之后）
  var wbByPos = { before: [], middle: [], after: [] };
  getActiveWbEntries(char, history).forEach(function(e) {
    (wbByPos[e.pos] || wbByPos.before).push({ role: 'system', content: '【世界书 · ' + e.name + '】\n' + e.content });
  });
  msgs = msgs.concat(wbByPos.before);

  // 注入当前预设中已启用的提示词条目（按条目各自的 role 身份发送）
  var curPreset = (typeof charPromptPreset === 'function') ? charPromptPreset(char) : (stPresets && stPresets[stActivePresetIdx]);
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
  // 聊天和剧情的记忆互通：带上另一边的前情（剧情窗口还带聊天的记忆总结），再说明现在在哪个空间
  var cross = crossSceneContext(idx, isDrama);
  if (cross) msgs.push({ role: 'system', content: cross });
  if (typeof scenePrompt === 'function') msgs.push({ role: 'system', content: scenePrompt(isDrama) });
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
  q.textContent = quote.author + '：' + fillMacros(quote.text, charList[openingChatCharIdx]);   // 以前存下的引用可能还带着 {{user}}
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
  // 图片前面带一句文字：有些接口（如部分 Gemini 中转）不接受只有图片、没有文字的消息
  if (m.imgSrc && mediaCfg.vision) {
    var parts = [{ type: 'text', text: (m.quote ? '「引用 ' + m.quote.author + '：' + m.quote.text + '」\n' : '') + '（我发了一张图片）' }];
    parts.push({ type: 'image_url', image_url: { url: m.imgSrc } });
    return parts;
  }
  // 「发送音频」模式，或「转成文字」但还没转出文字（比如接口不支持语音识别）时，直接把录音发过去
  if (m.voice && (mediaCfg.voiceMode === 'audio' || !m.transcript)) {
    return [{ type: 'text', text: text }, { type: 'input_audio', _voiceSrc: m.voice.src }];
  }
  return text;
}

// 把角色的一次原始回复拆成多条消息（||| 分隔）并取出 <status>，写入记录并显示
function commitAssistantReply(hist, raw, list, empty) {
  var status = '', headStatus = '';
  raw = String(raw || '').replace(/<status>([\s\S]*?)<\/status>/i, function(_, s) { status = s.trim(); return ''; });
  raw = raw.replace(/<签名>([\s\S]*?)<\/签名>/g, function(_, s) { headStatus = s.replace(/\s+/g, ' ').trim().slice(0, 20); return ''; });
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
  if (rc && chatHistories[rc.id] === hist && !(rc.chatCfg && rc.chatCfg.actionOn)) {
    raw = raw.replace(/\*[^*\n]+\*/g, '').replace(/[ \t]{2,}/g, ' ');
  }
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
  if (status && typeof refreshStatusPanel === 'function') refreshStatusPanel();
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
    }
    saveHistories();
    renderChatCharList();
    // 切到后台时弹系统通知
    if (typeof notifyNewMessages === 'function') notifyNewMessages(replyChar, added);
    return added;
  }

  // 聊天视图附加回复格式要求（剧情视图不拆条、不加状态栏）；请求按接口类型自动适配（见 24-llm.js）
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
    return llmRequest(buildMsgs(replyCharIdx).concat(isChatView ? chatFormatRules(charList[replyCharIdx]) : []), {
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
        .replace(/<记忆[\s\S]*?(<\/记忆>|$)/g, '').replace(/<签名[\s\S]*?(<\/签名>|$)/g, '').trim();
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
