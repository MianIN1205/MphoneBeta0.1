// 眠花糖机 — 新建对话 — 角色选择弹窗

// =============================================
// 新建对话 — 角色选择弹窗
// =============================================
var newChatOverlay        = document.getElementById('newChatOverlay');
var newChatList           = document.getElementById('newChatList');
var newChatCancel         = document.getElementById('newChatCancel');
var newChatConfirm        = document.getElementById('newChatConfirm');
var selectedNewChatIndex  = -1;

function openNewChatModal() {
  selectedNewChatIndex = -1;
  newChatList.innerHTML = '';
  charList.forEach(function(char, i) {
    var item = document.createElement('div');
    item.className = 'new-chat-char-item';
    item.dataset.index = i;

    var av = document.createElement('div');
    av.className = 'new-chat-char-avatar';
    paintCharAvatar(av, char);

    var info = document.createElement('div');
    info.className = 'new-chat-char-info';

    var alias = document.createElement('div');
    alias.className = 'new-chat-char-alias';
    alias.textContent = char.charAlias;
    info.appendChild(alias);

    if (char.charName) {
      var cname = document.createElement('div');
      cname.className = 'new-chat-char-name';
      cname.textContent = char.charName;
      info.appendChild(cname);
    }

    item.appendChild(av);
    item.appendChild(info);

    item.addEventListener('click', function() {
      var idx = parseInt(this.dataset.index, 10);
      if (selectedNewChatIndex === idx) {
        // 再次点击已选中项 → 取消选中
        this.classList.remove('selected');
        selectedNewChatIndex = -1;
      } else {
        document.querySelectorAll('.new-chat-char-item').forEach(function(el) {
          el.classList.remove('selected');
        });
        this.classList.add('selected');
        selectedNewChatIndex = idx;
      }
    });

    newChatList.appendChild(item);
  });
  newChatOverlay.classList.add('open');
}

function closeNewChatModal() {
  newChatOverlay.classList.remove('open');
  selectedNewChatIndex = -1;
}

// 「新建对话」菜单项
msgPlusItems[0].addEventListener('click', function(e) {
  e.stopPropagation();
  msgPlusPopup.classList.remove('open');
  openNewChatModal();
});

newChatCancel.addEventListener('click', function() {
  closeNewChatModal();
});

// 确认 → 直接进入所选角色的聊天
newChatConfirm.addEventListener('click', function() {
  var idx = selectedNewChatIndex;
  if (idx < 0) { shakeEl(newChatList); return; }
  closeNewChatModal();
  if (!charList[idx].inChat) {
    charList[idx].inChat = true;
    charList[idx].chatTouchedAt = Date.now();   // 还没有消息时，按开启时间排到前面
    saveCharList();
    renderChatCharList();
  }
  var card = document.querySelector('#chatCharList .chat-char-card[data-index="' + idx + '"]');
  if (card) card.click();
});

newChatOverlay.addEventListener('click', function(e) {
  if (e.target === newChatOverlay) closeNewChatModal();
});

// 返回（不保存）：撤销「应用」的预览样式
backCharSetting.addEventListener('click', function() {
  rememberCsView();
  appCharSetting.classList.remove('active');
  var opened = appChatRoom.classList.contains('active') ? charList[openingChatCharIdx] : null;
  applyChatRoomStyle(opened || null);
});

