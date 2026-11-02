// 眠花糖机 — 桌面上的花房、星星瓶、灯塔、见面：暂时只有图标和空白界面，之后再慢慢放内容

// 桌面编辑模式下点图标不会打开（见 js/desk/widgets.js）
['Greenhouse', 'StarJar', 'Lighthouse', 'Meet'].forEach(function(name) {
  var screen = document.getElementById('app' + name);
  document.getElementById('dock' + name).addEventListener('click', function() { screen.classList.add('active'); });
  document.getElementById('back' + name).addEventListener('click', function() { screen.classList.remove('active'); });
});
