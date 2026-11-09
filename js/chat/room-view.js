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

// 每个角色上次停在聊天还是剧情：退出再进回到那边；只记在这次打开期间，重新打开小手机都从聊天开始（用户定的）
var crLastView = {};
// 停在聊天室的一边（比如剧情）时，另一边来了新回复：那边的切换按钮上冒个小红点，切过去就消失
function crMarkOtherView(isChat) {
  if (currentCrSubView === (isChat ? 'chat' : 'contacts')) return;
  (isChat ? msgBtnChat : msgBtnContacts).classList.add('has-new');
}
function switchChatRoomSubView(view) {
  var vc0 = charList[openingChatCharIdx];
  var noDrama = !!(vc0 && (vc0.builtinAssistant || vc0.isGroup));   // 群聊先只做聊天（用户说先把聊天做稳，再试剧情）
  if (noDrama) view = 'chat';   // MianIN 没有剧情窗口（用户要的），切换按钮也藏起来
  appChatRoom.classList.toggle('no-drama', noDrama);
  appChatRoom.classList.toggle('is-group', !!(vc0 && vc0.isGroup));
  var isDrama = (view === 'contacts');
  (isDrama ? msgBtnContacts : msgBtnChat).classList.remove('has-new');
  currentCrSubView = isDrama ? 'contacts' : 'chat';
  var vc = charList[openingChatCharIdx];
  if (vc) crLastView[vc.id] = currentCrSubView;
  if (vc && isDrama && typeof crDramaSeen === 'function') crDramaSeen(vc);   // 看过剧情了，列表里的「[剧情]」那行就不显示了
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
  if (currentCrSubView === 'contacts' && typeof crDramaSeen === 'function') crDramaSeen(charList[openingChatCharIdx]);
  switchChatRoomSubView('chat');
});

msgBtnContacts.addEventListener('click', function() {
  switchChatRoomSubView('contacts');
});
