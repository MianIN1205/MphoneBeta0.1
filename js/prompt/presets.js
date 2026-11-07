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

// 默认剧情预设（这个项目自己写的）：剧情设置里每一类选项对应一条条目，选了哪个就换成哪段话
var PLOT_OPTS = [
  { key: 'len', name: '字数', pos: 'after', choices: [['short', '短'], ['mid', '中'], ['long', '长'], ['custom', '自己填']] },
  { key: 'person', name: '人称', pos: 'after', choices: [['2', '第二人称写你'], ['3', '第三人称']] },
  { key: 'view', name: '视角', pos: 'before', choices: [['char', '跟着 TA'], ['omni', '全知旁观'], ['user', '跟着你']] },
  { key: 'speak', name: '抢话', pos: 'after', choices: [['strict', '绝不替你说话做事'], ['light', '可以补一点小动作']] },
  { key: 'inner', name: 'TA 的内心', pos: 'before', choices: [['more', '多写'], ['some', '适量'], ['none', '不写']] },
  { key: 'style', name: '文风', pos: 'before', choices: [['delicate', '细腻'], ['romance', '细腻言情'], ['zhang', '华丽苍凉'], ['wang', '温润白描'], ['murakami', '疏离都市'], ['film', '电影镜头'], ['ancient', '古风'], ['funny', '搞笑'], ['flirty', '暧昧撩人'], ['clean', '简洁干净'], ['casual', '轻松口语'], ['literary', '文艺']] },
  { key: 'ratio', name: '对话和叙述', pos: 'before', choices: [['talk', '多对话'], ['balance', '平衡'], ['narr', '多叙述']] },
  { key: 'pace', name: '节奏', pos: 'before', choices: [['slow', '慢慢来'], ['normal', '正常'], ['fast', '推得快']] },
  { key: 'format', name: '格式', pos: 'after', choices: [['cn', '对话用「」'], ['en', '对话用“”']] }
];
var PLOT_DEFAULT_OPTS = { len: 'mid', lenCustom: 800, person: '2', view: 'char', speak: 'strict', inner: 'some', style: 'delicate', ratio: 'balance', pace: 'normal', format: 'cn' };
function plotText(key, o) {
  var T = {
    len: function() {
      var r = { short: '300～500', mid: '600～1000', long: '1200～2000' }[o.len] || ('约 ' + (parseInt(o.lenCustom, 10) || 800));
      return '【字数】这一轮的正文写 ' + r + ' 字（思考不算在内）。写完一个完整的段落再停，不要断在半句话上；篇幅不够时多写细节，不要拿重复的话凑字数。';
    },
    person: function() {
      return o.person === '3'
        ? '【人称】全文用第三人称：{{user}}也用名字或「他 / 她」来写，不用「你」。'
        : '【人称】写到{{user}}时用第二人称「你」；{{char}}和其他人用名字或「他 / 她」。';
    },
    view: function() {
      return {
        omni: '【视角】用旁观的全知视角：镜头可以在场景里自由移动，交代不同人物的言行和周围的环境；但{{user}}心里在想什么不替 TA 写。',
        user: '【视角】镜头跟着{{user}}：写{{user}}眼前看得到、听得到、感觉得到的东西和{{char}}的言行；{{char}}心里在想什么，只能从言行里流露出来。'
      }[o.view] || '【视角】镜头跟着{{char}}：写{{char}}看到的、听到的、感觉到的；其他人心里在想什么，只能从他们的言行里看出来。';
    },
    speak: function() {
      return o.speak === 'light'
        ? '【不抢话】不写{{user}}的台词，也不替 TA 做重要的决定；可以顺着{{user}}上一轮的行动，补一点自然的小动作把场景接上（比如推门进来、坐下），但不往下扩写 TA 没做的事。'
        : '【不抢话】{{user}}只由{{user}}自己扮演：不写 TA 的台词，不替 TA 做选择，不写 TA 心里的想法和反应的结果。写到需要{{user}}回应的地方就停下，把下一步留给 TA。';
    },
    inner: function() {
      return {
        more: '【内心】多写{{char}}的内心：此刻在想什么、在意什么、嘴上说的和心里想的哪里不一样，让人物有层次。',
        none: '【内心】不直接写{{char}}的内心想法，情绪全靠动作、表情、语气和对话表现出来。'
      }[o.inner] || '【内心】{{char}}的内心适量写：只在关键的地方点到为止，大部分情绪通过动作、表情和语气透出来。';
    },
    style: function() { return styleText(o.style); },
    ratio: function() {
      return {
        talk: '【对话和叙述】多用对话推动：人物之间多说话、多交锋，叙述只做必要的交代。',
        narr: '【对话和叙述】以叙述和描写为主：多写场景、动作和氛围，对话少而精。'
      }[o.ratio] || '【对话和叙述】对话和叙述大致平衡，穿插着写，不要整段只有对话，也不要整段只有描写。';
    },
    pace: function() {
      return {
        slow: '【节奏】慢慢来：一个场景好好写透，细腻地推进情绪和关系，不急着跳到下一件事。',
        fast: '【节奏】推得快一点：每一轮都让故事往前走，适时安排新的事件、人物或转折。'
      }[o.pace] || '【节奏】自然推进：每一轮往前走一点，有起有伏，不拖沓也不赶。';
    },
    format: function() {
      return o.format === 'en'
        ? '【格式】人物说的话用“”括起来；动作、神态和环境直接叙述；{{char}}心里的想法用（）括起来。'
        : '【格式】人物说的话用「」括起来；动作、神态和环境直接叙述；{{char}}心里的想法用（）括起来。';
    }
  };
  return T[key] ? T[key]() : '';
}
// 不跟选项变的几条
var PLOT_FIXED = [
  { key: 'core', name: '剧情演绎', pos: 'before', content: '【剧情演绎】你和{{user}}在剧情窗口里一起演绎一段故事。你负责{{char}}，以及故事里除了{{user}}以外的所有人物、环境和事件；按人设、世界书和前面发生过的事往下写，前后一致，不跳出故事。' },
  { key: 'ending', name: '结尾', pos: 'after', content: '【结尾】每一轮停在{{user}}可以接着行动或说话的地方。不替{{user}}收尾，不用总结、感悟或预告结束，也不要每次都用一个问题结尾。' },
  { key: 'fresh', name: '不重复', pos: 'after', content: '【不重复】不重复前文已经写过的句子、比喻和描写套路；同一个动作、表情不要反复出现，每一轮换新的细节。' }
];
// 生成一份默认剧情预设（opts 不传就用默认选项）
function makePlotPreset(opts) {
  var o = Object.assign({}, PLOT_DEFAULT_OPTS, opts || {});
  var e = function(key, name, pos, content) { return { key: key, name: name, role: 'system', enabled: true, pos: pos, content: content }; };
  var by = {};
  PLOT_OPTS.forEach(function(g) { by[g.key] = e(g.key, g.name, g.pos, plotText(g.key, o)); });
  PLOT_FIXED.forEach(function(f) { by[f.key] = e(f.key, f.name, f.pos, f.content); });
  // 顺序：放在聊天记录前面的（总要求、文风、视角、内心、对话、节奏），后面的（人称、抢话、格式、字数、结尾、不重复）
  var order = ['core', 'style', 'view', 'inner', 'ratio', 'pace', 'person', 'speak', 'format', 'len', 'ending', 'fresh'];
  return { name: '眠花糖机 · 剧情', builtin: true, opts: o, entries: order.map(function(k) { return by[k]; }) };
}


