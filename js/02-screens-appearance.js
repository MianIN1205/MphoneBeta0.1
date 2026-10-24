// 眠花糖机 — 外观界面

// =============================================
// 外观界面
// =============================================
const appAppearance  = document.getElementById('appAppearance');
const dockAppearance = document.getElementById('dockAppearance');
const backAppearance = document.getElementById('backAppearance');

dockAppearance.addEventListener('click', function() {
  appAppearance.classList.add('active');
});
backAppearance.addEventListener('click', function() {
  appAppearance.classList.remove('active');
});

// =============================================
// Chat 界面
// =============================================
const appChat  = document.getElementById('appChat');
const dockChat = document.getElementById('dockChat');
const backChat = document.getElementById('backChat');

dockChat.addEventListener('click', function() {
  appChat.classList.add('active');
  // 每次打开重置到消息页
  document.querySelectorAll('.chat-tab-item').forEach(function(t) {
    t.classList.remove('active');
  });
  document.querySelector('.chat-tab-item[data-tab="messages"]').classList.add('active');
  document.querySelectorAll('.chat-panel').forEach(function(p) {
    p.classList.remove('active');
  });
  document.querySelector('.chat-panel[data-panel="messages"]').classList.add('active');
  chatNavIcon.querySelector('svg').innerHTML = chatNavIconSVGs['messages'];
});
backChat.addEventListener('click', function() {
  appChat.classList.remove('active');
});

// =============================================
// 笔记界面（桌面程序）
// =============================================
const appNotes  = document.getElementById('appNotes');
const dockNotes = document.getElementById('dockNotes');
const backNotes = document.getElementById('backNotes');

dockNotes.addEventListener('click', function() {
  appNotes.classList.add('active');
});
backNotes.addEventListener('click', function() {
  exitDeleteMode();
  notesPopup.classList.remove('open');
  appNotes.classList.remove('active');
});

// =============================================
// Prompt 界面
// =============================================
const appPrompt  = document.getElementById('appPrompt');
const dockPrompt = document.getElementById('dockPrompt');
const backPrompt = document.getElementById('backPrompt');

dockPrompt.addEventListener('click', function() {
  appPrompt.classList.add('active');
});
backPrompt.addEventListener('click', function() {
  appPrompt.classList.remove('active');
});

// =============================================
// 外观界面 — 手机边框 / 全屏模式 互斥切换
// =============================================
const wpPreview       = document.getElementById('wpPreview');
const wpBtnFrame      = document.getElementById('wpBtnFrame');
const wpBtnFullscreen = document.getElementById('wpBtnFullscreen');

wpBtnFrame.addEventListener('click', function() {
  wpBtnFrame.classList.add('active');
  wpBtnFullscreen.classList.remove('active');
  wpPreview.classList.add('has-border');
  document.querySelector('.phone').classList.remove('fullscreen');
  document.body.classList.remove('phone-fullscreen');
});

wpBtnFullscreen.addEventListener('click', function() {
  wpBtnFullscreen.classList.add('active');
  wpBtnFrame.classList.remove('active');
  wpPreview.classList.remove('has-border');
  document.querySelector('.phone').classList.add('fullscreen');
  document.body.classList.add('phone-fullscreen');
});

// =============================================
// 外观界面 — 状态栏 Toggle & 自定义文字
// =============================================
var statusBar       = document.getElementById('statusBar');
var toggleStatusBar = document.getElementById('toggleStatusBar');
var sbCustomText    = document.getElementById('sbCustomText');
var sbSaveBtn       = document.getElementById('sbSaveBtn');
var statusCustom    = document.getElementById('statusCustomText');

// 保存的自定义文字（💫 保存后才持久）
var savedCustomText = '';

// Toggle：控制状态栏显示 / 隐藏
toggleStatusBar.addEventListener('change', function() {
  statusBar.style.display = this.checked ? 'flex' : 'none';
});

// 输入框实时预览（未保存，仅实时显示）
sbCustomText.addEventListener('input', function() {
  statusCustom.textContent = this.value;
});

// 💫 保存按钮：将当前输入持久化
sbSaveBtn.addEventListener('click', function() {
  savedCustomText = sbCustomText.value;
  statusCustom.textContent = savedCustomText;
  // 按钮小动画反馈
  sbSaveBtn.style.transform = 'scale(0.88)';
  setTimeout(function() { sbSaveBtn.style.transform = ''; }, 160);
});

// 关闭外观界面时，若未点保存则还原到已保存的文字
backAppearance.addEventListener('click', function() {
  appAppearance.classList.remove('active');
  sbCustomText.value = savedCustomText;
  statusCustom.textContent = savedCustomText;
});

// =============================================
// 外观界面 — 字体卡片
// =============================================
var fontInput     = document.getElementById('fontInput');
var fontApplyBtn  = document.getElementById('fontApplyBtn');
var fontPresetBtn = document.getElementById('fontPresetBtn');
var fpLine1       = document.getElementById('fpLine1');
var fpLine2       = document.getElementById('fpLine2');
var fpLine3       = document.getElementById('fpLine3');
var phoneEl       = document.querySelector('.phone');
var customFontStyleEl = null;
var customFontLinkEl  = null;

