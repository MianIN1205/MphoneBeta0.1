// 眠花糖机 — 公共工具 / 时钟电量 / 设置页（API、预设、温度）

const WEEKDAYS = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
function pad(n) { return String(n).padStart(2, '0'); }

function genAccountUid() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// 「我的」账号列表（任意模块可读；修改只在「我的」界面进行）
function loadAccounts() {
  var accs = mphoneStore.load('mphone_mine_accounts_v1', []);
  return Array.isArray(accs) ? accs : [];
}

// 必填项未填写时的抖动提示
function shakeEl(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  el.addEventListener('animationend', function() { el.classList.remove('shake'); }, { once: true });
  if (el.focus) el.focus();
}

// ---------- 时间显示 ----------
// 两个时间戳相差几个自然日（按本地日期算）
function daysAgo(t) {
  var a = new Date(t), b = new Date();
  a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}
// 聊天里居中显示的时间：今天 14:32 / 昨天 14:32 / 星期三 14:32 / 10月3日 14:32 / 2025年10月3日 14:32
function fmtMsgTime(t) {
  var d = new Date(t), hm = pad(d.getHours()) + ':' + pad(d.getMinutes()), n = daysAgo(t);
  if (n === 0) return hm;
  if (n === 1) return '昨天 ' + hm;
  if (n > 1 && n < 7) return WEEKDAYS[d.getDay()] + ' ' + hm;
  var md = (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  return d.getFullYear() === new Date().getFullYear() ? md : d.getFullYear() + '年' + md;
}
// 会话列表右上角的时间：14:32 / 昨天 / 星期三 / 10/3 / 2025/10/3
function fmtListTime(t) {
  var d = new Date(t), n = daysAgo(t);
  if (n === 0) return pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (n === 1) return '昨天';
  if (n > 1 && n < 7) return WEEKDAYS[d.getDay()];
  var md = (d.getMonth() + 1) + '/' + d.getDate();
  return d.getFullYear() === new Date().getFullYear() ? md : d.getFullYear() + '/' + md;
}

// ---------- 通用左滑操作 ----------
// row 是 position:relative 的容器，front 是可点击的内容，acts 是右侧按钮组（宽 width）。
// 内容不移动，按钮从右边滑进来盖住右侧；同一时间只展开一行。
var _openSwipeRow = null;
function closeSwipeRow(row) {
  if (!row) return;
  row._setSwipe(0);
  row.classList.remove('open');
  if (_openSwipeRow === row) _openSwipeRow = null;
}
function bindSwipeActions(row, front, acts, width) {
  var startX = 0, startY = 0, base = 0, dx = 0, dragging = false, decided = false;
  row._setSwipe = function(x) {
    acts.style.transform = 'translateX(' + (width + x) + 'px)';
    front.style.paddingRight = (-x > 14 ? -x : 14) + 'px';
  };
  front.addEventListener('pointerdown', function(e) {
    startX = e.clientX; startY = e.clientY;
    base = row.classList.contains('open') ? -width : 0;
    dx = 0; dragging = true; decided = false;
    acts.style.transition = front.style.transition = 'none';
  });
  front.addEventListener('pointermove', function(e) {
    if (!dragging) return;
    var mx = e.clientX - startX, my = e.clientY - startY;
    if (!decided) {
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      decided = true;
      // 竖向滑动交给列表滚动
      if (Math.abs(my) > Math.abs(mx)) { dragging = false; acts.style.transition = front.style.transition = ''; return; }
      try { front.setPointerCapture(e.pointerId); } catch (_) {}
      if (_openSwipeRow && _openSwipeRow !== row) closeSwipeRow(_openSwipeRow);
    }
    dx = mx;
    row._setSwipe(Math.max(-width, Math.min(0, base + dx)));
  });
  function end() {
    if (!dragging) return;
    dragging = false;
    acts.style.transition = front.style.transition = '';
    if (!decided) return;
    // 刚滑动过，接下来的点击不算「打开」
    row._justSwiped = true;
    setTimeout(function() { row._justSwiped = false; }, 350);
    if (base + dx < -width / 2) {
      row._setSwipe(-width);
      row.classList.add('open');
      _openSwipeRow = row;
    } else {
      closeSwipeRow(row);
    }
  }
  front.addEventListener('pointerup', end);
  front.addEventListener('pointercancel', end);
}
// 点击正在滑开（或刚滑过）的行：只收起，不触发打开
document.addEventListener('click', function(e) {
  var row = e.target.closest && e.target.closest('.swipe-row');
  if (!row || e.target.closest('.swipe-acts')) return;
  if (row._justSwiped || row.classList.contains('open')) {
    e.stopPropagation(); e.preventDefault();
    closeSwipeRow(row);
  }
}, true);
document.addEventListener('pointerdown', function(e) {
  if (_openSwipeRow && !_openSwipeRow.contains(e.target)) closeSwipeRow(_openSwipeRow);
});

function updateClock() {
  const now = new Date();
  const timeStr = pad(now.getHours()) + ':' + pad(now.getMinutes());
  document.getElementById('statusTime').textContent = timeStr;
  document.getElementById('clockDisplay').textContent = timeStr;
  document.getElementById('dateDisplay').textContent =
    now.getFullYear() + '年' + pad(now.getMonth()+1) + '月' +
    pad(now.getDate()) + '日 ' + WEEKDAYS[now.getDay()];
}
updateClock();
setInterval(updateClock, 1000);

function setBatteryLevel(level) {
  const pct = Math.max(0, Math.min(1, level));
  const fill = document.getElementById('batteryFill');
  fill.style.width = (pct * 100) + '%';
  fill.style.background = pct <= 0.2 ? '#e74c3c' : '#333';
}
if ('getBattery' in navigator) {
  navigator.getBattery().then(function(bat) {
    setBatteryLevel(bat.level);
    bat.addEventListener('levelchange', function() { setBatteryLevel(bat.level); });
  });
} else { setBatteryLevel(0.8); }

// 设置界面开关
const settingsScreen = document.getElementById('settingsScreen');
const dockSettings   = document.getElementById('dockSettings');
const backBtn        = document.getElementById('backBtn');

dockSettings.addEventListener('click', function() {
  settingsScreen.classList.add('active');
  // url/key 有值时自动刷新模型列表（会恢复上次选中的模型）；无值时清空
  var _url = document.getElementById('apiUrl').value.trim() || mphoneStore.load('mphone_api_url', null) || '';
  var _key = document.getElementById('apiKey').value.trim() || mphoneStore.load('mphone_api_key', null) || '';
  if (_url && _key) {
    setTimeout(function() { refreshBtn.click(); }, 60);
  } else {
    modelPopup.innerHTML = '';
    modelDisplay.textContent = '请选择模型';
    modelPopup.classList.remove('open');
    modelChevron.classList.remove('open');
  }
  requestAnimationFrame(function() { requestAnimationFrame(updateSliderThumb); });
});
backBtn.addEventListener('click', function() {
  settingsScreen.classList.remove('active');
  modelPopup.classList.remove('open');
  modelChevron.classList.remove('open');
});

// 设置界面 — 顶栏下方固定横向菜单切换（主API / 语音API / 生图API）
document.querySelectorAll('#settingsSubnav .settings-subnav-item').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var stab = this.dataset.stab;
    document.querySelectorAll('#settingsSubnav .settings-subnav-item').forEach(function(b) {
      b.classList.remove('active');
    });
    this.classList.add('active');
    document.querySelectorAll('#settingsScreen .settings-subpanel').forEach(function(panel) {
      panel.classList.toggle('active', panel.dataset.spanel === stab);
    });
    if (stab === 'main-api') {
      requestAnimationFrame(function() { requestAnimationFrame(updateSliderThumb); });
    }
  });
});

