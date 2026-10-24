// 眠花糖机 — 外观 / 系统提示词 持久化（默认全屏）

// =============================================
// 外观 / 系统提示词 持久化（默认全屏）
// =============================================
(function() {
  // 手机边框 / 全屏：默认全屏
  (mphoneStore.load('mphone_fullscreen', true) ? wpBtnFullscreen : wpBtnFrame).click();
  wpBtnFrame.addEventListener('click',      function() { mphoneStore.save('mphone_fullscreen', false); });
  wpBtnFullscreen.addEventListener('click', function() { mphoneStore.save('mphone_fullscreen', true); });

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

// =============================================
// 设置 — 数据管理：占用分析圆环 + 备份 / 导入（全部 mphone_ 数据）
// =============================================
(function() {
  var exportRow = document.querySelector('#settingsScreen .data-icon-export').closest('.card-row');
  var importRow = document.querySelector('#settingsScreen .data-icon-import').closest('.card-row');
  var importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = '.json,application/json';
  importInput.style.display = 'none';
  document.body.appendChild(importInput);

  // 占用分类：按数据 key 归类，所有 key 里的图片单独统计
  var DATA_GROUPS = [
    { name: '聊天记录', color: '#E8909E', keys: ['mphone_chat_histories', 'mphone_drama_histories'] },
    { name: '图片',     color: '#9BB8D8', keys: null },
    { name: '角色',     color: '#C4A6DC', keys: ['mphone_chars', 'mphone_unread', 'mphone_auto_next'] },
    { name: '动态',     color: '#F2C28C', keys: ['mphone_feed', 'mphone_feed_cover'] },
    { name: '笔记',     color: '#A8D4B8', keys: ['mphone_notes_shelves'] },
    { name: '世界书',   color: '#E0B8A0', keys: ['mphone_worldbook', 'mphone_wb_folders'] },
    { name: '其他',     color: '#D6D0D6', keys: [] }
  ];

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  function analyze() {
    var sizes = DATA_GROUPS.map(function() { return 0; });
    var imgIdx = 1, otherIdx = DATA_GROUPS.length - 1;
    mphoneStore.keys().forEach(function(k) {
      var json = JSON.stringify(mphoneStore.load(k, null)) || '';
      var img = 0;
      (json.match(/data:image\/[^"\\]+/g) || []).forEach(function(s) { img += s.length; });
      var text = Math.max(0, new Blob([json]).size - img);
      sizes[imgIdx] += img;
      var gi = otherIdx;
      DATA_GROUPS.forEach(function(g, i) { if (g.keys && g.keys.indexOf(k) >= 0) gi = i; });
      sizes[gi] += text;
    });
    return sizes;
  }

  function renderUsage() {
    var sizes = analyze();
    var total = sizes.reduce(function(a, b) { return a + b; }, 0);
    var svg = document.getElementById('dataDonut');
    var R = 15.915;   // 周长 ≈ 100，便于按百分比画弧
    var html = '<circle cx="21" cy="21" r="' + R + '" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="5"></circle>';
    var offset = 0;
    sizes.forEach(function(s, i) {
      if (!total || !s) return;
      var pct = s / total * 100;
      html += '<circle cx="21" cy="21" r="' + R + '" fill="none" stroke="' + DATA_GROUPS[i].color + '" stroke-width="5"' +
              ' stroke-dasharray="' + pct.toFixed(3) + ' ' + (100 - pct).toFixed(3) + '" stroke-dashoffset="' + (-offset).toFixed(3) + '"></circle>';
      offset += pct;
    });
    svg.innerHTML = html;
    document.getElementById('dataTotal').textContent = fmtBytes(total);

    var legend = document.getElementById('dataLegend');
    legend.innerHTML = '';
    sizes.forEach(function(s, i) {
      if (!s) return;
      var item = document.createElement('span');
      item.className = 'data-legend-item';
      item.innerHTML = '<span class="data-legend-dot" style="background:' + DATA_GROUPS[i].color + '"></span>';
      item.appendChild(document.createTextNode(DATA_GROUPS[i].name + ' ' + fmtBytes(s)));
      legend.appendChild(item);
    });

    var quota = document.getElementById('dataQuota');
    var mode = mphoneStore.usingIndexedDB() ? '存储方式：IndexedDB' : '存储方式：localStorage（约 5MB 上限）';
    quota.textContent = mode;
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function(est) {
        if (est && est.quota) quota.textContent = mode + ' · 浏览器可用配额约 ' + fmtBytes(est.quota);
      }).catch(function() {});
    }
  }

  // 打开设置时刷新占用
  dockSettings.addEventListener('click', function() { setTimeout(renderUsage, 50); });

  exportRow.addEventListener('click', function() {
    mphoneStore.flush();
    var data = {};
    mphoneStore.keys().forEach(function(k) { data[k] = mphoneStore.load(k, null); });
    var d = new Date();
    var name = 'mphone-backup-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json';
    var blob = new Blob([JSON.stringify({ app: 'mphone', version: 2, data: data })], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
    showToast('✓ 已导出备份', 'success');
  });

  importRow.addEventListener('click', function() {
    importInput.value = '';
    importInput.click();
  });

  importInput.addEventListener('change', function() {
    var file = this.files && this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      var parsed;
      try {
        parsed = JSON.parse(ev.target.result);
        if (!parsed || parsed.app !== 'mphone' || typeof parsed.data !== 'object') throw new Error('bad');
      } catch (_) {
        showToast('✗ 文件格式不正确', 'error');
        return;
      }
      openPfEntryDel('导入会覆盖当前的全部数据，确定继续吗？', function() {
        // 第 1 版备份里的值是 localStorage 文本，需要先解析
        var data = {};
        Object.keys(parsed.data).forEach(function(k) {
          if (k.indexOf('mphone_') !== 0) return;
          var v = parsed.data[k];
          if (parsed.version !== 2 && typeof v === 'string') {
            try { v = JSON.parse(v); } catch (_) {}
          }
          data[k] = v;
        });
        mphoneStore.replaceAll(data).then(function() {
          showToast('✓ 导入成功，正在刷新', 'success');
          setTimeout(function() { location.reload(); }, 800);
        });
      });
    };
    reader.readAsText(file);
  });
})();

// 初始渲染聊天角色列表
renderChatCharList();
