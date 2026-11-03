// 眠花糖机 — 输入栏的小工具：相册三选一（照片 / 拍照 / 文字图片）、文字图片消息、剧情窗口的快捷符号（【】{{}}「」“”）

// =============================================
// 相册：照片（选图）/ 拍照（安卓也能直接开相机）/ 文字图片（用一段文字描述一张照片，像动态里的文字图）
// =============================================
// 从按钮上方冒出来的小菜单（用户不要正中间的弹窗）：放在 body 下面用屏幕坐标摆，底边贴着按钮上沿，点外面收起；半透明毛玻璃
var albumPop = document.getElementById('albumPop');
document.body.appendChild(albumPop);
var albumPopAnchor = null;
function placeAlbumPop() {
  if (!albumPopAnchor) return;
  var r = albumPopAnchor.getBoundingClientRect(), w = albumPop.offsetWidth;
  albumPop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  albumPop.style.bottom = (window.innerHeight - r.top + 8) + 'px';
}
function openAlbumPick(anchor) {
  if (anchor) albumPopAnchor = anchor;
  document.getElementById('albumPickMain').style.display = '';
  document.getElementById('albumPickText').style.display = 'none';
  document.getElementById('albumTextInput').value = '';
  albumPop.classList.add('open');
  placeAlbumPop();
}
function closeAlbumPick() { albumPop.classList.remove('open'); }
// 选好了（选照片 / 拍照 / 发文字图片）：小菜单和加号抽屉一起收
function doneAlbumPick() { closeAlbumPick(); if (typeof closeCrPlusPanel === 'function') closeCrPlusPanel(); }
document.addEventListener('pointerdown', function(e) {
  if (albumPop.classList.contains('open') && !albumPop.contains(e.target) && !(albumPopAnchor && albumPopAnchor.contains(e.target))) closeAlbumPick();
}, true);
document.getElementById('albumPickPhoto').addEventListener('click', function() {
  doneAlbumPick();
  var f = document.getElementById('crAlbumFileInput');
  f.value = '';
  f.click();
});
document.getElementById('albumPickCamera').addEventListener('click', function() {
  doneAlbumPick();
  var f = document.getElementById('crCameraInput');
  f.value = '';
  f.click();
});
document.getElementById('crCameraInput').addEventListener('change', function() {
  if (typeof sendPickedImage === 'function') sendPickedImage(this.files && this.files[0]);
});
document.getElementById('albumPickTextBtn').addEventListener('click', function() {
  document.getElementById('albumPickMain').style.display = 'none';
  document.getElementById('albumPickText').style.display = '';
  placeAlbumPop();
  setTimeout(function() { document.getElementById('albumTextInput').focus(); }, 50);
});
document.getElementById('albumTextBack').addEventListener('click', function() { openAlbumPick(); });
document.getElementById('albumTextSend').addEventListener('click', function() {
  var t = document.getElementById('albumTextInput').value.trim();
  if (!t) { shakeEl(document.getElementById('albumTextInput')); return; }
  if (openingChatCharIdx === -1) return;
  var m = { role: 'user', content: '[文字图片] ' + t, textImg: t, time: Date.now() };
  if (pendingQuote) { m.quote = pendingQuote; clearQuote(); }
  getActiveHistory(openingChatCharIdx).push(m);
  renderHistMsg(m);
  saveHistories();
  doneAlbumPick();
});

// 聊天里的文字图片：方形小卡片，点开画成一张图全屏看（和动态里的文字图一样）
function appendTextImgMsg(role, m, list, empty) {
  list = list || getActiveMsgListEl();
  empty = empty || getActiveEmptyEl();
  if (empty) empty.style.display = 'none';
  var row = document.createElement('div');
  row.className = 'chat-msg-row ' + (role === 'user' ? 'user' : 'ai');
  row.appendChild(createMsgAvatar(role));
  var bubble = document.createElement('div');
  bubble.className = 'chat-msg-bubble img-bubble textimg-bubble';
  bubble.appendChild(createTextImgEl(m.textImg || ''));
  row.appendChild(bubble);
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
  return { row: row, bubble: bubble };
}

// =============================================
// 剧情窗口的快捷符号：点一下插入一对符号，光标停在中间；选中了文字就把它包起来。键盘不收起
// =============================================
(function() {
  var bar = document.getElementById('crSymbolBar'), input = document.getElementById('crInput');
  [['【', '】'], ['{{', '}}'], ['「', '」'], ['“', '”']].forEach(function(p) {
    var b = document.createElement('button');
    b.className = 'cr-symbol-btn';
    b.textContent = p[0] + p[1];
    b.addEventListener('pointerdown', function(e) { e.preventDefault(); });   // 不抢输入框的焦点
    b.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var s = input.selectionStart, en = input.selectionEnd, v = input.value;
      input.value = v.slice(0, s) + p[0] + v.slice(s, en) + p[1] + v.slice(en);
      var at = s + p[0].length + (en - s);
      input.focus();
      input.setSelectionRange(at, at);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    bar.appendChild(b);
  });
})();
