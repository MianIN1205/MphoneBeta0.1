// 眠花糖机 — 角色设置：返回 / 保存、世界书折叠、删除角色（倒计时确认）

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

closeOnBackdrop(charDelConfirmOverlay, function() {
  clearInterval(charDelTimer);
  charDelConfirmOverlay.classList.remove('open');
});
