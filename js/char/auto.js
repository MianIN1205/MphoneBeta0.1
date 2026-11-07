// 眠花糖机 — 角色自主活动：主动发消息、聊天后按概率发动态、定时调度

// ---------- 自主活动 ----------
var DEFAULT_AUTO = { msgOn: false, mode: 'random', fixedMin: 60, randMin: 30, randMax: 180, postOn: false, postChance: 30 };
var autoCard = document.querySelector('.auto-card');

function setAutoForm(a) {
  a = Object.assign({}, DEFAULT_AUTO, a || {});
  document.getElementById('autoMsgOn').checked  = a.msgOn;
  document.getElementById('autoPostOn').checked = a.postOn;
  document.getElementById('autoFixedMin').value = a.fixedMin;
  document.getElementById('autoRandMin').value  = a.randMin;
  document.getElementById('autoRandMax').value  = a.randMax;
  document.getElementById('autoPostChance').value = a.postChance;
  document.querySelectorAll('#autoModeRow .pf-radio-btn').forEach(function(b) {
    b.classList.toggle('selected', b.dataset.mode === a.mode);
  });
  syncAutoFormUI();
}

function readAutoForm() {
  var num = function(id, def, min, max) {
    var v = parseInt(document.getElementById(id).value, 10);
    if (isNaN(v)) v = def;
    return Math.max(min, Math.min(max, v));
  };
  var modeBtn = document.querySelector('#autoModeRow .pf-radio-btn.selected');
  var rMin = num('autoRandMin', 30, 1, 10080), rMax = num('autoRandMax', 180, 1, 10080);
  return {
    msgOn:      document.getElementById('autoMsgOn').checked,
    mode:       modeBtn ? modeBtn.dataset.mode : 'random',
    fixedMin:   num('autoFixedMin', 60, 1, 10080),
    randMin:    Math.min(rMin, rMax),
    randMax:    Math.max(rMin, rMax),
    postOn:     document.getElementById('autoPostOn').checked,
    postChance: num('autoPostChance', 30, 0, 100)
  };
}

function syncAutoFormUI() {
  document.getElementById('autoMsgSub').classList.toggle('open', document.getElementById('autoMsgOn').checked);
  document.getElementById('autoPostSub').classList.toggle('open', document.getElementById('autoPostOn').checked);
  var modeBtn = document.querySelector('#autoModeRow .pf-radio-btn.selected');
  autoCard.classList.toggle('mode-fixed', !!modeBtn && modeBtn.dataset.mode === 'fixed');
}

document.getElementById('autoMsgOn').addEventListener('change', syncAutoFormUI);
document.getElementById('autoPostOn').addEventListener('change', syncAutoFormUI);
document.querySelectorAll('#autoModeRow .pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#autoModeRow .pf-radio-btn').forEach(function(b) { b.classList.remove('selected'); });
    this.classList.add('selected');
    syncAutoFormUI();
  });
});

// 聊天回复后按概率发动态
function maybeAutoPostAfterChat(idx) {
  var char = charList[idx];
  if (!char || !char.auto || !char.auto.postOn) return;
  if (Math.random() * 100 >= char.auto.postChance) return;
  if (char._autoBusy) return;
  char._autoBusy = true;
  generateCharPost(idx)
    .catch(function(err) { console.warn('[Mphone] 自动发动态失败:', err); })
    .then(function() { delete char._autoBusy; });
}

// 记录最后几条对方发了但还没被回复的消息（只发出去、没按 ❄️ 请求回复的文字、图片、语音、拍一拍）
function unrepliedUserMsgs(hist) {
  var out = [];
  for (var i = hist.length - 1; i >= 0 && hist[i].role === 'user'; i--) {
    if (!hist[i].recalled) out.unshift(hist[i]);
  }
  return out;
}

