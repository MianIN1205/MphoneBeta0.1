// 眠花糖机 — Prompt：顶部文件夹标签切换

// =============================================
// Prompt — 文件夹标签切换
// =============================================
var promptTabRow    = document.getElementById('promptTabRow');
var promptFolderBody= document.getElementById('promptFolderBody');
// 更新 folder body 左上角 border-radius（让其与激活标签对齐）
function updateFolderBodyRadius() {
  var tabs   = Array.from(promptTabRow.querySelectorAll('.prompt-tab:not(.prompt-tab-plus)'));
  var active = promptTabRow.querySelector('.prompt-tab.active');
  if (!active) return;
  var idx = tabs.indexOf(active);
  // 第 0 个标签激活：左上角贴边（0），其余圆角
  // 非第 0 个：左上角也圆（14px），因为标签不在最左
  promptFolderBody.style.borderRadius = (idx === 0)
    ? '0 14px 14px 14px'
    : '14px 14px 14px 14px';
}

// 切换到指定面板
function switchPromptTab(tabEl) {
  var ptab = tabEl.dataset.ptab;
  if (!ptab) return;

  // 高亮标签
  promptTabRow.querySelectorAll('.prompt-tab').forEach(function(t) {
    t.classList.remove('active');
  });
  tabEl.classList.add('active');

  // 切换面板
  promptFolderBody.querySelectorAll('.prompt-panel').forEach(function(p) {
    p.classList.remove('active');
  });
  var target = promptFolderBody.querySelector('.prompt-panel[data-ppanel="' + ptab + '"]');
  if (target) target.classList.add('active');

  updateFolderBodyRadius();
}

// 绑定已有标签
promptTabRow.querySelectorAll('.prompt-tab').forEach(function(tab) {
  tab.addEventListener('click', function() { switchPromptTab(this); });
});

// 初始化 radius
updateFolderBodyRadius();
