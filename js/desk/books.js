// 眠花糖机 — 书架里的书：导入小说（txt / md / Word / epub / PDF），阅读器（分页、目录、字号、记住读到哪）；
// 和角色「一起看」：聊天加号抽屉里选一本书，角色聊天时知道你们在看哪本、你看到哪一页（mphone_books、mphone_book_<id>、mphone_together）

var BOOK_MAX_CHARS = 3000000;   // 一本最多存多少字
var BOOK_PAGE_CHARS = 700;      // 一页大约多少字（在换行处断开）
var BOOK_COLORS = ['#f6d4dc', '#d8e6f6', '#e3dcf3', '#f8e6c8', '#d9eedd', '#f3dbe9', '#dfe9f0', '#efe2d6'];
var bookMetas = mphoneStore.load('mphone_books', []) || [];       // [{ id, title, chars, pos, addedAt, color }]
var bookTogether = mphoneStore.load('mphone_together', {}) || {}; // 角色id → { bookId, at }
function saveBookMetas() { mphoneStore.save('mphone_books', bookMetas); }
function saveBookTogether() { mphoneStore.save('mphone_together', bookTogether); }
function bookMeta(id) { return bookMetas.filter(function(b) { return b.id === id; })[0] || null; }
var bookTextCache = {};
function bookText(id) {
  if (!(id in bookTextCache)) bookTextCache[id] = mphoneStore.load('mphone_book_' + id, '') || '';
  return bookTextCache[id];
}

