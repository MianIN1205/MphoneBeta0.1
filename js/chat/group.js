// 眠花糖机 — 群聊：几个角色和你在一个群里。群也放在 charList 里（isGroup: true, members: [角色 id]），
// 聊天室、记录、未读、通知、重新生成都直接用原来的；角色专属的功能（动态、星星、日记、记忆库、通讯录…）都跳过群（搜 isGroup）。
// 回复：一次请求写全群（用户定的），每行「名字：内容」，小手机拆成一条条、记在 m.speaker 上（js/chat/reply.js 的 sendMsg 接这里）
// groupCfg = { knows: { 角色id: false }（私聊时知不知道群里聊了什么，默认知道）, autoOn（没人说话时自己热闹）, autoGapH }

function isGroupChar(c) { return !!(c && c.isGroup); }
function groupLabel(c) { return c.charAlias || c.charName || (c.builtinAssistant && typeof MIANIN_NAME !== 'undefined' ? MIANIN_NAME : '角色'); }
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
    var s = '【' + groupLabel(c) + '】\n' + (persona ? fillMacros(persona, c) : '（没有写人设）');
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
  var seen = {}, wbList = [];
  members.forEach(function(c) {
    if (typeof getActiveWbEntries !== 'function') return;
    getActiveWbEntries(c, history, false).forEach(function(e) {
      var k = e.id || (e.name + '\n' + e.content);
      if (!seen[k]) { seen[k] = { text: '【' + e.name + '】\n' + e.content, owners: [] }; wbList.push(seen[k]); }
      if (seen[k].owners.indexOf(c) < 0) seen[k].owners.push(c);
    });
  });
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
  msgs.push({ role: 'system', content: '【现在】' + groupNowText() + '。心里有数就好，不用主动报时间。' });
  // 记录：最近的，按 token 裁掉更早的；角色的话写成「名字：内容」，同一轮连着的合在一起
  var hist = history.slice(-80), total = 0, from = hist.length;
  while (from > 0 && total < 16000) { from--; total += msgTokens(hist[from]); }
  hist = hist.slice(total >= 16000 ? from + 1 : from);
  var richFrom = Math.max(0, hist.length - 20), out = [];
  hist.forEach(function(m, i) {
    if (m.role === 'assistant') {
      var who = m.speaker ? charList[findCharIdx(m.speaker)] : null;
      var line = (who ? groupLabel(who) : names[0] || '群友') + '：' + msgTextForAI(m);
      var last = out[out.length - 1];
      if (last && last.role === 'assistant') last.content += '\n' + line; else out.push({ role: 'assistant', content: line });
    } else out.push({ role: 'user', content: msgContentForAI(m, i >= richFrom, g) });
  });
  var fileSys = typeof filesContextFor === 'function' ? filesContextFor(hist) : null;
  return msgs.concat(fileSys ? [fileSys] : [], out);
}
function groupFormatRules(g) {
  var names = groupMembers(g).map(groupLabel);
  return [{ role: 'system', content: groupFill(g,
    '【群聊回复格式】接着群里的聊天往下说：不是每个人每次都要开口，谁会接这个话题谁就说，一共 2～8 条，像真的群聊一样有来有回、有人插话。' +
    '每条单独一行，开头写说话人的名字和冒号（名字只能是：' + names.join('、') + '），比如：\n' +
    names.slice(0, 2).map(function(n, i) { return n + '：' + (i ? '我在我在！' : '在吗。'); }).join('\n') +
    '\n' + (typeof gpTagRule === 'function' ? gpTagRule() : '') + '\n同一个人连着说几句可以写在一行里，每句照常写标点，小手机会按句子分成气泡。像平时发微信一样说话，口语、短句；不写旁白、动作描写和括号说明，不替{{user}}说话。') }];
}

