// 眠花糖机 — 笔记界面 — 三点菜单

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
  if (pendingDelSlot) { pendingDelSlot.remove(); pendingDelSlot = null; }
  clearInterval(delCountdownTimer);
  bookDelConfirmOverlay.classList.remove('open');
  syncShelves();
});

bookDelConfirmOverlay.addEventListener('click', function(e) {
  if (e.target === bookDelConfirmOverlay) {
    clearInterval(delCountdownTimer);
    bookDelConfirmOverlay.classList.remove('open');
    pendingDelSlot = null;
  }
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
  bookNewName.value = '';
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

bookNewOverlay.addEventListener('click', function(e) {
  if (e.target === bookNewOverlay) bookNewOverlay.classList.remove('open');
});

document.getElementById('bookNewSave').addEventListener('click', function() {
  var name  = bookNewName.value.trim() || '-不知名-';
  var color = selectedBookColor;

  var shelfArea = document.querySelector('.notes-shelf-area');
  var shelves   = Array.from(shelfArea.querySelectorAll('.bookshelf'));
  var totalSlots = 0;
  shelves.forEach(function(s) { totalSlots += s.querySelectorAll('.book-slot').length; });

  // 4层书架全满（12本）时弹窗提示
  if (shelves.length >= 4 && totalSlots >= 12) {
    bookNewOverlay.classList.remove('open');
    document.getElementById('shelfFullOverlay').classList.add('open');
    return;
  }

  var slot = createBookSlot({ name: name, color: color, cover: selectedBookCover });
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
// 生成一个书本槽：{ name, color, cover, pages }
function createBookSlot(data) {
  var slot  = document.createElement('div');
  slot.className = 'book-slot';
  var book  = document.createElement('div');
  book.className = 'book';
  applyBookCover(book, data.color, data.cover);
  if (Array.isArray(data.pages)) book._bvPages = data.pages;
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
        pages: book._bvPages || [{}]
      };
    });
  });
  mphoneStore.save('mphone_notes_shelves', data);
}

function loadShelves() {
  var data = mphoneStore.load('mphone_notes_shelves', null);
  if (!Array.isArray(data) || !data.length) return;
  var shelfArea = document.querySelector('.notes-shelf-area');
  shelfArea.innerHTML = '';
  data.forEach(function(books) {
    var shelf = document.createElement('div');
    shelf.className = 'bookshelf';
    books.forEach(function(b) { shelf.appendChild(createBookSlot(b)); });
    shelfArea.appendChild(shelf);
  });
}

function syncShelves() {
  var shelfArea = document.querySelector('.notes-shelf-area');

  // 移除空书架（最少保留 1 层）
  var shelves = Array.from(shelfArea.querySelectorAll('.bookshelf'));
  shelves.forEach(function(shelf) {
    var cur = Array.from(shelfArea.querySelectorAll('.bookshelf'));
    if (cur.length > 1 && shelf.querySelectorAll('.book-slot').length === 0) {
      shelf.remove();
    }
  });

  // 重新获取
  shelves = Array.from(shelfArea.querySelectorAll('.bookshelf'));

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
shelfFullOverlay.addEventListener('click', function(e) {
  if (e.target === shelfFullOverlay) shelfFullOverlay.classList.remove('open');
});

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

function bindBookPointer(book) {
  book.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    var self = this;
    var pid  = e.pointerId;
    var sx   = e.clientX, sy = e.clientY;
    var holdTimer = null;

    holdTimer = setTimeout(function() {
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
        if (!isDeleteMode) openBookViewer(self);
        finish();
        return;
      }
      clearTimeout(holdTimer); holdTimer = null;

      if (_heldBook && _heldSlot) {
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
bookViewerBackdrop.addEventListener('click', function(e) {
  if (e.target === bookViewerBackdrop) closeBookViewer();
});

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
