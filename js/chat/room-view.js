// 眠花糖机 — 聊天室：聊天 / 剧情切换滑块，底部抽屉（加号、表情包）的开关

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
  if (typeof closeVoicePop === 'function') closeVoicePop();
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

// 每个角色上次停在聊天还是剧情：下次打开回到那边
var crLastView = mphoneStore.load('mphone_last_view', {}) || {};
function switchChatRoomSubView(view) {
  var isDrama = (view === 'contacts');
  currentCrSubView = isDrama ? 'contacts' : 'chat';
  var vc = charList[openingChatCharIdx];
  if (vc && crLastView[vc.id] !== currentCrSubView) { crLastView[vc.id] = currentCrSubView; mphoneStore.save('mphone_last_view', crLastView); }
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
  if (typeof crDraftSwap === 'function') crDraftSwap();   // 输入框草稿、引用跟着窗口走
  if (typeof syncGenBtn === 'function') syncGenBtn();     // ❄️ / ⏹ 看这个窗口自己在不在生成
  if (typeof renderQuickBar === 'function') renderQuickBar();
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
