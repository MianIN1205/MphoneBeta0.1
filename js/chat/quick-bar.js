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
  // 用到了几本：整本关联的 + 单独勾了条目的那几本（用户能在拓展栏里一条条勾）
  var wbCur = charWbOf(char, qbDrama), wbUsed = wbCur.folders.slice();
  (typeof wbEntries !== 'undefined' ? wbEntries : []).forEach(function(e) { if (wbCur.ids.indexOf(e.id) >= 0 && wbUsed.indexOf(e.folderId || '') < 0) wbUsed.push(e.folderId || ''); });
  var nWb = wbUsed.length;
  var val = function(k, t) { crQuickBar.querySelector('[data-qb="' + k + '"] .cr-qb-val').textContent = t; };
  // 显示现在实际用的名字（用户要的）：跟着全局时写全局正在用的模型 / 预设，不写「跟随全局」
  val('api', api ? api.name : (getApiCfg().model || '未选模型'));
  var drama = typeof currentCrSubView !== 'undefined' && currentCrSubView === 'contacts';
  crQuickBar.querySelector('[data-qb="preset"]').style.display = drama ? '' : 'none';
  crQuickBar.querySelector('[data-qb="cot"]').style.display = drama ? 'none' : '';
  var gPre = typeof stPresets !== 'undefined' && (stPresets[stActivePresetIdx] || stPresets[0]);
  val('preset', pre ? pre.name : (gPre ? gPre.name : '无'));
  var wbNames = wbUsed.map(function(id) { var f = (typeof wbFolders !== 'undefined' ? wbFolders : []).filter(function(x) { return x.id === id; })[0]; return f ? f.name : id ? '' : '未分类'; }).filter(Boolean);
  val('wb', !nWb ? '未选' : wbNames.length ? wbNames[0] + (nWb > 1 ? ' 等 ' + nWb + ' 本' : '') : nWb + ' 本');
  val('cot', typeof cotModeFor === 'function' ? cotName(cotModeFor(char, false)) : '');
  if (crQuickOpen) renderQuickPop();
}

function closeQuickPop() {
  crQuickOpen = '';
  crQuickPop.classList.remove('open');
  crQuickBar.querySelectorAll('.cr-qb-chip').forEach(function(c) { c.classList.remove('open'); });
}

var crQbPreOpen = {};   // 拓展栏预设里展开看条目的（只在这次打开期间）
var crQbWbOpen = {};   // 拓展栏世界书里展开看条目的那几本（只在这次打开期间）
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
  return it;
}

function setQuickField(key, value) {
  var char = crQuickChar();
  if (!char) return;
  char[key] = value;
  saveCharList();
  closeQuickPop();
  renderQuickBar();
}

