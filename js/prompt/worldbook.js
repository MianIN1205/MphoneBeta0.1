// 眠花糖机 — Prompt：世界书（文件夹、条目详情、开关、按关键词取用）

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

// 世界书条目：{ id, name, keywords, content, pos: 'auto' | 'before' | 'middle' | 'after', folderId: '' = 未分类 }
// 自动（新条目默认）：常驻条目放「前」当底色，关键词触发的放「中」（预设后面、聊天记录前面），都不插进聊天记录里，不抢戏
// 文件夹：{ id, name }
var wbEntries = mphoneStore.load('mphone_worldbook', []);
var wbFolders = mphoneStore.load('mphone_wb_folders', []);
var wbEditingId = null;   // null = 新建
var wbOpenFolders = {};   // 列表里展开的文件夹（默认全部收起）
var WB_POS_LABEL = { auto: '自动', before: '前', middle: '中', after: '后' };
function wbResolvePos(e) { return e.pos === 'auto' ? (e.keywords ? 'middle' : 'before') : (e.pos || 'before'); }
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
        askName('重命名文件夹', g.name, function(n) {
          wbFolders.forEach(function(f) { if (f.id === g.id) f.name = n; });
          saveWbEntries();
          renderWbList();
        });
      });
      var delBtn = document.createElement('button');
      delBtn.className = 'wb-folder-act';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', function(e) { e.stopPropagation(); askDelWbFolder(g); });
      wbLongPress(head, function() { askDelWbFolder(g); });   // 长按文件夹那一行也能删（用户要的）
      head.appendChild(renBtn);
      head.appendChild(delBtn);
    }
    if (g.entries.length) {   // 一个文件夹单独导出（用户要的：按分类导出，方便备份、分享）
      var outBtn = document.createElement('button');
      outBtn.className = 'wb-folder-act';
      outBtn.textContent = '导出';
      outBtn.addEventListener('click', function(e) { e.stopPropagation(); wbExport([g], g.name); });
      head.appendChild(outBtn);
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
      // 条目开关：关掉后保留内容，但不发给模型
      card.classList.toggle('disabled', entry.enabled === false);
      var tl = document.createElement('label');
      tl.className = 'st-toggle-wrap';
      tl.innerHTML = '<input type="checkbox"><span class="st-toggle-slider"></span>';
      var tcb = tl.querySelector('input');
      tcb.checked = entry.enabled !== false;
      tl.addEventListener('click', function(e) { e.stopPropagation(); });
      tcb.addEventListener('change', function() {
        entry.enabled = this.checked;
        card.classList.toggle('disabled', !this.checked);
        saveWbEntries();
      });
      card.appendChild(tl);
      card.insertAdjacentHTML('beforeend', '<svg class="pf-entry-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>');
      card.addEventListener('click', function() { openWbDetail(entry.id); });
      // 长按条目直接删，不用点进去（用户要的）；按在开关上不算
      wbLongPress(card, function() {
        openConfirm('删除条目「' + (entry.name || '未命名') + '」？', function() {
          wbEntries = wbEntries.filter(function(x) { return x.id !== entry.id; });
          saveWbEntries();
          renderWbList();
        });
      });
      body.appendChild(card);
    });
    if (!g.entries.length) body.innerHTML = '<div class="auto-hint" style="margin:0 0 6px;">空文件夹</div>';
    folder.appendChild(body);
    wrap.appendChild(folder);
  });
}

