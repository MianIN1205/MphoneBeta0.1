// 眠花糖机 — Chat「我的 → 资产」：赛博小物（盲盒抽到的虚拟小东西）和现实持有（自己记，或聊天时 TA 用 <记下持有> 帮忙记）
// mphone_assets = { share, cyber: [{ key, sid, iid, name, icon, img, text, rarity, series, count, first, last }],
//                   real: [{ id, name, note, chars（和谁有关的角色 id，这些角色知道它）, by（记的角色名，空 = 自己）, byId, at, fresh（新记的，看过就没了） }] }
// 谁知道什么（用户定的）：赛博小物看开关（默认都知道）；现实持有只有「和谁有关」里的角色知道（TA 帮忙记的、你选了 TA 的），别的角色不知道

var assetStore = mphoneStore.load('mphone_assets', null) || {};
if (!assetStore.cyber) assetStore.cyber = [];
if (!assetStore.real) assetStore.real = [];
if (assetStore.share === undefined) assetStore.share = true;   // 赛博小物默认让角色知道
assetStore.real.forEach(function(x) { if (!x.chars) x.chars = x.byId ? [x.byId] : []; });
function assetCharLabel(c) { return c.charAlias || c.charName || (c.builtinAssistant && typeof MIANIN_NAME !== 'undefined' ? MIANIN_NAME : '角色'); }
function assetCharName(id) { var c = charList[findCharIdx(id)]; return c ? assetCharLabel(c) : ''; }
function saveAssets() { mphoneStore.save('mphone_assets', assetStore); assetPaintDot(); }

var ASSET_RARITY = { n: '普通款', r: '稀有款', h: '隐藏款' };

// 盲盒抽到一个：同一个东西只记一份、数量加一（自定义的图片不用存好几遍）
function assetAddCyber(series, item) {
  var key = series.id + ':' + item.id, now = Date.now();
  var a = assetStore.cyber.filter(function(x) { return x.key === key; })[0];
  if (a) { a.count++; a.last = now; a.name = item.name || a.name; }
  else {
    a = { key: key, sid: series.id, iid: item.id, name: item.name || '', icon: item.icon || '', img: item.img || '', text: item.text || '',
          rarity: item.r || 'n', series: series.name, count: 1, first: now, last: now };
    assetStore.cyber.unshift(a);
  }
  saveAssets();
  return a;
}
function assetOwnedCount(sid, iid) {
  var a = assetStore.cyber.filter(function(x) { return x.key === sid + ':' + iid; })[0];
  return a ? a.count : 0;
}
function assetCyberLabel(a) { return a.name || (a.text ? a.text.slice(0, 12) + (a.text.length > 12 ? '…' : '') : '小物'); }

// 现实持有：记一样（by 是记的角色，空着是自己记的）
function assetAddReal(name, note, char, chars) {
  name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  note = String(note || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!name) return null;
  var same = assetStore.real.filter(function(x) { return x.name === name; })[0];
  if (!same) {
    same = { id: genFeedId('as'), name: name, note: note, chars: [], at: Date.now() };
    assetStore.real.unshift(same);
    if (char) { same.by = assetCharLabel(char); same.byId = char.id; same.fresh = true; }
  } else if (char) {
    var knew = same.chars.indexOf(char.id) >= 0;
    if (knew && (!note || note === same.note)) return same;   // TA 已经知道，也没新东西
    if (note) same.note = note;
    same.fresh = true;   // TA 补了备注，或者 TA 现在也知道了
  } else if (note) same.note = note;
  if (char && same.chars.indexOf(char.id) < 0) same.chars.push(char.id);
  if (chars) same.chars = chars.slice();
  saveAssets();
  return same;
}

// 「我的」入口上的数量和小红点（有 TA 新记的东西）
function assetPaintDot() {
  var fresh = assetStore.real.some(function(x) { return x.fresh; });
  var d = document.getElementById('mineAssetDot');
  if (d) d.classList.toggle('on', fresh);
  var t = document.getElementById('assetRealDot');
  if (t) t.classList.toggle('on', fresh);
  var c = document.getElementById('mineAssetCount');
  if (c) {
    var n = assetStore.cyber.length + assetStore.real.length;
    c.textContent = n ? n + ' 样' : '';
  }
}

