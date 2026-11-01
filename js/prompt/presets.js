// 眠花糖机 — Prompt：预设提示词（条目开关、排序、新建 / 保存 / 删除），导入酒馆预设

// =============================================
// Prompt — 类 SillyTavern 预设提示词管理
// =============================================
var stPresetSelectBox   = document.getElementById('stPresetSelectBox');
var stPresetSelectName  = document.getElementById('stPresetSelectName');
var stPresetChevron     = document.getElementById('stPresetChevron');
var stPresetPopup       = document.getElementById('stPresetPopup');
var stPresetNewBtn      = document.getElementById('stPresetNewBtn');
var stPresetSaveBtn     = document.getElementById('stPresetSaveBtn');
var stPresetDelBtn      = document.getElementById('stPresetDelBtn');
var stPresetNameBar     = document.getElementById('stPresetNameBar');
var stPresetNameInput   = document.getElementById('stPresetNameInput');
var stPresetNameOk      = document.getElementById('stPresetNameOk');
var stPresetNameCancel  = document.getElementById('stPresetNameCancel');
var stEntryList         = document.getElementById('stEntryList');
var stAddEntryBtn       = document.getElementById('stAddEntryBtn');

var stEntryDetailView   = document.getElementById('stEntryDetailView');
var stEntryDetailBack   = document.getElementById('stEntryDetailBack');
var stEntryDetailTitle  = document.getElementById('stEntryDetailTitle');
var stEntryNameInput    = document.getElementById('stEntryNameInput');
var stEntryRoleRow      = document.getElementById('stEntryRoleRow');
var stEntryContentInput = document.getElementById('stEntryContentInput');
var stEntryDetailSave   = document.getElementById('stEntryDetailSave');
var stEntryDetailDelete = document.getElementById('stEntryDetailDelete');

var stPresets = [];
var stActivePresetIdx = 0;
var stEditingEntryIdx = -1;

function getDefaultStPresets() {
  return [
    {
      name: '默认预设',
      entries: [
        {
          name: '主要提示词 (Main Prompt)',
          role: 'system',
          enabled: true,
          content: '请以角色的第一视角与用户进行自然、生动的互动，注重细节描写与情感递进。'
        },
        {
          name: '文风与叙事规范',
          role: 'system',
          enabled: true,
          content: '语言自然流畅，对话与动作神态自然穿插，避免机械重复与说教口吻。'
        },
        {
          name: '创作自由确认',
          role: 'assistant',
          enabled: false,
          content: '明白，我将完全代入角色设定与故事语境，直接开始沉浸式演绎。'
        }
      ]
    }
  ];
}

function saveStPresetsToStorage() {
  try {
    mphoneStore.save('mphone_st_presets', stPresets);
    mphoneStore.save('mphone_st_active_idx', stActivePresetIdx);
  } catch (_) {}
}

function loadStPresetsFromStorage() {
  try {
    var raw = mphoneStore.load('mphone_st_presets', null);
    var idx = parseInt(mphoneStore.load('mphone_st_active_idx', 0), 10);
    if (raw) {
      var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) {
        stPresets = parsed;
        stActivePresetIdx = (idx >= 0 && idx < stPresets.length) ? idx : 0;
        return;
      }
    }
  } catch (_) {}
  stPresets = getDefaultStPresets();
  stActivePresetIdx = 0;
}

function getRoleLabel(role) {
  if (role === 'user') return 'USER';
  if (role === 'assistant') return 'AI';
  return 'SYS';
}

function renderStPresetSelector() {
  var cur = stPresets[stActivePresetIdx] || stPresets[0];
  stPresetSelectName.textContent = cur ? cur.name : '默认预设';
  stPresetPopup.innerHTML = '';
  stPresets.forEach(function(p, idx) {
    var item = document.createElement('div');
    item.className = 'st-preset-popup-item' + (idx === stActivePresetIdx ? ' selected' : '');
    item.textContent = p.name;
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      stActivePresetIdx = idx;
      saveStPresetsToStorage();
      stPresetPopup.classList.remove('open');
      stPresetChevron.classList.remove('open');
      renderStPresetSelector();
      renderStEntryList();
    });
    stPresetPopup.appendChild(item);
  });
}

