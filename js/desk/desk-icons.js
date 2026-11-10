// 眠花糖机 — 外观「桌面图标」：每个桌面 / 程序坞图标可以换成图片或 emoji、改名字，以及显示 / 隐藏图标下面的名字

// 图标预设（用户要的）：自带「默认 / 纸片 / 软萌」三个（删不掉；改了能「恢复默认」），也能把现在的样子「存为预设」（长按删除）。
// 每个预设 = 底子 base（'' 原来的 emoji 方块，'paper' / 'soft' 是 icons/desk/<套>/ 里那套没有方块底的图）+ 单独换过的图标 icons
// （{ 图标id: { img, text, name } }，换过的不跟着底子）。在用的那个预设里点图标改，改的就是这个预设。
// 存 mphone_desk_icon_presets = { active, list: [{ id, name, base, icons, builtin }] }；效果（描边 / 阴影 / 发光，只管没有方块底的图）存 mphone_desk_iconset.fx。
// 底子和效果顺便抄一份到 localStorage 的 mphoneIconSet，index.html 一打开就先套上（不等脚本，免得先闪一下 emoji）。样子在 css/desk/iconsets.css
var DESK_ICON_BUILTIN = [{ id: 'default', name: '默认', base: '' }, { id: 'paper', name: '纸片', base: 'paper' }, { id: 'soft', name: '软萌', base: 'soft' }];
var DESK_ICON_FX = [{ id: '', name: '无' }, { id: 'stroke', name: '描边' }, { id: 'shadow', name: '阴影' }, { id: 'glow', name: '发光' }];
var DESK_ICON_FILES = { dockNotes: 'notes', dockMemory: 'memory', dockGreenhouse: 'greenhouse', dockStarJar: 'starjar', dockLighthouse: 'lighthouse', dockMeet: 'meet',
  dockPet: 'pet', dockLetters: 'letters', dockSettings: 'settings', dockAppearance: 'appearance', dockChat: 'chat', dockPrompt: 'prompt' };
var deskIconSet = Object.assign({ fx: 'stroke' }, mphoneStore.load('mphone_desk_iconset', {}) || {});   // { fx }（以前还存过 id）
var deskIconPresets = mphoneStore.load('mphone_desk_icon_presets', null);
(function() {
  if (!deskIconPresets || !Array.isArray(deskIconPresets.list)) {
    // 第一次：以前单独换过的图标放进当时在用的那个（以前只有「默认」或刚加的风格）
    var old = mphoneStore.load('mphone_desk_icons', {}) || {}, oldBase = deskIconSet.id || '';
    deskIconPresets = { active: '', list: [] };
    DESK_ICON_BUILTIN.forEach(function(b) { deskIconPresets.list.push({ id: b.id, name: b.name, base: b.base, builtin: true, icons: b.base === oldBase ? old : {} }); });
    deskIconPresets.active = (DESK_ICON_BUILTIN.filter(function(b) { return b.base === oldBase; })[0] || DESK_ICON_BUILTIN[0]).id;
  }
  DESK_ICON_BUILTIN.forEach(function(b, i) {   // 以后再加自带的，补进去
    if (!deskIconPresets.list.some(function(p) { return p.id === b.id; })) deskIconPresets.list.splice(i, 0, { id: b.id, name: b.name, base: b.base, builtin: true, icons: {} });
  });
  delete deskIconSet.id;
})();
function deskIconActive() {
  return deskIconPresets.list.filter(function(p) { return p.id === deskIconPresets.active; })[0] || deskIconPresets.list[0];
}
var deskIconCfg = deskIconActive().icons || (deskIconActive().icons = {});
function saveDeskIconPresets() {
  mphoneStore.save('mphone_desk_icon_presets', deskIconPresets);
  mphoneStore.save('mphone_desk_iconset', deskIconSet);
}
var deskIconOrig = {};   // 原来的图标和名字，恢复默认用
function deskIconItems() {
  return Array.prototype.slice.call(document.querySelectorAll('#deskGrid > .dock-item[id], .dock > .dock-item[id]'));
}
deskIconItems().forEach(function(el) {
  deskIconOrig[el.id] = { icon: el.querySelector('.dock-icon').innerHTML, name: el.querySelector('.dock-label').textContent };
});
function deskIconBase() { return deskIconActive().base || ''; }
function deskIconSetSrc(id) { var b = deskIconBase(); return b && DESK_ICON_FILES[id] ? 'icons/desk/' + b + '/' + DESK_ICON_FILES[id] + '.png' : ''; }
function applyDeskIconSet() {
  var ph = document.querySelector('.phone'), b = deskIconBase();
  ph.className = ph.className.replace(/\b(iconset|icon-fx)-\S+/g, '').trim();
  if (b) { ph.classList.add('iconset-' + b); if (deskIconSet.fx) ph.classList.add('icon-fx-' + deskIconSet.fx); }
  try { localStorage.setItem('mphoneIconSet', JSON.stringify({ id: b, fx: deskIconSet.fx || '' })); } catch (_) {}
}
function paintDeskIcon(el) {
  var c = deskIconCfg[el.id] || {}, o = deskIconOrig[el.id];
  if (!o) return;
  var icon = el.querySelector('.dock-icon');
  icon.classList.toggle('dock-own', !!(c.img || c.text));   // 自己换过的不跟着底子
  // 未读小红点这些挂在 .dock-icon 上的 class 不动，只换里面的内容
  if (c.img) { icon.innerHTML = ''; var im = document.createElement('img'); im.className = 'dock-custom-img'; im.src = c.img; im.alt = ''; icon.appendChild(im); }
  else if (c.text) icon.textContent = c.text;
  else icon.innerHTML = o.icon;
  icon.classList.toggle('dock-icon-custom', !!c.img);
  el.querySelector('.dock-label').textContent = c.name || o.name;
}
function paintDeskIcons() {
  applyDeskIconSet();
  deskIconItems().forEach(paintDeskIcon);
  document.querySelector('.phone').classList.toggle('hide-dock-labels', mphoneStore.load('mphone_desk_labels', true) === false);
}
paintDeskIcons();
function useDeskIconPreset(p) {
  deskIconPresets.active = p.id;
  deskIconCfg = p.icons || (p.icons = {});
  saveDeskIconPresets();
  paintDeskIcons();
  renderDeskIconUi();
}

