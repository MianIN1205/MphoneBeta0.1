// 眠花糖机 — 美化的导出 / 导入（聊天窗口、剧情窗口、状态栏，分开勾），和 CSS 预设（角色美化页、外观的全局样式都能存、能套用）

// =============================================
// CSS 预设：mphone_css_presets = [{ id, name, css }]，几个 CSS 框共用；点一下填进框里，长按删除
// =============================================
var cssPresets = mphoneStore.load('mphone_css_presets', []) || [];
var cssPresetBoxes = [];
function saveCssPresets() { mphoneStore.save('mphone_css_presets', cssPresets); cssPresetBoxes.forEach(function(f) { f(); }); }
function mountCssPresets(textareaId, afterId, onApply) {
  var ta = document.getElementById(textareaId), after = document.getElementById(afterId);
  var box = document.createElement('div');
  box.className = 'css-preset-box';
  box.innerHTML = '<div class="bubble-section-label" style="margin:12px 0 6px;">CSS 预设</div>' +
    '<div class="auto-hint" style="margin:0 0 6px;">点一下填进上面的框（会替换掉框里原来的），长按删除</div>' +
    '<div class="feed-visible-list css-preset-chips"></div>' +
    '<div class="auto-row" style="margin-top:8px;"><input class="field-input css-preset-name" type="text" maxlength="16" placeholder="给现在这段 CSS 起个名字">' +
    '<button class="mine-acc-btn mine-acc-btn-add css-preset-save" style="flex:none;padding:8px 14px;">存为预设</button></div>';
  after.parentNode.insertBefore(box, after.nextSibling);
  var chips = box.querySelector('.css-preset-chips'), name = box.querySelector('.css-preset-name');
  function render() {
    chips.innerHTML = '';
    if (!cssPresets.length) { chips.innerHTML = '<span class="auto-hint" style="margin:0;">还没有存过</span>'; return; }
    cssPresets.forEach(function(p) {
      var chip = document.createElement('span');
      chip.className = 'feed-visible-chip';
      chip.textContent = p.name;
      bindPress(chip, function() {
        ta.value = p.css;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        if (onApply) onApply();
        showToast('已套用「' + p.name + '」', 'plain');
      }, function() {
        openConfirm('删除 CSS 预设「' + p.name + '」？', function() {
          cssPresets = cssPresets.filter(function(x) { return x !== p; });
          saveCssPresets();
        });
      });
      chips.appendChild(chip);
    });
  }
  box.querySelector('.css-preset-save').addEventListener('click', function(e) {
    e.stopPropagation();
    var n = name.value.trim();
    if (!n) { shakeEl(name); return; }
    if (!ta.value.trim()) { showToast('上面的框是空的', 'error'); return; }
    cssPresets = cssPresets.filter(function(x) { return x.name !== n; }).concat([{ id: 'cp' + Date.now().toString(36), name: n, css: ta.value }]);
    saveCssPresets();
    name.value = '';
    showToast('✓ 已存为「' + n + '」', 'success');
  });
  cssPresetBoxes.push(render);
  render();
}
mountCssPresets('customCssInput', 'customCssApplyBtn');
mountCssPresets('globalCssInput', 'globalCssApplyBtn', function() { document.getElementById('globalCssApplyBtn').click(); });

