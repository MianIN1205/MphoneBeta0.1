// 眠花糖机 — 书架：书本、新建 / 删除笔记本、拖动换位置、翻页阅读

// =============================================
// 笔记界面 — 三点菜单
// =============================================
var notesMoreBtn      = document.getElementById('notesMoreBtn');
var notesPopup        = document.getElementById('notesPopup');
var notesDelCancelBtn = document.getElementById('notesDelCancelBtn');

notesMoreBtn.addEventListener('click', function(e) {
  if (isDeleteMode) return;
  e.stopPropagation();
  notesPopup.classList.toggle('open');
});

document.addEventListener('click', function(e) {
  if (notesMoreBtn && !notesMoreBtn.closest('.notes-more-wrap').contains(e.target)) {
    notesPopup.classList.remove('open');
  }
});

// =============================================
// 笔记界面 — 删除模式
// =============================================
var isDeleteMode          = false;
var pendingDelSlot        = null;
var bookDelConfirmOverlay = document.getElementById('bookDelConfirmOverlay');
var bookDelOkBtn          = document.getElementById('bookDelOkBtn');
var bookDelCountdown      = document.getElementById('bookDelCountdown');
var delCountdownTimer     = null;

function enterDeleteMode() {
  isDeleteMode = true;
  document.querySelectorAll('.notes-shelf-area .bookshelf').forEach(function(s) { s.classList.add('delete-mode'); });
  notesDelCancelBtn.classList.add('visible');
  notesMoreBtn.classList.add('disabled');
}

function exitDeleteMode() {
  if (!isDeleteMode) return;
  isDeleteMode = false;
  document.querySelectorAll('.notes-shelf-area .bookshelf').forEach(function(s) { s.classList.remove('delete-mode'); });
  notesDelCancelBtn.classList.remove('visible');
  notesMoreBtn.classList.remove('disabled');
}

notesDelCancelBtn.addEventListener('click', function(e) { e.stopPropagation(); exitDeleteMode(); });

document.getElementById('notesBtnDelete').addEventListener('click', function(e) {
  e.stopPropagation();
  notesPopup.classList.remove('open');
  enterDeleteMode();
});

// =============================================
// 笔记界面 — 删除确认弹窗
// =============================================
function openDelConfirm(slot) {
  pendingDelSlot = slot;
  bookDelOkBtn.disabled = true;
  var count = 2;
  bookDelCountdown.textContent = '(' + count + ')';
  bookDelConfirmOverlay.classList.add('open');
  clearInterval(delCountdownTimer);
  delCountdownTimer = setInterval(function() {
    count--;
    if (count <= 0) {
      clearInterval(delCountdownTimer);
      bookDelOkBtn.disabled = false;
      bookDelCountdown.textContent = '';
    } else {
      bookDelCountdown.textContent = '(' + count + ')';
    }
  }, 1000);
}

document.getElementById('bookDelCancelBtn').addEventListener('click', function() {
  clearInterval(delCountdownTimer);
  bookDelConfirmOverlay.classList.remove('open');
  pendingDelSlot = null;
});

bookDelOkBtn.addEventListener('click', function() {
  if (this.disabled) return;
  if (pendingDelSlot && typeof bookOnShelfDelete === 'function') bookOnShelfDelete(pendingDelSlot);
  if (pendingDelSlot) { pendingDelSlot.remove(); pendingDelSlot = null; }
  clearInterval(delCountdownTimer);
  bookDelConfirmOverlay.classList.remove('open');
  syncShelves();
});

closeOnBackdrop(bookDelConfirmOverlay, function() {
  clearInterval(delCountdownTimer);
  bookDelConfirmOverlay.classList.remove('open');
  pendingDelSlot = null;
});

// =============================================
// 笔记界面 — 书本删除按钮（挂在 book-slot 上）
// =============================================
function attachDelBtn(slot) {
  var delBtn = document.createElement('button');
  delBtn.className = 'book-del-btn';
  delBtn.innerHTML = '&times;';
  delBtn.addEventListener('click', function(e) { e.stopPropagation(); openDelConfirm(slot); });
  slot.appendChild(delBtn);
}

