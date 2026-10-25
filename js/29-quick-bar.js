// 眠花糖机 — 聊天窗口便捷拓展栏

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
  val('preset', pre ? pre.name : '跟随全局');
  val('wb', nWb ? nWb + ' 本' : '未选');
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