// ---------- 读文件 ----------
function bookHtmlToText(html) {
  return String(html || '').replace(/<head[\s\S]*?<\/head>/gi, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li|tr|section|blockquote)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, function(_, h) { return String.fromCodePoint(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function(_, d) { return String.fromCodePoint(+d); }).replace(/&amp;/g, '&');
}
function bookAttr(tag, name) { var m = tag.match(new RegExp('\\b' + name + '\\s*=\\s*"([^"]*)"')) || tag.match(new RegExp('\\b' + name + "\\s*=\\s*'([^']*)'")); return m ? m[1] : ''; }
function bookJoinPath(base, href) {
  var parts = (base + href).split('/'), out = [];
  parts.forEach(function(p) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); });
  return out.join('/');
}
function bookReadEpub(buf) {
  var dec = new TextDecoder();
  return zipReadEntry(buf, function(n) { return n === 'META-INF/container.xml'; }).then(function(b) {
    var opfPath = bookAttr(dec.decode(b).match(/<rootfile\b[^>]*>/) ? dec.decode(b).match(/<rootfile\b[^>]*>/)[0] : '', 'full-path');
    if (!opfPath) throw new Error('这个 epub 读不出目录');
    return zipReadEntry(buf, function(n) { return n === opfPath; }).then(function(ob) {
      var opf = dec.decode(ob), base = opfPath.replace(/[^\/]*$/, ''), manifest = {}, spine = [];
      var title = bookHtmlToText((opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/) || [])[1] || '').trim();
      (opf.match(/<item\b[^>]*>/g) || []).forEach(function(tag) { var id = bookAttr(tag, 'id'), href = bookAttr(tag, 'href'); if (id && href) manifest[id] = href; });
      (opf.match(/<itemref\b[^>]*>/g) || []).forEach(function(tag) { var r = bookAttr(tag, 'idref'); if (manifest[r]) spine.push(bookJoinPath(base, decodeURIComponent(manifest[r].split('#')[0]))); });
      var parts = [], chain = Promise.resolve();
      spine.forEach(function(p) {
        chain = chain.then(function() { return zipReadEntry(buf, function(n) { return n === p; }).then(function(x) { parts.push(bookHtmlToText(dec.decode(x))); }, function() {}); });
      });
      return chain.then(function() { return { title: title, text: parts.join('\n\n') }; });
    });
  });
}
function bookReadFile(file) {
  var name = file.name || '书', ext = (name.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase(), title = name.replace(/\.[^.]+$/, '');
  return file.arrayBuffer().then(function(buf) {
    if (ext === 'epub') return bookReadEpub(buf);
    if (ext === 'docx') return readDocxText(buf).then(function(t) { return { text: t }; });
    if (ext === 'pdf') return fileReadPdf(buf).then(function(t) { return { text: t }; });
    if (ext === 'txt' || ext === 'md' || ext === 'markdown' || /^text\//.test(file.type)) return { text: fileDecodeText(buf) };
    throw new Error('这种文件（.' + (ext || '?') + '）还读不了，可以导入 txt、epub、Word（.docx）、PDF');
  }).then(function(r) {
    var text = String(r.text || '').replace(/\r\n?/g, '\n').replace(/[ \t　]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) throw new Error(ext === 'pdf' ? '这个 PDF 里读不出文字，可能是扫描的图片' : '文件里没有文字');
    return { title: (r.title || title).slice(0, 40), text: text.slice(0, BOOK_MAX_CHARS), cut: text.length > BOOK_MAX_CHARS };
  });
}

// ---------- 导入：书架右上角 ··· →「导入图书」 ----------
var bookImportInput = document.getElementById('bookImportInput');
document.getElementById('notesBtnImport').addEventListener('click', function(e) {
  e.stopPropagation();
  notesPopup.classList.remove('open');
  if (document.querySelectorAll('.notes-shelf-area .book-slot').length >= SHELF_MAX * 3) { document.getElementById('shelfFullOverlay').classList.add('open'); return; }
  bookImportInput.value = '';
  bookImportInput.click();
});
bookImportInput.addEventListener('change', function() {
  var file = this.files && this.files[0];
  if (!file) return;
  showToast('正在读《' + file.name.replace(/\.[^.]+$/, '') + '》…', 'plain');
  bookReadFile(file).then(function(r) {
    var id = 'bk' + Date.now().toString(36);
    mphoneStore.save('mphone_book_' + id, r.text);
    bookTextCache[id] = r.text;
    var meta = { id: id, title: r.title, chars: r.text.length, pos: 0, addedAt: Date.now(), color: BOOK_COLORS[bookMetas.length % BOOK_COLORS.length] };
    bookMetas.push(meta);
    saveBookMetas();
    bookPutOnShelf(meta);
    showToast('✓ 《' + r.title + '》放上书架了' + (r.cut ? '（太长了，只存了前 300 万字）' : ''), 'success');
  }, function(err) { showToast('✗ ' + err.message, 'error'); });
});
// 放到第一个没满的书架上（和新建本子一样）
function bookPutOnShelf(meta) {
  var area = document.querySelector('.notes-shelf-area'), shelves = Array.from(area.querySelectorAll('.bookshelf'));
  var slot = createBookSlot({ name: meta.title, color: meta.color, novel: meta.id });
  var target = shelves.filter(function(s) { return s.querySelectorAll('.book-slot').length < 3; })[0];
  if (!target) { target = document.createElement('div'); target.className = 'bookshelf'; area.appendChild(target); }
  target.appendChild(slot);
  bindBookPointer(slot.querySelector('.book'));
  syncShelves();
}
// 书架上删掉这本书：书的文字、进度、一起看都清掉
function bookOnShelfDelete(slot) {
  var book = slot && slot.querySelector('.book'), id = book && book._novel;
  if (!id) return;
  bookMetas = bookMetas.filter(function(b) { return b.id !== id; });
  saveBookMetas();
  mphoneStore.remove('mphone_book_' + id);
  delete bookTextCache[id];
  Object.keys(bookTogether).forEach(function(k) { if (bookTogether[k].bookId === id) delete bookTogether[k]; });
  saveBookTogether();
}

// ---------- 分页、章节 ----------
var bookPagesCache = {};
function bookPages(id) {
  if (bookPagesCache[id]) return bookPagesCache[id];
  var text = bookText(id), pages = [0], i = 0, n = text.length;
  while (i < n) {
    var end = Math.min(n, i + BOOK_PAGE_CHARS);
    if (end < n) { var nl = text.indexOf('\n', end); if (nl >= 0 && nl - end < 260) end = nl + 1; }
    if (end >= n) break;
    pages.push(end); i = end;
  }
  return (bookPagesCache[id] = pages);
}
function bookPageOf(id, pos) {
  var pages = bookPages(id), lo = 0, hi = pages.length - 1;
  while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (pages[mid] <= pos) lo = mid; else hi = mid - 1; }
  return lo;
}
function bookPageText(id, page) {
  var pages = bookPages(id), text = bookText(id);
  return text.slice(pages[page], page + 1 < pages.length ? pages[page + 1] : text.length).trim();
}
var BOOK_CHAPTER_RE = /^\s*(第[0-9０-９零〇一二三四五六七八九十百千两]+[章节回卷集部篇幕话]|chapter\s*\d+|序章|序言|楔子|引子|番外|尾声|后记|终章)[^\n]{0,30}$/i;
function bookChapters(id) {
  var text = bookText(id), out = [], re = /[^\n]+/g, m;
  while ((m = re.exec(text))) {
    if (m[0].length <= 40 && BOOK_CHAPTER_RE.test(m[0])) out.push({ title: m[0].trim(), at: m.index });
    if (out.length > 3000) break;
  }
  return out;
}

// ---------- 阅读器 ----------
var appReader = document.getElementById('appReader');
var readerState = { id: '', page: 0, charId: '' };
var readerFont = mphoneStore.load('mphone_reader_font', 16) || 16;
function openReader(id, opts) {
  var meta = bookMeta(id);
  if (!meta) { showToast('这本书找不到了', 'error'); return; }
  readerState = { id: id, page: bookPageOf(id, meta.pos || 0), charId: (opts && opts.charId) || '' };
  appReader.classList.add('active');
  renderReader();
}
function renderReader() {
  var meta = bookMeta(readerState.id);
  if (!meta) return;
  var pages = bookPages(meta.id), page = Math.max(0, Math.min(pages.length - 1, readerState.page));
  readerState.page = page;
  document.getElementById('readerTitle').textContent = meta.title;
  var body = document.getElementById('readerPage');
  body.style.fontSize = readerFont + 'px';
  body.textContent = bookPageText(meta.id, page);
  body.scrollTop = 0;
  document.getElementById('readerProgress').textContent = (page + 1) + ' / ' + pages.length + ' · ' + Math.floor((page + 1) / pages.length * 100) + '%';
  document.getElementById('readerPrev').disabled = page === 0;
  document.getElementById('readerNext').disabled = page >= pages.length - 1;
  if (meta.pos !== pages[page]) { meta.pos = pages[page]; meta.readAt = Date.now(); saveBookMetas(); }
  // 一起看：下面一条小栏，TA 的头像 + 「聊这一页」「不看了」
  var bar = document.getElementById('readerTogether'), c = readerTogetherChar();
  bar.style.display = c ? '' : 'none';
  if (c) {
    paintCharAvatar(bar.querySelector('.reader-tg-av'), c);
    bar.querySelector('.reader-tg-name').textContent = '和「' + (c.charAlias || c.charName || 'TA') + '」一起看';
  }
}
function readerTogetherChar() {
  var cid = readerState.charId;
  if (!cid || !bookTogether[cid] || bookTogether[cid].bookId !== readerState.id) return null;
  return charList.filter(function(c) { return c.id === cid; })[0] || null;
}
function readerGo(d) {
  var n = bookPages(readerState.id).length, p = readerState.page + d;
  if (p < 0 || p >= n) return;
  readerState.page = p;
  renderReader();
}
document.getElementById('readerPrev').addEventListener('click', function() { readerGo(-1); });
document.getElementById('readerNext').addEventListener('click', function() { readerGo(1); });
document.getElementById('backReader').addEventListener('click', function() { appReader.classList.remove('active'); if (typeof setReaderChat === 'function') setReaderChat(false); });
// 点页面左边三分之一上一页、右边三分之一下一页；左右滑也能翻
(function() {
  var page = document.getElementById('readerPage'), sx = 0, sy = 0, moved = false;
  page.addEventListener('pointerdown', function(e) { sx = e.clientX; sy = e.clientY; moved = false; });
  page.addEventListener('pointermove', function(e) { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) moved = true; });
  page.addEventListener('pointerup', function(e) {
    var dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { readerGo(dx < 0 ? 1 : -1); return; }
    if (moved) return;
    // 点左边三分之一上一页，其余都是下一页（单手拇指够得着，用户要的）
    var r = page.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    if (x < 0.33) readerGo(-1); else readerGo(1);
  });
})();
[['readerFontDown', -1], ['readerFontUp', 1]].forEach(function(b) {
  document.getElementById(b[0]).addEventListener('click', function() {
    readerFont = Math.max(13, Math.min(24, readerFont + b[1]));
    mphoneStore.save('mphone_reader_font', readerFont);
    document.getElementById('readerPage').style.fontSize = readerFont + 'px';
  });
});
// 目录：认出来的章节标题，点一下跳过去；没认出来就按进度分十段
document.getElementById('readerTocBtn').addEventListener('click', function() {
  var id = readerState.id, list = document.getElementById('readerTocList'), chs = bookChapters(id), cur = bookPages(id)[readerState.page];
  list.innerHTML = '';
  if (!chs.length) {
    var n = bookText(id).length;
    for (var i = 0; i < 10; i++) chs.push({ title: (i * 10) + '%', at: Math.floor(n * i / 10) });
  }
  var curEl = null;
  chs.forEach(function(ch, i) {
    var row = document.createElement('div');
    row.className = 'reader-toc-row' + (ch.at <= cur && (!chs[i + 1] || chs[i + 1].at > cur) ? ' on' : '');
    row.textContent = ch.title;
    row.addEventListener('click', function() {
      readerState.page = bookPageOf(id, ch.at);
      document.getElementById('readerTocOverlay').classList.remove('open');
      renderReader();
    });
    if (row.classList.contains('on')) curEl = row;
    list.appendChild(row);
  });
  document.getElementById('readerTocOverlay').classList.add('open');
  if (curEl) setTimeout(function() { curEl.scrollIntoView({ block: 'center' }); }, 30);
});
closeOnBackdrop(document.getElementById('readerTocOverlay'));
document.getElementById('readerTocClose').addEventListener('click', function() { document.getElementById('readerTocOverlay').classList.remove('open'); });