document.querySelectorAll('.book-slot').forEach(attachDelBtn);

// =============================================
// 笔记界面 — 新建笔记
// =============================================
var bookNewOverlay    = document.getElementById('bookNewOverlay');
var bookNewPreview    = document.getElementById('bookNewPreview');
var bookNewName       = document.getElementById('bookNewName');
var bookColorSwatches = document.getElementById('bookColorSwatches');
var bookUploadBtns    = document.getElementById('bookUploadBtns');
var selectedBookColor = '#FFEBCD';
var selectedBookCover = '';   // 上传的封面图片（优先于颜色）
var coverExpandState  = null;

function applyBookCover(book, color, cover) {
  book.style.background = color || '#FFEBCD';
  if (cover) {
    book.style.backgroundImage    = 'url(' + cover + ')';
    book.style.backgroundSize     = 'cover';
    book.style.backgroundPosition = 'center';
  }
  book._cover = cover || '';
  book._color = color || '#FFEBCD';
}

function setCoverExpand(state) {
  if (coverExpandState === state) {
    coverExpandState = null;
    bookColorSwatches.classList.remove('active');
    bookUploadBtns.classList.remove('active');
  } else {
    coverExpandState = state;
    bookColorSwatches.classList.toggle('active', state === 'color');
    bookUploadBtns.classList.toggle('active', state === 'upload');
  }
}

document.getElementById('notesBtnNew').addEventListener('click', function(e) {
  e.stopPropagation();
  notesPopup.classList.remove('open');
  bookEditSlot = null;
  document.getElementById('bookNewTitle').textContent = '新建笔记';
  bookNewName.maxLength = 10;
  bookNewName.value = '';
  document.getElementById('bookNewNote').value = '';
  selectedBookColor = '#FFEBCD';
  selectedBookCover = '';
  bookNewPreview.style.background = selectedBookColor;
  coverExpandState = null;
  bookColorSwatches.classList.remove('active');
  bookUploadBtns.classList.remove('active');
  document.querySelectorAll('.color-swatch').forEach(function(s) {
    s.classList.toggle('selected', s.dataset.color === selectedBookColor);
  });
  bookNewOverlay.classList.add('open');
});

document.getElementById('bookCoverColor').addEventListener('click', function() { setCoverExpand('color'); });
document.getElementById('bookCoverUpload').addEventListener('click', function() {
  openImgPicker(function(src) {
    bookNewPreview.style.backgroundImage    = 'url(' + src + ')';
    bookNewPreview.style.backgroundSize     = 'cover';
    bookNewPreview.style.backgroundPosition = 'center';
    selectedBookCover = src;
  });
});

document.querySelectorAll('.color-swatch').forEach(function(swatch) {
  swatch.addEventListener('click', function() {
    selectedBookColor = this.dataset.color;
    selectedBookCover = '';
    bookNewPreview.style.background = selectedBookColor;
    document.querySelectorAll('.color-swatch').forEach(function(s) {
      s.classList.toggle('selected', s.dataset.color === selectedBookColor);
    });
  });
});

document.getElementById('bookNewCancel').addEventListener('click', function() {
  bookNewOverlay.classList.remove('open');
});

closeOnBackdrop(bookNewOverlay);

