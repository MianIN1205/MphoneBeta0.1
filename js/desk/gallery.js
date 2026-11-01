// 眠花糖机 — 书架上的系统书打开方式，以及「相册」：聊天、动态、收藏里的所有图片

// =============================================
// 打开 / 关闭：相册、日记从书架上的书打开；纪念日从桌面小组件打开
// =============================================
function openDeskScreen(screenId, onOpen) {
  if (onOpen) onOpen();
  document.getElementById(screenId).classList.add('active');
}
['Gallery', 'Anniv', 'Diary'].forEach(function(n) {
  document.getElementById('back' + n).addEventListener('click', function() {
    document.getElementById('app' + n).classList.remove('active');
  });
});
function openSysBook(kind) {
  if (kind === 'diary') openDeskScreen('appDiary', function() { renderDiaryChars(); renderDiaries(); });
  else if (kind === 'gallery') openDeskScreen('appGallery', renderGallery);
}
function openAnnivScreen() { openDeskScreen('appAnniv', renderAnnivs); }

function deskDateText(t) {
  var d = new Date(t);
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

// 书架上固定有「日记」「相册」两本书（旧数据里没有就补上）
(function ensureSysBooks() {
  var area = document.querySelector('.notes-shelf-area');
  var have = {};
  area.querySelectorAll('.book').forEach(function(b) { if (b._sys) have[b._sys] = true; });
  var add = [
    { sys: 'diary', name: '日记', color: '#F3CFD8' },
    { sys: 'gallery', name: '相册', color: '#CFE0F1' }
  ].filter(function(b) { return !have[b.sys]; }).reverse();   // 倒着插到最前面，最后是「日记」「相册」的顺序
  if (!add.length) return;
  add.forEach(function(data) {
    var shelves = Array.from(area.querySelectorAll('.bookshelf'));
    var shelf = shelves.filter(function(s) { return s.querySelectorAll('.book-slot').length < 3; })[0];
    if (!shelf) { shelf = document.createElement('div'); shelf.className = 'bookshelf'; area.appendChild(shelf); }
    var slot = createBookSlot(data);
    shelf.insertBefore(slot, shelf.querySelector('.book-slot'));
    bindBookPointer(slot.querySelector('.book'));
  });
  syncShelves();
})();

// =============================================
// 相册：聊天、剧情、动态、收藏里的所有图片，新的在前
// =============================================
var galleryFilter = 'all';
function galleryItems() {
  var items = [];
  charList.forEach(function(c) {
    var name = c.charAlias || c.charName || '角色';
    [[chatHistories[c.id], '聊天'], [dramaHistories[c.id], '剧情']].forEach(function(x) {
      (x[0] || []).forEach(function(m) {
        if (m.imgSrc && !m.recalled) items.push({ src: m.imgSrc, kind: 'chat', time: m.time || 0, label: '与 ' + name + ' 的' + x[1] });
      });
    });
  });
  feedPosts.forEach(function(p) {
    var label = (p.author && p.author.name || '') + ' 的动态';
    (p.images || []).forEach(function(src) { items.push({ src: src, kind: 'feed', time: p.time || 0, label: label }); });
    (p.textImgs || []).forEach(function(t) { items.push({ text: t, kind: 'feed', time: p.time || 0, label: label }); });
  });
  loadFavs().forEach(function(f) {
    (f.images || []).forEach(function(src) { items.push({ src: src, kind: 'fav', time: f.savedAt || f.time || 0, label: '收藏' + (f.source ? ' · ' + f.source : '') }); });
  });
  return items.sort(function(a, b) { return b.time - a.time; });
}
function renderGallery() {
  var grid = document.getElementById('galleryGrid');
  grid.innerHTML = '';
  var items = galleryItems().filter(function(it) { return galleryFilter === 'all' || it.kind === galleryFilter; });
  if (!items.length) {
    grid.innerHTML = '<div class="auto-hint desk-empty">这里还没有图片</div>';
    return;
  }
  items.forEach(function(it) {
    var cell;
    if (it.text) {
      cell = createTextImgEl(it.text);   // 文字图：点开画成图片
    } else {
      cell = document.createElement('div');
      cell.className = 'gallery-cell';
      cell.style.backgroundImage = 'url(' + it.src + ')';
      cell.addEventListener('click', function() { openImgViewer(it.src, { source: it.label, noFav: it.kind === 'fav' }); });
    }
    cell.title = it.label + (it.time ? ' · ' + deskDateText(it.time) : '');
    grid.appendChild(cell);
  });
  var count = document.createElement('div');
  count.className = 'auto-hint desk-count';
  count.textContent = '共 ' + items.length + ' 张';
  grid.appendChild(count);
}
document.querySelectorAll('#galleryFilter .pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    galleryFilter = this.dataset.src;
    document.querySelectorAll('#galleryFilter .pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b === btn); });
    renderGallery();
  });
});
