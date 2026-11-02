// 眠花糖机 — 聊天窗口便捷拓展栏：本窗口用的模型预设 / 预设 / 世界书

// =============================================
// 便捷拓展栏：顶栏下方一排小标签，给当前窗口选已保存的模型预设（API 预设）、预设、世界书
// 角色上记 apiPresetName / promptPresetName（按名字找，留空或找不到 = 跟随全局）；世界书就是角色设置里关联的文件夹
// =============================================
var crQuickBar = document.getElementById('crQuickBar');
var crQuickPop = document.getElementById('crQuickPop');
var crQuickOpen = '';   // 当前展开的标签：'api' | 'preset' | 'wb' | ''

function charApiPreset(char) {
  var n = char && char.apiPresetName;
  if (!n) return null;
  for (var i = 0; i < apiPresets.length; i++) if (apiPresets[i].name === n) return apiPresets[i];
  return null;
}
// 角色选的预设；没选或已删除时返回 null
function charOwnPromptPreset(char) {
  var n = char && char.promptPresetName;
  if (n) for (var i = 0; i < stPresets.length; i++) if (stPresets[i].name === n) return stPresets[i];
  return null;
}
function charPromptPreset(char) {
  return charOwnPromptPreset(char) || stPresets[stActivePresetIdx];
}

function crQuickChar() { return charList[openingChatCharIdx]; }

// ---------- 状态栏预设：在角色设置「美化 → 状态栏」里存，在聊天窗口的便捷拓展栏里一点就换 ----------
// mphone_status_presets = [{ id, name, fields, tpl, css }]；「默认」是自带的，不存
var statusPresets = mphoneStore.load('mphone_status_presets', []);
function saveStatusPresets() { mphoneStore.save('mphone_status_presets', statusPresets); }
function statusBuiltin() { return { id: '', name: '默认', fields: DEFAULT_LOOK.statusFields, tpl: DEFAULT_STATUS_TPL, css: '' }; }
// 角色现在用的是哪个：关了 → null；和某个预设一样 → 那个；都不一样 → 'custom'
function charStatusPreset(char) {
  var l = Object.assign({}, DEFAULT_LOOK, (char && char.look) || {});
  if (!l.statusOn) return null;
  var tpl = statusTplOf(l);
  var all = [statusBuiltin()].concat(statusPresets);
  for (var i = 0; i < all.length; i++) {
    if ((all[i].tpl || '') === (tpl || '') && (all[i].tpl || all[i].fields === l.statusFields) && (all[i].css || '') === (l.statusCss || '')) return all[i];
  }
  return 'custom';
}
function applyStatusPreset(char, p) {
  var l = Object.assign({}, DEFAULT_LOOK, char.look || {});
  char.look = p ? Object.assign(l, { statusOn: true, statusFields: p.fields || DEFAULT_LOOK.statusFields, statusTpl: p.tpl || '', statusCss: p.css || '' })
                : Object.assign(l, { statusOn: false });
  saveCharList();
  if (typeof applyChatRoomStyle === 'function' && charList[openingChatCharIdx] === char) applyChatRoomStyle(char);
  if (typeof refreshStatusPanel === 'function') refreshStatusPanel();
}

function renderQuickBar() {
  var char = crQuickChar();
  var on = !!(char && char.chatCfg && char.chatCfg.quickBar);
  appChatRoom.classList.toggle('cr-qb-on', on);
  if (!on) { closeQuickPop(); return; }
  var api = charApiPreset(char);
  var pre = charOwnPromptPreset(char);
  var nWb = (char.worldbookFolders || []).length;
  var val = function(k, t) { crQuickBar.querySelector('[data-qb="' + k + '"] .cr-qb-val').textContent = t; };
  val('api', api ? api.name : '跟随全局');
  var drama = typeof currentCrSubView !== 'undefined' && currentCrSubView === 'contacts';
  crQuickBar.querySelector('[data-qb="preset"]').style.display = drama ? '' : 'none';
  crQuickBar.querySelector('[data-qb="status"]').style.display = drama ? 'none' : '';
  val('preset', pre ? pre.name : '跟随全局');
  val('wb', nWb ? nWb + ' 本' : '未选');
  var sp = charStatusPreset(char);
  val('status', !sp ? '关' : sp === 'custom' ? '自定义' : sp.name);
  if (crQuickOpen) renderQuickPop();
}

function closeQuickPop() {
  crQuickOpen = '';
  crQuickPop.classList.remove('open');
  crQuickBar.querySelectorAll('.cr-qb-chip').forEach(function(c) { c.classList.remove('open'); });
}

function quickItem(name, sub, selected, onClick) {
  var it = document.createElement('div');
  it.className = 'cr-qb-item' + (selected ? ' selected' : '');
  var n = document.createElement('span');
  n.className = 'cr-qb-item-name';
  n.textContent = name;
  var s = document.createElement('span');
  s.className = 'cr-qb-item-sub';
  s.textContent = sub || '';
  it.appendChild(n);
  it.appendChild(s);
  it.addEventListener('click', function(e) { e.stopPropagation(); onClick(); });
  crQuickPop.appendChild(it);
}

function setQuickField(key, value) {
  var char = crQuickChar();
  if (!char) return;
  char[key] = value;
  saveCharList();
  closeQuickPop();
  renderQuickBar();
}

