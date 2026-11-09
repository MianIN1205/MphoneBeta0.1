// 眠花糖机 — 桌面「慢信」：给未来的自己或某个角色写一封信，约一个日子，封好以后到那天才能拆；
// 写给角色的，拆开那天 TA 读到信、回你一封（mphone_letters）

var letters = mphoneStore.load('mphone_letters', []) || [];
letters.forEach(function(l) { delete l._asking; });   // 上次关掉时正在等的回信，重开后可以再点
function saveLetters() { mphoneStore.save('mphone_letters', letters); paintLetterBadge(); }
var appLetters = document.getElementById('appLetters');
function letterDayStart(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
function letterCanOpen(l) { return Date.now() >= l.openAt; }
function letterDate(t) { var d = new Date(t); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
function letterToName(l) {
  if (l.to === 'self') return '未来的自己';
  var c = charList[findCharIdx(l.to)];
  return c ? (c.charAlias || c.charName || '角色') : '（已删除的角色）';
}
// 桌面图标上的小红点：有可以拆、还没拆的信
function paintLetterBadge() {
  var icon = document.querySelector('#dockLetters .dock-icon');
  if (icon) icon.classList.toggle('has-unread', letters.some(function(l) { return letterCanOpen(l) && !l.opened; }));
}
paintLetterBadge();
setInterval(paintLetterBadge, 60000);

function renderLetters() {
  var box = document.getElementById('lettersBody');
  box.innerHTML = '';
  if (!letters.length) {
    box.innerHTML = '<div class="letter-empty">还没有信<br>点右上角写一封，约一个日子再拆开</div>';
    return;
  }
  var groups = [
    ['可以拆了', letters.filter(function(l) { return letterCanOpen(l) && !l.opened; })],
    ['还在路上', letters.filter(function(l) { return !letterCanOpen(l); }).sort(function(a, b) { return a.openAt - b.openAt; })],
    ['拆过的', letters.filter(function(l) { return l.opened; }).sort(function(a, b) { return b.openedAt - a.openedAt; })]
  ];
  groups.forEach(function(g) {
    if (!g[1].length) return;
    var h = document.createElement('div');
    h.className = 'section-label';
    h.textContent = g[0];
    box.appendChild(h);
    g[1].forEach(function(l) {
      var card = document.createElement('div');
      var ready = letterCanOpen(l) && !l.opened;
      card.className = 'letter-card' + (ready ? ' ready' : '') + (l.opened ? ' opened' : '') + (!letterCanOpen(l) ? ' sealed' : '');
      var days = Math.ceil((l.openAt - letterDayStart(Date.now())) / 86400000);
      card.innerHTML = '<div class="letter-seal"></div><div class="letter-card-main"><div class="letter-card-to"></div><div class="letter-card-sub"></div></div>';
      card.querySelector('.letter-card-to').textContent = '寄给 ' + letterToName(l);
      card.querySelector('.letter-card-sub').textContent = l.opened ? letterDate(l.openedAt) + ' 拆开' + (l.reply ? ' · 有回信' : '')
        : ready ? '可以拆了 · ' + letterDate(l.writtenAt) + ' 写的'
        : letterDate(l.openAt) + ' 才能拆 · 还有 ' + days + ' 天';
      card.addEventListener('click', function() {
        if (!letterCanOpen(l)) { openLetterSealed(l); return; }
        openLetter(l);
      });
      box.appendChild(card);
    });
  });
}

// ---------- 拆信 / 看信 ----------
var letterViewing = null;
function openLetter(l) {
  letterViewing = l;
  var first = !l.opened;
  if (first) { l.opened = true; l.openedAt = Date.now(); saveLetters(); }
  var v = document.getElementById('letterView');
  v.querySelector('.letter-paper-head').textContent = '寄给 ' + letterToName(l) + '　·　' + letterDate(l.writtenAt) + ' 写的';
  v.querySelector('.letter-paper-text').textContent = l.content;
  paintLetterReply(l);
  v.classList.toggle('unfold', first);
  document.getElementById('letterViewOverlay').classList.add('open');
  // 写给角色的：第一次拆开时 TA 读到这封信，回你一封
  if (first && l.to !== 'self' && !l.reply) letterAskReply(l);
  renderLetters();
}
function paintLetterReply(l) {
  var box = document.getElementById('letterReply');
  box.innerHTML = '';
  if (l.to === 'self') { box.style.display = 'none'; return; }
  box.style.display = '';
  if (l.reply) {
    box.innerHTML = '<div class="letter-paper reply"><div class="letter-paper-head"></div><div class="letter-paper-text"></div></div>';
    box.querySelector('.letter-paper-head').textContent = letterToName(l) + ' 的回信　·　' + letterDate(l.reply.at);
    box.querySelector('.letter-paper-text').textContent = l.reply.content;
  } else if (l._asking) {
    box.innerHTML = '<div class="letter-wait">' + letterToName(l) + ' 正在读信、写回信…</div>';
  } else {
    var b = document.createElement('button');
    b.className = 'mine-acc-btn mine-acc-btn-add letter-ask-btn';
    b.textContent = '等 TA 回信';
    b.addEventListener('click', function() { letterAskReply(l); });
    box.appendChild(b);
  }
}
function letterAskReply(l) {
  var idx = findCharIdx(l.to), char = charList[idx];
  if (!char || l._asking) return;
  l._asking = true;
  if (letterViewing === l) paintLetterReply(l);
  var msgs = charContextMsgs(idx).concat([activityAsk('【慢信】' + letterDate(l.writtenAt) + '，用户给你写了一封慢信，约好 ' + letterDate(l.openAt) + ' 才拆开。今天你读到了这封信：\n「' + l.content + '」\n' +
    '请你给 TA 回一封信：第一人称，就是你平时的口吻，可以回应信里的话、说说这段时间、写你想对 TA 说的，150～400 字，分几段。开头可以有称呼，结尾署名。只输出信的正文。')]);
  callApiOnce(msgs, char).then(function(text) {
    l.reply = { content: String(text).replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim(), at: Date.now() };
    saveLetters();
    showToast('「' + (char.charAlias || char.charName) + '」给你回了一封信', 'plain');
  }, function(err) {
    showToast('✗ 回信没写出来：' + (typeof explainError === 'function' ? explainError(err).title : err.message), 'error');
  }).then(function() {
    delete l._asking;
    if (letterViewing === l) paintLetterReply(l);
    renderLetters();
  });
}
document.getElementById('letterViewClose').addEventListener('click', function() { document.getElementById('letterViewOverlay').classList.remove('open'); letterViewing = null; });
document.getElementById('letterViewDel').addEventListener('click', function() {
  var l = letterViewing;
  if (!l) return;
  openConfirm('把这封信扔掉？扔了就找不回来了', function() {
    letters = letters.filter(function(x) { return x !== l; });
    saveLetters();
    document.getElementById('letterViewOverlay').classList.remove('open');
    letterViewing = null;
    renderLetters();
  });
});

// ---------- 还封着的信：日子选错了可以改，不想寄了可以扔掉（用户要的；内容还是不给看） ----------
var letterSealed = null;
function letterDateVal(t) { var d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function openLetterSealed(l) {
  letterSealed = l;
  document.getElementById('letterSealedTitle').textContent = '寄给 ' + letterToName(l);
  document.getElementById('letterSealedTip').textContent = '还没到日子哦，' + letterDate(l.openAt) + ' 才能拆';
  var inp = document.getElementById('letterSealedDate');
  inp.min = letterDateVal(letterDayStart(Date.now()) + 86400000);
  inp.value = letterDateVal(l.openAt);
  document.getElementById('letterSealedOverlay').classList.add('open');
}
function closeLetterSealed() { document.getElementById('letterSealedOverlay').classList.remove('open'); letterSealed = null; }
document.getElementById('letterSealedCancel').addEventListener('click', closeLetterSealed);
closeOnBackdrop(document.getElementById('letterSealedOverlay'), closeLetterSealed);
document.getElementById('letterSealedSave').addEventListener('click', function() {
  var l = letterSealed, inp = document.getElementById('letterSealedDate');
  if (!l) return;
  var p = inp.value.split('-').map(Number), openAt = new Date(p[0], p[1] - 1, p[2]).getTime();
  if (!inp.value || isNaN(openAt) || openAt <= letterDayStart(Date.now())) { shakeEl(inp); showToast('拆信的日子要选明天以后', 'error'); return; }
  l.openAt = openAt;
  saveLetters(); closeLetterSealed(); renderLetters();
  showToast('✓ 改好了，' + letterDate(openAt) + ' 才能拆', 'success');
});
document.getElementById('letterSealedDel').addEventListener('click', function() {
  var l = letterSealed;
  if (!l) return;
  openConfirm('把这封信扔掉？扔了就找不回来了', function() {
    letters = letters.filter(function(x) { return x !== l; });
    saveLetters(); closeLetterSealed(); renderLetters();
  });
});

// ---------- 写信 ----------
var letterWriteOverlay = document.getElementById('letterWriteOverlay');
var LETTER_QUICK = [['一周后', 7], ['一个月后', 30], ['半年后', 182], ['一年后', 365]];
function letterSetDays(n) {
  var d = new Date(letterDayStart(Date.now()) + n * 86400000);
  document.getElementById('letterOpenDate').value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
document.getElementById('lettersWriteBtn').addEventListener('click', function() {
  var sel = document.getElementById('letterTo');
  sel.innerHTML = '<option value="self">未来的自己</option>';
  charList.forEach(function(c) { if (c.isGroup) return;   // 群聊不算
    var o = document.createElement('option');
    o.value = c.id; o.textContent = c.charAlias || c.charName || '未命名';
    sel.appendChild(o);
  });
  document.getElementById('letterContent').value = '';
  var tom = new Date(letterDayStart(Date.now()) + 86400000);
  document.getElementById('letterOpenDate').min = tom.getFullYear() + '-' + pad(tom.getMonth() + 1) + '-' + pad(tom.getDate());
  letterSetDays(30);
  var quick = document.getElementById('letterQuick');
  quick.innerHTML = '';
  LETTER_QUICK.forEach(function(q) {
    var b = document.createElement('button');
    b.className = 'pet-chip';
    b.textContent = q[0];
    b.addEventListener('click', function() { letterSetDays(q[1]); });
    quick.appendChild(b);
  });
  letterWriteOverlay.classList.add('open');
});
document.getElementById('letterWriteCancel').addEventListener('click', function() { letterWriteOverlay.classList.remove('open'); });
document.getElementById('letterWriteSend').addEventListener('click', function() {
  var content = document.getElementById('letterContent').value.trim();
  var date = document.getElementById('letterOpenDate').value;
  if (!content) { shakeEl(document.getElementById('letterContent')); return; }
  var p = date.split('-').map(Number), openAt = new Date(p[0], p[1] - 1, p[2]).getTime();
  if (!date || isNaN(openAt) || openAt <= letterDayStart(Date.now())) { shakeEl(document.getElementById('letterOpenDate')); showToast('拆信的日子要选明天以后', 'error'); return; }
  letters.push({ id: 'lt' + Date.now().toString(36), to: document.getElementById('letterTo').value, content: content, writtenAt: Date.now(), openAt: openAt, opened: false });
  saveLetters();
  letterWriteOverlay.classList.remove('open');
  renderLetters();
  showToast('✓ 信封好了，' + letterDate(openAt) + ' 才能拆', 'success');
});

document.getElementById('dockLetters').addEventListener('click', function() {
  renderLetters();
  appLetters.classList.add('active');
  if (letters.some(function(l) { return letterCanOpen(l) && !l.opened; })) showToast('有信可以拆了', 'plain');
});
document.getElementById('backLetters').addEventListener('click', function() { appLetters.classList.remove('active'); });
closeOnBackdrop(document.getElementById('letterViewOverlay'));
