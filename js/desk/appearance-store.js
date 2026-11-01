// 眠花糖机 — 外观设置的保存和恢复：边框 / 全屏、壁纸、模糊、桌面文字、状态栏、字体、字号，以及系统提示词

// =============================================
// 外观 / 系统提示词 持久化（默认全屏）
// =============================================
(function() {
  // 手机边框 / 全屏：默认全屏；同时记一份到 localStorage，下次启动时在画面出来前就用上
  function rememberFrameMode(frame) {
    mphoneStore.save('mphone_fullscreen', !frame);
    try { localStorage.setItem('mphoneFrameMode', frame ? '1' : '0'); } catch (_) {}
  }
  var startFull = mphoneStore.load('mphone_fullscreen', true);
  (startFull ? wpBtnFullscreen : wpBtnFrame).click();
  rememberFrameMode(!startFull);
  wpBtnFrame.addEventListener('click',      function() { rememberFrameMode(true); });
  wpBtnFullscreen.addEventListener('click', function() { rememberFrameMode(false); });

  // 壁纸
  function setWallpaper(src) {
    [phoneEl, wpPreview].forEach(function(el) {
      el.style.backgroundImage    = src ? 'url(' + src + ')' : '';
      el.style.backgroundSize     = src ? 'cover' : '';
      el.style.backgroundPosition = src ? 'center' : '';
    });
  }
  setWallpaper(mphoneStore.load('mphone_wallpaper', ''));
  document.getElementById('wpBtnReset').addEventListener('click', function() {
    mphoneStore.save('mphone_wallpaper', '');
  });
  // 「更换壁纸」原回调只改样式，这里在图片选好后从 .phone 上读回地址保存
  document.getElementById('wpBtnChange').addEventListener('click', function() {
    var origCb = _imgPickerCallback;
    _imgPickerCallback = function(src) {
      if (origCb) origCb(src);
      mphoneStore.save('mphone_wallpaper', src);
    };
  });

  // 壁纸模糊（0–20px）与桌面文字明暗（0 = 黑，100 = 白；null = 默认颜色）
  var wpBlurLayer = document.getElementById('wpBlurLayer');
  var wpBlurSlider = document.getElementById('wpBlurSlider');
  var deskTextSlider = document.getElementById('deskTextSlider');
  var deskTextValue = document.getElementById('deskTextValue');
  function applyWpBlur(px) {
    var f = px ? 'blur(' + px + 'px)' : '';
    wpBlurLayer.style.backdropFilter = f;
    wpBlurLayer.style.webkitBackdropFilter = f;
    wpPreview.style.filter = px ? 'blur(' + Math.max(1, Math.round(px * 0.3)) + 'px)' : '';
    document.getElementById('wpBlurValue').textContent = px;
  }
  function applyDeskText(v) {
    phoneEl.classList.toggle('desk-text-custom', v !== null);
    if (v === null) { deskTextValue.textContent = '默认'; return; }
    var c = Math.round(v * 2.55);
    phoneEl.style.setProperty('--desk-text', 'rgb(' + c + ',' + c + ',' + c + ')');
    // 浅色字配深色阴影、深色字配浅色阴影，换了背景也看得清
    phoneEl.style.setProperty('--desk-text-shadow', v >= 50 ? '0 1px 3px rgba(0,0,0,0.45)' : '0 1px 3px rgba(255,255,255,0.65)');
    deskTextValue.textContent = v + '%';
  }
  var wpBlur = mphoneStore.load('mphone_wp_blur', 0);
  var deskText = mphoneStore.load('mphone_desk_text', null);
  wpBlurSlider.value = wpBlur;
  if (deskText !== null) deskTextSlider.value = deskText;
  applyWpBlur(wpBlur);
  applyDeskText(deskText);
  wpBlurSlider.addEventListener('input', function() {
    applyWpBlur(parseInt(this.value, 10));
    mphoneStore.save('mphone_wp_blur', parseInt(this.value, 10));
  });
  deskTextSlider.addEventListener('input', function() {
    applyDeskText(parseInt(this.value, 10));
    mphoneStore.save('mphone_desk_text', parseInt(this.value, 10));
  });
  // 点「默认 / xx%」恢复原来的文字颜色
  deskTextValue.addEventListener('click', function() {
    deskTextSlider.value = 20;
    applyDeskText(null);
    mphoneStore.save('mphone_desk_text', null);
  });

  // 状态栏显示 / 自定义文字
  toggleStatusBar.checked = mphoneStore.load('mphone_statusbar_on', true);
  statusBar.style.display = toggleStatusBar.checked ? 'flex' : 'none';
  document.querySelector('.phone').classList.toggle('no-statusbar', !toggleStatusBar.checked);
  toggleStatusBar.addEventListener('change', function() {
    mphoneStore.save('mphone_statusbar_on', this.checked);
  });
  savedCustomText = mphoneStore.load('mphone_statusbar_text', '');
  sbCustomText.value = savedCustomText;
  statusCustom.textContent = savedCustomText;
  sbSaveBtn.addEventListener('click', function() {
    mphoneStore.save('mphone_statusbar_text', savedCustomText);
  });

  // 字体：点 ✓ 应用时保存（空 = 恢复默认）
  var savedFont = mphoneStore.load('mphone_font', '');
  if (savedFont) { fontInput.value = savedFont; fontApplyBtn.click(); }
  fontApplyBtn.addEventListener('click', function() {
    mphoneStore.save('mphone_font', fontInput.value.trim());
  });

  // 字号
  var savedSize = mphoneStore.load('mphone_font_size', 14);
  if (savedSize !== 14) { fontSizeSlider.value = savedSize; applyFontScale(savedSize); }
  fontSizeSlider.addEventListener('change', function() {
    mphoneStore.save('mphone_font_size', parseInt(this.value, 10));
  });

  // 系统提示词（Prompt → 系统）
  var sysTA = document.getElementById('systemPromptTA');
  var savedSys = mphoneStore.load('mphone_system_prompt', null);
  if (savedSys !== null) sysTA.value = savedSys;
  sysTA.addEventListener('input', function() {
    mphoneStore.save('mphone_system_prompt', this.value);
  });

  renderApiPresets();
  renderFontPresets();
})();