// 眼睛图标切换
const eyeBtn  = document.getElementById('eyeBtn');
const apiKey  = document.getElementById('apiKey');
const eyeIcon = document.getElementById('eyeIcon');

eyeBtn.addEventListener('click', function() {
  const isHidden = apiKey.type === 'password';
  apiKey.type = isHidden ? 'text' : 'password';
  eyeBtn.classList.toggle('visible', isHidden);
  eyeIcon.innerHTML = isHidden
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
});

// url/key 实时联动：任意一个清空则立刻清空模型列表
function syncModelState() {
  var _url = document.getElementById('apiUrl').value.trim();
  var _key = document.getElementById('apiKey').value.trim();
  if (!_url || !_key) {
    modelPopup.innerHTML = '';
    modelDisplay.textContent = '请选择模型';
    modelPopup.classList.remove('open');
    modelChevron.classList.remove('open');
  }
}
document.getElementById('apiUrl').addEventListener('input', syncModelState);
document.getElementById('apiKey').addEventListener('input', syncModelState);

// 刷新按钮
const refreshBtn = document.getElementById('refreshBtn');

// Toast 提示（屏幕偏上方小弹窗）
function showToast(msg, type) {
  var toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = [
    'position:fixed',
    'top:60px',
    'left:50%',
    'transform:translateX(-50%)',
    'background:' + (type === 'success' ? 'rgba(56,168,90,0.93)' : 'rgba(210,60,60,0.93)'),
    'color:#fff',
    'padding:7px 20px',
    'border-radius:20px',
    'font-size:13px',
    'font-weight:600',
    'font-family:system-ui,-apple-system,sans-serif',
    'letter-spacing:0.3px',
    'box-shadow:0 4px 18px rgba(0,0,0,0.22)',
    'z-index:99999',
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 0.2s ease',
    'white-space:nowrap'
  ].join(';');
  document.body.appendChild(toast);
  requestAnimationFrame(function() {
    requestAnimationFrame(function() { toast.style.opacity = '1'; });
  });
  setTimeout(function() {
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
  }, 1700);
}

