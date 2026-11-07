// 眠花糖机 — 消息列表：会话卡片、最后一条消息预览、未读数、删除会话

// =============================================
// 聊天列表角色卡片渲染 + 聊天对话界面
// =============================================
var appChatRoom        = document.getElementById('appChatRoom');
var backChatRoom       = document.getElementById('backChatRoom');
var chatRoomSettingsBtn= document.getElementById('chatRoomSettingsBtn');
var chatRoomTitle      = document.getElementById('chatRoomTitle');
var openingChatCharIdx = -1;

// 会话的最后一条消息（聊天与剧情里时间较晚的那条；旧消息没有时间时取聊天记录最后一条）
function lastSessionMsg(char) {
  var c = chatHistories[char.id] || [], d = dramaHistories[char.id] || [];
  var lc = c[c.length - 1], ld = d[d.length - 1];
  if (lc && ld && (ld.time || 0) > (lc.time || 0)) return ld;
  return lc || ld || null;
}
function msgPreviewText(m) {
  if (!m) return '暂无聊天记录';
  if (m.recalled) return (m.role === 'user' || m.recalledBy === 'user') ? '你撤回了一条消息' : '对方撤回了一条消息';
  if (m.action) return '[操作] ' + (typeof actionTitle === 'function' ? actionTitle(m.action) : '');
  if (m.pat) return '[拍一拍]';
  if (m.cal) return '[' + m.cal.kind + '] ' + m.cal.title;
  if (m.imgSrc) return '[图片]';
  if (m.file) return '[文件] ' + (m.file.name || '');
  if (m.textImg) return '[图片]';
  if (m.voice) return '[语音]' + (m.transcript ? ' ' + m.transcript : '');
  return String(m.content || '').replace(/〔译〕[\s\S]*$/, '').replace(/\s+/g, ' ');
}

// 剧情看到哪儿了：角色 id → 时间。剧情里有比这更新的角色回复，列表卡片下面多一行「[剧情]：…」（用户要的）
// 第一次用这个版本时从现在算起，以前的剧情不算新的
var dramaSeen = mphoneStore.load('mphone_drama_seen', null);
if (!dramaSeen) { dramaSeen = { _since: Date.now() }; mphoneStore.save('mphone_drama_seen', dramaSeen); }
function crDramaSeen(char) {
  if (!char || !char.id) return;
  dramaSeen[char.id] = Date.now();
  mphoneStore.save('mphone_drama_seen', dramaSeen);
}
function dramaNewMsg(char) {
  var d = dramaHistories[char.id] || [];
  for (var i = d.length - 1; i >= 0; i--) {
    if (d[i].role !== 'assistant' || d[i].action) continue;
    return (d[i].time || 0) > (dramaSeen[char.id] || dramaSeen._since || 0) ? d[i] : null;
  }
  return null;
}

