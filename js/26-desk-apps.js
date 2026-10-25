// 眠花糖机 — 书架上的「相册」「日记」，以及纪念日与日程

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

// =============================================
// 纪念日与日程
// · 自动：和每个角色认识第几天（从第一条消息算起）
// · 自己添加：纪念日（可每年重复，如生日）、日程（某天某时要做的事）
// · 置顶：在列表里排最前；外显：显示在桌面的纪念日小组件上
// =============================================
var annivs = mphoneStore.load('mphone_annivs', []);              // [{ id, kind: 'anniv' | 'event', title, date, time, yearly, pin, show }]
var annivFlags = mphoneStore.load('mphone_anniv_flags', {});     // 自动条目的置顶 / 外显：{ 'auto_角色id': { pin, show } }
var DAY_MS = 86400000;
function dayStart(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
function parseYmd(s) { var p = String(s).split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1).getTime(); }
function saveAnnivs() {
  mphoneStore.save('mphone_annivs', annivs);
  mphoneStore.save('mphone_anniv_flags', annivFlags);
  if (typeof renderWidgets === 'function') renderWidgets();
}

// 每一条：{ id, kind, title, date, time, big, note, unit, past, today, order, pin, show, a（自己添加的原始数据）, charId }
function annivEntries() {
  var today = dayStart(Date.now()), list = [];
  charList.forEach(function(c) {
    var first = 0;
    [chatHistories[c.id], dramaHistories[c.id]].forEach(function(h) {
      (h || []).forEach(function(m) { if (m.time && (!first || m.time < first)) first = m.time; });
    });
    if (!first) return;
    var id = 'auto_' + c.id, fl = annivFlags[id] || {};
    list.push({ id: id, kind: 'anniv', auto: true, charId: c.id, title: '和 ' + (c.charAlias || c.charName || '角色') + ' 认识',
      date: first, note: '第', big: Math.round((today - dayStart(first)) / DAY_MS) + 1, unit: '天', order: 0, pin: !!fl.pin, show: !!fl.show });
  });
  annivs.forEach(function(a) {
    var t = parseYmd(a.date), e = { id: a.id, kind: a.kind || 'anniv', a: a, title: a.title, date: t, time: a.time || '', pin: !!a.pin, show: !!a.show, unit: '天' };
    if (e.kind === 'anniv' && a.yearly) {
      var d = new Date(t), y = new Date(today).getFullYear();
      var next = new Date(y, d.getMonth(), d.getDate()).getTime();
      if (next < today) next = new Date(y + 1, d.getMonth(), d.getDate()).getTime();
      var left = Math.round((next - today) / DAY_MS);
      Object.assign(e, left === 0 ? { today: true, note: '', big: '🎉', unit: '就是今天' } : { note: '还有', big: left }, { order: 1 + left });
    } else if (t > today) {
      var l2 = Math.round((t - today) / DAY_MS);
      Object.assign(e, { note: '还有', big: l2, order: 1 + l2 });
    } else if (t === today) {
      Object.assign(e, e.kind === 'event'
        ? { today: true, note: '今天', big: e.time || '', unit: '' }
        : { note: '第', big: 1, unit: '天' }, { order: 0.5 });
    } else {
      var gone = Math.round((today - t) / DAY_MS);
      Object.assign(e, e.kind === 'event' ? { past: true, note: '已过去', big: gone } : { note: '已经', big: gone }, { order: 100000 + gone });
    }
    list.push(e);
  });
  // 置顶在前；其次「认识第几天」、今天和快到的日子（越近越前）；已经过去的在最后
  return list.sort(function(x, y) { return (y.pin - x.pin) || (x.order - y.order); });
}
// 小组件上显示的：设了外显的；都没设就用置顶的；还没有就用排在最前的一条
function annivWidgetItems() {
  var all = annivEntries();
  var shown = all.filter(function(e) { return e.show; });
  if (!shown.length) shown = all.filter(function(e) { return e.pin; });
  if (!shown.length) shown = all.slice(0, 1);
  return shown;
}
function annivSetFlag(e, key) {
  if (e.a) e.a[key] = !e.a[key];
  else { annivFlags[e.id] = Object.assign({}, annivFlags[e.id]); annivFlags[e.id][key] = !annivFlags[e.id][key]; }
  saveAnnivs();
  renderAnnivs();
}

