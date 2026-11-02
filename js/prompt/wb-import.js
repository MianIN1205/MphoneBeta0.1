// 眠花糖机 — Prompt：世界书导入（眠花糖机的世界书文件、酒馆世界书 JSON、角色卡里的世界书、uwu 小手机完整备份 .ee）

// =============================================
// 选文件 → 认出里面的世界书，按文件夹列出来（默认全勾）→ 导入
// · 文件夹按名字找，没有就新建；名字和内容都一样的条目算已经有了，不重复导入
// · 位置：眠花糖机文件照原样；酒馆的按它的位置换算（和导入角色卡一样）；其他的用「自动」
// · 导进来只是放进世界书库，要在角色设置里关联给角色才会生效
// =============================================
var wbImpOverlay = document.getElementById('wbImpOverlay');
var wbImpGroups = null;   // [{ name, entries: [{ name, keywords, content, pos, enabled }] }]

// 酒馆的位置：0/1 角色描述前后 → 前；2/3 作者注释 → 中；4 按深度插入 → 后
function wbImpStPos(p) { return p === 4 ? 'after' : (p === 2 || p === 3) ? 'middle' : p === 0 || p === 1 ? 'before' : 'auto'; }
function wbImpKeys(k) { return Array.isArray(k) ? k.filter(Boolean).join(',') : (typeof k === 'string' ? k : ''); }
function wbImpFromStEntry(e) {
  if (!e || !e.content) return null;
  var pos = e.extensions && e.extensions.position != null ? e.extensions.position : e.position;
  return { name: String(e.comment || e.name || (Array.isArray(e.key) && e.key[0]) || (Array.isArray(e.keys) && e.keys[0]) || '导入条目').slice(0, 60),
    keywords: e.constant ? '' : wbImpKeys(e.key || e.keys), content: String(e.content),
    pos: typeof pos === 'number' ? wbImpStPos(pos) : 'auto', enabled: !(e.disable || e.enabled === false) };
}
// 从一个 JSON 里认世界书
function wbImpFromJson(j, fileName) {
  var base = String(fileName || '导入的世界书').replace(/\.[^.]+$/, '').slice(0, 30);
  // 眠花糖机自己的世界书文件
  if (j && j.app === 'mphone' && j.type === 'worldbook' && Array.isArray(j.folders)) {
    return j.folders.map(function(f) {
      return { name: String(f.name || '未分类'), entries: (f.entries || []).filter(function(e) { return e && e.content; }).map(function(e) {
        return { name: String(e.name || '未命名').slice(0, 60), keywords: wbImpKeys(e.keywords), content: String(e.content),
          pos: ['auto', 'before', 'middle', 'after'].indexOf(e.pos) >= 0 ? e.pos : 'auto', enabled: e.enabled !== false };
      }) };
    });
  }
  // 角色卡（JSON）里带的世界书
  var card = j && (j.data || j);
  if (card && card.character_book && card.character_book.entries) {
    return [{ name: card.name || card.character_book.name || base, entries: [].concat(card.character_book.entries).map(wbImpFromStEntry).filter(Boolean) }];
  }
  // 酒馆世界书：{ entries: { "0": {…}, … } } 或数组
  if (j && j.entries && typeof j.entries === 'object') {
    var list = Array.isArray(j.entries) ? j.entries : Object.keys(j.entries).map(function(k) { return j.entries[k]; });
    return [{ name: j.name || base, entries: list.map(wbImpFromStEntry).filter(Boolean) }];
  }
  // 一组 { name, content } 的数组
  if (Array.isArray(j)) {
    return [{ name: base, entries: j.map(function(e) {
      return e && e.content ? { name: String(e.name || e.comment || '导入条目').slice(0, 60), keywords: wbImpKeys(e.keywords || e.keys || e.key), content: String(e.content), pos: 'auto', enabled: !e.disabled } : null;
    }).filter(Boolean) }];
  }
  return [];
}

