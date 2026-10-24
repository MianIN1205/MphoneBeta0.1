// 眠花糖机 — 消息页右侧控件

// =============================================
// 消息页右侧控件
// =============================================
var msgRightWrap    = document.getElementById('msgRightWrap');
var msgToggleSlider = document.getElementById('msgToggleSlider');
var msgBtnChat      = document.getElementById('msgBtnChat');
var msgBtnContacts  = document.getElementById('msgBtnContacts');
var msgPlusBtn      = document.getElementById('msgPlusBtn');
var msgPlusPopup    = document.getElementById('msgPlusPopup');

// 打开 Chat 时显示消息页控件
dockChat.addEventListener('click', function() {
  msgRightWrap.classList.add('visible');
});

// 返回时隐藏并重置
backChat.addEventListener('click', function() {
  msgRightWrap.classList.remove('visible');
  msgPlusPopup.classList.remove('open');
});

// tab 切换时显隐（追加，不修改原有 listener）
document.querySelectorAll('.chat-tab-item').forEach(function(tab) {
  tab.addEventListener('click', function() {
    var tabId = this.dataset.tab;
    msgRightWrap.classList.toggle('visible', tabId === 'messages');
    if (tabId !== 'messages') {
      msgPlusPopup.classList.remove('open');
    }
  });
});

// 聊天窗口内：聊天 / 剧情切换滑块
var crViewChat     = document.querySelector('#chatRoomContent .cr-view[data-crview="chat"]');
var crViewContacts = document.querySelector('#chatRoomContent .cr-view[data-crview="contacts"]');
var crBottomBar    = document.getElementById('crBottomBar') || document.querySelector('#appChatRoom .chat-room-bottom');
var crPlusBtn      = document.getElementById('crPlusBtn');
var crPlusPanel    = document.getElementById('crPlusPanel');
var currentCrSubView = 'chat';

var crEmojiBtn   = document.getElementById('crEmojiToggleBtn');
var crEmojiPanel = document.getElementById('crEmojiPanel');

// 收起底部所有抽屉（加号 + 表情包）
function closeCrPlusPanel() {
  [[crPlusPanel, crPlusBtn], [crEmojiPanel, crEmojiBtn]].forEach(function(p) {
    if (p[0]) p[0].classList.remove('open');
    if (p[1]) p[1].classList.remove('active');
  });
  if (crBottomBar) crBottomBar.classList.remove('panel-open');
}

// 切换某个底部抽屉；同一时间只展开一个
function toggleCrDrawer(panel, btn) {
  var willOpen = !panel.classList.contains('open');
  closeCrPlusPanel();
  if (!willOpen) return;
  panel.classList.add('open');
  btn.classList.add('active');
  if (crBottomBar) crBottomBar.classList.add('panel-open');
  setTimeout(function() {
    var activeList = getActiveMsgListEl();
    if (activeList) activeList.scrollTop = activeList.scrollHeight;
  }, 290);
}

function switchChatRoomSubView(view) {
  var isDrama = (view === 'contacts');
  currentCrSubView = isDrama ? 'contacts' : 'chat';
  msgBtnChat.classList.toggle('active', !isDrama);
  msgBtnContacts.classList.toggle('active', isDrama);
  msgToggleSlider.classList.toggle('contacts', isDrama);
  if (crViewChat)     crViewChat.classList.toggle('active', !isDrama);
  if (crViewContacts) crViewContacts.classList.toggle('active', isDrama);
  if (crBottomBar) {
    crBottomBar.style.display = '';
    crBottomBar.classList.toggle('drama-mode', isDrama);
  }
  closeCrPlusPanel();
  if (typeof applyChatRoomStyle === 'function' && charList[openingChatCharIdx]) applyChatRoomStyle(charList[openingChatCharIdx]);
  // 刚打开、还没显示过的列表停在最新消息
  if (typeof scrollPendingLists === 'function') setTimeout(scrollPendingLists, 0);
}

msgBtnChat.addEventListener('click', function() {
  switchChatRoomSubView('chat');
});

msgBtnContacts.addEventListener('click', function() {
  switchChatRoomSubView('contacts');
});

// 加号弹窗开关
msgPlusBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  msgPlusPopup.classList.toggle('open');
});

// 点击外部关闭加号弹窗
document.addEventListener('click', function(e) {
  if (msgRightWrap && !msgRightWrap.contains(e.target)) {
    msgPlusPopup.classList.remove('open');
  }
});