// 编辑一本书（长按卡片「编辑」、阅读器右上角 ✎）：用新建笔记的那个弹窗，名字、备注、封面都能改；导入的书连书单里的书名、封面一起改
var bookEditSlot = null;
function openBookEdit(slot) {
  var book = slot.querySelector('.book');
  bookEditSlot = slot;
  document.getElementById('bookNewTitle').textContent = '编辑';
  bookNewName.maxLength = 40;
  bookNewName.value = slot.querySelector('.book-label').textContent;
  document.getElementById('bookNewNote').value = book._note || '';
  selectedBookColor = book._color || '#FFEBCD';
  selectedBookCover = book._cover || '';
  bookNewPreview.style.cssText = '';
  applyBookCover(bookNewPreview, selectedBookColor, selectedBookCover);
  coverExpandState = null;
  bookColorSwatches.classList.remove('active');
  bookUploadBtns.classList.remove('active');
  document.querySelectorAll('.color-swatch').forEach(function(s) { s.classList.toggle('selected', !selectedBookCover && s.dataset.color === selectedBookColor); });
  bookNewOverlay.classList.add('open');
}
function saveBookEdit(slot, name) {
  var book = slot.querySelector('.book'), meta = book._novel && typeof bookMeta === 'function' ? bookMeta(book._novel) : null;
  slot.querySelector('.book-label').textContent = name;
  var tt = book.querySelector('.book-title');
  if (tt) { tt.textContent = name; tt.classList.toggle('on-img', !!selectedBookCover); }
  book.style.backgroundImage = '';
  applyBookCover(book, selectedBookColor, selectedBookCover);
  book._note = document.getElementById('bookNewNote').value.trim();
  if (meta) { meta.title = name; meta.cover = selectedBookCover; meta.color = selectedBookColor; saveBookMetas(); }
  syncShelves();
  if (meta && appReader.classList.contains('active')) renderReader();
  showToast('✓ 改好了', 'success');
}

document.getElementById('bookNewSave').addEventListener('click', function() {
  var name  = bookNewName.value.trim() || '-不知名-';
  var color = selectedBookColor;
  if (bookEditSlot) { saveBookEdit(bookEditSlot, name.slice(0, 40)); bookEditSlot = null; bookNewOverlay.classList.remove('open'); return; }

  var shelfArea = document.querySelector('.notes-shelf-area');
  var shelves   = Array.from(shelfArea.querySelectorAll('.bookshelf'));
  var totalSlots = 0;
  shelves.forEach(function(s) { totalSlots += s.querySelectorAll('.book-slot').length; });

  // 书架全满（8 层 24 本）时弹窗提示
  if (shelves.length >= SHELF_MAX && totalSlots >= SHELF_MAX * 3) {
    bookNewOverlay.classList.remove('open');
    document.getElementById('shelfFullOverlay').classList.add('open');
    return;
  }

  var slot = createBookSlot({ name: name, color: color, cover: selectedBookCover, note: document.getElementById('bookNewNote').value.trim() });
  var book = slot.querySelector('.book');

  // 找第一个未满的书架
  var inserted = false;
  shelves.forEach(function(shelf) {
    if (inserted) return;
    if (shelf.querySelectorAll('.book-slot').length < 3) {
      shelf.appendChild(slot); inserted = true;
    }
  });

  // 未找到未满书架 → 新建一层（已确保 < 4 层）
  if (!inserted) {
    var newShelf = document.createElement('div');
    newShelf.className = 'bookshelf';
    newShelf.appendChild(slot);
    shelfArea.appendChild(newShelf);
  }

  bindBookPointer(book);
  syncShelves();
  bookNewOverlay.classList.remove('open');
});

// =============================================
// 笔记界面 — 书架管理 syncShelves
// =============================================
// 生成一个书本槽：{ name, color, cover, pages, sys }
// sys = 'diary' | 'gallery'：书架上的「日记」「相册」，点开进对应界面，不能删除
var SYS_BOOK_EMBLEM = { diary: '📔', gallery: '🖼️' };
function createBookSlot(data) {
  var slot  = document.createElement('div');
  slot.className = 'book-slot' + (data.sys ? ' sys-book' : '');
  var book  = document.createElement('div');
  book.className = 'book';
  applyBookCover(book, data.color, data.cover);
  if (Array.isArray(data.pages)) book._bvPages = data.pages;
  if (data.novel) book._novel = data.novel;   // 导入的书（js/desk/books.js）
  book._note = data.note || '';
  // 精装书的样子（用户选的）：封面一圈细边框、书名横着印在封面上、底下垂一根小书签丝带
  var deco = document.createElement('span');
  deco.className = 'book-frame';
  book.appendChild(deco);
  if (!data.sys) {
    var tt = document.createElement('span');
    tt.className = 'book-title' + (data.cover ? ' on-img' : '');
    tt.textContent = data.name;
    book.appendChild(tt);
  }
  var rb = document.createElement('span');
  rb.className = 'book-ribbon';
  book.appendChild(rb);
  if (data.sys) {
    book._sys = data.sys;
    var emblem = document.createElement('span');
    emblem.className = 'book-emblem';
    emblem.textContent = SYS_BOOK_EMBLEM[data.sys] || '📘';
    book.appendChild(emblem);
  }
  var label = document.createElement('span');
  label.className = 'book-label';
  label.textContent = data.name;
  slot.appendChild(book);
  slot.appendChild(label);
  attachDelBtn(slot);
  return slot;
}

