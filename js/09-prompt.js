// 眠花糖机 — Prompt — 文件夹标签切换

// =============================================
// Prompt — 文件夹标签切换
// =============================================
var promptTabRow    = document.getElementById('promptTabRow');
var promptFolderBody= document.getElementById('promptFolderBody');
// 更新 folder body 左上角 border-radius（让其与激活标签对齐）
function updateFolderBodyRadius() {
  var tabs   = Array.from(promptTabRow.querySelectorAll('.prompt-tab:not(.prompt-tab-plus)'));
  var active = promptTabRow.querySelector('.prompt-tab.active');
  if (!active) return;
  var idx = tabs.indexOf(active);
  // 第 0 个标签激活：左上角贴边（0），其余圆角
  // 非第 0 个：左上角也圆（14px），因为标签不在最左
  promptFolderBody.style.borderRadius = (idx === 0)
    ? '0 14px 14px 14px'
    : '14px 14px 14px 14px';
}

// 切换到指定面板
function switchPromptTab(tabEl) {
  var ptab = tabEl.dataset.ptab;
  if (!ptab) return;

  // 高亮标签
  promptTabRow.querySelectorAll('.prompt-tab').forEach(function(t) {
    t.classList.remove('active');
  });
  tabEl.classList.add('active');

  // 切换面板
  promptFolderBody.querySelectorAll('.prompt-panel').forEach(function(p) {
    p.classList.remove('active');
  });
  var target = promptFolderBody.querySelector('.prompt-panel[data-ppanel="' + ptab + '"]');
  if (target) target.classList.add('active');

  updateFolderBodyRadius();
}

// 绑定已有标签
promptTabRow.querySelectorAll('.prompt-tab').forEach(function(tab) {
  tab.addEventListener('click', function() { switchPromptTab(this); });
});

// 初始化 radius
updateFolderBodyRadius();

// =============================================
// Prompt — 世界书详情视图
// =============================================
var wbDetailView = document.getElementById('wbDetailView');
var wbDetailBack = document.getElementById('wbDetailBack');
var wbDetailTitle= document.getElementById('wbDetailTitle');
var wbEntryName  = document.getElementById('wbEntryName');
var wbEntryKeywords = document.getElementById('wbEntryKeywords');
var wbEntryContent  = document.getElementById('wbEntryContent');
var wbInjectPos  = document.getElementById('wbInjectPos');
var wbDetailSave = document.getElementById('wbDetailSave');
var wbAddEntryBtn= document.getElementById('wbAddEntryBtn');
var wbPanelList  = document.getElementById('wbPanelList');
var wbDetailDelete = document.getElementById('wbDetailDelete');

// 世界书条目：{ id, name, keywords, content, pos: 'before' | 'middle' | 'after', folderId: '' = 未分类 }
// 文件夹：{ id, name }
var wbEntries = mphoneStore.load('mphone_worldbook', []);
var wbFolders = mphoneStore.load('mphone_wb_folders', []);
var wbEditingId = null;   // null = 新建
var wbOpenFolders = {};   // 列表里展开的文件夹（默认全部收起）
var WB_POS_LABEL = { before: '前', middle: '中', after: '后' };
var WB_NONE = '';         // 未分类

function saveWbEntries() {
  mphoneStore.save('mphone_worldbook', wbEntries);
  mphoneStore.save('mphone_wb_folders', wbFolders);
}
function genWbId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// 按文件夹分组：先各文件夹（含空的），最后是有条目的「未分类」
function wbGroups() {
  var groups = wbFolders.map(function(f) {
    return { id: f.id, name: f.name, entries: wbEntries.filter(function(e) { return e.folderId === f.id; }) };
  });
  var known = {};
  wbFolders.forEach(function(f) { known[f.id] = true; });
  var loose = wbEntries.filter(function(e) { return !e.folderId || !known[e.folderId]; });
  if (loose.length) groups.push({ id: WB_NONE, name: '未分类', entries: loose });
  return groups;
}

var FOLDER_ARROW = '<svg class="wb-folder-arrow" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>';