function renderStEntryList() {
  stEntryList.innerHTML = '';
  var cur = stPresets[stActivePresetIdx];
  if (!cur || !Array.isArray(cur.entries)) return;

  cur.entries.forEach(function(entry, idx) {
    var card = document.createElement('div');
    card.className = 'st-entry-card' + (entry.enabled ? '' : ' disabled');

    var badge = document.createElement('span');
    var roleKey = (entry.role === 'user' || entry.role === 'assistant') ? entry.role : 'system';
    badge.className = 'st-role-badge role-' + roleKey;
    badge.textContent = getRoleLabel(roleKey);

    var main = document.createElement('div');
    main.className = 'st-entry-main';
    var title = document.createElement('div');
    title.className = 'st-entry-title';
    title.textContent = entry.name || '未命名条目';
    var preview = document.createElement('div');
    preview.className = 'st-entry-preview';
    preview.textContent = entry.content || '（空内容）';
    main.appendChild(title);
    main.appendChild(preview);

    var toggleLabel = document.createElement('label');
    toggleLabel.className = 'st-toggle-wrap';
    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!entry.enabled;
    var slider = document.createElement('span');
    slider.className = 'st-toggle-slider';
    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(slider);

    toggleLabel.addEventListener('click', function(e) {
      e.stopPropagation();
    });
    checkbox.addEventListener('change', function() {
      entry.enabled = this.checked;
      card.classList.toggle('disabled', !entry.enabled);
      saveStPresetsToStorage();
    });

    card.addEventListener('click', function() {
      openStEntryDetail(idx);
    });

    card.appendChild(badge);
    card.appendChild(main);
    card.appendChild(toggleLabel);
    stEntryList.appendChild(card);
  });
}

stPresetSelectBox.addEventListener('click', function(e) {
  e.stopPropagation();
  var isOpen = stPresetPopup.classList.toggle('open');
  stPresetChevron.classList.toggle('open', isOpen);
});

document.addEventListener('click', function() {
  stPresetPopup.classList.remove('open');
  stPresetChevron.classList.remove('open');
});

stPresetNewBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  stPresetNameInput.value = '';
  stPresetNameBar.classList.add('open');
  stPresetNameInput.focus();
});

stPresetNameCancel.addEventListener('click', function() {
  stPresetNameBar.classList.remove('open');
});

stPresetNameOk.addEventListener('click', function() {
  var name = stPresetNameInput.value.trim();
  if (!name) {
    shakeEl(stPresetNameInput);
    return;
  }
  var cur = stPresets[stActivePresetIdx];
  var copiedEntries = (cur && Array.isArray(cur.entries))
    ? JSON.parse(JSON.stringify(cur.entries))
    : [];
  stPresets.push({ name: name, entries: copiedEntries });
  stActivePresetIdx = stPresets.length - 1;
  saveStPresetsToStorage();
  stPresetNameBar.classList.remove('open');
  renderStPresetSelector();
  renderStEntryList();
  showToast('✓ 已新建预设「' + name + '」', 'success');
});

stPresetSaveBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  saveStPresetsToStorage();
  var cur = stPresets[stActivePresetIdx];
  showToast('✓ 预设「' + (cur ? cur.name : '') + '」已保存', 'success');
});

stPresetDelBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  if (stPresets.length <= 1) {
    showToast('至少保留一个预设', 'error');
    return;
  }
  var cur = stPresets[stActivePresetIdx];
  openConfirm('删除预设「' + (cur ? cur.name : '') + '」？', function() {
    stPresets.splice(stActivePresetIdx, 1);
    if (stActivePresetIdx >= stPresets.length) {
      stActivePresetIdx = stPresets.length - 1;
    }
    saveStPresetsToStorage();
    renderStPresetSelector();
    renderStEntryList();
    showToast('已删除预设', 'success');
  });
});

stEntryRoleRow.querySelectorAll('.pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    stEntryRoleRow.querySelectorAll('.pf-radio-btn').forEach(function(b) {
      b.classList.remove('selected');
    });
    this.classList.add('selected');
  });
});

function openStEntryDetail(idx) {
  var cur = stPresets[stActivePresetIdx];
  if (!cur) return;
  stEditingEntryIdx = idx;
  if (idx >= 0 && cur.entries[idx]) {
    var entry = cur.entries[idx];
    stEntryDetailTitle.textContent = entry.name || '编辑条目';
    stEntryNameInput.value = entry.name || '';
    stEntryContentInput.value = entry.content || '';
    var r = (entry.role === 'user' || entry.role === 'assistant') ? entry.role : 'system';
    stEntryRoleRow.querySelectorAll('.pf-radio-btn').forEach(function(b) {
      b.classList.toggle('selected', b.dataset.role === r);
    });
    stEntryDetailDelete.classList.remove('hidden');
  } else {
    stEntryDetailTitle.textContent = '新建提示词条目';
    stEntryNameInput.value = '';
    stEntryContentInput.value = '';
    stEntryRoleRow.querySelectorAll('.pf-radio-btn').forEach(function(b) {
      b.classList.toggle('selected', b.dataset.role === 'system');
    });
    stEntryDetailDelete.classList.add('hidden');
  }
  stEntryDetailView.classList.add('open');
}

