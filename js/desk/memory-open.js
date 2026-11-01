// 眠花糖机 — 桌面「记忆库」的打开和返回（界面在 desk/memory-lib.js，记忆系统在 char/memory.js）

// ---------- 桌面：记忆库（界面在 js/desk/memory-lib.js，记忆系统在 js/char/memory.js） ----------
document.getElementById('dockMemory').addEventListener('click', function() {
  document.getElementById('appMemory').classList.add('active');
});
document.getElementById('backMemory').addEventListener('click', function() {
  document.getElementById('appMemory').classList.remove('active');
});