// ---------- 一起看：聊天加号抽屉 →「一起看」 ----------
function togetherNote(char, text, ai) {
  var idx = findCharIdx(char.id);
  if (idx < 0) return;
  var m = { role: 'user', note: text, noteAI: ai, content: '', time: Date.now() };
  getChatHistory(idx).push(m);
  saveHistories();
  if (appChatRoom.classList.contains('active') && charList[openingChatCharIdx] === char) renderHistMsg(m, document.getElementById('chatMsgList'), document.getElementById('chatRoomEmpty'));
}
function openTogether(idx) {
  var char = charList[idx];
  if (!char) return;
  var cur = bookTogether[char.id];
  if (cur && bookMeta(cur.bookId)) { openReader(cur.bookId, { charId: char.id }); return; }   // 已经在一起看了：直接接着看
  if (!bookMetas.length) { showToast('书架里还没有书，先去书架右上角「导入图书」', 'plain'); return; }
  var list = document.getElementById('togetherPickList');
  list.innerHTML = '';
  bookMetas.slice().sort(function(a, b) { return (b.readAt || b.addedAt) - (a.readAt || a.addedAt); }).forEach(function(meta) {
    var row = document.createElement('div');
    row.className = 'together-book';
    row.innerHTML = '<span class="together-book-cover"></span><span class="together-book-info"><b></b><small></small></span>';
    row.querySelector('.together-book-cover').style.background = meta.color;
    row.querySelector('b').textContent = '《' + meta.title + '》';
    var pages = bookPages(meta.id);
    row.querySelector('small').textContent = meta.pos ? '看到 ' + Math.floor((bookPageOf(meta.id, meta.pos) + 1) / pages.length * 100) + '%' : '还没开始看 · ' + pages.length + ' 页';
    row.addEventListener('click', function() {
      document.getElementById('togetherPickOverlay').classList.remove('open');
      bookTogether[char.id] = { bookId: meta.id, at: Date.now() };
      saveBookTogether();
      togetherNote(char, '你邀请「' + (char.charAlias || char.charName || 'TA') + '」一起看《' + meta.title + '》', '（用户邀请你一起看《' + meta.title + '》，现在你们在一起看这本书）');
      openReader(meta.id, { charId: char.id });
    });
    list.appendChild(row);
  });
  document.getElementById('togetherPickOverlay').classList.add('open');
}
closeOnBackdrop(document.getElementById('togetherPickOverlay'));
document.getElementById('togetherPickCancel').addEventListener('click', function() { document.getElementById('togetherPickOverlay').classList.remove('open'); });
// ---------- 边看边聊（用户要的：以前要退出去发消息、再点一起看回来，很别扭） ----------
// 下面小栏点「聊天」展开一个小聊天面板：最近的聊天记录、输入框（回车发出去，和聊天窗口一样不叫 TA）、❄️ 请 TA 回（生成中变 ⏹）、📖 带上这一页。
// 发的就是聊天窗口里的消息：走聊天室那一套（appendUserMsg / sendMsg），面板只是照着聊天记录画一份；聊天窗口那边有变化（新消息、正在输入的预览）就跟着重画
var readerChatOpen = false, readerChatQuote = false, readerChatTimer = null;
function readerChatChar() { return readerTogetherChar(); }
// 确保聊天室停在这个角色的聊天窗口（一起看是从聊天里点进来的，一般已经是了）
function readerChatEnsureRoom(c) {
  var idx = findCharIdx(c.id);
  if (idx < 0) return false;
  if (!(appChatRoom.classList.contains('active') && openingChatCharIdx === idx)) {
    openingChatCharIdx = idx;
    renderRoomLists(idx);
    appChatRoom.classList.add('active');
  }
  if (currentCrSubView !== 'chat') switchChatRoomSubView('chat');
  return true;
}
function readerChatRender() {
  var box = document.getElementById('readerChatList'), c = readerChatChar();
  if (!readerChatOpen || !c) return;
  var idx = findCharIdx(c.id), hist = idx < 0 ? [] : getChatHistory(idx);
  box.innerHTML = '';
  hist.slice(-30).forEach(function(m) {
    if (m.recalled) return;
    if (m.note || m.pat) { var n = document.createElement('div'); n.className = 'reader-chat-note'; n.textContent = m.note || '拍了拍'; box.appendChild(n); return; }
    var mine = m.role === 'user', text = typeof msgPreviewText === 'function' ? msgPreviewText(m) : String(m.content || '');
    if (!mine) text = fillMacros(text, c);
    // 角色的 *动作* 拿出来变成小灰字，和聊天窗口一样
    var acts = [];
    if (!mine) text = text.replace(/\*([^*\n]+)\*/g, function(_, t) { acts.push(t.trim()); return ''; }).replace(/〔译〕[\s\S]*$/, '').trim();
    if (text) {
      var row = document.createElement('div');
      row.className = 'reader-chat-msg ' + (mine ? 'me' : 'ta');
      if (m.quote && mine) { var q = document.createElement('span'); q.className = 'reader-chat-q'; q.textContent = m.quote.author; row.appendChild(q); }
      row.appendChild(document.createTextNode(text));
      box.appendChild(row);
    }
    acts.forEach(function(t) { var a = document.createElement('div'); a.className = 'reader-chat-act'; a.textContent = t; box.appendChild(a); });
  });
  // 正在回：聊天窗口里冒出来的预览气泡照抄过来，最后放「正在输入」
  var g = typeof genStates !== 'undefined' && genStates[genKey(c, true)];
  if (g) {
    Array.prototype.forEach.call(document.querySelectorAll('#chatMsgList .cr-stream-preview .chat-msg-bubble'), function(b) {
      var t = b.textContent.trim();
      if (!t) return;
      var row = document.createElement('div'); row.className = 'reader-chat-msg ta'; row.textContent = t; box.appendChild(row);
    });
    var dots = document.createElement('div'); dots.className = 'reader-chat-msg ta reader-chat-typing'; dots.textContent = '正在输入…'; box.appendChild(dots);
  }
  box.scrollTop = box.scrollHeight;
  var ask = document.getElementById('readerChatAsk');
  ask.textContent = g ? '⏹' : '❄️';
  ask.setAttribute('aria-label', g ? '停止' : '请求回复');
}
function readerChatSoon() { clearTimeout(readerChatTimer); readerChatTimer = setTimeout(readerChatRender, 60); }
new MutationObserver(function() { readerTgTag(); if (readerChatOpen && appReader.classList.contains('active')) readerChatSoon(); })
  .observe(document.getElementById('chatMsgList'), { childList: true, subtree: true, characterData: true });
