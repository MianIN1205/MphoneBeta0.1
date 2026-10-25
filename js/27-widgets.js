// 眠花糖机 — 桌面网格、小组件、编辑桌面

// =============================================
// 桌面网格：时钟卡片下面是 4 列方格，程序占 1×1，小组件占 2×2
// 长按桌面进入编辑：拖动程序和小组件换位置（放到同样大小的东西上会互换），添加 / 修改 / 移除小组件
// 程序坞固定，不参与编辑
// · 纪念日小组件：显示设为「外显」的纪念日和日程；样式可选 两人头像（透明底）/ 图片背景 / Emoji
// · 照片小组件：显示一张自选图片（没选时用相册里最新的一张）
// =============================================
var WIDGET_TYPES = {
  anniv: { name: '纪念日', icon: '💝', desc: '显示设为外显的纪念日和日程，点开看全部' },
  photo: { name: '照片', icon: '🖼️', desc: '放一张喜欢的图片' }
};
var DESK_COLS = 4;
var deskWidgets = mphoneStore.load('mphone_widgets', null);
if (!Array.isArray(deskWidgets)) {
  // 第一次：原来的「纪念日」图标改成桌面上的纪念日小组件
  deskWidgets = [{ id: 'w' + Date.now().toString(36), type: 'anniv', style: 'avatars', charId: '', image: '', emoji: '💝' }];
  mphoneStore.save('mphone_widgets', deskWidgets);
}
var deskLayout = mphoneStore.load('mphone_desk_layout', {});   // { 'app:dockNotes': { x, y }, 'w:小组件id': { x, y } }
function saveWidgets() { mphoneStore.save('mphone_widgets', deskWidgets); }
function saveDeskLayout() { mphoneStore.save('mphone_desk_layout', deskLayout); }

var deskEl = document.querySelector('.desktop');
var deskGrid = document.getElementById('deskGrid');
var deskEditing = false;

// 小组件里「两人头像」的那个角色：自己选的；没选就用第一个聊过天的
function widgetChar(w) {
  var c = charList.filter(function(x) { return x.id === w.charId; })[0];
  if (c) return c;
  return charList.filter(function(x) { return (chatHistories[x.id] || []).length; })[0] || charList[0] || null;
}
function widgetLatestPhoto() {
  var items = (typeof galleryItems === 'function') ? galleryItems().filter(function(it) { return it.src; }) : [];
  return items.length ? items[0].src : '';
}
function makeAv(img) {
  var av = document.createElement('div');
  av.className = 'chat-char-card-avatar widget-av';
  paintAvatar(av, img || '', '');
  return av;
}

// 生成小组件的面板（编辑面板里的预览也用它）
// 纪念日：上面是两人头像 / Emoji（图片背景时没有），下面一行标题、一行大数字
function buildWidget(w) {
  var face = document.createElement('div');
  face.className = 'widget-face type-' + w.type + (w.type === 'anniv' ? ' style-' + (w.style || 'avatars') : '');
  if (w.type === 'photo') {
    var src = w.image || widgetLatestPhoto();
    if (src) face.style.backgroundImage = 'url(' + src + ')';
    else face.innerHTML = '<div class="widget-empty">🖼️<br>还没有图片</div>';
    return face;
  }
  if (w.style === 'image' && w.image) face.style.backgroundImage = 'url(' + w.image + ')';
  if (w.style === 'emoji') {
    var em = document.createElement('div');
    em.className = 'widget-emoji';
    em.textContent = w.emoji || '💝';
    face.appendChild(em);
  } else if (w.style !== 'image') {
    var me = (typeof getMineAccount === 'function') ? getMineAccount() : {};
    var c = widgetChar(w);
    var pair = document.createElement('div');
    pair.className = 'widget-pair';
    pair.appendChild(makeAv(me.avatar));
    pair.appendChild(makeAv(c && c.charAvatar));
    var heart = document.createElement('span');
    heart.className = 'widget-heart';
    heart.textContent = '♥';
    pair.appendChild(heart);
    face.appendChild(pair);
  }
  var e = annivWidgetItems()[0];
  var title = document.createElement('div');
  title.className = 'widget-title';
  title.textContent = e ? e.title : '还没有纪念日';
  var num = document.createElement('div');
  num.className = 'widget-num';
  if (e) {
    num.innerHTML = '<small></small><b></b><small></small>';
    num.children[0].textContent = e.note || '';
    num.children[1].textContent = e.big;
    num.children[2].textContent = e.unit || '';
  } else {
    num.innerHTML = '<small>点开添加</small>';
  }
  face.appendChild(title);
  face.appendChild(num);
  return face;
}