// 模型弹窗
const modelSelectBox = document.getElementById('modelSelectBox');
const modelPopup     = document.getElementById('modelPopup');
const modelDisplay   = document.getElementById('modelDisplay');
const modelChevron   = document.getElementById('modelChevron');

modelSelectBox.addEventListener('click', function(e) {
  e.stopPropagation();
  const isOpen = modelPopup.classList.toggle('open');
  modelChevron.classList.toggle('open', isOpen);
});

document.querySelectorAll('.model-popup-item').forEach(function(item) {
  item.addEventListener('click', function(e) {
    e.stopPropagation();
    document.querySelectorAll('.model-popup-item').forEach(function(i) {
      i.classList.remove('selected');
    });
    item.classList.add('selected');
    modelDisplay.textContent = item.dataset.model;
    modelPopup.classList.remove('open');
    modelChevron.classList.remove('open');
  });
});

document.addEventListener('click', function() {
  modelPopup.classList.remove('open');
  modelChevron.classList.remove('open');
});

// 存为预设弹窗
const btnSavePreset   = document.getElementById('btnSavePreset');
const presetModal     = document.getElementById('presetModal');
const modalCancel     = document.getElementById('modalCancel');
const modalConfirm    = document.getElementById('modalConfirm');
const presetNameInput = document.getElementById('presetNameInput');

// 存为预设弹窗共用：'api' = API 预设，'font' = 字体预设
var presetModalMode = 'api';
var apiPresets  = mphoneStore.load('mphone_api_presets', []);
var fontPresets = mphoneStore.load('mphone_font_presets', []);

btnSavePreset.addEventListener('click', function(e) {
  e.stopPropagation();
  presetModalMode = 'api';
  document.querySelector('#presetModal .modal-title').textContent = '备注名称';
  presetNameInput.value = '';
  presetModal.classList.add('open');
});

modalCancel.addEventListener('click', function() {
  presetModal.classList.remove('open');
});