// 实时预览：输入时更新虚线框内三行文字的字体
fontInput.addEventListener('input', function() {
  var val = this.value.trim();
});

// ✓ 应用：将字体应用到整个手机界面
fontApplyBtn.addEventListener('click', function() {
  var val = fontInput.value.trim();

  // 清除之前注入的字体资源
  if (customFontStyleEl && customFontStyleEl.parentNode) {
    customFontStyleEl.parentNode.removeChild(customFontStyleEl);
    customFontStyleEl = null;
  }
  if (customFontLinkEl && customFontLinkEl.parentNode) {
    customFontLinkEl.parentNode.removeChild(customFontLinkEl);
    customFontLinkEl = null;
  }

  if (!val) {
    // 空：恢复默认字体
    phoneEl.style.fontFamily = '';

  } else if (val.indexOf('@font-face') !== -1 || /^@import/i.test(val)) {
    // ① 原始 CSS 代码（含 @font-face 或 @import）→ 直接注入 <style>
    customFontStyleEl = document.createElement('style');
    customFontStyleEl.textContent = val;
    document.head.appendChild(customFontStyleEl);
    // 检查是否已包含选择器级别的 font-family 应用规则（如 body { font-family: ... }）
    // 若有，则不设置内联样式，让 CSS 层叠自然生效
    // 若只有 @font-face / @import，则提取字体名并设置到 .phone
    var hasApplicationRule = /\{[^}]*font-family[^}]*\}/i.test(val);
    if (!hasApplicationRule) {
      var ffMatch = val.match(/font-family\s*:\s*['"]?([^;'"]+)['"]?/i);
      if (ffMatch) {
        phoneEl.style.fontFamily = '"' + ffMatch[1].trim() + '", system-ui, sans-serif';
      }
    } else {
      phoneEl.style.fontFamily = '';
    }

  } else if (/^https?:\/\//i.test(val) && (/\.css(\?|$)/i.test(val) || /fonts\.(googleapis|bunny|adobe)\.com/i.test(val) || /css/i.test(val))) {
    // ② CSS URL（Google Fonts 等）→ 注入 <link rel="stylesheet">
    customFontLinkEl = document.createElement('link');
    customFontLinkEl.rel = 'stylesheet';
    customFontLinkEl.href = val;
    document.head.appendChild(customFontLinkEl);
    // 尝试从 URL 参数中提取字体名（Google Fonts 格式）
    var familyMatch = val.match(/[?&]family=([^&:]+)/i);
    if (familyMatch) {
      var familyName = decodeURIComponent(familyMatch[1].replace(/\+/g, ' '));
      phoneEl.style.fontFamily = '"' + familyName + '", system-ui, sans-serif';
    }

  } else if (/^https?:\/\//i.test(val)) {
    // ③ 字体文件直链（.woff2 / .ttf / .otf 等）→ 生成 @font-face
    customFontStyleEl = document.createElement('style');
    customFontStyleEl.textContent =
      '@font-face { font-family: "MphoneCustomFont"; src: url("' + val + '"); }';
    document.head.appendChild(customFontStyleEl);
    phoneEl.style.fontFamily = '"MphoneCustomFont", system-ui, sans-serif';
  }

  // 动画反馈
  fontApplyBtn.style.transform = 'scale(0.88)';
  setTimeout(function() { fontApplyBtn.style.transform = ''; }, 160);
});

// 💾 存为预设：复用现有预设弹窗
fontPresetBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  if (!fontInput.value.trim()) { shakeEl(fontInput); return; }
  presetModalMode = 'font';
  document.querySelector('#presetModal .modal-title').textContent = '备注名称';
  presetNameInput.value = '';
  presetModal.classList.add('open');
});

// =============================================
// 外观界面 — 字体大小滑条
// =============================================
var fontSizeSlider  = document.getElementById('fontSizeSlider');
var fontSizePxLabel = document.getElementById('fontSizePxLabel');
var fontScaleStyleEl = null;