function renderAnnivs() {
  var box = document.getElementById('annivList');
  box.innerHTML = '';
  var list = annivEntries();
  if (!list.length) {
    box.innerHTML = '<div class="auto-hint desk-empty">还没有纪念日和日程。和角色聊过天就会自动出现「认识第几天」，也可以点右上角「添加」。</div>';
    return;
  }
  list.forEach(function(e) {
    var card = document.createElement('div');
    card.className = 'anniv-card' + (e.today ? ' today' : '') + (e.past ? ' past' : '') + (e.pin ? ' pinned' : '');
    var main = document.createElement('div');
    main.className = 'anniv-main';
    var info = document.createElement('div');
    info.className = 'anniv-info';
    var t = document.createElement('div');
    t.className = 'anniv-title';
    t.textContent = (e.kind === 'event' ? '🗓 ' : '') + e.title + (e.a && e.a.yearly ? ' 🔁' : '');
    var d = document.createElement('div');
    d.className = 'anniv-date';
    d.textContent = deskDateText(e.date) + (e.time ? ' ' + e.time : '');
    info.appendChild(t);
    info.appendChild(d);
    var num = document.createElement('div');
    num.className = 'anniv-num';
    num.innerHTML = '<small></small><b></b><small></small>';
    num.children[0].textContent = e.note || '';
    num.children[1].textContent = e.big;
    num.children[2].textContent = e.unit || '';
    main.appendChild(info);
    main.appendChild(num);
    card.appendChild(main);

    var acts = document.createElement('div');
    acts.className = 'anniv-acts';
    [['pin', '📌 置顶'], ['show', '👁 外显']].forEach(function(x) {
      var b = document.createElement('button');
      b.className = 'anniv-flag' + (e[x[0]] ? ' on' : '');
      b.textContent = x[1];
      b.addEventListener('click', function() { annivSetFlag(e, x[0]); });
      acts.appendChild(b);
    });
    if (e.a) {
      var del = document.createElement('button');
      del.className = 'anniv-flag anniv-del';
      del.textContent = '删除';
      del.addEventListener('click', function() {
        openPfEntryDel('删除「' + e.a.title + '」？', function() {
          annivs = annivs.filter(function(x) { return x !== e.a; });
          saveAnnivs();
          renderAnnivs();
        });
      });
      acts.appendChild(del);
    }
    card.appendChild(acts);
    box.appendChild(card);
  });
}