// 导出世界书：眠花糖机的世界书文件（「导入世界书」认得），一个文件夹或者全部
function wbExport(groups, name) {
  groups = groups.filter(function(g) { return g.entries.length; });
  if (!groups.length) { showToast('还没有世界书', 'plain'); return; }
  mphoneExportFile('worldbook', { folders: groups.map(function(g) {
    return { name: g.name, entries: g.entries.map(function(e) { return { name: e.name, keywords: e.keywords || '', content: e.content || '', pos: e.pos || 'auto', enabled: e.enabled !== false }; }) };
  }) }, '世界书-' + name);
}
document.getElementById('wbExportAllBtn').addEventListener('click', function(e) { e.stopPropagation(); wbExport(wbGroups(), '全部'); });
// 长按半秒（按在开关上、手指挪动了都不算），长按后松手的那次点击不再打开 / 收起
function wbLongPress(el, onLong) {
  var timer = null, sx = 0, sy = 0, fired = false;
  el.addEventListener('pointerdown', function(e) {
    fired = false;
    if (e.target.closest('.st-toggle-wrap, .wb-folder-act')) return;
    sx = e.clientX; sy = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(function() { timer = null; fired = true; if (navigator.vibrate) navigator.vibrate(15); onLong(); }, 500);
  });
  el.addEventListener('pointermove', function(e) {
    if (timer && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) { clearTimeout(timer); timer = null; }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(ev) { el.addEventListener(ev, function() { clearTimeout(timer); timer = null; }); });
  el.addEventListener('click', function(e) { if (fired) { fired = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  el.addEventListener('contextmenu', function(e) { e.preventDefault(); });
}
// 删文件夹：里面有条目时问一下——条目移到未分类，还是连条目一起删（用户要的）
function askDelWbFolder(g) {
  var drop = function(alsoEntries) {
    wbFolders = wbFolders.filter(function(f) { return f.id !== g.id; });
    if (alsoEntries) wbEntries = wbEntries.filter(function(en) { return en.folderId !== g.id; });
    else wbEntries.forEach(function(en) { if (en.folderId === g.id) en.folderId = WB_NONE; });
    saveWbEntries();
    renderWbList();
  };
  if (!g.entries.length) { openConfirm('删除文件夹「' + g.name + '」？', function() { drop(false); }); return; }
  openConfirm('删除文件夹「' + g.name + '」？', function() { drop(true); },
    { desc: '里面有 ' + g.entries.length + ' 条，可以先移到未分类', okText: '全部删除', alt: '移到未分类', onAlt: function() { drop(false); } });
}

// 文件夹命名：复用「备注名称」弹窗
var _wbFolderNameCb = null;
// 问一个名字（文件夹、预设都用这个弹窗）
function askName(title, value, cb) {
  presetModalMode = 'wbFolder';
  _wbFolderNameCb = cb;
  document.querySelector('#presetModal .modal-title').textContent = title;
  presetNameInput.value = value || '';
  presetModal.classList.add('open');
  presetNameInput.focus();
}

document.getElementById('wbAddFolderBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  askName('新建文件夹', '', function(n) {
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
  var pos = entry ? (entry.pos || 'before') : 'auto';
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
    pos:      posBtn ? posBtn.dataset.val : 'auto',
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

// 世界书 — 删除按钮
wbDetailDelete.addEventListener('click', function() {
  if (!wbEditingId) {
    wbDetailView.classList.remove('open');
    return;
  }
  var delId = wbEditingId;
  openConfirm('删除此世界书条目？', function() {
    wbEntries = wbEntries.filter(function(e) { return e.id !== delId; });
    saveWbEntries();
    renderWbList();
    wbDetailView.classList.remove('open');
  });
});

wbDetailDelete.classList.add('hidden');
renderWbList();

// 取出某角色当前应注入的世界书条目：已关联（整个文件夹或单个条目）且（无关键词 或 最近 6 条消息里出现任一关键词）
// drama：剧情窗口用「剧情窗口」那栏的关联（角色设置里分开勾的；没单独设置过就和聊天一样）
function charWbOf(char, drama) {
  if (drama && char && char.dramaWb) return { ids: char.dramaWb.ids || [], folders: char.dramaWb.folders || [] };
  return { ids: (char && char.worldbookIds) || [], folders: (char && char.worldbookFolders) || [] };
}
function getActiveWbEntries(char, hist, drama) {
  var wb = charWbOf(char, drama);
  var ids = wb.ids;
  var folders = wb.folders;
  if (!ids.length && !folders.length) return [];
  var known = {};
  wbFolders.forEach(function(f) { known[f.id] = true; });
  // 关键词只在最近 6 条里你说的话（和开场旁白）中找：角色自己提到的不算，免得 TA 提一次 → 触发 → 又提一次，反复绕着同一个设定说
  var recent = hist.slice(-6).filter(function(m) { return m.role === 'user'; })
    .map(function(m) { return typeof m.content === 'string' ? m.content : ''; }).join('\n').toLowerCase();
  return wbEntries.filter(function(e) {
    var fid = (e.folderId && known[e.folderId]) ? e.folderId : WB_NONE;
    var linked = ids.indexOf(e.id) >= 0 || folders.indexOf(fid) >= 0;
    if (!linked || !e.content || e.enabled === false) return false;
    if (!e.keywords) return true;
    return e.keywords.split(/[,，]/).some(function(k) {
      k = k.trim().toLowerCase();
      return k && recent.indexOf(k) >= 0;
    });
  });
}