// ---------- 页面 ----------
var appAssets = document.getElementById('appAssets');
var assetTab = 'cyber', assetRealFilter = '';
function assetIconEl(a, cls) {
  var el = document.createElement('div');
  el.className = cls;
  if (a.img) { var im = document.createElement('img'); im.src = a.img; im.alt = ''; el.appendChild(im); }
  else if (a.icon) el.textContent = a.icon;
  else { el.classList.add('is-text'); el.textContent = '✉'; }
  return el;
}
function renderAssets() {
  var box = document.getElementById('assetBody');
  box.innerHTML = '';
  document.getElementById('assetShareToggle').checked = assetStore.share !== false;
  document.getElementById('assetShareCard').style.display = assetTab === 'cyber' ? '' : 'none';   // 现实持有按「和谁有关」，不看这个开关
  document.querySelectorAll('#assetTabs .fav-filter-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.kind === assetTab); });
  if (assetTab === 'cyber') renderAssetCyber(box); else renderAssetReal(box);
}
function renderAssetCyber(box) {
  if (!assetStore.cyber.length) {
    box.innerHTML = '<div class="feed-empty-hint">还没有赛博小物<br>去桌面的盲盒抽一个吧</div>';
    return;
  }
  // 按系列分组，最近拿到的系列在前
  var groups = [], bySeries = {};
  assetStore.cyber.slice().sort(function(a, b) { return b.last - a.last; }).forEach(function(a) {
    if (!bySeries[a.sid]) { bySeries[a.sid] = { name: a.series, items: [] }; groups.push(bySeries[a.sid]); }
    bySeries[a.sid].items.push(a);
  });
  groups.forEach(function(g) {
    var h = document.createElement('div');
    h.className = 'section-label';
    h.textContent = g.name;
    box.appendChild(h);
    var grid = document.createElement('div');
    grid.className = 'asset-grid';
    g.items.forEach(function(a) {
      var cell = document.createElement('div');
      cell.className = 'asset-cell r-' + a.rarity;
      cell.appendChild(assetIconEl(a, 'asset-cell-ic'));
      var nm = document.createElement('div');
      nm.className = 'asset-cell-name';
      nm.textContent = assetCyberLabel(a);
      cell.appendChild(nm);
      if (a.count > 1) { var c = document.createElement('span'); c.className = 'asset-cell-count'; c.textContent = '×' + a.count; cell.appendChild(c); }
      cell.addEventListener('click', function() { openAssetCyber(a); });
      grid.appendChild(cell);
    });
    box.appendChild(grid);
  });
}
function renderAssetReal(box) {
  var add = document.createElement('button');
  add.className = 'asset-add-btn';
  add.textContent = '+ 记一样';
  add.addEventListener('click', function() { openAssetReal(null); });
  box.appendChild(add);
  if (!assetStore.real.length) {
    var e = document.createElement('div');
    e.className = 'feed-empty-hint';
    e.innerHTML = '还没有记下的东西<br>可以自己记，也可以聊天时让 TA 帮你记<br>和谁有关，那个角色才知道';
    box.appendChild(e);
    return;
  }
  // 按角色筛：只有出现过的角色
  var ids = [];
  assetStore.real.forEach(function(x) { x.chars.forEach(function(id) { if (ids.indexOf(id) < 0 && assetCharName(id)) ids.push(id); }); });
  if (assetRealFilter && ids.indexOf(assetRealFilter) < 0) assetRealFilter = '';
  if (ids.length) {
    var chips = document.createElement('div');
    chips.className = 'pet-chips asset-real-filter';
    [''].concat(ids).forEach(function(id) {
      var c = document.createElement('button');
      c.className = 'pet-chip' + (assetRealFilter === id ? ' active' : '');
      c.textContent = id ? assetCharName(id) : '全部';
      c.addEventListener('click', function() { assetRealFilter = id; renderAssets(); });
      chips.appendChild(c);
    });
    box.appendChild(chips);
  }
  var card = document.createElement('div');
  card.className = 'settings-card asset-real-list';
  assetStore.real.filter(function(x) { return !assetRealFilter || x.chars.indexOf(assetRealFilter) >= 0; }).forEach(function(x) {
    var row = document.createElement('div');
    row.className = 'asset-real' + (x.fresh ? ' fresh' : '');
    var main = document.createElement('div');
    main.className = 'asset-real-main';
    var nm = document.createElement('div');
    nm.className = 'asset-real-name';
    nm.textContent = x.name;
    main.appendChild(nm);
    if (x.note) { var no = document.createElement('div'); no.className = 'asset-real-note'; no.textContent = x.note; main.appendChild(no); }
    var rel = document.createElement('div');
    rel.className = 'asset-real-rel';
    var names = x.chars.map(assetCharName).filter(Boolean);
    rel.textContent = names.length ? '和 ' + names.join('、') + ' 有关' : '只有你知道';
    if (!names.length) rel.classList.add('none');
    main.appendChild(rel);
    var by = document.createElement('div');
    by.className = 'asset-real-by';
    var d = new Date(x.at);
    by.textContent = (x.by ? x.by + ' 帮你记的' : '我记的') + ' · ' + (d.getMonth() + 1) + '/' + d.getDate();
    row.appendChild(main);
    row.appendChild(by);
    row.addEventListener('click', function() { openAssetReal(x); });
    card.appendChild(row);
  });
  box.appendChild(card);
  // 看到了就不算新的了（这次画出来的红点先留着）
  if (assetStore.real.some(function(x) { return x.fresh; })) {
    assetStore.real.forEach(function(x) { delete x.fresh; });
    saveAssets();
  }
}
document.querySelectorAll('#assetTabs .fav-filter-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { assetTab = this.dataset.kind; renderAssets(); });
});
document.getElementById('assetShareToggle').addEventListener('change', function() {
  assetStore.share = this.checked;
  saveAssets();
  showToast(this.checked ? '角色们会知道你的赛博小物' : '角色们不会知道你的赛博小物了', 'plain');
});
document.getElementById('mineAssetEntry').addEventListener('click', function() {
  // 有 TA 新记的东西时直接打开「现实持有」
  if (assetStore.real.some(function(x) { return x.fresh; })) assetTab = 'real';
  renderAssets();
  appAssets.classList.add('active');
});
document.getElementById('backAssets').addEventListener('click', function() {
  appAssets.classList.remove('active');
  refreshMineEntries();
  assetPaintDot();
});