// =============================================
// 美化的导出 / 导入：{ app: 'mphone', type: 'look', chat, drama, status }，勾哪几样就导出 / 套用哪几样
// 导入后改到这个角色的美化页上（和手动改一样立刻生效）
// =============================================
var LOOK_STATUS_KEYS = ['statusOn', 'statusFields', 'statusTpl', 'statusCss', 'statusFind', 'statusRules'];
var lookShareOverlay = document.getElementById('lookShareOverlay');
var lookShareMode = 'export', lookShareData = null;
function lookShareCurrent() {
  csLookParts[csLookView] = readLookPartForm();
  var chat = JSON.parse(JSON.stringify(csLookParts.chat)), status = {};
  chat.look = chat.look || {};
  LOOK_STATUS_KEYS.forEach(function(k) { if (chat.look[k] !== undefined) status[k] = chat.look[k]; delete chat.look[k]; });
  return { chat: chat, drama: JSON.parse(JSON.stringify(csLookParts.drama || {})), status: status };
}
function openLookShare(mode, data) {
  lookShareMode = mode; lookShareData = data;
  document.getElementById('lookShareTitle').textContent = mode === 'export' ? '导出美化' : '导入美化';
  document.getElementById('lookShareOk').textContent = mode === 'export' ? '导出' : '套用';
  [['chat', 'lookShareChat'], ['drama', 'lookShareDrama'], ['status', 'lookShareStatus']].forEach(function(p) {
    var has = mode === 'export' || !!(data && data[p[0]] && Object.keys(data[p[0]]).length);
    var cb = document.getElementById(p[1]);
    cb.checked = has;
    cb.disabled = !has;
    cb.closest('.auto-row').style.opacity = has ? '' : '0.4';
  });
  document.getElementById('lookShareHint').textContent = mode === 'export'
    ? '导出成一个文件，可以发给别人，或者导进别的角色。背景图片也会一起带上。'
    : '套用到这个角色的美化上（原来对应的那几样会被换掉），满意了点右上「保存」。' + (data && data.name ? '（来自「' + data.name + '」）' : '');
  lookShareOverlay.classList.add('open');
}
document.getElementById('lookExportBtn').addEventListener('click', function(e) { e.stopPropagation(); openLookShare('export'); });
document.getElementById('lookImportBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  var f = document.getElementById('lookImportFile');
  f.value = '';
  f.click();
});
document.getElementById('lookImportFile').addEventListener('change', function() {
  var file = this.files && this.files[0];
  if (!file) return;
  file.text().then(function(t) {
    var d = JSON.parse(t.replace(/^﻿/, ''));
    if (!d || d.app !== 'mphone' || d.type !== 'look') throw new Error('not look');
    openLookShare('import', d);
  }).catch(function() { showToast('✗ 这不是眠花糖机的美化文件', 'error'); });
});
document.getElementById('lookShareCancel').addEventListener('click', function() { lookShareOverlay.classList.remove('open'); });
closeOnBackdrop(lookShareOverlay);
document.getElementById('lookShareOk').addEventListener('click', function() {
  var pick = { chat: document.getElementById('lookShareChat').checked, drama: document.getElementById('lookShareDrama').checked, status: document.getElementById('lookShareStatus').checked };
  if (!pick.chat && !pick.drama && !pick.status) { showToast('至少勾一样', 'error'); return; }
  if (lookShareMode === 'export') {
    var cur = lookShareCurrent(), out = { app: 'mphone', type: 'look', version: 1, name: document.getElementById('charAlias').value.trim() || document.getElementById('charName').value.trim() || '' };
    ['chat', 'drama', 'status'].forEach(function(k) { if (pick[k]) out[k] = cur[k]; });
    var json = JSON.stringify(out), base = '眠花糖机美化' + (out.name ? '_' + out.name : '');
    // 安卓分享不认 .json，就换成 .txt（导入时也认）
    var files = [new File([json], base + '.json', { type: 'application/json' }), new File([json], base + '.txt', { type: 'text/plain' })];
    var ok = navigator.canShare && files.filter(function(f) { try { return navigator.canShare({ files: [f] }); } catch (_) { return false; } })[0];
    if (ok && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) navigator.share({ files: [ok] }).catch(function() {});
    else downloadBlob(new Blob([json], { type: 'application/json' }), base + '.json');
    lookShareOverlay.classList.remove('open');
    return;
  }
  // 导入：换掉勾了的那几样
  var d = lookShareData || {};
  csLookParts[csLookView] = readLookPartForm();
  if (pick.chat && d.chat) {
    var keepStatus = {};
    LOOK_STATUS_KEYS.forEach(function(k) { if ((csLookParts.chat.look || {})[k] !== undefined) keepStatus[k] = csLookParts.chat.look[k]; });
    csLookParts.chat = Object.assign({}, d.chat, { look: Object.assign({}, d.chat.look || {}, keepStatus) });
  }
  if (pick.drama && d.drama) csLookParts.drama = JSON.parse(JSON.stringify(d.drama));
  if (pick.status && d.status) csLookParts.chat.look = Object.assign({}, csLookParts.chat.look || {}, d.status);
  setLookPartForm(csLookView);
  liveApplyLook();
  lookShareOverlay.classList.remove('open');
  showToast('✓ 已套用，满意了点「保存」', 'success');
});