// 添加纪念日 / 日程
var annivOverlay = document.getElementById('annivOverlay');
var annivKind = 'anniv';
function setAnnivKind(kind) {
  annivKind = kind;
  document.querySelectorAll('#annivKindRow .pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.kind === kind); });
  document.getElementById('annivTime').style.display = kind === 'event' ? '' : 'none';
  document.getElementById('annivYearlyRow').style.display = kind === 'anniv' ? '' : 'none';
  document.getElementById('annivTitle').placeholder = kind === 'event' ? '比如：一起看电影、交作业' : '比如：第一次见面、TA 的生日';
}
document.querySelectorAll('#annivKindRow .pf-radio-btn').forEach(function(b) {
  b.addEventListener('click', function() { setAnnivKind(this.dataset.kind); });
});
document.getElementById('annivAddBtn').addEventListener('click', function() {
  document.getElementById('annivTitle').value = '';
  var now = new Date();
  document.getElementById('annivDate').value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  document.getElementById('annivTime').value = '';
  document.getElementById('annivYearly').checked = false;
  setAnnivKind('anniv');
  annivOverlay.classList.add('open');
});
document.getElementById('annivCancel').addEventListener('click', function() { annivOverlay.classList.remove('open'); });
annivOverlay.addEventListener('click', function(e) { if (e.target === annivOverlay) annivOverlay.classList.remove('open'); });
document.getElementById('annivSave').addEventListener('click', function() {
  var titleEl = document.getElementById('annivTitle'), dateEl = document.getElementById('annivDate');
  if (!titleEl.value.trim()) { shakeEl(titleEl); return; }
  if (!dateEl.value) { shakeEl(dateEl); return; }
  annivs.push({
    id: 'an' + Date.now().toString(36), kind: annivKind, title: titleEl.value.trim(), date: dateEl.value,
    time: annivKind === 'event' ? document.getElementById('annivTime').value : '',
    yearly: annivKind === 'anniv' && document.getElementById('annivYearly').checked, pin: false, show: false
  });
  saveAnnivs();
  annivOverlay.classList.remove('open');
  renderAnnivs();
});

// =============================================
// 日记：角色以第一人称写今天的日记（参考最近的聊天和动态）
// =============================================
var diaries = mphoneStore.load('mphone_diaries', []);   // [{ id, charId, time, title, text }]
var diaryCharId = '';
var diaryReading = null;

function renderDiaryChars() {
  var row = document.getElementById('diaryCharRow');
  row.innerHTML = '';
  if (!charList.some(function(c) { return c.id === diaryCharId; })) diaryCharId = charList[0] ? charList[0].id : '';
  charList.forEach(function(c) {
    var chip = document.createElement('span');
    chip.className = 'feed-visible-chip' + (c.id === diaryCharId ? ' on' : '');
    chip.textContent = c.charAlias || c.charName || '未命名';
    chip.addEventListener('click', function() { diaryCharId = c.id; renderDiaryChars(); renderDiaries(); });
    row.appendChild(chip);
  });
}
function renderDiaries() {
  var box = document.getElementById('diaryList');
  box.innerHTML = '';
  var mine = diaries.filter(function(d) { return d.charId === diaryCharId; }).sort(function(a, b) { return b.time - a.time; });
  if (!mine.length) {
    box.innerHTML = '<div class="auto-hint desk-empty">TA 还没有写过日记</div>';
    return;
  }
  mine.forEach(function(d) {
    var card = document.createElement('div');
    card.className = 'diary-card';
    var date = document.createElement('div');
    date.className = 'diary-date';
    date.textContent = deskDateText(d.time);
    var title = document.createElement('div');
    title.className = 'diary-title';
    title.textContent = d.title;
    var pre = document.createElement('div');
    pre.className = 'diary-preview';
    pre.textContent = d.text;
    card.appendChild(date);
    card.appendChild(title);
    card.appendChild(pre);
    card.addEventListener('click', function() { openDiary(d); });
    box.appendChild(card);
  });
}
var diaryReadOverlay = document.getElementById('diaryReadOverlay');
var diaryDelBtn = document.getElementById('diaryReadDel');
function openDiary(d) {
  diaryReading = d;
  var c = charList[findCharIdx(d.charId)] || {};
  document.getElementById('diaryReadTitle').textContent = d.title;
  document.getElementById('diaryReadMeta').textContent = (c.charAlias || c.charName || '') + ' · ' + deskDateText(d.time);
  document.getElementById('diaryReadText').textContent = d.text;
  diaryDelBtn.textContent = '删除';
  diaryReadOverlay.classList.add('open');
}
document.getElementById('diaryReadClose').addEventListener('click', function() { diaryReadOverlay.classList.remove('open'); });
diaryReadOverlay.addEventListener('click', function(e) { if (e.target === diaryReadOverlay) diaryReadOverlay.classList.remove('open'); });
// 删除要点两次，免得误删
diaryDelBtn.addEventListener('click', function() {
  if (this.textContent !== '确认删除') { this.textContent = '确认删除'; return; }
  diaries = diaries.filter(function(x) { return x !== diaryReading; });
  mphoneStore.save('mphone_diaries', diaries);
  diaryReadOverlay.classList.remove('open');
  renderDiaries();
});

// 让角色写一篇今天的日记，存进「日记」；日记里藏一句当天的要点，记成一条长期记忆（来源「日记」）
function writeCharDiary(idx) {
  var char = charList[idx], name = char.charAlias || char.charName || '角色';
  var msgs = charContextMsgs(idx).concat([{ role: 'system', content:
    '【写日记】现在是 ' + nowText() + '。请你以「' + name + '」的身份，用第一人称写一篇今天的私人日记：可以写今天发生的事、和用户的聊天、心情和没说出口的想法，口吻符合人设，200～400 字。' +
    '第一行只写日记标题（不超过 12 个字，不加书名号和「标题」二字），然后空一行写正文。只输出日记本身。' +
    '日记写完后另起一行写 <要点>用一句话概括今天最值得记住的事（30 字以内）</要点>，这一行不会出现在日记里。' }]);
  return callApiOnce(msgs).then(function(text) {
    var point = '';
    text = String(text).replace(/<要点>([\s\S]*?)<\/要点>/g, function(_, s) { point = s.replace(/\s+/g, ' ').trim(); return ''; });
    var lines = memExtractTags(char, text).replace(/\r/g, '').split('\n');
    var title = stripQuotes(lines.shift().replace(/^(标题|题目)[:：]\s*/, '').replace(/^[#《「\s]+|[》」\s]+$/g, '')) || '无题';
    var body = lines.join('\n').trim() || title;
    var d = { id: 'dy' + Date.now().toString(36), charId: char.id, time: Date.now(), title: title.slice(0, 24), text: body };
    diaries.push(d);
    mphoneStore.save('mphone_diaries', diaries);
    var cfg = memCfgOf(char), day = new Date(d.time);
    if (point && cfg.on && cfg.write && cfg.types.long) {
      memAdd(char, { type: 'long', text: (day.getMonth() + 1) + '月' + day.getDate() + '日的日记：' + point, source: 'diary' });
    }
    return d;
  });
}

var diaryWriteBtn = document.getElementById('diaryWriteBtn');
diaryWriteBtn.addEventListener('click', function() {
  var idx = findCharIdx(diaryCharId);
  if (idx < 0 || diaryWriteBtn.disabled) return;
  var char = charList[idx], name = char.charAlias || char.charName || '角色';
  diaryWriteBtn.disabled = true;
  diaryWriteBtn.textContent = name + ' 正在写…';
  writeCharDiary(idx).then(function(d) {
    renderDiaries();
    openDiary(d);
  }).catch(function(err) {
    showToast('✗ 没写成：' + err.message, 'error');
  }).then(function() {
    diaryWriteBtn.disabled = false;
    diaryWriteBtn.textContent = '让 TA 写今天的日记';
  });
});

// 每天定时写日记（角色设置「扩展」页）：到点就写；错过的时间打开后补写当天的一篇（不补前几天的）。只在小手机开着时运行
var diaryAutoDone = mphoneStore.load('mphone_diary_auto', {});   // 角色id → 写过的时段 ['2026-10-25 21:30', …]
var diaryAutoBusy = false;
var diaryAutoRetry = {};   // 角色id → 失败后下次再试的时间
function diaryDayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function diaryTick() {
  if (diaryAutoBusy || !charList.length) return;
  var api = getApiCfg();
  if (!api.url || !api.key || !api.model) return;
  var now = new Date(), day = diaryDayKey(now);
  for (var i = 0; i < charList.length; i++) {
    var c = charList[i], cfg = Object.assign({}, DEFAULT_DIARY_CFG, c.diaryCfg || {});
    if (!cfg.on || !c.id || (diaryAutoRetry[c.id] || 0) > Date.now()) continue;
    var done = diaryAutoDone[c.id] || [];
    // 今天已经到点、还没写过的时段；同时错过两个只写一篇
    var due = (cfg.times || []).filter(function(t) { return /^\d{1,2}:\d{2}$/.test(t || ''); }).map(function(t) {
      return day + ' ' + t.padStart(5, '0');
    }).filter(function(k) { return now >= new Date(k.replace(' ', 'T')) && done.indexOf(k) < 0; });
    if (!due.length) continue;
    diaryAutoBusy = true;
    (function(char, keys) {
      writeCharDiary(findCharIdx(char.id)).then(function() {
        diaryAutoDone[char.id] = (diaryAutoDone[char.id] || []).concat(keys).slice(-10);
        mphoneStore.save('mphone_diary_auto', diaryAutoDone);
        if (document.getElementById('appDiary').classList.contains('active') && diaryCharId === char.id) renderDiaries();
      }).catch(function(err) {
        console.warn('[Mphone] 自动写日记失败:', err);
        diaryAutoRetry[char.id] = Date.now() + 30 * 60000;
      }).then(function() { diaryAutoBusy = false; });
    })(c, due);
    return;   // 一次只写一篇，下一分钟再看别的角色
  }
}
setInterval(diaryTick, 60000);
onMphoneReady(function() { setTimeout(diaryTick, 10000); });