// 角色设置「美化 → 状态栏」最上面的预设抽屉（js/core/utils.js 的 mountPresetDrawer）：点开选一个套用到表单，右边保存 / 删除
var statusImportName = '';   // 刚导入的酒馆正则的名字，存预设时默认用它
function statusFormPreset() {
  var v = function(id) { return document.getElementById(id).value; };
  return { fields: v('statusFields').trim() || DEFAULT_LOOK.statusFields, tpl: v('statusTpl').trim(), css: v('statusCss'), find: v('statusFind').trim(), rules: v('statusRules').trim() };
}
var statusPresetBox = mountPresetDrawer(document.querySelector('#statusSub .st-live-label'), {
  list: function() { return [Object.assign(statusBuiltin(), { builtin: true })].concat(statusPresets); },
  apply: function(p) {
    document.getElementById('statusOn').checked = true;
    document.getElementById('statusSub').classList.add('open');
    document.getElementById('statusFields').value = p.fields || DEFAULT_LOOK.statusFields;
    document.getElementById('statusTpl').value = p.tpl || '';
    document.getElementById('statusCss').value = p.css || '';
    document.getElementById('statusFind').value = p.find || '';
    document.getElementById('statusRules').value = p.rules || '';
    syncStatusRegexForm(true);
  },
  save: function(name) {
    statusPresets = statusPresets.filter(function(x) { return x.name !== name; }).concat([Object.assign({ id: 'sp' + Date.now().toString(36), name: name }, statusFormPreset())]);
    saveStatusPresets();
  },
  del: function(p) { statusPresets = statusPresets.filter(function(x) { return x.id !== p.id; }); saveStatusPresets(); },
  match: function() {
    var mine = statusFormPreset(), key = JSON.stringify(statusPresetSpec(mine));
    return this.list().filter(function(p) { return JSON.stringify(statusPresetSpec(p)) === key && (p.css || '') === (mine.css || ''); })[0] || null;
  },
  suggest: function() { return statusImportName; },
  share: { type: 'status-presets', file: '状态栏预设', items: function() { return statusPresets; },
    add: function(list) { var n = 0; list.forEach(function(p) { if (!p || !p.name) return; statusPresets = statusPresets.filter(function(x) { return x.name !== p.name; }).concat([Object.assign({}, p, { id: 'sp' + Date.now().toString(36) + n })]); n++; }); saveStatusPresets(); return n; } }
});

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
  if (fold) $('statusCodeFold').open = false;   // 规则和代码平时收着（用户要的）
  statusLivePaint();
}
// 「现在的样子」：照表单里现在的写法画一张卡片（这个角色有状态栏记录就用最近一条，没有就画个样子）
function statusLivePaint() {
  var box = document.getElementById('statusLive');
  if (!box) return;
  var p = statusFormPreset(), c = typeof editingCharIndex !== 'undefined' && editingCharIndex >= 0 ? charList[editingCharIndex] : null;
  var el = statusCardEl(c, Object.assign({}, DEFAULT_LOOK, { statusOn: true, statusFields: p.fields, statusTpl: p.tpl, statusCss: p.css, statusFind: p.find, statusRules: p.rules }), false);
  box.innerHTML = '';
  if (el) box.appendChild(el); else box.innerHTML = '<div class="auto-hint" style="margin:0;">还画不出来：规则和代码里还没写好</div>';
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
    statusImportName = String(pick.scriptName || '').slice(0, 16);
    // 之前贴的规则留着（重新导入改好的正则时不用再贴）；小手机自己换算出来的那种清掉，换成酒馆的要贴的
    if (/^每次回复的最后另起一行，按下面的格式写你此刻的状态/.test(document.getElementById('statusRules').value)) document.getElementById('statusRules').value = '';
    syncStatusRegexForm(true);
    document.getElementById('statusCodeFold').open = true;
    showToast('✓ 已导入「' + (pick.scriptName || '状态栏') + '」' + (list.length > 1 ? '（文件里有 ' + list.length + ' 条，用了最像状态栏的一条）' : '') + '，把配套的规则贴进「生成规则」，点保存生效', 'success');
  }).catch(function() { showToast('✗ 读不了这个文件，要酒馆导出的正则 JSON', 'error'); });
});

