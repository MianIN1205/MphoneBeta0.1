// 眠花糖机 — 输入栏的小工具：相册三选一（照片 / 拍照 / 文字图片）、文字图片消息、剧情窗口的快捷符号（【】{{}}「」“”）

// =============================================
// 相册：照片（选图）/ 拍照（安卓也能直接开相机）/ 文字图片（用一段文字描述一张照片，像动态里的文字图）
// =============================================
// 从按钮上方冒出来的小菜单（用户不要正中间的弹窗）：放在 body 下面用屏幕坐标摆，底边贴着按钮上沿，点外面收起；半透明毛玻璃
var albumPop = document.getElementById('albumPop');
document.body.appendChild(albumPop);
var albumPopAnchor = null;
function placeAlbumPop() {
  if (!albumPopAnchor) return;
  var r = albumPopAnchor.getBoundingClientRect(), w = albumPop.offsetWidth;
  albumPop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  albumPop.style.bottom = (window.innerHeight - r.top + 8) + 'px';
}
function openAlbumPick(anchor) {
  if (anchor) albumPopAnchor = anchor;
  document.getElementById('albumPickMain').style.display = '';
  document.getElementById('albumPickText').style.display = 'none';
  document.getElementById('albumTextInput').value = '';
  albumPop.classList.add('open');
  placeAlbumPop();
}
function closeAlbumPick() { albumPop.classList.remove('open'); }
// 选好了（选照片 / 拍照 / 发文字图片）：小菜单和加号抽屉一起收
function doneAlbumPick() { closeAlbumPick(); if (typeof closeCrPlusPanel === 'function') closeCrPlusPanel(); }
document.addEventListener('pointerdown', function(e) {
  if (albumPop.classList.contains('open') && !albumPop.contains(e.target) && !(albumPopAnchor && albumPopAnchor.contains(e.target))) closeAlbumPick();
}, true);
document.getElementById('albumPickPhoto').addEventListener('click', function() {
  doneAlbumPick();
  var f = document.getElementById('crAlbumFileInput');
  f.value = '';
  f.click();
});
document.getElementById('albumPickCamera').addEventListener('click', function() {
  doneAlbumPick();
  var f = document.getElementById('crCameraInput');
  f.value = '';
  f.click();
});
document.getElementById('crCameraInput').addEventListener('change', function() {
  if (typeof sendPickedImage === 'function') sendPickedImage(this.files && this.files[0]);
});
document.getElementById('albumPickTextBtn').addEventListener('click', function() {
  document.getElementById('albumPickMain').style.display = 'none';
  document.getElementById('albumPickText').style.display = '';
  placeAlbumPop();
  setTimeout(function() { document.getElementById('albumTextInput').focus(); }, 50);
});
document.getElementById('albumTextBack').addEventListener('click', function() { openAlbumPick(); });
document.getElementById('albumTextSend').addEventListener('click', function() {
  var t = document.getElementById('albumTextInput').value.trim();
  if (!t) { shakeEl(document.getElementById('albumTextInput')); return; }
  if (openingChatCharIdx === -1) return;
  var m = { role: 'user', content: '[文字图片] ' + t, textImg: t, time: Date.now() };
  if (pendingQuote) { m.quote = pendingQuote; clearQuote(); }
  getActiveHistory(openingChatCharIdx).push(m);
  renderHistMsg(m);
  saveHistories();
  doneAlbumPick();
});

// 聊天里的文字图片：方形小卡片，点开画成一张图全屏看（和动态里的文字图一样）
function appendTextImgMsg(role, m, list, empty) {
  list = list || getActiveMsgListEl();
  empty = empty || getActiveEmptyEl();
  if (empty) empty.style.display = 'none';
  var row = document.createElement('div');
  row.className = 'chat-msg-row ' + (role === 'user' ? 'user' : 'ai');
  row.appendChild(createMsgAvatar(role));
  var bubble = document.createElement('div');
  bubble.className = 'chat-msg-bubble img-bubble textimg-bubble';
  bubble.appendChild(createTextImgEl(m.textImg || ''));
  row.appendChild(bubble);
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
  return { row: row, bubble: bubble };
}

// =============================================
// 剧情窗口的快捷符号：点一下插入一对符号，光标停在中间；选中了文字就把它包起来。键盘不收起
// =============================================
(function() {
  var bar = document.getElementById('crSymbolBar'), input = document.getElementById('crInput');
  [['【', '】'], ['{{', '}}'], ['「', '」'], ['“', '”']].forEach(function(p) {
    var b = document.createElement('button');
    b.className = 'cr-symbol-btn';
    b.textContent = p[0] + p[1];
    b.addEventListener('pointerdown', function(e) { e.preventDefault(); });   // 不抢输入框的焦点
    b.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var s = input.selectionStart, en = input.selectionEnd, v = input.value;
      input.value = v.slice(0, s) + p[0] + v.slice(s, en) + p[1] + v.slice(en);
      var at = s + p[0].length + (en - s);
      input.focus();
      input.setSelectionRange(at, at);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    bar.appendChild(b);
  });
})();