function renderWbList() {
  var wrap = document.getElementById('wbFolderList');
  wrap.innerHTML = '';
  wbGroups().forEach(function(g) {
    var folder = document.createElement('div');
    folder.className = 'wb-folder' + (wbOpenFolders[g.id] ? ' open' : '');
    var head = document.createElement('div');
    head.className = 'wb-folder-head';
    head.innerHTML = FOLDER_ARROW;
    var name = document.createElement('span');
    name.className = 'wb-folder-name';
    name.textContent = g.name;
    var count = document.createElement('span');
    count.className = 'wb-folder-count';
    count.textContent = g.entries.length + ' 条';
    head.appendChild(name);
    head.appendChild(count);
    head.addEventListener('click', function() {
      wbOpenFolders[g.id] = !wbOpenFolders[g.id];
      folder.classList.toggle('open', wbOpenFolders[g.id]);
    });
    // 文件夹操作：在此新建 / 重命名 / 删除（未分类没有重命名和删除）
    var addBtn = document.createElement('button');
    addBtn.className = 'wb-folder-act';
    addBtn.textContent = '+ 条目';
    addBtn.addEventListener('click', function(e) { e.stopPropagation(); openWbDetail(null, g.id); });
    head.appendChild(addBtn);
    if (g.id !== WB_NONE) {
      var renBtn = document.createElement('button');
      renBtn.className = 'wb-folder-act';
      renBtn.textContent = '重命名';
      renBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        askWbFolderName('重命名文件夹', g.name, function(n) {
          wbFolders.forEach(function(f) { if (f.id === g.id) f.name = n; });
          saveWbEntries();
          renderWbList();
        });
      });
      var delBtn = document.createElement('button');
      delBtn.className = 'wb-folder-act';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openPfEntryDel('删除文件夹「' + g.name + '」？里面的条目会移到未分类', function() {
          wbFolders = wbFolders.filter(function(f) { return f.id !== g.id; });
          wbEntries.forEach(function(en) { if (en.folderId === g.id) en.folderId = WB_NONE; });
          saveWbEntries();
          renderWbList();
        });
      });
      head.appendChild(renBtn);
      head.appendChild(delBtn);
    }
    folder.appendChild(head);

    var body = document.createElement('div');
    body.className = 'wb-folder-body';
    g.entries.forEach(function(entry) {
      var card = document.createElement('div');
      card.className = 'pf-entry-card';
      var cb = document.createElement('div');
      cb.className = 'pf-entry-card-body';
      var nameEl = document.createElement('div');
      nameEl.className = 'pf-entry-card-name';
      nameEl.textContent = entry.name || '未命名';
      var subEl = document.createElement('div');
      subEl.className = 'pf-entry-card-sub';
      subEl.textContent = (WB_POS_LABEL[entry.pos] || '前') + (entry.keywords ? ' · 关键词：' + entry.keywords : ' · 常驻');
      cb.appendChild(nameEl);
      cb.appendChild(subEl);
      card.appendChild(cb);
      card.insertAdjacentHTML('beforeend', '<svg class="pf-entry-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>');
      card.addEventListener('click', function() { openWbDetail(entry.id); });
      body.appendChild(card);
    });
    if (!g.entries.length) body.innerHTML = '<div class="auto-hint" style="margin:0 0 6px;">空文件夹</div>';
    folder.appendChild(body);
    wrap.appendChild(folder);
  });
}

// 文件夹命名：复用「备注名称」弹窗
var _wbFolderNameCb = null;
function askWbFolderName(title, value, cb) {
  presetModalMode = 'wbFolder';
  _wbFolderNameCb = cb;
  document.querySelector('#presetModal .modal-title').textContent = title;
  presetNameInput.value = value || '';
  presetModal.classList.add('open');
  presetNameInput.focus();
}

document.getElementById('wbAddFolderBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  askWbFolderName('新建文件夹', '', function(n) {
    var f = { id: genWbId('wf'), name: n };
    wbFolders.push(f);
    wbOpenFolders[f.id] = true;
    saveWbEntries();
    renderWbList();
  });
});

// 注入位置单选
wbInjectPos.querySelectorAll('.pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    wbInjectPos.querySelectorAll('.pf-radio-btn').forEach(function(b) { b.classList.remove('selected'); });
    this.classList.add('selected');
  });
});

// folderId：新建时预选的文件夹
function openWbDetail(id, folderId) {
  var entry = null;
  wbEntries.forEach(function(e) { if (e.id === id) entry = e; });
  wbEditingId = entry ? entry.id : null;
  wbDetailTitle.textContent = entry ? (entry.name || '世界书条目') : '新建条目';
  wbEntryName.value     = entry ? entry.name : '';
  wbEntryKeywords.value = entry ? entry.keywords : '';
  wbEntryContent.value  = entry ? entry.content : '';
  var sel = document.getElementById('wbEntryFolder');
  sel.innerHTML = '';
  [{ id: WB_NONE, name: '未分类' }].concat(wbFolders).forEach(function(f) {
    var o = document.createElement('option');
    o.value = f.id;
    o.textContent = f.name;
    sel.appendChild(o);
  });
  sel.value = entry ? (entry.folderId || WB_NONE) : (folderId || WB_NONE);
  if (sel.selectedIndex < 0) sel.value = WB_NONE;
  var pos = entry ? entry.pos : 'before';
  wbInjectPos.querySelectorAll('.pf-radio-btn').forEach(function(b) {
    b.classList.toggle('selected', b.dataset.val === pos);
  });
  wbDetailDelete.classList.toggle('hidden', !entry);
  wbDetailView.classList.add('open');
}

wbDetailBack.addEventListener('click', function() { wbDetailView.classList.remove('open'); });

wbAddEntryBtn.addEventListener('click', function(e) { e.stopPropagation(); openWbDetail(null); });