// 小弹窗（动态建的，用完就拿掉）
function assetModal(html) {
  var ov = document.createElement('div');
  ov.className = 'mine-acc-overlay open';
  ov.innerHTML = '<div class="mine-acc-modal">' + html + '</div>';
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  (document.querySelector('.phone') || document.body).appendChild(ov);
  return ov;
}
function openAssetCyber(a) {
  var ov = assetModal('<div class="asset-detail"></div><div class="mine-acc-actions">' +
    '<button class="mine-acc-btn mine-acc-btn-close" data-act="drop">扔掉一个</button><button class="mine-acc-btn mine-acc-btn-add" data-act="ok">收好</button></div>');
  var det = ov.querySelector('.asset-detail');
  if (a.text) { var p = document.createElement('div'); p.className = 'bb-note-paper'; p.textContent = a.text; det.appendChild(p); }
  else det.appendChild(assetIconEl(a, 'asset-detail-ic'));
  var nm = document.createElement('div'); nm.className = 'asset-detail-name'; nm.textContent = a.name || ''; if (a.name) det.appendChild(nm);
  var meta = document.createElement('div'); meta.className = 'asset-detail-meta';
  var d = new Date(a.first);
  meta.textContent = a.series + ' · ' + ASSET_RARITY[a.rarity] + ' · 有 ' + a.count + ' 个 · ' + d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' 第一次拿到';
  det.appendChild(meta);
  ov.querySelector('[data-act="ok"]').addEventListener('click', function() { ov.remove(); });
  ov.querySelector('[data-act="drop"]').addEventListener('click', function() {
    openConfirm('扔掉一个「' + assetCyberLabel(a) + '」？', function() {
      a.count--;
      if (a.count <= 0) assetStore.cyber = assetStore.cyber.filter(function(x) { return x !== a; });
      saveAssets();
      ov.remove();
      renderAssets();
    });
  });
}
function openAssetReal(x) {
  var ov = assetModal('<div class="mine-acc-title">' + (x ? '改一改' : '记一样东西') + '</div>' +
    '<input class="pet-edit-input" maxlength="40" placeholder="东西的名字" data-f="name">' +
    '<input class="pet-edit-input" maxlength="80" placeholder="备注（可以不写：什么时候买的、放在哪……）" data-f="note">' +
    '<div class="asset-rel-label">和谁有关（选了的角色会知道它）</div><div class="pet-chips asset-rel-chips"></div>' +
    (x && x.by ? '<div class="auto-hint">' + escHtmlAsset(x.by) + ' 帮你记的</div>' : '') +
    '<div class="mine-acc-actions">' + (x ? '<button class="mine-acc-btn mine-acc-btn-close" data-act="del">删除</button>' : '') +
    '<button class="mine-acc-btn mine-acc-btn-close" data-act="cancel">取消</button><button class="mine-acc-btn mine-acc-btn-add" data-act="ok">好了</button></div>');
  var nameIn = ov.querySelector('[data-f="name"]'), noteIn = ov.querySelector('[data-f="note"]');
  if (x) { nameIn.value = x.name; noteIn.value = x.note || ''; }
  var picked = x ? x.chars.slice() : (assetRealFilter ? [assetRealFilter] : []);
  var chipBox = ov.querySelector('.asset-rel-chips');
  charList.forEach(function(c) { if (c.isGroup) return;   // 群聊不算
    var b = document.createElement('button');
    b.className = 'pet-chip' + (picked.indexOf(c.id) >= 0 ? ' active' : '');
    b.textContent = assetCharLabel(c);
    b.addEventListener('click', function() {
      var k = picked.indexOf(c.id);
      if (k >= 0) picked.splice(k, 1); else picked.push(c.id);
      b.classList.toggle('active', k < 0);
    });
    chipBox.appendChild(b);
  });
  ov.querySelector('[data-act="cancel"]').addEventListener('click', function() { ov.remove(); });
  ov.querySelector('[data-act="ok"]').addEventListener('click', function() {
    var name = nameIn.value.trim();
    if (!name) { shakeEl(nameIn); return; }
    if (x) { x.name = name.slice(0, 40); x.note = noteIn.value.trim().slice(0, 80); x.chars = picked.slice(); saveAssets(); }
    else assetAddReal(name, noteIn.value, null, picked);
    ov.remove();
    renderAssets();
  });
  if (x) ov.querySelector('[data-act="del"]').addEventListener('click', function() {
    openConfirm('删除「' + x.name + '」？', function() {
      assetStore.real = assetStore.real.filter(function(y) { return y !== x; });
      saveAssets();
      ov.remove();
      renderAssets();
    });
  });
  if (!x) setTimeout(function() { nameIn.focus(); }, 50);
}
function escHtmlAsset(t) { return String(t).replace(/[&<>"]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

// ---------- 给角色 ----------
// 现实感知里的一行：赛博小物是虚拟的，只在小手机里
function assetContextLine(char) {
  var out = [];
  if (assetStore.share !== false && assetStore.cyber.length) {
    out.push('{{user}}在小手机里收集的赛博小物（盲盒抽到的，虚拟的，只存在小手机里，不是现实里的东西）：' +
      assetStore.cyber.slice().sort(function(a, b) { return b.last - a.last; }).slice(0, 20).map(function(a) {
        return (a.text ? '小纸条「' + a.text + '」' : assetCyberLabel(a)) + (a.rarity !== 'n' ? '（' + ASSET_RARITY[a.rarity] + '）' : '') + (a.count > 1 ? '×' + a.count : '');
      }).join('、') + '。');
  }
  var mine = assetStore.real.filter(function(x) { return char && x.chars.indexOf(char.id) >= 0; });
  if (mine.length) {
    out.push('{{user}}现实里有的、和你有关的东西（你知道的）：' + mine.slice(0, 20).map(function(x) {
      return x.name + (x.note ? '（' + x.note + '）' : '');
    }).join('、') + '。');
  }
  return out.length ? '【{{user}}的资产】' + out.join('') : '';
}
// 聊天的要求：帮忙记现实里的东西
function assetRuleFor(char) {
  return '{{user}}跟你说起自己现实里新买到、收到或一直很珍惜的东西（不是小手机里的赛博小物），而你知道的【{{user}}的资产】里还没有时，可以顺手帮忙记下：在全部消息最后另起一行写 <记下持有>东西的名字｜一句备注（怎么来的、什么时候，知道的才写）</记下持有>。很少用，只记真的值得记的东西。';
}
// 回复里取走 <记下持有>（js/chat/reply.js、js/char/auto.js）
function assetTakeTags(char, text) {
  var got = 0;
  text = String(text || '').replace(/<记下持有>([\s\S]*?)(<\/记下持有>|$)/g, function(_, body) {
    var parts = body.replace(/\s+/g, ' ').trim().split(/[｜|]/);
    if (char && assetAddReal(parts[0], parts.slice(1).join(' '), char)) got++;
    return '';
  });
  if (got) assetPaintDot();
  return text;
}

assetPaintDot();