function getDefaultStPresets() {
  return [makePlotPreset()];
}
// 以前的「默认预设」（三条很简单的条目）：没改过就换成新的默认剧情预设
function stOldDefaultPresets() {
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
        // 还没有默认剧情预设：以前的默认预设没改过就直接换掉，改过的保留，新的放在最前面
        if (!stPresets.some(function(p) { return p && p.builtin; })) {
          if (stPresets.length === 1 && JSON.stringify(stPresets[0]) === JSON.stringify(stOldDefaultPresets()[0])) { stPresets = [makePlotPreset()]; stActivePresetIdx = 0; }
          else { stPresets.unshift(makePlotPreset()); stActivePresetIdx += 1; }
          saveStPresetsToStorage();
        }
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
  renderPlotCard(cur);
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
    if (entry.pos === 'after') { var pb = document.createElement('span'); pb.className = 'st-pos-badge'; pb.textContent = '记录后'; title.appendChild(pb); }
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
  if (stPresets.some(function(p) { return p.name === name; })) { shakeEl(stPresetNameInput); showToast('已经有叫这个名字的预设了', 'error'); return; }
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
  if (cur && cur.builtin) { showToast('默认预设不能删，可以在上面「恢复默认」', 'plain'); return; }
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

var stEntryPosRow = document.getElementById('stEntryPosRow');
stEntryPosRow.querySelectorAll('.pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    stEntryPosRow.querySelectorAll('.pf-radio-btn').forEach(function(b) { b.classList.remove('selected'); });
    this.classList.add('selected');
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
    stEntryPosRow.querySelectorAll('.pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.pos === (entry.pos === 'after' ? 'after' : 'before')); });
    stEntryDetailDelete.classList.remove('hidden');
  } else {
    stEntryPosRow.querySelectorAll('.pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.pos === 'before'); });
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
  var posBtn = stEntryPosRow.querySelector('.pf-radio-btn.selected');
  var pos = posBtn && posBtn.dataset.pos === 'after' ? 'after' : 'before';

  if (stEditingEntryIdx >= 0 && cur.entries[stEditingEntryIdx]) {
    cur.entries[stEditingEntryIdx].name = name;
    cur.entries[stEditingEntryIdx].role = role;
    cur.entries[stEditingEntryIdx].content = content;
    cur.entries[stEditingEntryIdx].pos = pos;
  } else {
    cur.entries.push({ name: name, role: role, enabled: true, content: content, pos: pos });
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

// 剧情设置：只在默认剧情预设上出现。点一个选项，对应那一条条目就换成那段话（自己改过那条的字也会被换掉）
function renderPlotCard(cur) {
  var card = document.getElementById('stPlotCard');
  if (!card) return;
  card.innerHTML = '';
  card.style.display = cur && cur.builtin ? '' : 'none';
  if (!cur || !cur.builtin) return;
  var o = cur.opts = Object.assign({}, PLOT_DEFAULT_OPTS, cur.opts || {});
  var head = document.createElement('div');
  head.className = 'plot-head';
  head.innerHTML = '<b>剧情设置</b><button class="plot-reset">恢复默认</button>';
  head.querySelector('.plot-reset').addEventListener('click', function() {
    openConfirm('把「' + cur.name + '」恢复成自带的样子？你改过的条目和选项都会还原', function() {
      var fresh = makePlotPreset();
      cur.entries = fresh.entries; cur.opts = fresh.opts;
      saveStPresetsToStorage(); renderStEntryList();
      showToast('✓ 恢复默认了', 'success');
    });
  });
  card.appendChild(head);
  PLOT_OPTS.forEach(function(g) {
    var row = document.createElement('div');
    row.className = 'plot-row';
    row.innerHTML = '<span class="plot-label"></span><div class="plot-choices"></div>';
    row.querySelector('.plot-label').textContent = g.name;
    var choices = g.key === 'style' ? styleList().map(function(x) { return [x.id, x.name]; }) : g.choices;
    choices.forEach(function(c) {
      var b = document.createElement('button');
      b.className = 'pf-radio-btn plot-chip' + ((g.key === 'style' ? styleById(o.style).id : o[g.key]) === c[0] ? ' selected' : '');
      b.textContent = c[1];
      b.addEventListener('click', function() {
        o[g.key] = c[0];
        var en = cur.entries.filter(function(e) { return e.key === g.key; })[0];
        if (en) en.content = plotText(g.key, o);
        else cur.entries.push({ key: g.key, name: g.name, role: 'system', enabled: true, pos: g.pos, content: plotText(g.key, o) });
        saveStPresetsToStorage(); renderStEntryList();
      });
      row.querySelector('.plot-choices').appendChild(b);
    });
    if (g.key === 'len' && o.len === 'custom') {
      var inp = document.createElement('input');
      inp.className = 'plot-len-input'; inp.type = 'number'; inp.min = 100; inp.max = 5000; inp.step = 100; inp.value = o.lenCustom || 800;
      inp.addEventListener('change', function() {
        o.lenCustom = Math.max(100, Math.min(5000, parseInt(this.value, 10) || 800));
        var en = cur.entries.filter(function(e) { return e.key === 'len'; })[0];
        if (en) en.content = plotText('len', o);
        saveStPresetsToStorage(); renderStEntryList();
      });
      var wrap = document.createElement('span'); wrap.className = 'plot-len-wrap'; wrap.appendChild(inp); wrap.appendChild(document.createTextNode(' 字左右'));
      row.querySelector('.plot-choices').appendChild(wrap);
    }
    // 文风：下面一行小字写着这个文风大概是什么样（就是发给 TA 的那段话，去掉开头的标题）
    if (g.key === 'style') {
      var desc = document.createElement('div');
      desc.className = 'plot-desc';
      desc.textContent = styleById(o.style).text.replace(STYLE_REF_NOTE, '');
      row.querySelector('.plot-choices').appendChild(desc);
    }
    card.appendChild(row);
  });
  var tip = document.createElement('div');
  tip.className = 'auto-hint';
  tip.textContent = '点一下就换成那段写法，下面对应的条目跟着变；想自己改字就点进条目里改（再点这里的选项会被换回来）。标着「记录后」的条目放在聊天记录后面，离回复最近，字数、人称、不抢话这类放在那里最管用。';
  card.appendChild(tip);
}

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
        return { name: e.name || '未命名条目', role: toRole(e.role), enabled: e.enabled !== false, content: String(e.content || ''), pos: e.pos === 'after' ? 'after' : 'before' };
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
  // 酒馆里排在「聊天记录」（chatHistory）占位后面的条目，导进来也放在聊天记录后面
  var afterHist = false;
  var entries = list.filter(function(x) {
    if (x.p && x.p.identifier === 'chatHistory') { afterHist = true; return false; }
    x.after = afterHist;
    return x.p && !x.p.marker && String(x.p.content || '').trim();
  }).map(function(x) {
      return { name: x.p.name || x.p.identifier || '未命名条目', role: toRole(x.p.role), enabled: x.enabled, content: String(x.p.content), pos: x.after ? 'after' : 'before' };
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