stEntryDetailBack.addEventListener('click', function() {
  stEntryDetailView.classList.remove('open');
});

stAddEntryBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  openStEntryDetail(-1);
});

stEntryDetailSave.addEventListener('click', function() {
  var cur = stPresets[stActivePresetIdx];
  if (!cur) return;
  var name = stEntryNameInput.value.trim() || '未命名条目';
  var selectedRoleBtn = stEntryRoleRow.querySelector('.pf-radio-btn.selected');
  var role = selectedRoleBtn ? selectedRoleBtn.dataset.role : 'system';
  var content = stEntryContentInput.value.trim();

  if (stEditingEntryIdx >= 0 && cur.entries[stEditingEntryIdx]) {
    cur.entries[stEditingEntryIdx].name = name;
    cur.entries[stEditingEntryIdx].role = role;
    cur.entries[stEditingEntryIdx].content = content;
  } else {
    cur.entries.push({ name: name, role: role, enabled: true, content: content });
  }
  saveStPresetsToStorage();
  renderStEntryList();
  stEntryDetailView.classList.remove('open');
});

stEntryDetailDelete.addEventListener('click', function() {
  var cur = stPresets[stActivePresetIdx];
  if (!cur || stEditingEntryIdx < 0 || !cur.entries[stEditingEntryIdx]) {
    stEntryDetailView.classList.remove('open');
    return;
  }
  openConfirm('删除此提示词条目？', function() {
    cur.entries.splice(stEditingEntryIdx, 1);
    saveStPresetsToStorage();
    renderStEntryList();
    stEntryDetailView.classList.remove('open');
  });
});

loadStPresetsFromStorage();
renderStPresetSelector();
renderStEntryList();

// =============================================
// 预设导入：酒馆（SillyTavern）对话补全预设 JSON，或本应用自己的 { name, entries }
// 按 prompt_order 的顺序和开关导入；占位条目（聊天记录、角色描述、世界书等 marker）由应用自己处理，跳过
// =============================================
function stPresetFromJson(json, fallbackName) {
  var toRole = function(r) { return (r === 'user' || r === 'assistant') ? r : 'system'; };
  if (!Array.isArray(json.prompts)) {
    if (Array.isArray(json.entries)) {
      return { name: json.name || fallbackName, entries: json.entries.map(function(e) {
        return { name: e.name || '未命名条目', role: toRole(e.role), enabled: e.enabled !== false, content: String(e.content || '') };
      }) };
    }
    throw new Error('不是酒馆的对话补全预设（找不到 prompts）');
  }
  var byId = {};
  json.prompts.forEach(function(p) { if (p && p.identifier) byId[p.identifier] = p; });
  var orders = Array.isArray(json.prompt_order) ? json.prompt_order : [];
  // 优先用全局顺序（character_id 100001），否则用条目最多的那份
  var order = orders.filter(function(o) { return o && o.character_id === 100001; })[0] ||
    orders.slice().sort(function(a, b) { return ((b && b.order) || []).length - ((a && a.order) || []).length; })[0];
  var list = (order && Array.isArray(order.order))
    ? order.order.map(function(o) { return { p: byId[o.identifier], enabled: o.enabled !== false }; })
    : json.prompts.map(function(p) { return { p: p, enabled: p.enabled !== false }; });
  var entries = list.filter(function(x) { return x.p && !x.p.marker && String(x.p.content || '').trim(); })
    .map(function(x) {
      return { name: x.p.name || x.p.identifier || '未命名条目', role: toRole(x.p.role), enabled: x.enabled, content: String(x.p.content) };
    });
  if (!entries.length) throw new Error('预设里没有可用的提示词条目');
  return { name: fallbackName, entries: entries };
}
var stPresetImportInput = document.getElementById('stPresetImportInput');
document.getElementById('stPresetImportBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  stPresetImportInput.value = '';
  stPresetImportInput.click();
});
stPresetImportInput.addEventListener('change', function() {
  var file = this.files && this.files[0];
  if (!file) return;
  file.text().then(function(text) {
    var preset = stPresetFromJson(JSON.parse(text), file.name.replace(/\.json$/i, '').slice(0, 24) || '导入的预设');
    stPresets.push(preset);
    stActivePresetIdx = stPresets.length - 1;
    saveStPresetsToStorage();
    renderStPresetSelector();
    renderStEntryList();
    var on = preset.entries.filter(function(e) { return e.enabled; }).length;
    showToast('✓ 已导入「' + preset.name + '」：' + preset.entries.length + ' 条，开启 ' + on + ' 条', 'success');
  }).catch(function(err) {
    showToast('✗ 导入失败：' + (err instanceof SyntaxError ? '文件不是有效的 JSON' : err.message), 'error');
  });
});