document.getElementById('wbImportBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  pickFile('.json,.ee,.gz,.png,application/json,application/gzip,image/png', function(file) {
    var read;
    if (/\.png$/i.test(file.name)) {
      read = file.arrayBuffer().then(function(buf) {
        var s = typeof readPngCard === 'function' ? readPngCard(buf) : null;
        if (!s) throw new Error('这张图里没有角色卡');
        return wbImpFromJson(JSON.parse(s), file.name);
      });
    } else {
      read = file.slice(0, 2).arrayBuffer().then(function(b) {
        var u = new Uint8Array(b);
        // gzip：uwu 小手机的完整备份，只取里面的世界书，按原来的分类分文件夹
        if (u[0] === 0x1f && u[1] === 0x8b) {
          if (typeof migScan !== 'function') throw new Error('读不了这种备份');
          return migScan(file).then(function(r) {
            var by = {};
            r.books.forEach(function(x) {
              var cat = String(x.category || '').trim() || '未分类';
              (by[cat] = by[cat] || []).push({ name: String(x.name || '未命名').slice(0, 60), content: String(x.content),
                keywords: x.alwaysOn ? '' : wbImpKeys(x.keywords), pos: 'auto', enabled: !x.disabled });
            });
            return Object.keys(by).map(function(k) { return { name: k, entries: by[k] }; });
          });
        }
        return file.text().then(function(t) { return wbImpFromJson(JSON.parse(t.replace(/^﻿/, '')), file.name); });
      });
    }
    read.then(function(groups) {
      groups = groups.filter(function(g) { return g.entries.length; });
      if (!groups.length) throw new Error('里面没找到世界书');
      wbImpGroups = groups;
      wbImpRender();
      wbImpOverlay.classList.add('open');
    }).catch(function(err) { showToast('✗ 读不出来：' + ((err && err.message) || '格式不认识'), 'error'); });
  });
});

function wbImpRender() {
  var n = 0;
  var box = document.getElementById('wbImpList');
  box.innerHTML = '';
  wbImpGroups.forEach(function(g) {
    n += g.entries.length;
    var head = document.createElement('label');
    head.className = 'mig-row wb-imp-folder';
    var fcb = document.createElement('input');
    fcb.type = 'checkbox';
    fcb.checked = true;
    var ft = document.createElement('span');
    ft.textContent = '📁 ' + g.name + '（' + g.entries.length + ' 条）';
    head.appendChild(fcb);
    head.appendChild(ft);
    box.appendChild(head);
    var cbs = [];
    g.entries.forEach(function(e) {
      var lab = document.createElement('label');
      lab.className = 'mig-row wb-imp-entry';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb._entry = e;
      cb._group = g;
      var t = document.createElement('span');
      t.textContent = e.name + ' · ' + e.content.length + ' 字' + (e.keywords ? ' · 关键词' : ' · 常驻') + (e.enabled === false ? ' · 原来是关着的' : '');
      lab.appendChild(cb);
      lab.appendChild(t);
      box.appendChild(lab);
      cbs.push(cb);
      cb.addEventListener('change', function() { fcb.checked = cbs.some(function(x) { return x.checked; }); });
    });
    fcb.addEventListener('change', function() { cbs.forEach(function(x) { x.checked = fcb.checked; }); });
  });
  document.getElementById('wbImpInfo').textContent = '共 ' + n + ' 条，分在 ' + wbImpGroups.length + ' 个文件夹里。导进来后，在角色设置里关联给角色才会用上。';
}

document.getElementById('wbImpCancel').addEventListener('click', function() { wbImpOverlay.classList.remove('open'); wbImpGroups = null; });
closeOnBackdrop(wbImpOverlay, function() { wbImpOverlay.classList.remove('open'); wbImpGroups = null; });
document.getElementById('wbImpOk').addEventListener('click', function() {
  if (!wbImpGroups) return;
  var added = 0, had = 0, folders = 0;
  var picked = Array.prototype.filter.call(document.querySelectorAll('#wbImpList .wb-imp-entry input'), function(cb) { return cb.checked; });
  picked.forEach(function(cb) {
    var e = cb._entry, g = cb._group;
    if (wbEntries.some(function(x) { return x.name === e.name && x.content === e.content; })) { had++; return; }
    var folderId = WB_NONE;
    if (g.name && g.name !== '未分类') {
      var f = wbFolders.filter(function(x) { return x.name === g.name; })[0];
      if (!f) { f = { id: genWbId('wf'), name: g.name }; wbFolders.push(f); folders++; }
      folderId = f.id;
    }
    var entry = { id: genWbId('wb'), name: e.name, keywords: e.keywords || '', content: e.content, pos: e.pos || 'auto', folderId: folderId };
    if (e.enabled === false) entry.enabled = false;
    wbEntries.push(entry);
    added++;
  });
  saveWbEntries();
  renderWbList();
  wbImpOverlay.classList.remove('open');
  wbImpGroups = null;
  showToast(added || had ? '✓ 导入了 ' + added + ' 条' + (folders ? '，新建 ' + folders + ' 个文件夹' : '') + (had ? '，' + had + ' 条本来就有' : '') : '没有勾选要导入的', added ? 'success' : 'plain');
});