// 渲染一张 API 预设卡片
function createApiPresetItem(d, idx) {
  var pItem = document.createElement('div');
  pItem.className = 'preset-item';
  pItem.style.position = 'relative';
  var nameEl = document.createElement('div');
  nameEl.style.cssText = 'font-size:14px;font-weight:600;color:#333;';
  nameEl.textContent = d.name;
  var subEl = document.createElement('div');
  subEl.style.cssText = 'font-size:12px;color:#aaa;margin-top:3px;';
  subEl.textContent = (d.model || '未选择模型') + ' · 温度 ' + d.temp;
  var delBtn = document.createElement('button');
  delBtn.textContent = '✕';
  delBtn.title = '删除预设';
  delBtn.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);border:none;background:none;color:#ccc;font-size:13px;cursor:pointer;';
  delBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    apiPresets.splice(idx, 1);
    mphoneStore.save('mphone_api_presets', apiPresets);
    renderApiPresets();
  });
  pItem.appendChild(nameEl);
  pItem.appendChild(subEl);
  pItem.appendChild(delBtn);

  // 点击预设 → 回填表单
  pItem.addEventListener('click', function() {
    document.getElementById('apiUrl').value = d.url;
    document.getElementById('apiKey').value = d.key;
    if (d.model) {
      modelDisplay.textContent = d.model;
      // 同步 popup 的 selected 状态（若列表已加载）
      document.querySelectorAll('.model-popup-item').forEach(function(it) {
        it.classList.toggle('selected', it.dataset.model === d.model);
      });
    } else {
      modelDisplay.textContent = '请选择模型';
      document.querySelectorAll('.model-popup-item').forEach(function(it) {
        it.classList.remove('selected');
      });
    }
    tempSlider.value = d.temp;
    updateSliderThumb();
    // 高亮选中预设
    document.querySelectorAll('.preset-item').forEach(function(i) {
      i.classList.remove('selected');
    });
    this.classList.add('selected');
  });
  return pItem;
}

function renderApiPresets() {
  presetList.innerHTML = '';
  apiPresets.forEach(function(d, i) { presetList.appendChild(createApiPresetItem(d, i)); });
}

// 字体预设：点击芯片 → 填入并应用；✕ 删除
function renderFontPresets() {
  var wrap = document.getElementById('fontPresetChips');
  wrap.innerHTML = '';
  fontPresets.forEach(function(fp, i) {
    var chip = document.createElement('span');
    chip.className = 'font-preset-chip';
    chip.title = fp.value;
    var label = document.createElement('span');
    label.textContent = fp.name;
    var del = document.createElement('button');
    del.className = 'font-preset-chip-del';
    del.textContent = '×';
    del.addEventListener('click', function(e) {
      e.stopPropagation();
      fontPresets.splice(i, 1);
      mphoneStore.save('mphone_font_presets', fontPresets);
      renderFontPresets();
    });
    chip.appendChild(label);
    chip.appendChild(del);
    chip.addEventListener('click', function() {
      fontInput.value = fp.value;
      fontApplyBtn.click();
    });
    wrap.appendChild(chip);
  });
}

modalConfirm.addEventListener('click', function() {
  var name = presetNameInput.value.trim();
  if (!name) {
    presetNameInput.classList.remove('shake');
    void presetNameInput.offsetWidth;
    presetNameInput.classList.add('shake');
    presetNameInput.addEventListener('animationend', function() {
      presetNameInput.classList.remove('shake');
    }, { once: true });
    return;
  }

  if (presetModalMode === 'wallet') {
    if (!confirmWalletTopup(name)) { shakeEl(presetNameInput); return; }
    presetModal.classList.remove('open');
    return;
  }

  if (presetModalMode === 'wbFolder') {
    presetModal.classList.remove('open');
    if (_wbFolderNameCb) _wbFolderNameCb(name);
    _wbFolderNameCb = null;
    return;
  }

  if (presetModalMode === 'font') {
    fontPresets.push({ name: name, value: fontInput.value.trim() });
    mphoneStore.save('mphone_font_presets', fontPresets);
    renderFontPresets();
    presetModal.classList.remove('open');
    showToast('✓ 已保存字体预设', 'success');
    return;
  }

  // 读取正在填写的值（非已应用的 localStorage 值）
  var pModel = modelDisplay.textContent.trim();
  if (pModel === '请选择模型') pModel = '';
  apiPresets.push({
    name:  name,
    url:   document.getElementById('apiUrl').value.trim(),
    key:   document.getElementById('apiKey').value.trim(),
    model: pModel,
    temp:  parseFloat(tempSlider.value).toFixed(2)
  });
  mphoneStore.save('mphone_api_presets', apiPresets);
  renderApiPresets();

  // 自动展开预设列表
  if (!presetList.classList.contains('open')) {
    presetHeader.classList.add('open');
    presetList.classList.add('open');
  }

  presetModal.classList.remove('open');
});