// 书架持久化：每层书架一个数组
function saveShelves() {
  var data = Array.from(document.querySelectorAll('.notes-shelf-area .bookshelf')).map(function(shelf) {
    return Array.from(shelf.querySelectorAll('.book-slot')).map(function(slot) {
      var book = slot.querySelector('.book');
      return {
        name:  slot.querySelector('.book-label').textContent,
        color: book._color || '#FFEBCD',
        cover: book._cover || '',
        pages: book._bvPages || [{}],
        sys:   book._sys || undefined,
        novel: book._novel || undefined,
        note:  book._note || undefined
      };
    });
  });
  mphoneStore.save('mphone_notes_shelves', data);
  mphoneStore.save('mphone_shelf_names', Array.from(document.querySelectorAll('.notes-shelf-area .bookshelf')).map(function(s) { return s._name || ''; }));
}

function loadShelves() {
  var data = mphoneStore.load('mphone_notes_shelves', null), names = mphoneStore.load('mphone_shelf_names', []) || [];
  if (!Array.isArray(data) || !data.length) return;
  var shelfArea = document.querySelector('.notes-shelf-area');
  shelfArea.innerHTML = '';
  data.forEach(function(books, i) {
    var shelf = document.createElement('div');
    shelf.className = 'bookshelf';
    shelf._name = names[i] || '';
    books.forEach(function(b) { shelf.appendChild(createBookSlot(b)); });
    shelfArea.appendChild(shelf);
  });
}

// 书架分类（用户要的）：每层左上角一个小标签写分类名，点一下就能改；书长按拖到别的层就算换了分类
var SHELF_MAX = 8;   // 最多 8 层、每层 3 本
function decorateShelf(shelf) {
  var tag = shelf.querySelector(':scope > .shelf-name');
  if (!tag) {
    tag = document.createElement('span');
    tag.className = 'shelf-name';
    tag.addEventListener('click', function(e) { e.stopPropagation(); renameShelf(shelf); });
    shelf.insertBefore(tag, shelf.firstChild);
  }
  tag.textContent = shelf._name || '+ 分类';
  tag.classList.toggle('empty', !shelf._name);
}
function renameShelf(shelf) {
  if (isDeleteMode) return;
  var tag = shelf.querySelector(':scope > .shelf-name');
  var inp = document.createElement('input');
  inp.className = 'shelf-name-input';
  inp.maxLength = 10;
  inp.value = shelf._name || '';
  inp.placeholder = '比如：小说、日常';
  tag.replaceWith(inp);
  inp.focus();
  var done = false;
  function finish() {
    if (done) return;
    done = true;
    shelf._name = inp.value.trim();
    inp.replaceWith(tag);
    syncShelves();
  }
  inp.addEventListener('blur', finish);
  inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
}
document.getElementById('notesBtnShelf').addEventListener('click', function(e) {
  e.stopPropagation();
  notesPopup.classList.remove('open');
  var area = document.querySelector('.notes-shelf-area');
  if (area.querySelectorAll('.bookshelf').length >= SHELF_MAX) { showToast('最多 ' + SHELF_MAX + ' 层', 'plain'); return; }
  var shelf = document.createElement('div');
  shelf.className = 'bookshelf';
  area.appendChild(shelf);
  decorateShelf(shelf);
  renameShelf(shelf);
});