// ---------- 外观里的设置 ----------
var deskIconEditing = null, deskIconDraft = null;
function renderDeskIconList() {
  var box = document.getElementById('deskIconList');
  box.innerHTML = '';
  box.className = 'desk-icon-list' + (deskIconSet.fx ? ' icon-fx-' + deskIconSet.fx : '');   // 下面的小图也带上效果，看得到样子
  deskIconItems().forEach(function(el) {
    var b = document.createElement('button');
    b.className = 'desk-icon-cell';
    var ic = document.createElement('div');
    ic.className = 'desk-icon-prev';
    var own = deskIconCfg[el.id] || {}, setSrc = !(own.img || own.text) && deskIconSetSrc(el.id);
    if (setSrc) { ic.classList.add('iconset-img'); ic.style.backgroundImage = 'url(' + setSrc + ')'; }
    else ic.innerHTML = el.querySelector('.dock-icon').innerHTML;
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
  var setSrc = !(d.img || d.text) && deskIconSetSrc(deskIconEditing.id);
  p.classList.toggle('iconset-img', !!setSrc);
  p.style.backgroundImage = setSrc ? 'url(' + setSrc + ')' : '';
  if (setSrc) p.innerHTML = '';
  else if (d.img) p.innerHTML = '<img class="dock-custom-img" alt="" src="' + String(d.img).replace(/"/g, '&quot;') + '">';
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
  saveDeskIconPresets();
  paintDeskIcon(deskIconEditing);
  renderDeskIconUi();
  document.getElementById('deskIconEditOverlay').classList.remove('open');
});
closeOnBackdrop(document.getElementById('deskIconEditOverlay'));
(function() {
  var t = document.getElementById('deskLabelToggle');
  t.checked = mphoneStore.load('mphone_desk_labels', true) !== false;
  t.addEventListener('change', function() { mphoneStore.save('mphone_desk_labels', t.checked); paintDeskIcons(); });
})();
// 效果、预设
function renderDeskIconUi() {
  var fxRow = document.getElementById('deskIconFxRow');
  if (fxRow) {
    fxRow.innerHTML = '';
    DESK_ICON_FX.forEach(function(o) {
      var b = document.createElement('button');
      b.className = 'pf-radio-btn' + ((deskIconSet.fx || '') === o.id ? ' selected' : '');
      b.textContent = o.name;
      b.addEventListener('click', function() { deskIconSet.fx = o.id; saveDeskIconPresets(); paintDeskIcons(); renderDeskIconUi(); });
      fxRow.appendChild(b);
    });
  }
  var chips = document.getElementById('deskIconPresetChips');
  if (chips) {
    chips.innerHTML = '';
    deskIconPresets.list.forEach(function(p) {
      var chip = document.createElement('span');
      chip.className = 'feed-visible-chip' + (p.id === deskIconPresets.active ? ' on' : '');
      chip.textContent = p.name + (p.builtin && Object.keys(p.icons || {}).length ? ' ·改' : '');
      bindPress(chip, function() { useDeskIconPreset(p); }, function() {
        if (p.builtin) { showToast('自带的预设删不掉，改过的可以「恢复默认」', 'plain'); return; }
        openConfirm('删除图标预设「' + p.name + '」？', function() {
          deskIconPresets.list = deskIconPresets.list.filter(function(x) { return x !== p; });
          if (deskIconPresets.active === p.id) useDeskIconPreset(deskIconPresets.list[0]);
          else { saveDeskIconPresets(); renderDeskIconUi(); }
        });
      });
      chips.appendChild(chip);
    });
  }
  var cur = deskIconActive(), reset = document.getElementById('deskIconPresetReset');
  if (reset) reset.style.display = cur.builtin && Object.keys(cur.icons || {}).length ? '' : 'none';
  renderDeskIconList();
}
document.getElementById('deskIconPresetReset').addEventListener('click', function() {
  var cur = deskIconActive();
  openConfirm('把「' + cur.name + '」恢复成自带的样子？单独换过的图标和名字都会还原', function() {
    cur.icons = {};
    useDeskIconPreset(cur);
    showToast('✓ 已恢复「' + cur.name + '」', 'success');
  });
});
document.getElementById('deskIconPresetSave').addEventListener('click', function() {
  var inp = document.getElementById('deskIconPresetName'), n = inp.value.trim().slice(0, 12);
  if (!n) { shakeEl(inp); return; }
  if (DESK_ICON_BUILTIN.some(function(b) { return b.name === n; })) { showToast('和自带的重名了，换个名字吧', 'error'); return; }
  var cur = deskIconActive();
  var p = { id: 'ip' + Date.now().toString(36), name: n, base: cur.base || '', icons: JSON.parse(JSON.stringify(cur.icons || {})) };
  deskIconPresets.list = deskIconPresets.list.filter(function(x) { return x.builtin || x.name !== n; }).concat([p]);
  inp.value = '';
  useDeskIconPreset(p);
  showToast('✓ 已存为「' + n + '」', 'success');
});
// 导出 / 导入自己存的图标预设（用户要的：按分类单独导出，方便备份）
document.getElementById('deskIconPresetOut').addEventListener('click', function() {
  var mine = deskIconPresets.list.filter(function(p) { return !p.builtin; }).map(function(p) { return { name: p.name, base: p.base || '', icons: p.icons || {} }; });
  if (!mine.length) { showToast('还没有自己存的预设，先「存为预设」', 'plain'); return; }
  mphoneExportFile('icon-presets', { items: mine }, '桌面图标预设');
});
document.getElementById('deskIconPresetIn').addEventListener('click', function() {
  mphoneImportFile('icon-presets', function(f) {
    var n = 0;
    (f.items || []).forEach(function(p) {
      if (!p || !p.name || DESK_ICON_BUILTIN.some(function(b) { return b.name === p.name; })) return;
      deskIconPresets.list = deskIconPresets.list.filter(function(x) { return x.builtin || x.name !== p.name; }).concat([{ id: 'ip' + Date.now().toString(36) + n, name: String(p.name).slice(0, 12), base: p.base || '', icons: p.icons || {} }]);
      n++;
    });
    saveDeskIconPresets(); renderDeskIconUi();
    showToast('✓ 导入了 ' + n + ' 个图标预设', 'success');
  });
});
renderDeskIconUi();
document.getElementById('dockAppearance').addEventListener('click', renderDeskIconUi);
