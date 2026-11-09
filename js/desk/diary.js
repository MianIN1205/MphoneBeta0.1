// 眠花糖机 — 日记：角色写今天的日记，每天定时写并记成长期记忆

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
  charList.forEach(function(c) { if (c.isGroup) return;   // 群聊不算
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
closeOnBackdrop(diaryReadOverlay);
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
  var msgs = charContextMsgs(idx).concat([activityAsk(
    '【写日记】现在是 ' + nowText(char) + '。请你以「' + name + '」的身份，用第一人称写一篇今天的私人日记：可以写今天发生的事、和用户的聊天、心情和没说出口的想法，200～400 字。' +
    '日记是写给自己看的，可以比聊天时更坦白，但还是你自己的口吻和用词，分几段写。' +
    '第一行只写日记标题（不超过 12 个字，不加书名号和「标题」二字），然后空一行写正文。只输出日记本身。' +
    '日记写完后另起一行写 <要点>用一句话概括今天最值得记住的事（30 字以内）</要点>，这一行不会出现在日记里。'
  )]);
  return callApiOnce(msgs, char).then(function(text) {
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
    if (c.isGroup || !cfg.on || !c.id || (diaryAutoRetry[c.id] || 0) > Date.now()) continue;
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
