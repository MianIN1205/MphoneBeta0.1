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
// mphone_status_presets = [{ id, name, fields, tpl, css, find, rules }]；「默认」是自带的，不存。find / rules：导入的酒馆正则和生成规则
var statusPresets = mphoneStore.load('mphone_status_presets', []);
function saveStatusPresets() { mphoneStore.save('mphone_status_presets', statusPresets); }
function statusBuiltin() {
  var c = statusConvertTpl(DEFAULT_STATUS_TPL);
  return { id: '', name: '默认', fields: DEFAULT_LOOK.statusFields, tpl: c.tpl, css: '', find: c.find, rules: c.rules };
}
function statusPresetSpec(p) { return statusSpec({ statusTpl: p.tpl || '', statusFields: p.fields, statusFind: p.find || '', statusRules: p.rules || '' }); }
// 角色现在用的是哪个：关了 → null；和某个预设一样 → 那个；都不一样 → 'custom'
function charStatusPreset(char) {
  var l = Object.assign({}, DEFAULT_LOOK, (char && char.look) || {});
  if (!l.statusOn) return null;
  var mine = JSON.stringify(statusSpec(l));
  var all = [statusBuiltin()].concat(statusPresets);
  for (var i = 0; i < all.length; i++) {
    if (JSON.stringify(statusPresetSpec(all[i])) === mine && (all[i].css || '') === (l.statusCss || '')) return all[i];
  }
  return 'custom';
}
function applyStatusPreset(char, p) {
  var l = Object.assign({}, DEFAULT_LOOK, char.look || {});
  char.look = p ? Object.assign(l, { statusOn: true, statusFields: p.fields || DEFAULT_LOOK.statusFields, statusTpl: p.tpl || '', statusCss: p.css || '', statusFind: p.find || '', statusRules: p.rules || '' })
                : Object.assign(l, { statusOn: false });
  saveCharList();
  if (typeof applyChatRoomStyle === 'function' && charList[openingChatCharIdx] === char) applyChatRoomStyle(char);
  if (typeof refreshStatusPanel === 'function') refreshStatusPanel();
}

function renderQuickBar() {
  var char = crQuickChar();
  var on = !!(char && Object.assign({}, DEFAULT_CHAT_CFG, char.chatCfg || {}).quickBar);   // 默认开（用户要的：第一次用就看得到）
  appChatRoom.classList.toggle('cr-qb-on', on);
  if (!on) { closeQuickPop(); return; }
  var api = charApiPreset(char);
  var pre = charOwnPromptPreset(char);
  var qbDrama = typeof currentCrSubView !== 'undefined' && currentCrSubView === 'contacts';
  var nWb = charWbOf(char, qbDrama).folders.length;
  var val = function(k, t) { crQuickBar.querySelector('[data-qb="' + k + '"] .cr-qb-val').textContent = t; };
  // 显示现在实际用的名字（用户要的）：跟着全局时写全局正在用的模型 / 预设，不写「跟随全局」
  val('api', api ? api.name : (getApiCfg().model || '未选模型'));
  var drama = typeof currentCrSubView !== 'undefined' && currentCrSubView === 'contacts';
  crQuickBar.querySelector('[data-qb="preset"]').style.display = drama ? '' : 'none';
  crQuickBar.querySelector('[data-qb="cot"]').style.display = drama ? 'none' : '';
  var gPre = typeof stPresets !== 'undefined' && (stPresets[stActivePresetIdx] || stPresets[0]);
  val('preset', pre ? pre.name : (gPre ? gPre.name : '无'));
  var wbNames = charWbOf(char, qbDrama).folders.map(function(id) { var f = (typeof wbFolders !== 'undefined' ? wbFolders : []).filter(function(x) { return x.id === id; })[0]; return f ? f.name : ''; }).filter(Boolean);
  val('wb', !nWb ? '未选' : wbNames.length ? wbNames[0] + (nWb > 1 ? ' 等 ' + nWb + ' 本' : '') : nWb + ' 本');
  val('cot', typeof cotModeFor === 'function' ? cotName(cotModeFor(char, false)) : '');
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
      document.getElementById('statusFind').value = p.find || '';
      document.getElementById('statusRules').value = p.rules || '';
      syncStatusRegexForm(true);
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
    tpl: document.getElementById('statusTpl').value.trim(), css: document.getElementById('statusCss').value,
    find: document.getElementById('statusFind').value.trim(), rules: document.getElementById('statusRules').value.trim() };
  statusPresets = statusPresets.filter(function(x) { return x.name !== name; }).concat([p]);
  saveStatusPresets();
  document.getElementById('statusPresetName').value = '';
  renderStatusPresetChips();
  showToast('✓ 已存为「' + name + '」', 'success');
});
renderStatusPresetChips();