// =============================================
// 剧情存档（用户要的，2026-11-11）：符号栏最右边「总结」打开小窗
// · 「显示每轮摘要」开关：剧情里每次回复藏着的那句 <前情>，显示在气泡 / 文本框最下面（居左灰色小字、不加背景，.cr-recap-line；
//   一直画着，#appChatRoom.cr-show-recap 才显示），存 mphone_recap_show
// · 存档：选一段范围（从第几条到第几条），把这一段总结成一个存档——「哪次发生了什么」各存各的，不串成一长段（用户要的）。
//   「合并摘要」（这一段每轮的摘要，省）/「总结全文」（读这一段的原文，太长时前面的用摘要代替），结果和名字都能改，点保存才存
//   存 char.dramaSaves = [{ id, title, text, fromT, toT, from, to, at }]：fromT / toT 是这一段第一条、最后一条消息的时间，范围靠它认（删消息、重新生成后不会错位，
//   js/chat/prompt.js 的 dramaSaveRange 现算是第几条）；from / to 是存的时候的条数，只给没有时间的旧消息兜底
//   js/chat/prompt.js 的 dramaSavesOf：聊天窗口的【剧情空间里的事】和剧情窗口的【更早的剧情】都先一个个列存档，存档没盖到的回合再接每轮摘要
// =============================================
var dramaRecapShow = !!mphoneStore.load('mphone_recap_show', false);
function dramaRecapApply() { var room = document.getElementById('appChatRoom'); if (room) room.classList.toggle('cr-show-recap', dramaRecapShow); }
dramaRecapApply();
function dramaRecapLine(bubble, m) {
  if (!bubble || !m || !m.recap || bubble.querySelector('.cr-recap-line')) return;
  var d = document.createElement('div');
  d.className = 'cr-recap-line';
  d.textContent = '摘要：' + m.recap;
  bubble.appendChild(d);
}
var DRAMA_SUM_RAW_MAX = 40000;   // 总结全文时最多读多少字的原文（更早的用摘要）
function dramaSumList(idx) { return getDramaHistory(idx).filter(function(m) { return !m.action; }); }
// 总结第 from～to 条（从 1 数）。回来 { title, text }
function dramaSumAsk(idx, full, from, to) {
  var char = charList[idx], list = dramaSumList(idx).slice(from - 1, to);
  var charName = char.charAlias || char.charName || '角色', userName = resolveCharAccount(char).nickname || '用户', body = '';
  var recapsOf = function(part) { return splitRounds(part).map(roundRecap).filter(Boolean).map(function(r) { return '· ' + r; }); };
  if (!list.length) return Promise.reject(new Error('这个范围里没有剧情'));
  if (full) {
    // 从最后往前取原文，取够 DRAMA_SUM_RAW_MAX 字；再往前的用每轮摘要
    var raw = [], used = 0, i = list.length;
    while (i > 0) {
      var m = list[i - 1], t = (m.role === 'user' ? userName : charName) + '：' + String(msgTextForAI(m)).trim();
      if (used + t.length > DRAMA_SUM_RAW_MAX && raw.length) break;
      raw.unshift(t); used += t.length; i--;
    }
    var early = recapsOf(list.slice(0, i));
    body = (early.length ? '这一段前面的经过（每轮一句）：\n' + early.join('\n') + '\n\n' : '') + '剧情原文：\n' + raw.join('\n\n');
  } else {
    var rest = recapsOf(list);
    if (!rest.length) return Promise.reject(new Error('这一段还没有每轮的摘要，试试「总结全文」'));
    body = '每一轮的经过：\n' + rest.join('\n');
  }
  var ask = '请把下面这一段剧情整理成一份存档，给之后接着演的人看。第一行写「标题：」加一个 12 字以内的名字（这一段讲的是哪件事），第二行起写总结。' +
    '总结的要求：第三人称，按时间顺序；写清楚谁做了什么、说定了什么、' + charName + '和' + userName + '的关系有什么变化、还有哪些事没解决；' +
    '保留具体的细节（地点、东西、称呼、约定的时间），不评价、不抒情、不用列表符号，' + (full ? '500' : '300') + ' 字以内。只输出标题和总结。\n\n' + body;
  return callApiOnce([{ role: 'user', content: ask }], char).then(function(text) {
    text = String(text || '').trim();
    var title = '', m = text.match(/^\s*(?:标题|名字)\s*[：:]\s*([^\n]{1,30})\n?/);
    if (m) { title = m[1].replace(/[「」《》"“”]/g, '').trim().slice(0, 20); text = text.slice(m[0].length).trim(); }
    return { title: title, text: text };
  });
}
function openDramaSum() {
  var idx = openingChatCharIdx, char = charList[idx];
  if (!char) return;
  var ov = document.createElement('div');
  ov.className = 'mine-acc-overlay open drama-sum-dlg';
  var modal = document.createElement('div');
  modal.className = 'mine-acc-modal';
  ov.appendChild(modal);
  var total = function() { return dramaSumList(idx).length; };
  var saves = function() { return dramaSavesOf(char, dramaSumList(idx)).list; };   // [{ s 存档, r 现在是第几条到第几条（从 0 数）或 null }]
  var esc = function(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  function listView() {
    var rows = saves();
    modal.innerHTML = '<div class="mine-acc-title">剧情存档</div>' +
      '<div class="auto-row"><span class="auto-row-label">显示每轮摘要</span><label class="st-toggle-wrap"><input type="checkbox" data-k="show"><span class="st-toggle-slider"></span></label></div>' +
      '<div class="auto-hint" style="margin:2px 2px 10px;">开着时，每次回复最下面有一行灰色小字，是 TA 给这一轮写的摘要。</div>' +
      '<div class="drama-save-list">' + (rows.length ? rows.map(function(x) {
        var s = x.s;
        return '<button class="drama-save-row" data-id="' + esc(s.id) + '"><span class="drama-save-name">' + esc(s.title || '没起名字') + '</span><span class="drama-save-range">' + (x.r ? '第 ' + (x.r[0] + 1) + '～' + (x.r[1] + 1) + ' 条' : '原文已经删了') + '</span><span class="drama-save-text">' + esc(s.text) + '</span></button>';
      }).join('') : '<div class="auto-hint" style="margin:8px 2px;text-align:center;">还没有存档。把一段剧情存成一个存档，哪次发生了什么就分开记着，TA 之后照着这些记得。</div>') + '</div>' +
      '<button class="action-btn btn-preset" data-a="new" style="width:100%;padding:10px 0;margin-top:8px;">新建存档</button>' +
      '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-a="close">关闭</button></div>';
    var cb = modal.querySelector('[data-k="show"]');
    cb.checked = dramaRecapShow;
    cb.addEventListener('change', function() { dramaRecapShow = cb.checked; mphoneStore.save('mphone_recap_show', dramaRecapShow); dramaRecapApply(); });
    modal.onclick = function(e) {
      var row = e.target.closest && e.target.closest('.drama-save-row'), a = e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'close') ov.remove();
      else if (a === 'new') {
        if (!total()) { showToast('剧情里还没有内容', 'plain'); return; }
        var last = rows.reduce(function(n, x) { return x.r ? Math.max(n, x.r[1] + 1) : n; }, 0);   // 默认：最后一个存档之后到现在
        editView(null, Math.min(last + 1, total()), total());
      } else if (row) { var hit = rows.filter(function(x) { return x.s.id === row.getAttribute('data-id'); })[0]; if (hit) editView(hit.s, hit.r ? hit.r[0] + 1 : 0, hit.r ? hit.r[1] + 1 : 0); }
    };
  }
  function editView(save, from, to) {
    var busy = false, n = total(), gone = !!save && !from;   // gone：这一段的原文已经删了，只能改名字和文字
    modal.innerHTML = '<div class="mine-acc-title">' + (save ? '存档' : '新建存档') + '</div>' +
      '<div class="field-label">名字</div><input class="field-input" data-k="title" maxlength="20" placeholder="这一段讲的是哪件事（可以让 TA 起）">' +
      '<div class="field-label">范围（剧情一共 ' + n + ' 条）</div>' +
      '<div class="drama-save-range-row">从第 <input class="field-input" data-k="from" type="number" min="1" max="' + n + '" inputmode="numeric"> 条　到第 <input class="field-input" data-k="to" type="number" min="1" max="' + n + '" inputmode="numeric"> 条</div>' +
      '<div class="auto-hint" data-k="peek" style="margin:4px 2px 8px;"></div>' +
      '<textarea class="field-input drama-sum-text" data-k="text" rows="6" placeholder="这一段发生了什么。点下面的按钮让 TA 写，也可以自己写。"></textarea>' +
      '<div class="auto-hint" data-k="msg" style="margin:6px 2px 8px;min-height:16px;"></div>' +
      '<div style="display:flex;gap:8px;"><button class="action-btn btn-preset" data-a="merge" style="flex:1;padding:9px 0;">合并摘要</button><button class="action-btn btn-preset" data-a="full" style="flex:1;padding:9px 0;">总结全文</button></div>' +
      '<div class="auto-hint" style="margin:6px 2px 0;">合并摘要：把这一段每轮的摘要合起来，省。总结全文：重新读这一段再写，更细，花得多一点。</div>' +
      '<div class="mine-acc-actions">' + (save ? '<button class="mine-acc-btn mine-acc-btn-close" data-a="del">删除</button>' : '') +
      '<button class="mine-acc-btn mine-acc-btn-close" data-a="back">返回</button><button class="mine-acc-btn mine-acc-btn-add" data-a="save">保存</button></div>';
    var q = function(k) { return modal.querySelector('[data-k="' + k + '"]'); };
    var msg = function(t) { q('msg').textContent = t || ''; };
    var range = function() {
      var a = Math.max(1, Math.min(n, parseInt(q('from').value, 10) || 1)), b = Math.max(1, Math.min(n, parseInt(q('to').value, 10) || n));
      return a <= b ? [a, b] : [b, a];
    };
    var peek = function() {   // 让人看清选的是哪一段：第一条和最后一条的开头
      var r = range(), list = dramaSumList(idx), cut = function(m) { var t = String(m ? msgTextForAI(m) : '').replace(/\s+/g, ' ').trim(); return t.length > 22 ? t.slice(0, 22) + '…' : t; };
      q('peek').textContent = gone ? '这一段的原文已经删了，存档还留着。' : '从「' + cut(list[r[0] - 1]) + '」到「' + cut(list[r[1] - 1]) + '」';
    };
    q('title').value = save ? save.title || '' : '';
    q('text').value = save ? save.text : '';
    q('from').value = from || ''; q('to').value = to || '';
    if (gone) { q('from').disabled = q('to').disabled = true; modal.querySelector('[data-a="merge"]').disabled = modal.querySelector('[data-a="full"]').disabled = true; }
    q('from').addEventListener('input', peek); q('to').addEventListener('input', peek);
    peek();
    modal.onclick = function(e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'back') listView();
      else if (a === 'del') openConfirm('删掉这个存档？', function() { char.dramaSaves = (char.dramaSaves || []).filter(function(x) { return x !== save; }); saveCharList(); listView(); }, { desc: '剧情本身不会删，只是不再用这段总结。', okText: '删掉' });
      else if (a === 'save') {
        var t = q('text').value.trim(), r = range();
        if (!t) { msg('总结还是空的'); return; }
        var data = { title: q('title').value.trim().slice(0, 20), text: t.slice(0, 2000), at: Date.now() };
        if (!gone) {   // 范围记成第一条、最后一条消息的时间
          var ml = dramaSumList(idx), m1 = ml[r[0] - 1], m2 = ml[r[1] - 1];
          data.from = r[0]; data.to = r[1];
          if (m1 && m2 && m1.time && m2.time) { data.fromT = m1.time; data.toT = Math.max(m1.time, m2.time); } else { delete data.fromT; delete data.toT; if (save) { delete save.fromT; delete save.toT; } }
        }
        if (save) Object.assign(save, data);
        else { data.id = 'ds' + Date.now().toString(36); char.dramaSaves = (char.dramaSaves || []).concat(data); }
        saveCharList();
        showToast('✓ 存档存好了', 'success');
        listView();
      } else if ((a === 'merge' || a === 'full') && !busy) {
        var rg = range();
        busy = true; msg('正在写…');
        dramaSumAsk(idx, a === 'full', rg[0], rg[1]).then(function(res) {
          busy = false;
          if (!modal.contains(q('text'))) return;
          if (!res.text) { msg('没写出来，再试一次'); return; }
          q('text').value = res.text;
          if (res.title && !q('title').value.trim()) q('title').value = res.title;
          msg('写好了，可以改一改，点「保存」才算数');
        }, function(err) { busy = false; if (q('msg')) msg('✗ ' + ((err && err.message) || '没写出来')); });
      }
    };
  }
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  listView();
  (document.querySelector('.phone') || document.body).appendChild(ov);
}
(function() {
  var bar = document.getElementById('crSymbolBar');
  if (!bar) return;
  var b = document.createElement('button');
  b.className = 'cr-symbol-btn cr-symbol-sum';
  b.textContent = '总结';
  b.addEventListener('pointerdown', function(e) { e.preventDefault(); });
  b.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); openDramaSum(); });
  bar.appendChild(b);
})();