// 消息列表：MianIN 固定在最上面，然后置顶的，其余按最后一条消息的时间从新到旧；左滑出现 置顶 / 标为未读 / 删除（MianIN 不能左滑）
var SESSION_SWIPE_W = 168;
function renderChatCharList() {
  var list = document.getElementById('chatCharList');
  list.innerHTML = '';
  var sessions = [];
  charList.forEach(function(char, i) {
    if (!char.inChat && !char.builtinAssistant) return;   // MianIN 一直在列表里
    var last = lastSessionMsg(char);
    sessions.push({ char: char, idx: i, last: last, time: (last && last.time) || char.chatTouchedAt || 0 });
  });
  sessions.sort(function(a, b) {
    // MianIN 固定在最上面（用户要的），然后是置顶的，再按时间
    if (!!a.char.builtinAssistant !== !!b.char.builtinAssistant) return a.char.builtinAssistant ? -1 : 1;
    if (!!a.char.pinned !== !!b.char.pinned) return a.char.pinned ? -1 : 1;
    return (b.time - a.time) || (a.idx - b.idx);
  });

  sessions.forEach(function(s) {
    var char = s.char, i = s.idx;
    var row = document.createElement('div');
    row.className = 'swipe-row chat-session';

    var acts = document.createElement('div');
    acts.className = 'swipe-acts';
    // MianIN 不能取消置顶、不能删除，只能标已读 / 未读
    var helper = !!char.builtinAssistant;
    (helper ? [['unread', chatUnread[char.id] ? '标为已读' : '标为未读']] : [['pin', char.pinned ? '取消置顶' : '置顶'],
     ['unread', chatUnread[char.id] ? '标为已读' : '标为未读'],
     ['delete', '删除']]).forEach(function(a) {
      var b = document.createElement('button');
      b.className = 'swipe-btn swipe-' + a[0];
      b.textContent = a[1];
      b.addEventListener('click', function(e) {
        e.stopPropagation();
        closeSwipeRow(row);
        if (a[0] === 'pin') { char.pinned = !char.pinned; saveCharList(); renderChatCharList(); }
        else if (a[0] === 'unread') {
          if (chatUnread[char.id]) delete chatUnread[char.id]; else chatUnread[char.id] = 1;
          mphoneStore.save('mphone_unread', chatUnread);
          renderChatCharList();
        }
        else openSessionDelete(char);
      });
      acts.appendChild(b);
    });

    var card = document.createElement('div');
    card.className = 'chat-char-card' + (char.pinned || helper ? ' pinned' : '') + (helper ? ' helper' : '');
    card.dataset.index = i;

    var av = document.createElement('div');
    av.className = 'chat-char-card-avatar';
    paintCharAvatar(av, char);

    var info = document.createElement('div');
    info.className = 'chat-char-card-info';

    var head = document.createElement('div');
    head.className = 'chat-char-card-head';
    var nameEl = document.createElement('div');
    nameEl.className = 'chat-char-card-name';
    nameEl.textContent = char.charAlias || char.charName || '未命名';
    head.appendChild(nameEl);
    // 手动置顶的：名字旁边一颗粉色小爱心（画的，不用 emoji）；MianIN 不显示爱心，右边是小助手的标
    if (char.pinned && !helper) {
      var pin = document.createElement('span');
      pin.className = 'chat-card-pin';
      pin.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.2 5 6.7 5c2 0 3.4 1.1 4.3 2.4.4.6 1.6.6 2 0C13.9 6.1 15.3 5 17.3 5c3.5 0 5.5 3.6 4.2 6.8C19.5 16.4 12 21 12 21z"/></svg>';
      head.appendChild(pin);
    }
    if (s.last && s.last.time) {
      var timeEl = document.createElement('span');
      timeEl.className = 'chat-char-card-time';
      timeEl.textContent = fmtListTime(s.last.time);
      head.appendChild(timeEl);
    }

    var lastEl = document.createElement('div');
    lastEl.className = 'chat-char-card-last';
    var chatHist = chatHistories[char.id] || [];
    lastEl.textContent = msgPreviewText(chatHist[chatHist.length - 1]);   // 第一行一直是聊天的最后一条

    info.appendChild(head);
    info.appendChild(lastEl);
    var dNew = dramaNewMsg(char);
    if (dNew) {
      var dEl = document.createElement('div');
      dEl.className = 'chat-char-card-drama';
      dEl.textContent = '[剧情]：' + msgPreviewText(dNew);
      info.appendChild(dEl);
    }
    card.appendChild(av);
    card.appendChild(info);
    if (helper) {
      var hb = document.createElement('span');
      hb.className = 'chat-card-helper';
      hb.title = '小助手';
      hb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>';
      card.appendChild(hb);
    }
    if (chatUnread[char.id]) {
      var badge = document.createElement('span');
      badge.className = 'chat-unread-badge';
      badge.textContent = chatUnread[char.id] > 99 ? '99+' : chatUnread[char.id];
      card.appendChild(badge);
    }

    card.addEventListener('click', function() {
      openingChatCharIdx = parseInt(this.dataset.index, 10);
      var hadUnread = !!chatUnread[charList[openingChatCharIdx].id];
      if (chatUnread[charList[openingChatCharIdx].id]) {
        delete chatUnread[charList[openingChatCharIdx].id];
        mphoneStore.save('mphone_unread', chatUnread);
        var b = this.querySelector('.chat-unread-badge');
        if (b) b.remove();
        updateUnreadTotal();
      }
      var char = charList[openingChatCharIdx];
      chatRoomTitle.textContent = char.charAlias || char.charName || '未命名';
      applyChatRoomStyle(char);
      // 回到上次离开时的那边（聊天 / 剧情，用户要的）；有没看的新消息时先看聊天
      switchChatRoomSubView(hadUnread ? 'chat' : ((crLastView[char.id] === 'contacts') ? 'contacts' : 'chat'));
      appChatRoom.classList.add('active');
    });

    // MianIN 固定在最上面，没有左滑（用户要的）
    if (!helper) row.appendChild(acts);
    row.appendChild(card);
    if (!helper) bindSwipeActions(row, card, acts, SESSION_SWIPE_W);
    list.appendChild(row);
  });
  updateUnreadTotal();
  renderContactList();
}

// 底部「消息」标签上的未读总数
function updateUnreadTotal() {
  var badge = document.getElementById('chatTabBadge');
  if (!badge) return;
  var total = 0;
  charList.forEach(function(c) { if (c.inChat) total += chatUnread[c.id] || 0; });
  badge.textContent = total > 99 ? '99+' : total;
  badge.classList.toggle('show', total > 0);
  // 桌面上的 Chat 图标：有未读就一个小红点，不显示数字
  var dock = document.querySelector('#dockChat .dock-icon');
  if (dock) dock.classList.toggle('has-unread', total > 0);
}

// 删除会话：只从列表移走（保留记录），或连聊天记录一起删除
var sessionDelTarget = null;
function openSessionDelete(char) {
  if (char && char.builtinAssistant) return;   // MianIN 删不掉
  sessionDelTarget = char;
  document.getElementById('sessionDelName').textContent = '删除与「' + (char.charAlias || char.charName || '未命名') + '」的聊天';
  document.getElementById('sessionDelOverlay').classList.add('open');
}
function closeSessionDelete() {
  sessionDelTarget = null;
  document.getElementById('sessionDelOverlay').classList.remove('open');
}
document.getElementById('sessionDelCancel').addEventListener('click', closeSessionDelete);
closeOnBackdrop(document.getElementById('sessionDelOverlay'), closeSessionDelete);
document.getElementById('sessionDelHide').addEventListener('click', function() {
  var char = sessionDelTarget;
  if (!char) return;
  char.inChat = false;
  char.pinned = false;
  delete chatUnread[char.id];
  mphoneStore.save('mphone_unread', chatUnread);
  saveCharList();
  closeSessionDelete();
  renderChatCharList();
  showToast('已从消息列表移除，聊天记录还在', 'success');
});
document.getElementById('sessionDelClear').addEventListener('click', function() {
  var char = sessionDelTarget;
  if (!char) return;
  char.inChat = false;
  char.pinned = false;
  delete chatHistories[char.id];
  delete dramaHistories[char.id];
  delete chatUnread[char.id];
  saveHistories();
  mphoneStore.save('mphone_unread', chatUnread);
  saveCharList();
  closeSessionDelete();
  renderChatCharList();
  showToast('已删除聊天记录', 'success');
});