// 导入酒馆正则状态栏（regex JSON，单个、数组、或者藏在预设 / 角色卡里的都认）：正则 + 美化 HTML 原样放进来，规则让用户自己贴
// 状态栏只有一种写法：生成规则 + 匹配正则 + 美化 HTML。fold = true：刚填好表单（打开设置、套用预设、导入）时，
// 旧的 {{}} 模板 / 只填字段的写法换算成新写法填进来（statusConvertTpl），短的框展开、长的代码框收起来
function syncStatusRegexForm(fold) {
  var $ = function(id) { return document.getElementById(id); };
  if (fold && !$('statusFind').value.trim()) {
    var tpl = $('statusTpl').value.trim();
    if (!tpl || statusTplFields(tpl).length) {
      var c = statusConvertTpl(tpl, $('statusFields').value), extra = $('statusRules').value.trim();
      $('statusFind').value = c.find;
      $('statusTpl').value = c.tpl;
      $('statusRules').value = c.rules + (extra ? '\n每一项的要求：\n' + extra : '');
    }
  }
  [['statusTpl', 'statusTplMeta'], ['statusFind', 'statusFindMeta'], ['statusRules', 'statusRulesMeta'], ['statusCss', 'statusCssMeta']].forEach(function(p) {
    var v = $(p[0]).value.trim();
    $(p[1]).textContent = v ? v.length + ' 字' : '空着';
  });
  if (fold) {
    $('statusRulesFold').open = $('statusRules').value.trim().length < 400;
    $('statusFindFold').open = false;
    $('statusTplFold').open = false;
    $('statusCssFold').open = false;
  }
}
['statusTpl', 'statusFind', 'statusRules', 'statusCss'].forEach(function(id) {
  document.getElementById(id).addEventListener('input', function() { syncStatusRegexForm(); });
});
function statusRegexScripts(obj, out) {
  out = out || [];
  if (Array.isArray(obj)) obj.forEach(function(x) { statusRegexScripts(x, out); });
  else if (obj && typeof obj === 'object') {
    if (typeof obj.findRegex === 'string' && typeof obj.replaceString === 'string') out.push(obj);
    else Object.keys(obj).forEach(function(k) { statusRegexScripts(obj[k], out); });
  }
  return out;
}
document.getElementById('statusImportBtn').addEventListener('click', function() {
  var f = document.getElementById('statusImportFile');
  f.value = '';
  f.click();
});
document.getElementById('statusImportFile').addEventListener('change', function() {
  var file = this.files && this.files[0];
  if (!file) return;
  file.text().then(function(text) {
    var list = statusRegexScripts(JSON.parse(text.replace(/^\uFEFF/, '')));
    // 有好几条时，挑替换成 HTML 的、最长的那条（一般就是状态栏本体）
    var pick = list.filter(function(r) { return /<[a-z]/i.test(r.replaceString); }).sort(function(a, b) { return b.replaceString.length - a.replaceString.length; })[0] || list[0];
    if (!pick) { showToast('✗ 这个文件里没找到酒馆正则', 'error'); return; }
    if (!statusRegexOf(pick.findRegex)) { showToast('✗ 正则写法认不出来', 'error'); return; }
    document.getElementById('statusOn').checked = true;
    document.getElementById('statusSub').classList.add('open');
    document.getElementById('statusTpl').value = pick.replaceString.trim();
    document.getElementById('statusFind').value = pick.findRegex;
    if (pick.scriptName) document.getElementById('statusPresetName').value = String(pick.scriptName).slice(0, 16);
    // 之前贴的规则留着（重新导入改好的正则时不用再贴）；小手机自己换算出来的那种清掉，换成酒馆的要贴的
    if (/^每次回复的最后另起一行，按下面的格式写你此刻的状态/.test(document.getElementById('statusRules').value)) document.getElementById('statusRules').value = '';
    syncStatusRegexForm(true);
    document.getElementById('statusRulesFold').open = true;
    showToast('✓ 已导入「' + (pick.scriptName || '状态栏') + '」' + (list.length > 1 ? '（文件里有 ' + list.length + ' 条，用了最像状态栏的一条）' : '') + '，把配套的规则贴进「生成规则」，点保存生效', 'success');
  }).catch(function() { showToast('✗ 读不了这个文件，要酒馆导出的正则 JSON', 'error'); });
});

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
    // 只换当前窗口（聊天 / 剧情）那栏的
    var groups = wbGroups(), wbDrama = currentCrSubView === 'contacts';
    if (wbDrama && !char.dramaWb) char.dramaWb = { ids: (char.worldbookIds || []).slice(), folders: (char.worldbookFolders || []).slice() };
    groups.forEach(function(g) {
      var cur = charWbOf(char, wbDrama);
      var linked = cur.folders.indexOf(g.id) >= 0;
      quickItem(g.name, g.entries.length + ' 条', linked, function() {
        var list = cur.folders.filter(function(id) { return id !== g.id; });
        if (!linked) list.push(g.id);
        if (wbDrama) char.dramaWb.folders = list; else char.worldbookFolders = list;
        saveCharList();
        renderQuickBar();
      });
    });
    if (!groups.length) crQuickPop.insertAdjacentHTML('beforeend', '<div class="cr-qb-empty">还没有世界书</div>');
  } else if (crQuickOpen === 'cot') {
    // 思维链：这个角色单独选，或者跟着 Prompt 页的全局设置
    var own = char.cotMode && cotValid(char.cotMode) ? char.cotMode : '';
    quickItem('跟随全局', cotName(cotModeNow()), !own, function() { setQuickField('cotMode', ''); });
    [['off', '模型自带的思考也尽量关掉，回得最快'], ['native', '模型有自己的思考就用，没有就直接回']].concat(cotList().map(function(c) { return [c.id, c.builtin ? c.desc : '自己写的思维链']; })).forEach(function(o) {
      quickItem(cotName(o[0]), o[1], own === o[0], function() { setQuickField('cotMode', o[0]); });
    });
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