wbDetailSave.addEventListener('click', function() {
  var posBtn = wbInjectPos.querySelector('.pf-radio-btn.selected');
  var data = {
    name:     wbEntryName.value.trim() || '未命名',
    keywords: wbEntryKeywords.value.trim(),
    content:  wbEntryContent.value.trim(),
    pos:      posBtn ? posBtn.dataset.val : 'before',
    folderId: document.getElementById('wbEntryFolder').value
  };
  var entry = null;
  wbEntries.forEach(function(e) { if (e.id === wbEditingId) entry = e; });
  if (entry) {
    Object.assign(entry, data);
  } else {
    data.id = genWbId('wb');
    wbEntries.push(data);
  }
  wbOpenFolders[data.folderId] = true;
  saveWbEntries();
  renderWbList();
  wbDetailView.classList.remove('open');
});

// =============================================
// Prompt — 世界书 条目删除弹窗
// =============================================
var pfEntryDelOverlay = document.getElementById('pfEntryDelOverlay');
var pfEntryDelTitle   = document.getElementById('pfEntryDelTitle');
var pfEntryDelOk      = document.getElementById('pfEntryDelOk');
var pfEntryDelCancel  = document.getElementById('pfEntryDelCancel');
var _pfDelCallback    = null;   // 确认后执行的删除回调

function openPfEntryDel(title, onConfirm) {
  pfEntryDelTitle.textContent = title || '删除此条目？';
  _pfDelCallback = onConfirm;
  pfEntryDelOverlay.classList.add('open');
}

pfEntryDelCancel.addEventListener('click', function() {
  pfEntryDelOverlay.classList.remove('open');
  _pfDelCallback = null;
});

pfEntryDelOk.addEventListener('click', function() {
  pfEntryDelOverlay.classList.remove('open');
  if (_pfDelCallback) { _pfDelCallback(); _pfDelCallback = null; }
});

pfEntryDelOverlay.addEventListener('click', function(e) {
  if (e.target === pfEntryDelOverlay) {
    pfEntryDelOverlay.classList.remove('open');
    _pfDelCallback = null;
  }
});

// 世界书 — 删除按钮
wbDetailDelete.addEventListener('click', function() {
  if (!wbEditingId) {
    wbDetailView.classList.remove('open');
    return;
  }
  var delId = wbEditingId;
  openPfEntryDel('删除此世界书条目？', function() {
    wbEntries = wbEntries.filter(function(e) { return e.id !== delId; });
    saveWbEntries();
    renderWbList();
    wbDetailView.classList.remove('open');
  });
});

wbDetailDelete.classList.add('hidden');
renderWbList();

// 取出某角色当前应注入的世界书条目：已关联（整个文件夹或单个条目）且（无关键词 或 最近 6 条消息里出现任一关键词）
function getActiveWbEntries(char, hist) {
  var ids = (char && char.worldbookIds) || [];
  var folders = (char && char.worldbookFolders) || [];
  if (!ids.length && !folders.length) return [];
  var known = {};
  wbFolders.forEach(function(f) { known[f.id] = true; });
  var recent = hist.slice(-6).map(function(m) { return m.content || ''; }).join('\n').toLowerCase();
  return wbEntries.filter(function(e) {
    var fid = (e.folderId && known[e.folderId]) ? e.folderId : WB_NONE;
    var linked = ids.indexOf(e.id) >= 0 || folders.indexOf(fid) >= 0;
    if (!linked || !e.content) return false;
    if (!e.keywords) return true;
    return e.keywords.split(/[,，]/).some(function(k) {
      k = k.trim().toLowerCase();
      return k && recent.indexOf(k) >= 0;
    });
  });
}

// =============================================
// Prompt — 思维链 (CoT) 面板
// =============================================
var cotEnableToggle = document.getElementById('cotEnableToggle');
var cotPromptTA     = document.getElementById('cotPromptTA');

(function initCotState() {
  var savedCotEnabled = mphoneStore.load('mphone_cot_enabled', null);
  var savedCotPrompt  = mphoneStore.load('mphone_cot_prompt', null);
  if (savedCotEnabled !== null) {
    cotEnableToggle.checked = (String(savedCotEnabled) === 'true');
  }
  if (savedCotPrompt !== null) {
    cotPromptTA.value = savedCotPrompt;
  } else {
    cotPromptTA.value = '在正式回复前，请先在内心梳理当前场景、角色情绪变化与潜台词，确保言行符合人设逻辑，然后再输出正式的角色回复。';
  }
})();

cotEnableToggle.addEventListener('change', function() {
  mphoneStore.save('mphone_cot_enabled', this.checked ? 'true' : 'false');
});

cotPromptTA.addEventListener('input', function() {
  mphoneStore.save('mphone_cot_prompt', this.value);
});

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
  openPfEntryDel('删除预设「' + (cur ? cur.name : '') + '」？', function() {
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
  openPfEntryDel('删除此提示词条目？', function() {
    cur.entries.splice(stEditingEntryIdx, 1);
    saveStPresetsToStorage();
    renderStEntryList();
    stEntryDetailView.classList.remove('open');
  });
});

loadStPresetsFromStorage();
renderStPresetSelector();
renderStEntryList();