// ---------- 收到回复：按「名字：」拆给每个成员 ----------
function groupCommitReply(g, hist, raw, list) {
  raw = typeof takeThink === 'function' ? takeThink(raw).text : String(raw || '');
  // 投票 / 红包 / 抽奖的标签先换成占位，免得下面被当成别的标签去掉（js/chat/group-play.js）
  var plays = [];
  if (typeof GP_TAG_RE !== 'undefined') raw = raw.replace(GP_TAG_RE, function(_, kind, attrs, body) { plays.push([kind, attrs, body]); return '\u0001P' + (plays.length - 1) + '\u0001'; });
  raw = raw.replace(/<status>[\s\S]*?(<\/status>|$)/gi, '').replace(/<([一-鿿A-Za-z]+)[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<[一-鿿]+[^>]*\/>/g, '');
  var members = groupMembers(g), byName = {};
  members.forEach(function(c) {
    [c.charAlias, c.charName, groupLabel(c)].concat(c.builtinAssistant && typeof MIANIN_NAME !== 'undefined' ? [MIANIN_NAME] : []).forEach(function(n) { if (n) byName[String(n).trim()] = c.id; });
  });
  var userName = resolveCharAccount(g).nickname || '';
  var segs = [], cur = null, skip = false;
  raw.split('\n').forEach(function(line) {
    var m = line.match(/^\s*[【\[]?\s*@?([^：:\]】\n]{1,20}?)\s*[\]】]?\s*[：:]\s*(.*)$/);
    var name = m && m[1].trim();
    if (m && byName[name]) { cur = { id: byName[name], text: m[2] }; segs.push(cur); skip = false; return; }
    if (m && (name === userName || name === '{{user}}' || name === '用户')) { skip = true; cur = null; return; }   // 替用户说的话不要
    if (skip || !line.trim()) return;
    if (!cur) { cur = { id: members[0] && members[0].id, text: '' }; segs.push(cur); }
    cur.text += (cur.text ? '\n' : '') + line;
  });
  var now = Date.now(), added = [];
  segs.forEach(function(s) {
    if (!s.id || !s.text.trim()) return;
    s.text.split(/\u0001P(\d+)\u0001/).forEach(function(piece, k) {
      if (k % 2) {   // 占位：这个人发起的投票 / 红包 / 抽奖
        var t = plays[+piece], play = t && gpFromTag(t[0], t[1], t[2], g, s.id);
        if (play) added.push({ role: 'assistant', content: '[' + GP_NAMES[play.kind] + '] ' + (play.q || play.prize || play.wish), play: play, speaker: s.id, time: now });
        return;
      }
      var text = piece.replace(actionRe(), '').replace(/[ \t]{2,}/g, ' ').trim();
      if (!text) return;
      chatSplitLines([text]).forEach(function(p) {
        if (typeof p !== 'string' || !p.trim() || CHAT_MARK_RE.test(p.trim())) return;
        added.push({ role: 'assistant', content: p, speaker: s.id, time: now });
      });
    });
  });
  added.forEach(function(m) { hist.push(m); if (list) renderHistMsg(m, list, null); });
  added.forEach(function(m) { if (m.play && typeof gpAfterAdd === 'function') gpAfterAdd(g, m); });
  return added;
}

// ---------- 私聊时知道群里聊了什么（每个成员能单独关掉，用户要的） ----------
function groupContextLine(char) {
  if (!char || char.isGroup) return '';
  var out = [];
  groupsOf(char).forEach(function(g) {
    if (groupCfgOf(g).knows[char.id] === false) return;
    var h = (chatHistories[g.id] || []).filter(function(m) { return !m.pat && !m.action && !m.cal && Date.now() - (m.time || 0) < 3 * 86400000; }).slice(-12);
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
              charAlias: '', inChat: true, chatTouchedAt: Date.now(), groupCfg: { knows: {}, autoOn: false, autoGapH: 1 } };
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
  paintCharAvatar(document.getElementById('grpAvatarBox'), Object.assign({}, e.g, { members: e.picked, charAvatar: e.avImg }));
}
function grpPaintKnows() {
  var e = grpEdit, box = document.getElementById('grpKnows');
  box.innerHTML = '';
  e.picked.forEach(function(id) {
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
  grpEdit = { g: g, picked: (g.members || []).slice(), knows: Object.assign({}, cfg.knows), avImg: g.charAvatar || '', gap: cfg.autoGapH };
  document.getElementById('grpName').value = g.charName || '';
  document.getElementById('grpAutoOn').checked = !!cfg.autoOn;
  groupMemberChips(document.getElementById('grpMembers'), grpEdit.picked, function() { grpPaintKnows(); grpPaintAv(); });
  grpPaintKnows(); grpPaintAv(); grpPaintGap();
  appGroupSetting.querySelector('.settings-content').scrollTop = 0;
  appGroupSetting.classList.add('active');
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
  if (e.picked.length < 2) { shakeEl(document.getElementById('grpMembers')); showToast('群里至少要有两个角色', 'error'); return; }
  if (!nameIn.value.trim()) { shakeEl(nameIn); return; }
  var g = e.g;
  g.charName = nameIn.value.trim().slice(0, 20);
  g.members = e.picked.slice();
  g.charAvatar = e.avImg;
  Object.keys(e.knows).forEach(function(id) { if (e.picked.indexOf(id) < 0) delete e.knows[id]; });
  g.groupCfg = { knows: e.knows, autoOn: document.getElementById('grpAutoOn').checked, autoGapH: e.gap };
  saveCharList();
  closeGroupSetting();
  if (charList[openingChatCharIdx] === g) { chatRoomTitle.textContent = groupTitle(g); paintChatSubTitle(g); }
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