presetModal.addEventListener('click', function(e) {
  if (e.target === presetModal) presetModal.classList.remove('open');
});

// 预设卡片折叠
const presetHeader = document.getElementById('presetHeader');
const presetList   = document.getElementById('presetList');

presetHeader.addEventListener('click', function() {
  presetHeader.classList.toggle('open');
  presetList.classList.toggle('open');
});

document.querySelectorAll('.preset-item').forEach(function(item) {
  item.addEventListener('click', function() {
    document.querySelectorAll('.preset-item').forEach(function(i) {
      i.classList.remove('selected');
    });
    item.classList.add('selected');
  });
});

// 温度滑条
const tempSlider       = document.getElementById('tempSlider');
const sliderThumb      = document.getElementById('sliderThumb');
const tempValueDisplay = document.getElementById('tempValueDisplay');

function updateSliderThumb() {
  const min = parseFloat(tempSlider.min);
  const max = parseFloat(tempSlider.max);
  const val = parseFloat(tempSlider.value);
  const pct = (val - min) / (max - min);
  sliderThumb.style.left = (pct * tempSlider.offsetWidth) + 'px';
  tempValueDisplay.textContent = val.toFixed(2);
}

tempSlider.addEventListener('input', updateSliderThumb);
requestAnimationFrame(function() { requestAnimationFrame(updateSliderThumb); });

// =============================================
// 接口报错记录：外部接口返回错误或连不上时记下来，供内置助手答疑
// 只记地址（去掉 ? 后面的参数）、状态码和报错文字，不记密钥
// =============================================
var apiErrorLog = mphoneStore.load('mphone_api_errors', []);
var API_ERROR_MAX = 20;
function apiFeatureName(path) {
  if (/chat\/completions/.test(path)) return '聊天回复';
  if (/\/models\/?$/.test(path)) return '获取模型列表';
  if (/audio\/transcriptions/.test(path)) return '语音转文字';
  if (/audio\/speech|t2a|text-to-speech/.test(path)) return '语音合成';
  if (/image/.test(path)) return '生图';
  return '接口请求';
}
// 报错文字里可能带着密钥片段，存之前打码
function redactSecret(text) {
  return String(text || '').replace(/(sk|key|pk)-[A-Za-z0-9_\-]{6,}/gi, '$1-***').replace(/Bearer\s+\S+/gi, 'Bearer ***').slice(0, 300);
}
function logApiError(url, status, message) {
  var u;
  try { u = new URL(url, location.href); } catch (_) { return; }
  apiErrorLog.push({ time: Date.now(), feature: apiFeatureName(u.pathname), url: u.origin + u.pathname,
                     status: status, message: redactSecret(message) });
  if (apiErrorLog.length > API_ERROR_MAX) apiErrorLog = apiErrorLog.slice(-API_ERROR_MAX);
  mphoneStore.save('mphone_api_errors', apiErrorLog);
}
(function() {
  var rawFetch = window.fetch;
  if (!rawFetch) return;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var external = false;
    try { external = new URL(url, location.href).origin !== location.origin; } catch (_) {}
    var p = rawFetch.apply(this, arguments);
    if (!external) return p;
    return p.then(function(res) {
      if (!res.ok) {
        res.clone().text().then(function(t) {
          var msg = t;
          try { var j = JSON.parse(t); msg = (j.error && (j.error.message || j.error)) || j.message || j.detail || t; } catch (_) {}
          logApiError(url, res.status, typeof msg === 'string' ? msg : JSON.stringify(msg));
        }, function() { logApiError(url, res.status, ''); });
      }
      return res;
    }, function(err) {
      if (!err || err.name !== 'AbortError') logApiError(url, 0, (err && err.message) || '连接失败');
      throw err;
    });
  };
})();