function syncShelves() {
  var shelfArea = document.querySelector('.notes-shelf-area');

  // 移除空书架（最少保留 1 层）
  var shelves = Array.from(shelfArea.querySelectorAll('.bookshelf'));
  shelves.forEach(function(shelf) {
    var cur = Array.from(shelfArea.querySelectorAll('.bookshelf'));
    if (cur.length > 1 && shelf.querySelectorAll('.book-slot').length === 0 && !shelf._name && !shelf.querySelector('.shelf-name-input')) {
      shelf.remove();
    }
  });

  // 重新获取
  shelves = Array.from(shelfArea.querySelectorAll('.bookshelf'));
  shelves.forEach(decorateShelf);

  // 空提示：仅当唯一一层且为空时显示
  shelves.forEach(function(shelf) {
    var hint      = shelf.querySelector('.bookshelf-empty-hint');
    var slotCount = shelf.querySelectorAll('.book-slot').length;
    if (shelves.length === 1 && slotCount === 0) {
      if (!hint) {
        var h = document.createElement('div');
        h.className = 'bookshelf-empty-hint';
        h.innerHTML = '-书架还是空的哦-<br>-右上角···可以添加新本子-';
        shelf.appendChild(h);
      }
    } else {
      if (hint) hint.remove();
    }
  });

  // 若处于删除模式，补充 delete-mode class
  if (isDeleteMode) {
    shelves.forEach(function(s) { s.classList.add('delete-mode'); });
  }

  saveShelves();
}

// =============================================
// 书架满提示弹窗
// =============================================
var shelfFullOverlay = document.getElementById('shelfFullOverlay');
document.getElementById('shelfFullBtn').addEventListener('click', function() {
  shelfFullOverlay.classList.remove('open');
});
closeOnBackdrop(shelfFullOverlay);

// =============================================
// 笔记界面 — 书本跨书架漂浮拖拽
// =============================================
var _heldBook  = null;
var _heldSlot  = null;
var _dragGhost = null;
var _ghostOffX = 0;
var _ghostOffY = 0;
var _overSlot  = null;
var _overShelf = null;
var LONG_PRESS_MS  = 400;
var MOVE_CANCEL_SQ = 64;

function cleanupDragUI() {
  document.querySelectorAll('.book.drag-target').forEach(function(b) { b.classList.remove('drag-target'); });
  document.querySelectorAll('.bookshelf.drag-over').forEach(function(s) { s.classList.remove('drag-over'); });
}

function removeDragGhost() {
  if (_dragGhost && _dragGhost.parentNode) _dragGhost.parentNode.removeChild(_dragGhost);
  _dragGhost = null;
}

