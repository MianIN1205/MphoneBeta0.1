// 眠花糖机 — 桌面图标打开各个界面：外观、Chat、书架、Prompt

// =============================================
// 外观界面
// =============================================
const appAppearance  = document.getElementById('appAppearance');
const dockAppearance = document.getElementById('dockAppearance');
const backAppearance = document.getElementById('backAppearance');

dockAppearance.addEventListener('click', function() {
  appAppearance.classList.add('active');
});
backAppearance.addEventListener('click', function() {
  appAppearance.classList.remove('active');
});

// =============================================
// Chat 界面
// =============================================
const appChat  = document.getElementById('appChat');
const dockChat = document.getElementById('dockChat');
const backChat = document.getElementById('backChat');

dockChat.addEventListener('click', function() {
  appChat.classList.add('active');
  // 每次打开重置到消息页
  document.querySelectorAll('.chat-tab-item').forEach(function(t) {
    t.classList.remove('active');
  });
  document.querySelector('.chat-tab-item[data-tab="messages"]').classList.add('active');
  document.querySelectorAll('.chat-panel').forEach(function(p) {
    p.classList.remove('active');
  });
  document.querySelector('.chat-panel[data-panel="messages"]').classList.add('active');
  chatNavIcon.querySelector('svg').innerHTML = chatNavIconSVGs['messages'];
});
backChat.addEventListener('click', function() {
  appChat.classList.remove('active');
});

// =============================================
// 笔记界面（桌面程序）
// =============================================
const appNotes  = document.getElementById('appNotes');
const dockNotes = document.getElementById('dockNotes');
const backNotes = document.getElementById('backNotes');

dockNotes.addEventListener('click', function() {
  appNotes.classList.add('active');
});
backNotes.addEventListener('click', function() {
  exitDeleteMode();
  notesPopup.classList.remove('open');
  appNotes.classList.remove('active');
});

// =============================================
// Prompt 界面
// =============================================
const appPrompt  = document.getElementById('appPrompt');
const dockPrompt = document.getElementById('dockPrompt');
const backPrompt = document.getElementById('backPrompt');

dockPrompt.addEventListener('click', function() {
  appPrompt.classList.add('active');
});
backPrompt.addEventListener('click', function() {
  appPrompt.classList.remove('active');
});