// 保存
charSaveBtn.addEventListener('click', function() {
  var aliasInput = document.getElementById('charAlias');
  var alias = aliasInput.value.trim();

  if (!alias) {
    aliasInput.classList.remove('shake');
    void aliasInput.offsetWidth;
    aliasInput.classList.add('shake');
    aliasInput.addEventListener('animationend', function() {
      aliasInput.classList.remove('shake');
    }, { once: true });
    return;
  }

  var data = readCharForm();

  if (editingCharIndex === -1) {
    data.id = genCharId();
    data.inChat = false;   // 新角色只进通讯录，新建对话后才出现在消息列表
    // 导入的世界书：确认添加角色时才建同名文件夹写入，并整体关联
    var pendingCb = document.getElementById('wbPendingCb');
    if (csPendingWb && pendingCb && pendingCb.checked) {
      var folder = { id: genWbId('wf'), name: data.charAlias || data.charName || '导入角色' };
      wbFolders.push(folder);
      csPendingWb.entries.forEach(function(e) {
        wbEntries.push(Object.assign({ id: genWbId('wb'), folderId: folder.id }, e));
      });
      saveWbEntries();
      renderWbList();
      data.worldbookFolders = (data.worldbookFolders || []).concat(folder.id);
    }
    delete data.pendingWb;
    csPendingWb = null;
    charList.push(data);
    syncCharCircle(data);
    saveCharList();
    renderChatCharList();
    appCharSetting.classList.remove('active');
    // 新卡片发光效果
    var newCard = document.querySelector('#contactList .chat-char-card[data-index="' + (charList.length - 1) + '"]');
    if (newCard) {
      newCard.classList.add('card-glow');
      newCard.addEventListener('animationend', function() {
        newCard.classList.remove('card-glow');
      }, { once: true });
    }
  } else {
    data.id = charList[editingCharIndex].id;
    data.inChat = charList[editingCharIndex].inChat;
    charList[editingCharIndex] = data;
    syncCharCircle(data);
    saveCharList();
    if (openingChatCharIdx === editingCharIndex) {
      chatRoomTitle.textContent = data.charAlias || data.charName || '未命名';
      applyChatRoomStyle(data);
    }
    renderChatCharList();
    // 编辑模式：保存后同样关闭界面
    rememberCsView();
    appCharSetting.classList.remove('active');
  }

  charSaveBtn.style.transform = 'scale(0.88)';
  setTimeout(function() { charSaveBtn.style.transform = ''; }, 160);
});

// 世界书折叠
var wbHeader  = document.getElementById('wbHeader');
var wbContent = document.getElementById('wbContent');
var wbArrow   = document.getElementById('wbArrow');

wbHeader.addEventListener('click', function() {
  var isOpen = wbContent.classList.toggle('open');
  wbArrow.classList.toggle('open', isOpen);
});

// 角色删除确认弹窗逻辑
var charDelConfirmOverlay = document.getElementById('charDelConfirmOverlay');
var charDelOkBtn          = document.getElementById('charDelOkBtn');
var charDelCountdown      = document.getElementById('charDelCountdown');
var charDelCancelBtn      = document.getElementById('charDelCancelBtn');
var charDeleteBtn         = document.getElementById('charDeleteBtn');
var charDelTimer          = null;

charDeleteBtn.addEventListener('click', function() {
  if (editingCharIndex === -1) return;
  charDelOkBtn.disabled = true;
  var count = 3;
  charDelCountdown.textContent = '(' + count + ')';
  charDelConfirmOverlay.classList.add('open');
  clearInterval(charDelTimer);
  charDelTimer = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(charDelTimer);
      charDelOkBtn.disabled = false;
      charDelCountdown.textContent = '';
    } else {
      charDelCountdown.textContent = '(' + count + ')';
    }
  }, 1000);
});

charDelCancelBtn.addEventListener('click', function() {
  clearInterval(charDelTimer);
  charDelConfirmOverlay.classList.remove('open');
});

charDelOkBtn.addEventListener('click', function() {
  if (this.disabled) return;
  clearInterval(charDelTimer);
  charDelConfirmOverlay.classList.remove('open');
  var removed = charList.splice(editingCharIndex, 1)[0];
  if (removed) {
    delete chatHistories[removed.id]; delete dramaHistories[removed.id]; saveHistories();
    delete chatUnread[removed.id]; mphoneStore.save('mphone_unread', chatUnread);
    charList.forEach(function(c) { if (c.circle) c.circle = c.circle.filter(function(id) { return id !== removed.id; }); });
  }
  saveCharList();
  applyChatRoomStyle(null);
  renderChatCharList();
  appCharSetting.classList.remove('active');
  appChatRoom.classList.remove('active');
  editingCharIndex = -1;
  openingChatCharIdx = -1;
});

charDelConfirmOverlay.addEventListener('click', function(e) {
  if (e.target === charDelConfirmOverlay) {
    clearInterval(charDelTimer);
    charDelConfirmOverlay.classList.remove('open');
  }
});

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
  if (m.recalled) return m.role === 'user' ? '你撤回了一条消息' : '对方撤回了一条消息';
  if (m.action) return '[操作] ' + (typeof actionTitle === 'function' ? actionTitle(m.action) : '');
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
document.getElementById('sessionDelOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeSessionDelete();
});
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

// 聊天对话界面 — 返回
backChatRoom.addEventListener('click', function() {
  closeCrPlusPanel();
  appChatRoom.classList.remove('active');
  applyChatRoomStyle(null);
  renderChatCharList();   // 刷新列表里的最后一条消息
});