// 书是手指抬起时打开的，手机随后还会补一次「点击」，会落在刚打开的界面上（相册先弹出一张图）：吞掉紧跟着的那一次
function swallowNextClick() {
  var until = Date.now() + 600;
  function eat(ev) {
    document.removeEventListener('click', eat, true);
    if (Date.now() < until) { ev.stopPropagation(); ev.preventDefault(); }
  }
  document.addEventListener('click', eat, true);
  setTimeout(function() { document.removeEventListener('click', eat, true); }, 650);
}
function bindBookPointer(book) {
  book.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    var self = this;
    var pid  = e.pointerId;
    var sx   = e.clientX, sy = e.clientY;
    var holdTimer = null, dragMoved = false;   // 长按后没挪动 = 松手弹菜单（信息 / 编辑 / 删除，用户要的）；挪动了 = 拖去换位置

    holdTimer = setTimeout(function() {
      if (navigator.vibrate) navigator.vibrate(12);
      holdTimer = null;
      _heldBook = self;
      _heldSlot = self.closest('.book-slot');

      // 记录触点在书本内的偏移
      var rect = self.getBoundingClientRect();
      _ghostOffX = e.clientX - rect.left;
      _ghostOffY = e.clientY - rect.top;

      // 创建漂浮副本
      _dragGhost = document.createElement('div');
      _dragGhost.className = 'book';
      _dragGhost.style.cssText = [
        'position:fixed',
        'width:'  + rect.width  + 'px',
        'height:' + rect.height + 'px',
        'left:'   + (e.clientX - _ghostOffX) + 'px',
        'top:'    + (e.clientY - _ghostOffY) + 'px',
        'background:' + (self.style.background || '#FFEBCD'),
        'z-index:9999',
        'pointer-events:none',
        'opacity:0.90',
        'transform:scale(1.10) rotate(2deg)',
        'box-shadow:0 16px 36px rgba(0,0,0,0.28),0 4px 12px rgba(0,0,0,0.18)',
        'border-radius:4px 12px 12px 4px',
        'transition:none'
      ].join(';');
      document.body.appendChild(_dragGhost);

      // 原书半透明
      self.style.opacity = '0.32';

      try { self.setPointerCapture(pid); } catch(_) {}
    }, LONG_PRESS_MS);

    function onMove(ev) {
      if (holdTimer !== null) {
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (dx * dx + dy * dy > MOVE_CANCEL_SQ) {
          clearTimeout(holdTimer); holdTimer = null; finish();
        }
        return;
      }
      if (!_heldBook) return;
      if (!dragMoved && (ev.clientX - sx) * (ev.clientX - sx) + (ev.clientY - sy) * (ev.clientY - sy) > MOVE_CANCEL_SQ) dragMoved = true;

      // 漂浮副本跟随指针
      if (_dragGhost) {
        _dragGhost.style.left = (ev.clientX - _ghostOffX) + 'px';
        _dragGhost.style.top  = (ev.clientY - _ghostOffY) + 'px';
      }

      // 检测副本下方的目标
      var el     = document.elementFromPoint(ev.clientX, ev.clientY);
      var bUnder = el && el.closest ? el.closest('.book') : null;
      var sUnder = el && el.closest ? el.closest('.bookshelf') : null;

      cleanupDragUI();
      if (bUnder && bUnder !== _heldBook) {
        bUnder.classList.add('drag-target');
        _overSlot  = bUnder.closest('.book-slot');
        _overShelf = null;
      } else if (sUnder) {
        sUnder.classList.add('drag-over');
        _overSlot  = null;
        _overShelf = sUnder;
      } else {
        _overSlot  = null;
        _overShelf = null;
      }
    }

    function onUp() {
      // 短按：timer 未到期 → 打开笔记本（非删除模式）
      if (holdTimer !== null) {
        clearTimeout(holdTimer); holdTimer = null;
        if (!isDeleteMode) { swallowNextClick(); openBookViewer(self); }
        finish();
        return;
      }
      clearTimeout(holdTimer); holdTimer = null;
      var menuSlot = !dragMoved && !isDeleteMode && _heldSlot;

      if (_heldBook && _heldSlot && dragMoved) {
        if (_overSlot && _overSlot !== _heldSlot) {
          // 两个槽互换：用注释节点占位
          var hParent = _heldSlot.parentNode;
          var tParent = _overSlot.parentNode;
          var ph = document.createComment('ph');
          hParent.insertBefore(ph, _heldSlot);
          tParent.insertBefore(_heldSlot, _overSlot);
          hParent.insertBefore(_overSlot, ph);
          hParent.removeChild(ph);
        } else if (_overShelf && _overShelf !== _heldSlot.closest('.bookshelf') &&
                   _overShelf.querySelectorAll('.book-slot').length < 3) {
          // 移动整个槽到目标书架末尾
          _overShelf.appendChild(_heldSlot);
        }
      }

      // 恢复原书透明度
      if (_heldBook) _heldBook.style.opacity = '';
      removeDragGhost();
      cleanupDragUI();

      _heldBook  = null;
      _heldSlot  = null;
      _overSlot  = null;
      _overShelf = null;

      syncShelves();
      finish();
      if (menuSlot) { swallowNextClick(); openBookCard(menuSlot); }
    }

    function finish() {
      document.removeEventListener('pointermove',   onMove);
      document.removeEventListener('pointerup',     onUp);
      document.removeEventListener('pointercancel', onUp);
    }

    document.addEventListener('pointermove',   onMove);
    document.addEventListener('pointerup',     onUp);
    document.addEventListener('pointercancel', onUp);
  });
}