if (typeof syncGenBtn === 'function') { var _readerSyncGen = syncGenBtn; syncGenBtn = function() { _readerSyncGen(); readerChatSoon(); }; }
function setReaderChat(on) {
  readerChatOpen = !!on && !!readerChatChar();
  appReader.classList.toggle('chat-open', readerChatOpen);
  document.getElementById('readerTgChat').textContent = readerChatOpen ? '收起' : '聊天';
  if (readerChatOpen) { readerChatRender(); }
}
document.getElementById('readerTgChat').addEventListener('click', function() { setReaderChat(!readerChatOpen); });
document.getElementById('readerChatPage').addEventListener('click', function() {
  readerChatQuote = !readerChatQuote;
  this.classList.toggle('on', readerChatQuote);
  showToast(readerChatQuote ? '下一条会带上这一页' : '不带这一页了', 'plain');
});
function readerChatSend() {
  var inp = document.getElementById('readerChatInput'), text = inp.value.trim(), c = readerChatChar(), meta = bookMeta(readerState.id);
  if (!text || !c || !meta || !readerChatEnsureRoom(c)) return;
  if (readerChatQuote) {
    var t = bookPageText(meta.id, readerState.page).replace(/\s+/g, ' ');
    setQuote({ author: '《' + meta.title + '》第 ' + (readerState.page + 1) + ' 页', text: t.length > 60 ? t.slice(0, 60) + '…' : t });
    readerChatQuote = false;
    document.getElementById('readerChatPage').classList.remove('on');
  }
  appendUserMsg(text);
  var hist = getChatHistory(findCharIdx(c.id)), last = hist[hist.length - 1];
  if (last && last.role === 'user') { last.tg = meta.id; saveHistories(); readerTgPaintSoon(); }   // 一起看时聊的：回到聊天窗口用虚线框圈起来
  if (typeof markChatActive === 'function') markChatActive();
  inp.value = ''; inp.style.height = '';
  readerChatRender();
}
document.getElementById('readerChatInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); readerChatSend(); }
});
document.getElementById('readerChatInput').addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 72) + 'px'; });
document.getElementById('readerChatAsk').addEventListener('click', function() {
  var c = readerChatChar();
  if (!c || !readerChatEnsureRoom(c)) return;
  if (document.getElementById('readerChatInput').value.trim()) readerChatSend();   // 打了字没按回车，先发出去
  if (genHere()) { stopGenerating(); return; }
  readerTgPending = { charId: c.id, book: readerState.id, from: Date.now() };   // 这次 TA 回的也算一起看时聊的
  sendMsg('', true);
  readerChatRender();
});
document.getElementById('readerTgStop').addEventListener('click', function() {
  var meta = bookMeta(readerState.id), c = readerTogetherChar();
  if (!meta || !c) return;
  openConfirm('不和「' + (c.charAlias || c.charName) + '」一起看《' + meta.title + '》了？', function() {
    delete bookTogether[c.id];
    saveBookTogether();
    togetherNote(c, '你们不一起看《' + meta.title + '》了', '（你们暂时不一起看《' + meta.title + '》了）');
    setReaderChat(false);
    renderReader();
  });
});

