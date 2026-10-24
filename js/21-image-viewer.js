// 眠花糖机 — 图片全屏查看

// =============================================
// 图片全屏查看：点聊天 / 动态 / 收藏里的图片打开；双指或双击缩放，放大后可拖动，单击关闭
// =============================================
var imgViewer    = document.getElementById('imgViewer');
var imgViewerImg = document.getElementById('imgViewerImg');
var ivState = { src: '', source: '', author: '', scale: 1, x: 0, y: 0 };

function ivApply() {
  imgViewerImg.style.transform = 'translate(' + ivState.x + 'px,' + ivState.y + 'px) scale(' + ivState.scale + ')';
}
function ivReset() { ivState.scale = 1; ivState.x = 0; ivState.y = 0; ivApply(); }

function openImgViewer(src, info) {
  info = info || {};
  ivState.src = src;
  ivState.source = info.source || '';
  ivState.author = info.author || '';
  imgViewerImg.src = src;
  // 收藏页里打开的图片不再显示「收藏」
  document.getElementById('imgViewerFav').style.display = info.noFav ? 'none' : '';
  ivReset();
  imgViewer.classList.add('open');
}
function closeImgViewer() {
  imgViewer.classList.remove('open');
  imgViewerImg.removeAttribute('src');
}

// 打开入口（捕获阶段；长按弹出菜单后松手的那次点击不打开）
document.addEventListener('click', function(e) {
  var img = e.target.closest && e.target.closest('.chat-msg-bubble.img-bubble img, .feed-post-imgs img, .fav-item-imgs img');
  if (!img || !img.src || suppressClick) return;
  e.stopPropagation();
  var info = {};
  if (img.closest('.fav-item-imgs')) info.noFav = true;
  else if (img.closest('.feed-post-imgs')) info.source = '动态';
  else {
    var row = img.closest('.chat-msg-row');
    var char = charList[openingChatCharIdx] || {};
    var isUser = row && row.classList.contains('user');
    info.author = isUser ? (resolveCharAccount(char).nickname || '我') : (char.charAlias || char.charName || '角色');
    info.source = '与 ' + chatRoomTitle.textContent + (img.closest('#dramaMsgList') ? ' 的剧情' : ' 的聊天');
  }
  openImgViewer(img.src, info);
});

// 手势：记录按下的指针；两指缩放，一指在放大时拖动；没移动的轻点 = 单击（关闭）或双击（缩放）
var ivPointers = {}, ivPinch = null, ivDrag = null, ivTap = null, ivLastTap = 0, ivTapTimer = null;
function ivDist() {
  var p = Object.keys(ivPointers).map(function(k) { return ivPointers[k]; });
  return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
}
imgViewer.addEventListener('pointerdown', function(e) {
  if (e.target.closest('.img-viewer-bar')) return;
  imgViewer.setPointerCapture(e.pointerId);
  ivPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  var n = Object.keys(ivPointers).length;
  if (n === 1) {
    ivTap = { x: e.clientX, y: e.clientY, t: Date.now() };
    ivDrag = { x: e.clientX, y: e.clientY, ox: ivState.x, oy: ivState.y };
  } else if (n === 2) {
    ivTap = null; ivDrag = null;
    ivPinch = { dist: ivDist(), scale: ivState.scale };
  }
});
imgViewer.addEventListener('pointermove', function(e) {
  if (!ivPointers[e.pointerId]) return;
  ivPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  if (ivTap && Math.hypot(e.clientX - ivTap.x, e.clientY - ivTap.y) > 8) ivTap = null;
  if (ivPinch && Object.keys(ivPointers).length === 2) {
    ivState.scale = Math.max(1, Math.min(5, ivPinch.scale * ivDist() / ivPinch.dist));
    ivApply();
  } else if (ivDrag && ivState.scale > 1) {
    ivState.x = ivDrag.ox + e.clientX - ivDrag.x;
    ivState.y = ivDrag.oy + e.clientY - ivDrag.y;
    ivApply();
  }
});
function ivPointerEnd(e) {
  if (!ivPointers[e.pointerId]) return;
  delete ivPointers[e.pointerId];
  var left = Object.keys(ivPointers).length;
  if (left < 2) ivPinch = null;
  if (left === 1) {
    // 两指松开一指：剩下那一指从当前位置继续拖动
    var k = Object.keys(ivPointers)[0];
    ivDrag = { x: ivPointers[k].x, y: ivPointers[k].y, ox: ivState.x, oy: ivState.y };
  }
  if (left) return;
  ivDrag = null;
  if (ivState.scale <= 1.02) ivReset();
  if (e.type !== 'pointerup' || !ivTap || Date.now() - ivTap.t > 300) { ivTap = null; return; }
  ivTap = null;
  var now = Date.now();
  if (now - ivLastTap < 300) {
    clearTimeout(ivTapTimer);
    ivLastTap = 0;
    if (ivState.scale > 1) ivReset(); else { ivState.scale = 2.5; ivApply(); }
  } else {
    ivLastTap = now;
    ivTapTimer = setTimeout(closeImgViewer, 300);
  }
}
['pointerup', 'pointercancel'].forEach(function(ev) { imgViewer.addEventListener(ev, ivPointerEnd); });
// 电脑上用滚轮缩放
imgViewer.addEventListener('wheel', function(e) {
  e.preventDefault();
  ivState.scale = Math.max(1, Math.min(5, ivState.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  if (ivState.scale <= 1.02) ivReset(); else ivApply();
}, { passive: false });

// 保存：手机上走系统分享（可选「存储图像」），电脑上直接下载
document.getElementById('imgViewerSave').addEventListener('click', function(e) {
  e.stopPropagation();
  var src = ivState.src;
  var name = 'mphone-' + Date.now();
  function download(href) {
    var a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  fetch(src).then(function(r) { return r.blob(); }).then(function(blob) {
    var ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    var file = new File([blob], name + '.' + ext, { type: blob.type || 'image/png' });
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file] }).catch(function() {});
    }
    var url = URL.createObjectURL(blob);
    name += '.' + ext;
    download(url);
    setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
  }).catch(function() {
    // 读不到图片数据（跨域图片）：在新页面打开，长按保存
    download(src);
  });
});
document.getElementById('imgViewerFav').addEventListener('click', function(e) {
  e.stopPropagation();
  addFav({ kind: 'image', text: '', images: [ivState.src], source: ivState.source, author: ivState.author, time: Date.now() });
});
