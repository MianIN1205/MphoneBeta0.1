// 眠花糖机 — 新建对话：选角色弹窗

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

closeOnBackdrop(newChatOverlay, closeNewChatModal);