// 角色设置「美化 → 状态栏」里的预设小标签：点一下套用到表单，长按删除
function renderStatusPresetChips() {
  var box = document.getElementById('statusPresetChips');
  if (!box) return;
  box.innerHTML = '';
  [statusBuiltin()].concat(statusPresets).forEach(function(p) {
    var chip = document.createElement('span');
    chip.className = 'feed-visible-chip';
    chip.textContent = p.name;
    bindPress(chip, function() {
      document.getElementById('statusOn').checked = true;
      document.getElementById('statusSub').classList.add('open');
      document.getElementById('statusFields').value = p.fields || DEFAULT_LOOK.statusFields;
      document.getElementById('statusTpl').value = p.tpl || '';
      document.getElementById('statusCss').value = p.css || '';
      showToast('已套用「' + p.name + '」，点保存生效', 'plain');
    }, p.id ? function() {
      openConfirm('删除状态栏预设「' + p.name + '」？', function() {
        statusPresets = statusPresets.filter(function(x) { return x !== p; });
        saveStatusPresets();
        renderStatusPresetChips();
      });
    } : function() {});
    box.appendChild(chip);
  });
}
document.getElementById('statusPresetSave').addEventListener('click', function() {
  var name = document.getElementById('statusPresetName').value.trim();
  if (!name) { shakeEl(document.getElementById('statusPresetName')); return; }
  var p = { id: 'sp' + Date.now().toString(36), name: name, fields: document.getElementById('statusFields').value.trim() || DEFAULT_LOOK.statusFields,
    tpl: document.getElementById('statusTpl').value.trim(), css: document.getElementById('statusCss').value };
  statusPresets = statusPresets.filter(function(x) { return x.name !== name; }).concat([p]);
  saveStatusPresets();
  document.getElementById('statusPresetName').value = '';
  renderStatusPresetChips();
  showToast('✓ 已存为「' + name + '」', 'success');
});
renderStatusPresetChips();

function renderQuickPop() {
  var char = crQuickChar();
  crQuickPop.innerHTML = '';
  if (crQuickOpen === 'api') {
    var api = charApiPreset(char);
    quickItem('跟随全局', getApiCfg().model || '未选择模型', !api, function() { setQuickField('apiPresetName', ''); });
    apiPresets.forEach(function(p) {
      quickItem(p.name, p.model || '未选择模型', api === p, function() { setQuickField('apiPresetName', p.name); });
    });
    if (!apiPresets.length) crQuickPop.insertAdjacentHTML('beforeend', '<div class="cr-qb-empty">还没有保存的模型预设，可以在 API 设置里「存为预设」</div>');
  } else if (crQuickOpen === 'preset') {
    var cur = stPresets[stActivePresetIdx];
    var mine = charOwnPromptPreset(char);
    quickItem('跟随全局', cur ? cur.name : '', !mine, function() { setQuickField('promptPresetName', ''); });
    stPresets.forEach(function(p) {
      quickItem(p.name, (p.entries || []).length + ' 条', mine === p, function() { setQuickField('promptPresetName', p.name); });
    });
  } else if (crQuickOpen === 'wb') {
    // 世界书可多选：点一下关联 / 取消，弹层不收起
    var groups = wbGroups();
    groups.forEach(function(g) {
      var linked = (char.worldbookFolders || []).indexOf(g.id) >= 0;
      quickItem(g.name, g.entries.length + ' 条', linked, function() {
        var list = (char.worldbookFolders || []).filter(function(id) { return id !== g.id; });
        if (!linked) list.push(g.id);
        char.worldbookFolders = list;
        saveCharList();
        renderQuickBar();
      });
    });
    if (!groups.length) crQuickPop.insertAdjacentHTML('beforeend', '<div class="cr-qb-empty">还没有世界书</div>');
  } else if (crQuickOpen === 'status') {
    var now = charStatusPreset(char);
    var pick = function(p) { applyStatusPreset(char, p); closeQuickPop(); renderQuickBar(); };
    quickItem('关闭', '这个角色不带状态栏', !now, function() { pick(null); });
    if (now === 'custom') quickItem('自定义', '角色设置里改过的', true, function() { closeQuickPop(); });
    [statusBuiltin()].concat(statusPresets).forEach(function(p) {
      quickItem(p.name, p.tpl ? 'HTML 模板' : '字段：' + p.fields, now === p || (now && now !== 'custom' && now.id === p.id && now.name === p.name), function() { pick(p); });
    });
    if (!statusPresets.length) crQuickPop.insertAdjacentHTML('beforeend', '<div class="cr-qb-empty">可以在角色设置「美化 → 状态栏」里把现在的样子「存为预设」</div>');
  }
}

crQuickBar.querySelectorAll('.cr-qb-chip').forEach(function(chip) {
  chip.addEventListener('click', function(e) {
    e.stopPropagation();
    var k = chip.dataset.qb;
    if (crQuickOpen === k) { closeQuickPop(); return; }
    closeQuickPop();
    crQuickOpen = k;
    chip.classList.add('open');
    renderQuickPop();
    crQuickPop.classList.add('open');
  });
});
crQuickPop.addEventListener('click', function(e) { e.stopPropagation(); });
document.addEventListener('click', function() { if (crQuickOpen) closeQuickPop(); });
