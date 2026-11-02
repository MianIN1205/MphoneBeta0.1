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
  if (m.voice) return '[语音]' + (m.transcript ? ' ' + m.transcript : '');
  return String(m.content || '').replace(/〔译〕[\s\S]*$/, '').replace(/\s+/g, ' ');
}

// 消息列表：置顶在前，其余按最后一条消息的时间从新到旧；左滑出现 置顶 / 标为未读 / 删除
var SESSION_SWIPE_W = 168;
function renderChatCharList() {
  var list = document.getElementById('chatCharList');
  list.innerHTML = '';
  var sessions = [];
  charList.forEach(function(char, i) {
    if (!char.inChat) return;
    var last = lastSessionMsg(char);
    sessions.push({ char: char, idx: i, last: last, time: (last && last.time) || char.chatTouchedAt || 0 });
  });
  sessions.sort(function(a, b) {
    if (!!a.char.pinned !== !!b.char.pinned) return a.char.pinned ? -1 : 1;
    return (b.time - a.time) || (a.idx - b.idx);
  });

  sessions.forEach(function(s) {
    var char = s.char, i = s.idx;
    var row = document.createElement('div');
    row.className = 'swipe-row chat-session';

    var acts = document.createElement('div');
    acts.className = 'swipe-acts';
    [['pin', char.pinned ? '取消置顶' : '置顶'],
     ['unread', chatUnread[char.id] ? '标为已读' : '标为未读'],
     ['delete', '删除']].forEach(function(a) {
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
    card.className = 'chat-char-card' + (char.pinned ? ' pinned' : '');
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
    if (char.pinned) {
      var pin = document.createElement('span');
      pin.className = 'chat-card-pin';
      pin.textContent = '📌';
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
    lastEl.textContent = msgPreviewText(s.last);

    info.appendChild(head);
    info.appendChild(lastEl);
    card.appendChild(av);
    card.appendChild(info);
    if (chatUnread[char.id]) {
      var badge = document.createElement('span');
      badge.className = 'chat-unread-badge';
      badge.textContent = chatUnread[char.id] > 99 ? '99+' : chatUnread[char.id];
      card.appendChild(badge);
    }

    card.addEventListener('click', function() {
      openingChatCharIdx = parseInt(this.dataset.index, 10);
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
      switchChatRoomSubView('chat');
      appChatRoom.classList.add('active');
    });

    row.appendChild(acts);
    row.appendChild(card);
    bindSwipeActions(row, card, acts, SESSION_SWIPE_W);
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