// 主动发消息：写入聊天记录；正在看这个聊天就直接显示，否则计未读
// 对方有没回复的消息时，先回应这些，回应完再看要不要开新话题
function autoSendMessage(idx) {
  var char = charList[idx];
  var hist = getChatHistory(idx);
  var last = hist[hist.length - 1];
  var pending = unrepliedUserMsgs(hist);
  var gap = '';
  // 优先用最后一条消息的时间（旧记录没有时间时退回本次打开后的记录）
  var lastAt = (last && last.time) || char._lastChatAt;
  if (lastAt) {
    var mins = Math.round((Date.now() - lastAt) / 60000);
    var ago = mins >= 60 ? Math.round(mins / 60) + ' 小时' : mins + ' 分钟';
    gap = pending.length ? '对方最后一条消息是大约 ' + ago + '前发来的。' : '距离你们上次聊天大约过去了 ' + ago + '。';
  }
  // 你还没回 TA 的时候：把 TA 自己最近发出的几条摆出来，说清楚这些已经发过了，接着往下说，不要重说一遍、不要重新回答之前的话
  var mine = [];
  if (!pending.length) {
    for (var i = hist.length - 1; i >= 0 && hist[i].role === 'assistant' && mine.length < 6; i--) {
      if (!hist[i].recalled && !hist[i].cal && !hist[i].action && !hist[i].pat) mine.unshift(msgTextForAI(hist[i]));
    }
  }
  var ask = pending.length
    ? '对方发来的 ' + pending.length + ' 条消息你还没有回复（就是聊天记录最后那几条，拍一拍也算）。请你以「' + charAuthor(char).name + '」的身份' +
      '先自然地回应这些消息；回应完如果还想继续聊，再决定要不要开启新的话题。自然简短，符合人设与当前关系。只输出消息内容本身。'
    : mine.length
    ? '你上次发的这几条，对方到现在还没回：\n' + mine.map(function(t) { return '「' + t + '」'; }).join('\n') + '\n' +
      '这些已经发出去了。请你以「' + charAuthor(char).name + '」的身份，像真人隔了一会儿再发微信那样接着往下说：' +
      '可以追一句、问问对方在忙什么、分享你这会儿在做的事、或者自然地换个话题。' +
      '不要把上面的话重说一遍或者换个说法再说，也不要重新回答对方更早说过的话。自然简短，符合人设与当前关系。只输出消息内容本身。'
    : '请你以「' + charAuthor(char).name + '」的身份主动给对方发一条消息，' +
      '可以是分享日常、想念、追问之前的话题等，自然简短，符合人设与当前关系。只输出消息内容本身。';
  // 这段要求放在最后、用「用户」身份但标明不是对方说的：有的接口（比如 Claude）最后一条是角色自己的话时，会当成要接着写那条，像卡住了重说一遍
  var msgs = charContextMsgs(idx).concat(chatFormatRules(char)).concat([activityAsk('【主动消息】现在是 ' + nowText(char) + '。' + gap + ask)]);
  // TA 正在写的时候算这个聊天窗口「正在回复」：点开能看到正在输入、❄️ 变 ⏹（点了就打断），不会再叫一次回复撞在一起
  var gk = typeof genKey === 'function' ? genKey(char, true) : '', ctrl = new AbortController();
  var gen = { ctrl: ctrl, char: char, auto: true, typing: null, previews: function() { return []; } };
  if (gk) { genStates[gk] = gen; syncGenBtn(); }
  function genDone() {
    if (gk && genStates[gk] === gen) { delete genStates[gk]; syncGenBtn(); }
    if (gen.typing) gen.typing.row.remove();
  }
  return callApiOnce(msgs, char, ctrl.signal, true).then(function(text) {
    genDone();
    if (ctrl.signal.aborted) return;
    text = stripQuotes(text);
    var viewing = appChatRoom.classList.contains('active') && openingChatCharIdx === idx;
    var showNow = viewing;   // 聊天室开着就画进聊天列表（停在剧情那边时也画，切回来就看得到），另一边的按钮冒小红点
    if (viewing && typeof crMarkOtherView === 'function') crMarkOtherView(true);
    if (typeof peekTakeLockTag === 'function') text = peekTakeLockTag(char, text);
    if (typeof lifeTakeTags === 'function') text = lifeTakeTags(char, text);   // 主动消息里问过的事也划掉
    var added = commitAssistantReply(hist, text,
      showNow ? document.getElementById('chatMsgList') : null,
      showNow ? document.getElementById('chatRoomEmpty') : null);
    if (added.length && typeof peekCaughtDone === 'function') peekCaughtDone(char);
    saveHistories();
    // 主动发来消息的角色出现在消息列表
    if (!char.inChat) { char.inChat = true; saveCharList(); }
    if (!viewing) {
      chatUnread[char.id] = (chatUnread[char.id] || 0) + added.length;
      mphoneStore.save('mphone_unread', chatUnread);
      if (typeof showInAppNotice === 'function') showInAppNotice(char, added);
      else showToast('「' + charAuthor(char).name + '」给你发来一条消息', 'success');
    }
    if (typeof notifyNewMessages === 'function') notifyNewMessages(char, added);
    renderChatCharList();
  }, function(err) {
    genDone();
    if (ctrl.signal.aborted) return;   // 用户点 ⏹ 打断的，不算失败
    throw err;
  });
}