// ---------- 网格排布 ----------
function deskCell() { return deskGrid.clientWidth / DESK_COLS || 75; }
// 能放多少行：铺满时钟卡片到桌面底部之间
function deskRows() {
  var cell = deskCell();
  var room = deskEl.getBoundingClientRect().bottom - deskGrid.getBoundingClientRect().top - 8;
  return Math.max(4, Math.floor(room / cell));
}
function deskItemList() {
  var apps = Array.prototype.map.call(deskGrid.querySelectorAll(':scope > .dock-item'), function(el) {
    return { id: 'app:' + el.id, el: el, w: 1, h: 1 };
  });
  var wids = deskWidgets.map(function(w) { return { id: 'w:' + w.id, widget: w, w: 2, h: 2 }; });
  return wids.concat(apps);   // 第一次排布时小组件先占左上角
}
function rectsHit(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
function deskFits(item, pos, items, skip) {
  if (pos.x < 0 || pos.y < 0 || pos.x + item.w > DESK_COLS) return false;
  var me = { x: pos.x, y: pos.y, w: item.w, h: item.h };
  return items.every(function(o) {
    if (o === item || (skip && skip.indexOf(o) >= 0) || !deskLayout[o.id]) return true;
    return !rectsHit(me, { x: deskLayout[o.id].x, y: deskLayout[o.id].y, w: o.w, h: o.h });
  });
}
function deskFirstFree(item, items) {
  for (var y = 0; y < 60; y++) for (var x = 0; x + item.w <= DESK_COLS; x++) {
    if (deskFits(item, { x: x, y: y }, items)) return { x: x, y: y };
  }
  return { x: 0, y: 60 };
}

function renderWidgets() {
  var cell = deskCell();
  deskGrid.style.setProperty('--desk-cell', cell + 'px');
  deskGrid.querySelectorAll(':scope > .desk-widget').forEach(function(el) { el.remove(); });
  var items = deskItemList();
  // 去掉已经不存在的；没有位置的找第一个空位
  var ids = {};
  items.forEach(function(it) { ids[it.id] = true; });
  Object.keys(deskLayout).forEach(function(k) { if (!ids[k]) delete deskLayout[k]; });
  items.forEach(function(it) { if (!deskLayout[it.id]) deskLayout[it.id] = deskFirstFree(it, items); });
  saveDeskLayout();
  var maxRow = 0;
  items.forEach(function(it) {
    var el = it.el;
    if (it.widget) {
      el = document.createElement('div');
      el.className = 'desk-widget';
      el.appendChild(buildWidget(it.widget));
      var lb = document.createElement('span');
      lb.className = 'dock-label';
      lb.textContent = WIDGET_TYPES[it.widget.type].name;
      el.appendChild(lb);
      if (deskEditing) {
        var x = document.createElement('button');
        x.className = 'widget-remove';
        x.textContent = '−';
        x.addEventListener('click', function(ev) { ev.stopPropagation(); removeWidget(it.widget); });
        el.appendChild(x);
      }
      (function(w) {
        el.addEventListener('click', function() {
          if (deskEditing) { openWidgetEdit(w); return; }
          if (w.type === 'anniv') openAnnivScreen();
          else if (w.type === 'photo') { var src = w.image || widgetLatestPhoto(); if (src) openImgViewer(src, { source: '桌面小组件' }); }
        });
      })(it.widget);
      deskGrid.appendChild(el);
    }
    var p = deskLayout[it.id];
    el.dataset.deskId = it.id;
    el.style.gridColumn = (p.x + 1) + ' / span ' + it.w;
    el.style.gridRow = (p.y + 1) + ' / span ' + it.h;
    maxRow = Math.max(maxRow, p.y + it.h);
  });
  // 编辑时把空格子也撑出来，方便拖过去
  deskGrid.style.minHeight = deskEditing ? (Math.max(maxRow, deskRows()) * cell) + 'px' : '';
}
function removeWidget(w) {
  openPfEntryDel('移除这个小组件？', function() {
    deskWidgets = deskWidgets.filter(function(x) { return x !== w; });
    saveWidgets();
    renderWidgets();
  });
}

// ---------- 编辑桌面：长按桌面进入，点「完成」或空白处退出 ----------
function setDeskEditing(on) {
  deskEditing = on;
  deskEl.classList.toggle('editing', on);
  renderWidgets();
}
var deskHold = null, deskHoldX = 0, deskHoldY = 0, deskSuppressClick = false;
deskEl.addEventListener('pointerdown', function(e) {
  if (deskEditing || e.target.closest('.desk-edit-bar')) return;
  deskHoldX = e.clientX; deskHoldY = e.clientY;
  clearTimeout(deskHold);
  deskHold = setTimeout(function() {
    deskHold = null;
    deskSuppressClick = true;
    setDeskEditing(true);
    if (navigator.vibrate) navigator.vibrate(15);
  }, 550);
});
deskEl.addEventListener('pointermove', function(e) {
  if (deskHold && (Math.abs(e.clientX - deskHoldX) > 10 || Math.abs(e.clientY - deskHoldY) > 10)) { clearTimeout(deskHold); deskHold = null; }
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(function(ev) {
  deskEl.addEventListener(ev, function() {
    clearTimeout(deskHold); deskHold = null;
    if (deskSuppressClick) setTimeout(function() { deskSuppressClick = false; }, 350);
  });
});
// 长按松手后的那次点击、编辑时点程序，都不打开程序；编辑时点空白处退出
deskEl.addEventListener('click', function(e) {
  if (deskSuppressClick) { e.stopPropagation(); e.preventDefault(); deskSuppressClick = false; return; }
  if (!deskEditing) return;
  if (e.target.closest('.desk-grid .dock-item, .info-card')) { e.stopPropagation(); e.preventDefault(); return; }
  if (!e.target.closest('.desk-widget, .desk-edit-bar')) setDeskEditing(false);
}, true);
deskEl.addEventListener('contextmenu', function(e) { e.preventDefault(); });
document.getElementById('deskEditDone').addEventListener('click', function() { setDeskEditing(false); });
window.addEventListener('resize', function() { renderWidgets(); });

// ---------- 编辑时拖动：手指跟着一个影子走，松手时落到对应格子 ----------
var deskDrag = null;
deskGrid.addEventListener('pointerdown', function(e) {
  if (!deskEditing || e.target.closest('.widget-remove')) return;
  var el = e.target.closest('.desk-grid > .dock-item, .desk-grid > .desk-widget');
  if (!el) return;
  var r = el.getBoundingClientRect();
  deskDrag = { el: el, id: el.dataset.deskId, sx: e.clientX, sy: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top, moved: false, ghost: null };
  try { el.setPointerCapture(e.pointerId); } catch (_) {}
});
deskGrid.addEventListener('pointermove', function(e) {
  var d = deskDrag;
  if (!d) return;
  if (!d.moved) {
    if (Math.abs(e.clientX - d.sx) < 6 && Math.abs(e.clientY - d.sy) < 6) return;
    d.moved = true;
    var r = d.el.getBoundingClientRect();
    d.ghost = d.el.cloneNode(true);
    d.ghost.className += ' desk-ghost';
    d.ghost.style.cssText += ';position:fixed;margin:0;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;';
    document.body.appendChild(d.ghost);
    d.el.classList.add('desk-dragging');
  }
  d.ghost.style.left = (e.clientX - d.offX) + 'px';
  d.ghost.style.top = (e.clientY - d.offY) + 'px';
});
function endDeskDrag(e) {
  var d = deskDrag;
  deskDrag = null;
  if (!d || !d.moved) return;
  d.ghost.remove();
  d.el.classList.remove('desk-dragging');
  deskSuppressClick = true;
  setTimeout(function() { deskSuppressClick = false; }, 350);
  if (!e || e.type === 'pointercancel') return;
  var cell = deskCell(), gr = deskGrid.getBoundingClientRect();
  var items = deskItemList();
  var item = items.filter(function(it) { return it.id === d.id; })[0];
  if (!item) return;
  var pos = {
    x: Math.round((e.clientX - d.offX - gr.left) / cell),
    y: Math.round((e.clientY - d.offY - gr.top) / cell)
  };
  pos.x = Math.max(0, Math.min(DESK_COLS - item.w, pos.x));
  pos.y = Math.max(0, Math.min(deskRows() - item.h, pos.y));
  var old = deskLayout[item.id];
  if (deskFits(item, pos, items)) {
    deskLayout[item.id] = pos;
  } else {
    // 落在一个同样大小、位置正好对齐的东西上：互换
    var me = { x: pos.x, y: pos.y, w: item.w, h: item.h };
    var hits = items.filter(function(o) {
      return o !== item && deskLayout[o.id] && rectsHit(me, { x: deskLayout[o.id].x, y: deskLayout[o.id].y, w: o.w, h: o.h });
    });
    var other = hits.length === 1 && hits[0].w === item.w && hits[0].h === item.h &&
                deskLayout[hits[0].id].x === pos.x && deskLayout[hits[0].id].y === pos.y ? hits[0] : null;
    var smaller = hits.length && hits.every(function(o) { return o.w * o.h < item.w * item.h; });
    if (other && deskFits(other, old, items, [item])) {
      deskLayout[other.id] = { x: old.x, y: old.y };
      deskLayout[item.id] = pos;
    } else if (smaller) {
      // 小组件压到程序上：程序让开，挪到最近的空格
      deskLayout[item.id] = pos;
      hits.forEach(function(o) { delete deskLayout[o.id]; });
      hits.forEach(function(o) { deskLayout[o.id] = deskFirstFree(o, items); });
    } else {
      showToast('那里放不下', 'error');
    }
  }
  saveDeskLayout();
  renderWidgets();
}
deskGrid.addEventListener('pointerup', endDeskDrag);
deskGrid.addEventListener('pointercancel', endDeskDrag);

// ---------- 添加小组件 ----------
var widgetAddOverlay = document.getElementById('widgetAddOverlay');
document.getElementById('deskAddWidget').addEventListener('click', function() {
  var list = document.getElementById('widgetTypeList');
  list.innerHTML = '';
  Object.keys(WIDGET_TYPES).forEach(function(type) {
    var t = WIDGET_TYPES[type];
    var item = document.createElement('div');
    item.className = 'mine-acc-item';
    item.innerHTML = '<div class="widget-type-icon"></div><div class="mine-acc-item-info"><div class="mine-acc-item-name"></div><div class="widget-type-desc"></div></div>';
    item.querySelector('.widget-type-icon').textContent = t.icon;
    item.querySelector('.mine-acc-item-name').textContent = t.name;
    item.querySelector('.widget-type-desc').textContent = t.desc;
    item.addEventListener('click', function() {
      var w = { id: 'w' + Date.now().toString(36), type: type, style: 'avatars', charId: '', image: '', emoji: '💝' };
      deskWidgets.push(w);
      saveWidgets();
      widgetAddOverlay.classList.remove('open');
      renderWidgets();
      openWidgetEdit(w);
    });
    list.appendChild(item);
  });
  widgetAddOverlay.classList.add('open');
});
document.getElementById('widgetAddCancel').addEventListener('click', function() { widgetAddOverlay.classList.remove('open'); });
widgetAddOverlay.addEventListener('click', function(e) { if (e.target === widgetAddOverlay) widgetAddOverlay.classList.remove('open'); });

// ---------- 编辑小组件：样式、和谁、图片、Emoji（改了立刻生效） ----------
var widgetEditOverlay = document.getElementById('widgetEditOverlay');
var wgEditing = null;
function fillWidgetEdit() {
  var w = wgEditing, anniv = w.type === 'anniv';
  document.getElementById('wgEditTitle').textContent = '编辑' + WIDGET_TYPES[w.type].name + '小组件';
  document.getElementById('wgStyleWrap').style.display = anniv ? '' : 'none';
  document.getElementById('wgCharWrap').style.display = anniv && w.style === 'avatars' ? '' : 'none';
  document.getElementById('wgImageWrap').style.display = (anniv && w.style === 'image') || w.type === 'photo' ? '' : 'none';
  document.getElementById('wgEmojiWrap').style.display = anniv && w.style === 'emoji' ? '' : 'none';
  document.getElementById('wgImageBtn').textContent = w.image ? '换一张图片' : '选择图片';
  document.getElementById('wgEmoji').value = w.emoji || '';
  document.querySelectorAll('#wgStyleRow .pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.style === w.style); });
  var row = document.getElementById('wgCharRow');
  row.innerHTML = '';
  var cur = widgetChar(w);
  charList.forEach(function(c) {
    var chip = document.createElement('span');
    chip.className = 'feed-visible-chip' + (cur && c.id === cur.id ? ' on' : '');
    chip.textContent = c.charAlias || c.charName || '未命名';
    chip.addEventListener('click', function() { w.charId = c.id; widgetChanged(); });
    row.appendChild(chip);
  });
  var pv = document.getElementById('wgPreview');
  pv.innerHTML = '';
  pv.appendChild(buildWidget(w));
  document.getElementById('wgDelete').textContent = '删除';
}
function widgetChanged() { saveWidgets(); renderWidgets(); fillWidgetEdit(); }
function openWidgetEdit(w) {
  wgEditing = w;
  fillWidgetEdit();
  widgetEditOverlay.classList.add('open');
}
document.querySelectorAll('#wgStyleRow .pf-radio-btn').forEach(function(b) {
  b.addEventListener('click', function() { wgEditing.style = this.dataset.style; widgetChanged(); });
});
document.getElementById('wgImageBtn').addEventListener('click', function() {
  var w = wgEditing;
  openImgPicker(function(src) { w.image = src; widgetChanged(); });
});
document.getElementById('wgEmoji').addEventListener('input', function() {
  wgEditing.emoji = this.value.trim();
  saveWidgets(); renderWidgets();
  var pv = document.getElementById('wgPreview');
  pv.innerHTML = '';
  pv.appendChild(buildWidget(wgEditing));
});
document.getElementById('wgDone').addEventListener('click', function() { widgetEditOverlay.classList.remove('open'); });
widgetEditOverlay.addEventListener('click', function(e) { if (e.target === widgetEditOverlay) widgetEditOverlay.classList.remove('open'); });
// 删除要点两次
document.getElementById('wgDelete').addEventListener('click', function() {
  if (this.textContent !== '确认删除') { this.textContent = '确认删除'; return; }
  var w = wgEditing;
  deskWidgets = deskWidgets.filter(function(x) { return x !== w; });
  saveWidgets();
  widgetEditOverlay.classList.remove('open');
  renderWidgets();
});

// 聊天、头像、纪念日变化后，回到桌面时刷新一下小组件
document.querySelectorAll('.back-btn').forEach(function(b) { b.addEventListener('click', function() { setTimeout(renderWidgets, 0); }); });
renderWidgets();