function renderQuickPop() {
  var char = crQuickChar(), keepTop = crQuickPop.scrollTop;   // 点条目重画后停在原处，不跳回顶上
  crQuickPop.innerHTML = '';
  requestAnimationFrame(function() { crQuickPop.scrollTop = keepTop; });
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
    // 每个预设右边「条目」：展开一条条开关（用户要的：选完预设还能改具体开哪些）；改的是这个预设本身，用它的角色都会跟着变
    stPresets.forEach(function(p) {
      var es = p.entries || [], nOn = es.filter(function(e) { return e.enabled; }).length;
      var it = quickItem(p.name, nOn + ' / ' + es.length + ' 条开着', mine === p, function() { setQuickField('promptPresetName', p.name); });
      if (!es.length) return;
      var ex = document.createElement('button');
      ex.className = 'cr-qb-expand';
      ex.textContent = crQbPreOpen[p.name] ? '收起' : '条目';
      ex.addEventListener('click', function(e) { e.stopPropagation(); crQbPreOpen[p.name] = !crQbPreOpen[p.name]; renderQuickPop(); });
      it.appendChild(ex);
      if (!crQbPreOpen[p.name]) return;
      es.forEach(function(en) {
        var sub = quickItem(en.name || '未命名条目', en.pos === 'after' ? '放在后' : '', !!en.enabled, function() {
          en.enabled = !en.enabled;
          saveStPresetsToStorage();
          if (typeof renderStEntryList === 'function') renderStEntryList();   // Prompt 页开着的话跟着变
          renderQuickPop();
        });
        sub.classList.add('cr-qb-sub');
      });
      crQuickPop.insertAdjacentHTML('beforeend', '<div class="cr-qb-empty" style="padding:2px 14px 8px;text-align:left;">改的是「' + escHtmlAsset(p.name) + '」本身，用它的角色都会跟着变</div>');
    });
  } else if (crQuickOpen === 'wb') {
    // 世界书可多选：点一本 = 整本关联 / 取消；点「条目」展开，一条条单独勾（用户要的），弹层不收起
    // 只换当前窗口（聊天 / 剧情）那栏的
    var groups = wbGroups(), wbDrama = currentCrSubView === 'contacts';
    if (wbDrama && !char.dramaWb) char.dramaWb = { ids: (char.worldbookIds || []).slice(), folders: (char.worldbookFolders || []).slice() };
    var setWb = function(folders, ids) {
      if (wbDrama) { char.dramaWb.folders = folders; char.dramaWb.ids = ids; } else { char.worldbookFolders = folders; char.worldbookIds = ids; }
      saveCharList();
      renderQuickBar();
    };
    groups.forEach(function(g) {
      var cur = charWbOf(char, wbDrama), fOn = cur.folders.indexOf(g.id) >= 0;
      var gIds = g.entries.map(function(e) { return e.id; });
      var nOn = fOn ? gIds.length : gIds.filter(function(id) { return cur.ids.indexOf(id) >= 0; }).length;
      var it = quickItem(g.name, fOn ? '整本 · ' + gIds.length + ' 条' : nOn ? '选了 ' + nOn + ' / ' + gIds.length + ' 条' : gIds.length + ' 条', fOn, function() {
        var others = cur.ids.filter(function(id) { return gIds.indexOf(id) < 0; });   // 整本开关时，这本里单独勾的不用再记
        setWb(fOn ? cur.folders.filter(function(id) { return id !== g.id; }) : cur.folders.concat([g.id]), others);
      });
      if (nOn && !fOn) it.classList.add('part');
      if (!gIds.length) return;
      var ex = document.createElement('button');
      ex.className = 'cr-qb-expand';
      ex.textContent = crQbWbOpen[g.id] ? '收起' : '条目';
      ex.addEventListener('click', function(e) { e.stopPropagation(); crQbWbOpen[g.id] = !crQbWbOpen[g.id]; renderQuickPop(); });
      it.appendChild(ex);
      if (!crQbWbOpen[g.id]) return;
      g.entries.forEach(function(en) {
        var on = fOn || cur.ids.indexOf(en.id) >= 0;
        var sub = quickItem(en.name || '未命名', en.enabled === false ? '已关' : en.keywords ? '关键词' : '常驻', on, function() {
          if (fOn) setWb(cur.folders.filter(function(id) { return id !== g.id; }), cur.ids.concat(gIds.filter(function(id) { return id !== en.id; })));   // 从整本变成一条条
          else setWb(cur.folders, on ? cur.ids.filter(function(id) { return id !== en.id; }) : cur.ids.concat([en.id]));
        });
        sub.classList.add('cr-qb-sub');
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
    // 显示 / 隐藏思考（用户要的：在这里就能开关，和 Prompt 页「在聊天里显示思考」是同一个）
    var showT = document.getElementById('cotShowToggle');
    var tg = quickItem('在聊天里显示思考', showT.checked ? '开着' : '关着', showT.checked, function() {
      showT.checked = !showT.checked;
      showT.dispatchEvent(new Event('change'));
      renderQuickPop();
    });
    tg.classList.add('cr-qb-toggle');
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
    crQuickPop.scrollTop = 0;
    // 拓展栏在顶栏里（仿siya）时它很窄：弹层照聊天室的宽度摆，左右各留 12px
    if (appChatRoom.classList.contains('cr-qb-in-nav')) {
      var rr = appChatRoom.getBoundingClientRect(), qr = crQuickBar.getBoundingClientRect();
      crQuickPop.style.left = (rr.left + 12 - qr.left) + 'px'; crQuickPop.style.right = 'auto'; crQuickPop.style.width = (rr.width - 24) + 'px';
    } else { crQuickPop.style.left = ''; crQuickPop.style.right = ''; crQuickPop.style.width = ''; }
    renderQuickPop();
    crQuickPop.classList.add('open');
  });
});
crQuickPop.addEventListener('click', function(e) { e.stopPropagation(); });
document.addEventListener('click', function() { if (crQuickOpen) closeQuickPop(); });
