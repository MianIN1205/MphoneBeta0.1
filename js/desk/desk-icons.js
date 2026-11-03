// 眠花糖机 — 外观「桌面图标」：每个桌面 / 程序坞图标可以换成图片或 emoji、改名字，以及显示 / 隐藏图标下面的名字

// mphone_desk_icons = { 图标id（dockChat 这种）: { img, text, name } }；mphone_desk_labels = false 时隐藏名字
var deskIconCfg = mphoneStore.load('mphone_desk_icons', {}) || {};
var deskIconOrig = {};   // 原来的图标和名字，恢复默认用
function deskIconItems() {
  return Array.prototype.slice.call(document.querySelectorAll('#deskGrid > .dock-item[id], .dock > .dock-item[id]'));
}
deskIconItems().forEach(function(el) {
  deskIconOrig[el.id] = { icon: el.querySelector('.dock-icon').innerHTML, name: el.querySelector('.dock-label').textContent };
});
function paintDeskIcon(el) {
  var c = deskIconCfg[el.id] || {}, o = deskIconOrig[el.id];
  if (!o) return;
  var icon = el.querySelector('.dock-icon');
  // 未读小红点这些挂在 .dock-icon 上的 class 不动，只换里面的内容
  if (c.img) { icon.innerHTML = ''; var im = document.createElement('img'); im.className = 'dock-custom-img'; im.src = c.img; im.alt = ''; icon.appendChild(im); }
  else if (c.text) icon.textContent = c.text;
  else icon.innerHTML = o.icon;
  icon.classList.toggle('dock-icon-custom', !!c.img);
  el.querySelector('.dock-label').textContent = c.name || o.name;
}
function paintDeskIcons() {
  deskIconItems().forEach(paintDeskIcon);
  document.querySelector('.phone').classList.toggle('hide-dock-labels', mphoneStore.load('mphone_desk_labels', true) === false);
}
paintDeskIcons();

// ---------- 外观里的设置 ----------
var deskIconEditing = null, deskIconDraft = null;
function renderDeskIconList() {
  var box = document.getElementById('deskIconList');
  box.innerHTML = '';
  deskIconItems().forEach(function(el) {
    var b = document.createElement('button');
    b.className = 'desk-icon-cell';
    var ic = document.createElement('div');
    ic.className = 'desk-icon-prev';
    ic.innerHTML = el.querySelector('.dock-icon').innerHTML;
    var nm = document.createElement('span');
    nm.textContent = el.querySelector('.dock-label').textContent;
    b.appendChild(ic);
    b.appendChild(nm);
    b.addEventListener('click', function() { openDeskIconEdit(el); });
    box.appendChild(b);
  });
}
function paintDeskIconPreview() {
  var p = document.getElementById('deskIconEditPrev'), d = deskIconDraft, o = deskIconOrig[deskIconEditing.id];
  if (d.img) p.innerHTML = '<img class="dock-custom-img" alt="" src="' + String(d.img).replace(/"/g, '&quot;') + '">';
  else if (d.text) p.textContent = d.text;
  else p.innerHTML = o.icon;
}
function openDeskIconEdit(el) {
  deskIconEditing = el;
  deskIconDraft = Object.assign({}, deskIconCfg[el.id] || {});
  var o = deskIconOrig[el.id];
  document.getElementById('deskIconEditTitle').textContent = '「' + o.name + '」的图标';
  document.getElementById('deskIconEditText').value = deskIconDraft.text || '';
  document.getElementById('deskIconEditName').value = deskIconDraft.name || '';
  document.getElementById('deskIconEditName').placeholder = o.name;
  paintDeskIconPreview();
  document.getElementById('deskIconEditOverlay').classList.add('open');
}
document.getElementById('deskIconEditPick').addEventListener('click', function() {
  openImgPicker(function(src) { deskIconDraft.img = src; deskIconDraft.text = ''; document.getElementById('deskIconEditText').value = ''; paintDeskIconPreview(); });
});
document.getElementById('deskIconEditText').addEventListener('input', function() {
  deskIconDraft.text = this.value.trim().slice(0, 4);
  if (deskIconDraft.text) deskIconDraft.img = '';
  paintDeskIconPreview();
});
document.getElementById('deskIconEditReset').addEventListener('click', function() {
  deskIconDraft = {};
  document.getElementById('deskIconEditText').value = '';
  document.getElementById('deskIconEditName').value = '';
  paintDeskIconPreview();
});
document.getElementById('deskIconEditCancel').addEventListener('click', function() { document.getElementById('deskIconEditOverlay').classList.remove('open'); });
document.getElementById('deskIconEditSave').addEventListener('click', function() {
  var d = deskIconDraft, name = document.getElementById('deskIconEditName').value.trim().slice(0, 8);
  var c = {};
  if (d.img) c.img = d.img; else if (d.text) c.text = d.text;
  if (name) c.name = name;
  if (Object.keys(c).length) deskIconCfg[deskIconEditing.id] = c; else delete deskIconCfg[deskIconEditing.id];
  mphoneStore.save('mphone_desk_icons', deskIconCfg);
  paintDeskIcon(deskIconEditing);
  renderDeskIconList();
  document.getElementById('deskIconEditOverlay').classList.remove('open');
});
closeOnBackdrop(document.getElementById('deskIconEditOverlay'));
(function() {
  var t = document.getElementById('deskLabelToggle');
  t.checked = mphoneStore.load('mphone_desk_labels', true) !== false;
  t.addEventListener('change', function() { mphoneStore.save('mphone_desk_labels', t.checked); paintDeskIcons(); });
})();
renderDeskIconList();
document.getElementById('dockAppearance').addEventListener('click', renderDeskIconList);
