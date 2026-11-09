// 眠花糖机 — 桌面上的花房、星星瓶、灯塔、见面：打开 / 返回（花房内容在 greenhouse.js，星星瓶在 starjar.js；灯塔、见面还空着）

// 桌面编辑模式下点图标不会打开（见 js/desk/widgets.js）
['Greenhouse', 'StarJar'].forEach(function(name) {
  var screen = document.getElementById('app' + name);
  document.getElementById('dock' + name).addEventListener('click', function() { screen.classList.add('active'); });
  document.getElementById('back' + name).addEventListener('click', function() { screen.classList.remove('active'); });
});
// 灯塔、见面、盲盒只有图标、还没有功能：点了不进去，弹个小提示（用户要的）。做好了再改回上面那样打开
['Lighthouse', 'Meet', 'Blindbox'].forEach(function(name) {
  document.getElementById('dock' + name).addEventListener('click', function() { showToast('还在开发中，敬请期待～', 'plain'); });
});