function initBookDrag() {
  document.querySelectorAll('.book').forEach(bindBookPointer);
}

loadShelves();
initBookDrag();
syncShelves();

// =============================================
// 笔记本阅读弹窗
// =============================================
var bookViewerBackdrop = document.getElementById('bookViewerBackdrop');
var bvSpine     = document.getElementById('bvSpine');
var bvPagesWrap = document.getElementById('bvPagesWrap');
var bvPagesTrack= document.getElementById('bvPagesTrack');
var bvPageNum   = document.getElementById('bvPageNum');
var bvPrevBtn   = document.getElementById('bvPrevBtn');
var bvNextBtn   = document.getElementById('bvNextBtn');
var currentBook      = null;
var currentPageIndex = 0;

var BV_DUR = '0.38s cubic-bezier(0.4,0,0.2,1)';
var bvAnimating = false;

function updatePageNav() {
  var total = currentBook ? currentBook._bvPages.length : 1;
  bvPageNum.textContent = (currentPageIndex + 1) + '/' + total;
  bvPrevBtn.classList.toggle('hidden', currentPageIndex === 0);
  bvNextBtn.classList.toggle('hidden', currentPageIndex >= total - 1);
}

// 将所有页面定位到以 refIndex 为基准的静止位置（无动画）
function positionPages(refIndex) {
  var pages = bvPagesTrack.querySelectorAll('.bv-page');
  pages.forEach(function(pg, i) {
    pg.style.transition = 'none';
    pg.style.transform  = 'translateX(' + ((i - refIndex) * 100) + '%)';
    pg.style.boxShadow  = '';
    pg.style.zIndex     = (i === refIndex) ? '1' : '0';
  });
}

function goToPage(index, animate) {
  var oldIndex = currentPageIndex;
  currentPageIndex = index;

  if (!animate || oldIndex === index) {
    positionPages(index);
    updatePageNav();
    return;
  }

  var direction = index > oldIndex ? 1 : -1; // 1=向后(向左滑), -1=向前(向右滑)
  var pages     = bvPagesTrack.querySelectorAll('.bv-page');

  // 先把所有页面静止在 oldIndex 基准位置
  pages.forEach(function(pg, i) {
    pg.style.transition = 'none';
    pg.style.transform  = 'translateX(' + ((i - oldIndex) * 100) + '%)';
    pg.style.boxShadow  = '';
    pg.style.zIndex     = '0';
  });

  // 强制重排后开始动画
  void bvPagesTrack.offsetWidth;

  bvAnimating = true;
  pages.forEach(function(pg, i) {
    pg.style.transition = 'transform ' + BV_DUR + ', box-shadow ' + BV_DUR;
    pg.style.transform  = 'translateX(' + ((i - index) * 100) + '%)';

    // 仅为正在移动的两页添加阴影：
    // 出页（oldIndex）在滑出方向的边缘加阴影
    // 入页（index）在滑入方向的边缘加阴影
    if (i === oldIndex) {
      pg.style.boxShadow = direction > 0
        ? '6px 0 18px rgba(0,0,0,0.16)'   // 向左滑出 → 右侧阴影
        : '-6px 0 18px rgba(0,0,0,0.16)';  // 向右滑出 → 左侧阴影
      pg.style.zIndex = '1';
    } else if (i === index) {
      pg.style.boxShadow = direction > 0
        ? '-6px 0 14px rgba(0,0,0,0.12)'   // 从右滑入 → 左侧阴影
        : '6px 0 14px rgba(0,0,0,0.12)';   // 从左滑入 → 右侧阴影
      pg.style.zIndex = '2';
    }
  });

  // 动画结束后清理阴影
  setTimeout(function() {
    bvAnimating = false;
    positionPages(index);
  }, 420);

  updatePageNav();
}

