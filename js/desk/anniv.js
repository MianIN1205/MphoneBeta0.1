// 眠花糖机 — 纪念日与日程：自动「认识第几天」、自己添加（和谁有关）、角色能看到哪些

// =============================================
// 纪念日与日程
// · 自动：和每个角色认识第几天（从第一条消息算起）
// · 自己添加：纪念日（可每年重复，如生日）、日程（某天某时要做的事）
// · 置顶：在列表里排最前；外显：显示在桌面的纪念日小组件上
// =============================================
var annivs = mphoneStore.load('mphone_annivs', []);              // [{ id, kind: 'anniv' | 'event', title, date, time, yearly, pin, show, charIds, remind, by }]
// 和谁有关：withUser（user，默认有）、charIds（小手机里的角色）、npc（小手机外的人，文字）；
// remind：角色帮忙记的「提醒 / 闹钟 / 日程」；by：哪个角色记的
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
  charList.forEach(function(c) { if (c.isGroup) return;   // 群聊不算
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
    var t = parseYmd(a.date), e = { id: a.id, kind: a.kind || 'anniv', a: a, title: a.title, date: t, time: a.time || '', pin: !!a.pin, show: !!a.show,
      charIds: a.charIds || [], remind: a.remind || '', npc: a.npc || '', withUser: a.withUser !== false, unit: '天' };
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
// 告诉角色的纪念日和日程：和这个角色认识第几天；今天的日子和日程；30 天内要到的；已经过去的纪念日算到今天第几天。最多 8 条
// 角色只看得到：只和用户有关的、和自己有关的、和 TA 认识的人（社交圈）有关的；不认识的人的看不到
function annivVisibleTo(e, char) {
  var ids = e.charIds || [];
  if (!ids.length || ids.indexOf(char.id) >= 0) return true;
  return ids.some(function(id) { return (char.circle || []).indexOf(id) >= 0; });
}
function calendarContextFor(char) {
  var known = '', items = [];
  annivEntries().forEach(function(e) {
    if (e.auto) { if (e.charId === char.id) known = '今天是你们认识的第 ' + e.big + ' 天。'; return; }
    if (e.past || items.length >= 8 || !annivVisibleTo(e, char)) return;
    // 站在这个角色的角度：char = TA 自己，user = 用户，其他人（别的角色、用户身边的人）都是 NPC
    var who = [], npcs = (e.charIds || []).filter(function(id) { return id !== char.id; }).map(annivCharName).filter(Boolean).concat(e.npc ? [e.npc] : []);
    if (e.withUser) who.push('{{user}}');
    if ((e.charIds || []).indexOf(char.id) >= 0) who.push('你');
    if (npcs.length) who.push('NPC：' + npcs.join('、'));
    var whoText = (who.length && !(who.length === 1 && e.withUser)) ? '〔和谁有关：' + who.join('，') + '〕' : '';
    var title = (e.remind ? '（' + e.remind + '）' : '') + e.title + whoText;
    if (e.today) items.push((e.kind === 'event' ? '今天的日程：' : '今天是纪念日：') + title + (e.time ? '（' + e.time + '）' : ''));
    else if (e.note === '还有' && e.big <= 30) items.push(title + '：还有 ' + e.big + ' 天' + (e.kind === 'event' && e.time ? '（' + e.time + '）' : ''));
    else if (e.kind === 'anniv' && e.note === '已经') items.push(title + '：已经 ' + e.big + ' 天');
    else if (e.kind === 'anniv' && e.note === '第') items.push('今天是纪念日：' + title + '（第 1 天）');
  });
  return known + (known && items.length ? '\n' : '') + (items.length ? '{{user}}小手机日历里记着的纪念日和日程：\n' + items.map(function(t) { return '· ' + t; }).join('\n') : '');
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
    t.textContent = (e.kind === 'event' ? (CAL_ICON[e.remind] || '🗓') + ' ' : '') + e.title + (e.a && e.a.yearly ? ' 🔁' : '');
    var d = document.createElement('div');
    d.className = 'anniv-date';
    var who = (e.charIds || []).map(annivCharName).filter(Boolean).concat(e.npc ? [e.npc] : []);
    d.textContent = deskDateText(e.date) + (e.time ? ' ' + e.time : '') + (who.length ? ' · ' + (e.withUser ? '和 ' : '') + who.join('、') : '');
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
        openConfirm('删除「' + e.a.title + '」？', function() {
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
var CAL_ICON = { '提醒': '🔔', '闹钟': '⏰', '日程': '🗓' };
function annivCharName(id) {
  var c = charList.filter(function(x) { return x.id === id; })[0];
  return c ? (c.charAlias || c.charName || '') : '';
}
// 和谁有关：user（默认选上）+ 点角色名选 char；NPC 在下面的输入框里写
var annivPeople = [], annivWithUser = true;
function renderAnnivPeople() {
  var box = document.getElementById('annivPeople');
  box.innerHTML = '';
  var u = document.createElement('button');
  u.className = 'stk-chip' + (annivWithUser ? ' selected' : '');
  u.textContent = 'user';
  u.addEventListener('click', function() { annivWithUser = !annivWithUser; renderAnnivPeople(); });
  box.appendChild(u);
  charList.forEach(function(c) { if (c.isGroup) return;   // 群聊不算
    var b = document.createElement('button');
    b.className = 'stk-chip' + (annivPeople.indexOf(c.id) >= 0 ? ' selected' : '');
    b.textContent = c.charAlias || c.charName || '未命名';
    b.addEventListener('click', function() {
      var i = annivPeople.indexOf(c.id);
      if (i >= 0) annivPeople.splice(i, 1); else annivPeople.push(c.id);
      renderAnnivPeople();
    });
    box.appendChild(b);
  });
}
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
  annivPeople = [];
  annivWithUser = true;
  document.getElementById('annivNpc').value = '';
  renderAnnivPeople();
  annivOverlay.classList.add('open');
});
document.getElementById('annivCancel').addEventListener('click', function() { annivOverlay.classList.remove('open'); });
closeOnBackdrop(annivOverlay);
document.getElementById('annivSave').addEventListener('click', function() {
  var titleEl = document.getElementById('annivTitle'), dateEl = document.getElementById('annivDate');
  if (!titleEl.value.trim()) { shakeEl(titleEl); return; }
  if (!dateEl.value) { shakeEl(dateEl); return; }
  annivs.push({
    id: 'an' + Date.now().toString(36), kind: annivKind, title: titleEl.value.trim(), date: dateEl.value,
    time: annivKind === 'event' ? document.getElementById('annivTime').value : '',
    yearly: annivKind === 'anniv' && document.getElementById('annivYearly').checked, pin: false, show: false,
    charIds: annivPeople.slice(), withUser: annivWithUser, npc: document.getElementById('annivNpc').value.trim()
  });
  saveAnnivs();
  annivOverlay.classList.remove('open');
  renderAnnivs();
});
