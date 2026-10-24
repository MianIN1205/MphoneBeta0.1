// 眠花糖机 — Chat 底部标签栏切换

// =============================================
// Chat 底部标签栏切换
// =============================================
var chatNavIconSVGs = {
  messages: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
  contacts: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
  feed:     '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
  mine:     '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>'
};

var chatNavIcon = document.getElementById('chatNavIcon');

document.querySelectorAll('.chat-tab-item').forEach(function(tab) {
  tab.addEventListener('click', function() {
    var tabId = this.dataset.tab;

    // 切换标签高亮
    document.querySelectorAll('.chat-tab-item').forEach(function(t) {
      t.classList.remove('active');
    });
    this.classList.add('active');

    // 切换内容面板
    document.querySelectorAll('.chat-panel').forEach(function(p) {
      p.classList.remove('active');
    });
    var targetPanel = document.querySelector('.chat-panel[data-panel="' + tabId + '"]');
    if (targetPanel) targetPanel.classList.add('active');

    // 更新导航栏图标
    chatNavIcon.querySelector('svg').innerHTML = chatNavIconSVGs[tabId] || '';

    // 通讯录页右上角显示「添加角色」
    document.getElementById('contactsRightWrap').classList.toggle('visible', tabId === 'contacts');
    if (tabId === 'contacts') renderContactList();
  });
});