function renderBookPages() {
  bvPagesTrack.innerHTML = '';
  currentBook._bvPages.forEach(function() {
    var pg = document.createElement('div');
    pg.className = 'bv-page';
    bvPagesTrack.appendChild(pg);
  });
  positionPages(currentPageIndex);
  updatePageNav();
}

function openBookViewer(book) {
  // 「日记」「相册」这类系统书：直接打开对应界面
  if (book._sys && typeof openSysBook === 'function') { openSysBook(book._sys); return; }
  if (book._novel && typeof openReader === 'function') { openReader(book._novel); return; }   // 导入的书：打开阅读器
  currentBook = book;
  book._bvPages = book._bvPages || [{}];
  currentPageIndex = 0;
  bvSpine.style.background = book.style.background || '#FFEBCD';
  bookViewerBackdrop.classList.add('open');
  requestAnimationFrame(function() { renderBookPages(); });
}

function closeBookViewer() {
  bookViewerBackdrop.classList.remove('open');
  currentBook = null;
}

// 点击背景关闭
closeOnBackdrop(bookViewerBackdrop, closeBookViewer);

// 上一页
bvPrevBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  if (!bvAnimating && currentBook && currentPageIndex > 0) {
    goToPage(currentPageIndex - 1, true);
  }
});

// 下一页
bvNextBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  if (!bvAnimating && currentBook && currentPageIndex < currentBook._bvPages.length - 1) {
    goToPage(currentPageIndex + 1, true);
  }
});

// 新增页面（加号）
document.getElementById('bvAddBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  if (!currentBook || bvAnimating) return;
  currentBook._bvPages.push({});
  saveShelves();
  var newIndex = currentBook._bvPages.length - 1;
  var pg = document.createElement('div');
  pg.className = 'bv-page';
  // 先将新页静止在右侧（基于当前索引偏移）
  pg.style.transition = 'none';
  pg.style.transform  = 'translateX(' + ((newIndex - currentPageIndex) * 100) + '%)';
  pg.style.boxShadow  = '';
  pg.style.zIndex     = '0';
  bvPagesTrack.appendChild(pg);
  // 下一帧再滑入
  requestAnimationFrame(function() { goToPage(newIndex, true); });
});

// 长按一本书松手（用户要的）：一张小卡片，左边封面，右边名字、备注、一行小字（看到哪 / 几页），下面「编辑」「删除」；日记、相册只能看
function openBookCard(slot) {
  var book = slot.querySelector('.book');
  var ov = document.createElement('div');
  ov.className = 'mine-acc-overlay open';
  ov.innerHTML = '<div class="mine-acc-modal book-card"><div class="book-new-body"><div class="book-new-preview book-card-cover"></div>' +
    '<div class="book-card-info"><b></b><div class="book-card-note"></div><small></small></div></div>' +
    '<div class="mine-acc-actions"></div></div>';
  var cv = ov.querySelector('.book-card-cover');
  cv.style.cssText = book.style.cssText;
  cv.style.opacity = '';
  if (book._sys) cv.textContent = SYS_BOOK_EMBLEM[book._sys] || '';
  ov.querySelector('b').textContent = slot.querySelector('.book-label').textContent;
  var note = ov.querySelector('.book-card-note');
  note.textContent = book._sys ? '系统自带的书' : (book._note || '还没有备注');
  note.classList.toggle('empty', !book._note && !book._sys);
  ov.querySelector('small').textContent = typeof bookInfoLine === 'function' ? bookInfoLine(book) : '';
  var acts = ov.querySelector('.mine-acc-actions'), close = function() { ov.remove(); };
  (book._sys ? [['关闭', 'close', close]] : [['删除', 'close', function() { close(); openDelConfirm(slot); }], ['编辑', 'add', function() { close(); openBookEdit(slot); }]]).forEach(function(b) {
    var btn = document.createElement('button');
    btn.className = 'mine-acc-btn mine-acc-btn-' + b[1];
    btn.textContent = b[0];
    btn.addEventListener('click', b[2]);
    acts.appendChild(btn);
  });
  closeOnBackdrop(ov, close);
  (document.querySelector('.phone') || document.body).appendChild(ov);
}