// 基准字号映射表（选择器 → 原始 px）
var fontSizeBaseMap = [
  ['.status-time', 15],
  ['.clock-display', 21],
  ['.date-display', 12],
  ['.signature', 12.5],
  ['.dock-label', 10.5],
  ['.dock-icon', 25],
  ['.settings-title', 17],
  ['.section-label', 11],
  ['.field-label', 11],
  ['.field-input', 14],
  ['.field-password-row input', 14],
  ['.model-select-name', 14],
  ['.model-popup-item', 14],
  ['.temp-label', 12],
  ['.temp-value-display', 12],
  ['.temp-range-labels', 11],
  ['.action-btn', 15],
  ['.row-label', 15],
  ['.modal-title', 16],
  ['.modal-input', 14],
  ['.modal-btn', 15],
  ['.preset-card-title', 15],
  ['.preset-item > div:first-child', 14],
  ['.preset-item > div:last-child', 12],
  ['.font-input', 13],
  ['.font-size-px-label', 11],
  ['.font-preview-line', 13],
  ['.status-custom-text', 11],
  ['.sb-row-label', 15],
  ['.sb-custom-label', 11],
  ['.sb-input', 14],
  ['.sb-emoji-btn', 18],
  ['.chat-tab-label', 10],
  ['.chat-room-main-title', 16],
  ['.chat-room-sub-title', 11],
  ['.cr-input', 14],
  ['.cr-emoji-btn', 18],
  ['.book-label', 10],
  ['.bookshelf-empty-hint', 11],
  ['.notes-popup-item', 14],
  ['.notes-del-cancel-btn', 12],
  ['.contact-card-alias', 15],
  ['.contact-card-name', 12],
  ['.persona-title-sm', 12],
  ['.persona-title', 15],
  ['.persona-subtitle', 10],
  ['.persona-textarea', 13],
  ['.wb-title', 15],
  ['.wb-subtitle', 10],
  ['.wb-count', 12],
  ['.char-field-row .char-field-label', 12],
  ['.char-field-row .field-input', 13],
  ['.save-nav-btn', 15],
  ['.char-role-tag', 7],
  ['.chat-char-card-name', 15],
  ['.chat-char-card-last', 12],
  ['.chat-bg-upload-btn', 12],
  ['.bubble-section-label', 11],
  ['.bubble-opacity-label', 12],
  ['.bubble-opacity-value', 12],
  ['.bubble-effect-chip', 12],
  ['.custom-css-textarea', 11],
  ['.custom-css-apply-btn', 13],
  ['.char-action-btn', 14],
  ['.prompt-tab', 11],
  ['.prompt-section-label', 10],
  ['.prompt-textarea', 13],
  ['.prompt-entry-text', 12],
  ['.prompt-add-btn', 13],
  ['.pf-entry-card-name', 13],
  ['.pf-entry-card-sub', 11],
  ['.pf-detail-title', 13],
  ['.pf-back-btn', 13],
  ['.pf-field-label', 10],
  ['.pf-text-input', 13],
  ['.pf-textarea', 13],
  ['.pf-radio-btn', 12],
  ['.pf-save-btn', 14],
  ['.pf-del-btn', 14],
  ['.settings-subnav-item', 12],
  ['.st-preset-select-name', 13],
  ['.st-preset-popup-item', 12],
  ['.st-entry-title', 13],
  ['.st-entry-preview', 11],
  ['.cot-switch-title', 13],
  ['.cot-switch-desc', 10],
  ['.new-chat-char-alias', 14],
  ['.new-chat-char-name', 11],
  ['.new-chat-btn', 15],
  ['.new-chat-modal-title', 15],
  ['.bv-page-num', 11],
  ['.img-picker-title', 15],
  ['.img-picker-section-label', 11],
  ['.img-picker-url-input', 13],
  ['.img-picker-url-confirm', 13],
  ['.img-picker-local-btn', 14],
  ['.img-picker-cancel', 14],
  ['.prompt-tab-del-popup-item', 13],
  ['.book-new-title', 15],
  ['.book-new-input', 13],
  ['.book-cover-btn', 11],
  ['.book-upload-sub-btn', 10],
  ['.book-new-btn', 14],
  ['.book-del-confirm-title', 15],
  ['.book-del-confirm-desc', 12],
  ['.book-del-confirm-btn', 14],
  ['.book-del-countdown', 11],
  ['.shelf-full-text', 14],
  ['.shelf-full-btn', 15],
  ['.ci-item', 9],
  ['.ci-item.ci-star', 11],
  ['.msg-plus-popup-item', 14],
  ['.wp-preview-label', 10],
  ['.wp-btn', 11],
  ['.mine-profile-realname', 16],
  ['.mine-profile-id-tag', 11],
  ['.mine-profile-bio', 12],
  ['.mine-field-label', 12],
  ['.mine-field-input', 13],
  ['.mine-field-textarea', 13],
  ['.mine-switch-btn', 14],
  ['.mine-acc-title', 15],
  ['.mine-acc-item-name', 13],
  ['.mine-acc-item-sub', 11],
  ['.mine-acc-btn', 13],
  ['.cr-plus-label', 11]
];

function applyFontScale(sizePx) {
  var scale = sizePx / 14;
  fontSizePxLabel.textContent = sizePx + 'px';
  // 更新预览框三行字号
  [fpLine1, fpLine2, fpLine3].forEach(function(el) {
    el.style.fontSize = sizePx + 'px';
  });
  // 注入/更新全局字体缩放样式
  if (!fontScaleStyleEl) {
    fontScaleStyleEl = document.createElement('style');
    fontScaleStyleEl.id = 'fontScaleStyle';
    document.head.appendChild(fontScaleStyleEl);
  }
  var css = fontSizeBaseMap.map(function(pair) {
    return '.phone ' + pair[0] + ' { font-size: ' + (pair[1] * scale).toFixed(2) + 'px !important; }';
  }).join('\n');
  fontScaleStyleEl.textContent = css;
}

fontSizeSlider.addEventListener('input', function() {
  applyFontScale(parseInt(this.value, 10));
});
