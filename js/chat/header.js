// 眠花糖机 — Chat 消息页顶栏：右侧的控件、加号菜单

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