// 调度：每个角色记录下次活动时间 { 角色 id: { at, sig } }，设置变化时重新排期
var autoNext = mphoneStore.load('mphone_auto_next', {});

function autoSig(a) { return JSON.stringify([a.msgOn, a.mode, a.fixedMin, a.randMin, a.randMax, a.postOn]); }
function autoDelay(a) {
  var mins = a.mode === 'fixed' ? a.fixedMin : a.randMin + Math.random() * (a.randMax - a.randMin);
  return mins * 60000;
}

function autoTick() {
  var now = Date.now();
  var changed = false;
  charList.forEach(function(char, idx) {
    var a = char.auto;
    if (!a || !(a.msgOn || a.postOn)) {
      if (autoNext[char.id]) { delete autoNext[char.id]; changed = true; }
      return;
    }
    // 只开了「发动态」时，定时发动态的间隔沿用随机 / 固定设置
    var sig = autoSig(a);
    var plan = autoNext[char.id];
    if (!plan || plan.sig !== sig) {
      autoNext[char.id] = { at: now + autoDelay(a), sig: sig };
      changed = true;
      return;
    }
    if (now < plan.at || char._autoBusy) return;

    // 对方有没回复的消息时，先回消息，不去发动态
    var doPost = a.postOn && (!a.msgOn || (!unrepliedUserMsgs(getChatHistory(idx)).length && Math.random() < 0.3));
    // 主动消息只在「后台」发（用户要的）：正看着这个聊天、TA 正在回复、或者刚聊过 / 刚离开不到 AUTO_QUIET_MS，都先等着，
    // 不重新排期，等条件过了下一次检查就发（不会在用户打字、刚发了两条还没点 ❄️ 的时候插进来）
    if (!doPost) {
      var viewingThis = appChatRoom.classList.contains('active') && openingChatCharIdx === idx;
      var recent = char._lastChatAt && now - char._lastChatAt < AUTO_QUIET_MS;
      if (viewingThis || recent || (typeof genBusyChar === 'function' && genBusyChar(char))) return;
    }

    // 到点：只执行一次（关闭页面期间错过的不补发多次），然后重新排期
    autoNext[char.id] = { at: now + autoDelay(a), sig: sig };
    changed = true;
    char._autoBusy = true;
    (doPost ? generateCharPost(idx) : autoSendMessage(idx))
      .catch(function(err) { console.warn('[Mphone] 自主活动失败:', err); })
      .then(function() { delete char._autoBusy; });
  });
  // 清理已删除角色
  Object.keys(autoNext).forEach(function(id) {
    if (findCharIdx(id) < 0) { delete autoNext[id]; changed = true; }
  });
  if (changed) mphoneStore.save('mphone_auto_next', autoNext);
}

// 记录最近一次聊天时间：发消息、打字、离开聊天室都算，之后 AUTO_QUIET_MS 内不发主动消息
var AUTO_QUIET_MS = 5 * 60000;
function markChatActive() { var c = charList[openingChatCharIdx]; if (c) c._lastChatAt = Date.now(); }
document.getElementById('crInput').addEventListener('input', markChatActive);
document.getElementById('crInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) markChatActive();
});
new MutationObserver(function() {
  if (!appChatRoom.classList.contains('active')) markChatActive();   // 刚离开聊天室
}).observe(appChatRoom, { attributes: true, attributeFilter: ['class'] });

// 动态里的收藏状态要用到后面脚本的函数，等全部加载完再画
onMphoneReady(function() {
  renderFeed();
  setTimeout(autoTick, 5000);
});
setInterval(autoTick, 30000);
