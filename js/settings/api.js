// 眠花糖机 — 设置页：打开 / 关闭、顶部分页、主 API（地址、密钥、模型列表）、API 预设和字体预设、温度

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

// 设置界面 — 顶栏下方固定横向菜单切换（主API / 语音API / 生图API / 辅助功能）
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

closeOnBackdrop(presetModal);

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