// 角色知道你们在一起看哪本、你看到哪一页（聊天窗口的现实感知里带一段）
function togetherContextLine(char) {
  var t = char && bookTogether[char.id], meta = t && bookMeta(t.bookId);
  if (!meta) return '';
  var pages = bookPages(meta.id), page = bookPageOf(meta.id, meta.pos || 0);
  return '【一起看书】你和{{user}}正在一起看《' + meta.title + '》，{{user}}现在看到第 ' + (page + 1) + ' / ' + pages.length + ' 页（约 ' + Math.floor((page + 1) / pages.length * 100) + '%）。这一页写的是：\n「' + bookPageText(meta.id, page) + '」\n' +
    '聊天时可以自然地聊这一页的内容、人物和你的感受，像坐在一起看书的人；不用每次都提，不要整段复述，也不要说出后面还没看到的情节。';
}

// 换封面（目录弹窗里）：书架上那本也跟着换
document.getElementById('readerCoverBtn').addEventListener('click', function() {
  var meta = bookMeta(readerState.id);
  if (!meta) return;
  document.getElementById('bookEditOverlay').classList.remove('open');
  var book = Array.from(document.querySelectorAll('.notes-shelf-area .book')).filter(function(b) { return b._novel === meta.id; })[0];
  openImgPicker(function(src) {
    meta.cover = src; saveBookMetas();
    if (book) {
      applyBookCover(book, book._color, src);
      var t = book.querySelector('.book-title'); if (t) t.classList.add('on-img');
      syncShelves();
    }
    showToast('✓ 封面换好了', 'success');
  }, meta.cover ? { onReset: function() {
    meta.cover = ''; saveBookMetas();
    if (book) { book.style.backgroundImage = ''; applyBookCover(book, book._color, ''); var t = book.querySelector('.book-title'); if (t) t.classList.remove('on-img'); syncShelves(); }
  } } : null);
});