// 聊天对话界面 — 设置按钮 → 角色设置界面
chatRoomSettingsBtn.addEventListener('click', function() {
  if (openingChatCharIdx === -1) return;
  openCharSetting(openingChatCharIdx, null, true);
});

// 把角色的聊天背景、气泡样式、专属 CSS 应用到聊天室；char 为 null 时清除
var crCharStyleEl = document.createElement('style');
crCharStyleEl.id = 'crCharStyle';
document.head.appendChild(crCharStyleEl);

function hexToRgba(hex, a) {
  var n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}

// 气泡颜色 / 透明度 / 效果 / 显示格式 → CSS（scope：聊天室，或美化页里的小预览）
function lookCss(part, scope) {
  var look = Object.assign({}, DEFAULT_LOOK, part.look || {});
  var b = part.bubble || DEFAULT_BUBBLE;
  var colors = BUBBLE_PRESETS[b.preset] || BUBBLE_PRESETS[0];
  var op = (b.opacity === undefined ? 85 : b.opacity) / 100;
  var effects = {
    'shadow-out': function()  { return '0 2px 8px rgba(0,0,0,0.14)'; },
    'shadow-in':  function()  { return 'inset 0 1px 5px rgba(0,0,0,0.14)'; },
    'glow':       function(c) { return '0 0 10px ' + hexToRgba(c === '#FFFFFF' ? '#E0C8D0' : c, 0.9); }
  };
  var fx = effects[b.effect];
  var sel = scope + ' .chat-msg-row';
  var css =
    sel + '.ai .chat-msg-bubble:not(.error) { background: ' + hexToRgba(colors[0], op) + ';' + (fx ? ' box-shadow: ' + fx(colors[0]) + ';' : '') + ' }\n' +
    sel + '.user .chat-msg-bubble:not(.error) { background: ' + hexToRgba(colors[1], op) + ';' + (fx ? ' box-shadow: ' + fx(colors[1]) + ';' : '') + ' }\n';
  if (!look.showAvatar) css += scope + ' .chat-msg-avatar { display: none; }\n';
  // 文段：不要气泡，像小说一样整段排开；自己说的话用浅一点的颜色靠右
  if (look.format === 'text') {
    css += sel + ' .chat-msg-bubble:not(.error) { background: transparent !important; box-shadow: none !important; max-width: 100%; padding: 2px 2px; border-radius: 0; line-height: 1.8; }\n' +
           sel + ' .chat-msg-avatar { display: none; }\n' +
           sel + '.user .chat-msg-bubble:not(.error) { color: #8a6a76; text-align: right; }\n';
  }
  return css;
}
// 当前子视图（聊天 / 剧情）用的那套美化
function roomLookPart(char) {
  if (currentCrSubView === 'contacts' && char.dramaLook) return char.dramaLook;
  return { chatBg: char.chatBg, bubble: char.bubble, look: char.look, customCss: char.customCss };
}

function applyChatRoomStyle(char) {
  var content = document.getElementById('chatRoomContent');
  content.style.background = '';
  appChatRoom.classList.remove('cr-no-avatar', 'cr-head-avatar', 'cr-head-left');
  if (!char) { crCharStyleEl.textContent = ''; return; }

  var part = roomLookPart(char);
  var look = Object.assign({}, DEFAULT_LOOK, part.look || {});
  if (!look.showAvatar) appChatRoom.classList.add('cr-no-avatar');
  if (look.headAvatar) appChatRoom.classList.add('cr-head-avatar');
  if (look.headAlign === 'left') appChatRoom.classList.add('cr-head-left');
  paintCharAvatar(document.getElementById('chatRoomHeadAv'), char);

  var bg = part.chatBg || DEFAULT_CHAT_BG;
  if (bg.image) {
    content.style.background = 'url(' + bg.image + ') center / cover no-repeat';
  } else if (bg.color) {
    content.style.background = bg.color;
  }

  // 状态栏样式只属于聊天窗口
  var chatLook = Object.assign({}, DEFAULT_LOOK, char.look || {});
  crCharStyleEl.textContent = lookCss(part, '#appChatRoom') +
    (currentCrSubView === 'contacts' ? '' : (chatLook.statusCss || '')) + '\n' +
    (part.customCss || '');
  if (typeof renderQuickBar === 'function') renderQuickBar();
}