// 改书名（用户要的：导入的文件名有时候很长）：阅读器右上角 ✎ →「改书名」；书架上那本跟着改
function openBookRename() {
  var meta = bookMeta(readerState.id);
  if (!meta) return;
  document.getElementById('bookEditOverlay').classList.remove('open');
  var inp = document.getElementById('bookRenameInput');
  inp.value = meta.title;
  document.getElementById('bookRenameOverlay').classList.add('open');
  setTimeout(function() { inp.focus(); inp.select(); }, 50);
}
function doBookRename() {
  var meta = bookMeta(readerState.id), n = document.getElementById('bookRenameInput').value.trim().slice(0, 40);
  if (!meta) return;
  if (!n) { shakeEl(document.getElementById('bookRenameInput')); return; }
  meta.title = n; saveBookMetas();
  Array.prototype.forEach.call(document.querySelectorAll('.notes-shelf-area .book'), function(b) {
    if (b._novel !== meta.id) return;
    var t = b.querySelector('.book-title'); if (t) t.textContent = n;
    var l = b.parentNode && b.parentNode.querySelector('.book-label'); if (l) l.textContent = n;
  });
  if (typeof saveShelves === 'function') saveShelves();
  document.getElementById('bookRenameOverlay').classList.remove('open');
  renderReader();
  showToast('✓ 改好了', 'success');
}
document.getElementById('readerRenameBtn').addEventListener('click', openBookRename);
document.getElementById('readerEditBtn').addEventListener('click', function() { document.getElementById('bookEditOverlay').classList.add('open'); });
document.getElementById('bookEditClose').addEventListener('click', function() { document.getElementById('bookEditOverlay').classList.remove('open'); });
closeOnBackdrop(document.getElementById('bookEditOverlay'));
document.getElementById('bookRenameOk').addEventListener('click', doBookRename);
document.getElementById('bookRenameInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); doBookRename(); } });
document.getElementById('bookRenameCancel').addEventListener('click', function() { document.getElementById('bookRenameOverlay').classList.remove('open'); });
closeOnBackdrop(document.getElementById('bookRenameOverlay'));

// ---------- 一起看时聊的，回到聊天窗口用虚线框圈起来（用户要的） ----------
// 在阅读器里发的消息、在阅读器里点 ❄️ 回的消息记 m.tg = 书的 id；聊天列表里连着的这几条外面画一个虚线框，左上角写「一起看《书名》时聊的」
var readerTgPending = null;   // { charId, book, from }：这次请 TA 回的，回来的消息都记上
function readerTgTag() {
  var p = readerTgPending;
  if (!p) return;
  var idx = findCharIdx(p.charId);
  if (idx < 0) { readerTgPending = null; return; }
  var changed = false;
  getChatHistory(idx).forEach(function(m) { if (m.role === 'assistant' && !m.tg && m.time >= p.from) { m.tg = p.book; changed = true; } });
  if (changed) { saveHistories(); readerTgPaintSoon(); }
  if (!genStates[genKey(charList[idx], true)]) readerTgPending = null;   // 回完了
}
var readerTgRaf = 0;
function readerTgPaintSoon() { if (!readerTgRaf) readerTgRaf = requestAnimationFrame(function() { readerTgRaf = 0; readerTgPaint(); }); }
function readerTgPaint() {
  var list = document.getElementById('chatMsgList');
  if (!list) return;
  var layer = list.querySelector(':scope > .cr-tg-layer');
  list.querySelectorAll('.cr-tg-start, .cr-tg-end').forEach(function(el) { el.classList.remove('cr-tg-start', 'cr-tg-end'); });
  var groups = [], g = null;
  Array.prototype.forEach.call(list.children, function(el) {
    if (el === layer) return;
    var m = el._msg;
    if (m) {
      if (m.tg && g && g.book === m.tg) { g.last = el; return; }
      g = m.tg ? { book: m.tg, first: el, last: el } : null;
      if (g) groups.push(g);
      return;
    }
    if (g && el.matches('.cr-action-note, .cr-msg-stamp')) g.last = el;   // 跟在后面的动作小字、小时间也框进去
  });
  if (!groups.length) { if (layer) layer.remove(); return; }
  if (!layer) { layer = document.createElement('div'); layer.className = 'cr-tg-layer'; list.appendChild(layer); }
  groups.forEach(function(gr) { gr.first.classList.add('cr-tg-start'); gr.last.classList.add('cr-tg-end'); });
  layer.innerHTML = '';
  groups.forEach(function(gr) {
    var top = gr.first.offsetTop - 22, bottom = gr.last.offsetTop + gr.last.offsetHeight + 8;
    var box = document.createElement('div');
    box.className = 'cr-tg-box';
    box.style.top = top + 'px';
    box.style.height = Math.max(20, bottom - top) + 'px';
    var meta = bookMeta(gr.book), lab = document.createElement('span');
    lab.className = 'cr-tg-label';
    lab.textContent = '📖 一起看' + (meta ? '《' + meta.title + '》' : '') + '时聊的';
    box.appendChild(lab);
    layer.appendChild(box);
  });
}
(function() {
  var list = document.getElementById('chatMsgList');
  new MutationObserver(function(ms) {
    if (ms.some(function(m) { return m.removedNodes.length || Array.prototype.some.call(m.addedNodes, function(n) { return !(n.classList && n.classList.contains('cr-tg-layer')); }); })) readerTgPaintSoon();
  }).observe(list, { childList: true });
  window.addEventListener('resize', readerTgPaintSoon);
  list.addEventListener('load', readerTgPaintSoon, true);   // 图片加载完高度变了
  // 从阅读器回到聊天窗口时重新量一下（藏着的时候量不出位置）
  new MutationObserver(function() { if (!appReader.classList.contains('active')) readerTgPaintSoon(); }).observe(appReader, { attributes: true, attributeFilter: ['class'] });
})();
