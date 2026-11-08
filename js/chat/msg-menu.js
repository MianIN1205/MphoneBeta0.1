// 眠花糖机 — 聊天消息长按菜单：引用、编辑、重新生成、撤回、删除、多选、收藏、复制

// ---------- 聊天消息长按：收藏 / 复制 ----------
var msgCtxMenu = document.getElementById('msgCtxMenu');
var ctxTarget = null;     // { kind, text, images, author }
var suppressClick = false;

function closeMsgCtx() { msgCtxMenu.classList.remove('open'); ctxTarget = null; }

function snapshotBubble(bubble) {
  var row = bubble.closest('.chat-msg-row');
  var isUser = row && row.classList.contains('user');
  var char = charList[openingChatCharIdx] || {};
  var author = row && row._msg && row._msg.narr ? '旁白' : isUser ? (resolveCharAccount(char).nickname || '我') : (char.charAlias || char.charName || '角色');
  var img = bubble.querySelector('img');
  if (img) return { kind: 'image', text: '', images: [img.src], author: author };
  if (bubble.querySelector('.voice-bubble-inner')) {
    var vm = row && row._msg;
    return { kind: 'text', text: '[语音消息]' + (vm && vm.transcript ? '：' + vm.transcript : ''), images: [], author: author };
  }
  var tr = bubble.querySelector('.cr-translation');
  var text = tr ? bubble.textContent.slice(0, bubble.textContent.length - tr.textContent.length).trim() + '\n（译）' + tr.textContent : bubble.textContent;
  return { kind: 'text', text: text, images: [], author: author };
}

// 打开长按菜单：bubble 是哪条消息，anchor 是菜单贴着谁摆（长按时是气泡，剧情文本框里点「⋯」时是那个按钮）
function openMsgCtx(bubble, listId, anchor) {
  ctxTarget = snapshotBubble(bubble);
  ctxTarget.source = '与 ' + chatRoomTitle.textContent + (listId === 'dramaMsgList' ? ' 的剧情' : ' 的聊天');
  var row = bubble.closest('.chat-msg-row');
  ctxTarget.row = row;
  ctxTarget.bubble = bubble;
  ctxTarget.listId = listId;
  ctxTarget.msg = row && row._msg;
  ctxTarget.isUser = !!(row && row.classList.contains('user'));
  // 按消息类型显示可用操作：图片、表情包、语音不能编辑；自己和角色的消息都能撤回
  var m = ctxTarget.msg;
  var isLatest = !!m && !ctxTarget.isUser && trailingReplyGroup(histOfList(listId)).msgs.indexOf(m) >= 0;
  var narr = !!(m && m.narr);
  var show = narr ? { edit: true, delete: true, select: true, selBelow: true, fav: true, copy: true } : {
    quote:  !!m,
    edit:   !!m && !m.imgSrc && !m.sticker && !m.file && !m.textImg,
    recall: !!m && !m.recalled,
    // 重新生成：最新一组回复直接重新生成（旧版本留着切换）；更早的回复要先删掉后面的消息
    regen:     !!m && !genHere() && isLatest,
    regenFrom: !!m && !genHere() && !ctxTarget.isUser && !isLatest,
    delRound:  !!m && !ctxTarget.isUser,
    delete: true, select: !!m, selBelow: !!m, fav: true, copy: true
  };
  msgCtxMenu.querySelectorAll('button').forEach(function(btn) { btn.classList.toggle('hide', !show[btn.dataset.act]); });
  var r = (anchor || bubble).getBoundingClientRect();
  msgCtxMenu.classList.add('open');
  var mw = msgCtxMenu.offsetWidth, mh = msgCtxMenu.offsetHeight;
  var left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left + r.width / 2 - mw / 2));
  var top = r.top - mh - 6 < 8 ? r.bottom + 6 : r.top - mh - 6;
  msgCtxMenu.style.left = left + 'px';
  msgCtxMenu.style.top = top + 'px';
}

['chatMsgList', 'dramaMsgList'].forEach(function(listId) {
  var list = document.getElementById(listId);
  var timer = null, sx = 0, sy = 0;
  list.addEventListener('pointerdown', function(e) {
    var bubble = e.target.closest('.chat-msg-bubble');
    if (!bubble || bubble.querySelector('.typing-dots')) return;
    if (typeof msgSelecting === 'function' && msgSelecting()) return;   // 多选时点一下就是勾选
    sx = e.clientX; sy = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(function() {
      timer = null;
      openMsgCtx(bubble, listId, bubble);
      suppressClick = true;
      if (navigator.vibrate) navigator.vibrate(15);
    }, 500);
  });
  list.addEventListener('pointermove', function(e) {
    if (timer && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) { clearTimeout(timer); timer = null; }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(ev) {
    list.addEventListener(ev, function() {
      clearTimeout(timer); timer = null;
      // 触屏长按后不一定会产生点击，屏蔽只保留片刻，免得吞掉下一次正常点击
      if (suppressClick) setTimeout(function() { suppressClick = false; }, 350);
    });
  });
  // 长按后松手产生的点击不触发气泡自身的点击（如语音转文字）
  list.addEventListener('click', function(e) {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
  }, true);
  list.addEventListener('contextmenu', function(e) { if (e.target.closest('.chat-msg-bubble')) e.preventDefault(); });
});

msgCtxMenu.addEventListener('click', function(e) {
  var act = e.target.dataset && e.target.dataset.act;
  if (!act || !ctxTarget) return;
  var t = ctxTarget;
  closeMsgCtx();
  if (act === 'fav') {
    addFav({ kind: t.kind, text: t.text, images: t.images, source: t.source, author: t.author, time: Date.now() });
  } else if (act === 'copy') {
    var text = t.text || (t.images[0] || '');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function() { showToast('✓ 已复制', 'success'); }, function() { showToast('✗ 复制失败', 'error'); });
  } else if (act === 'quote') {
    var qt = t.msg.imgSrc ? '[图片]' : String(t.msg.content || '').replace(/〔译〕[\s\S]*$/, '').trim();
    // 角色消息里的 {{user}} / {{char}} 和气泡上显示的一样换成名字
    if (!t.isUser) qt = fillMacros(qt, charList[openingChatCharIdx]);
    setQuote({ author: t.author, text: qt.length > 60 ? qt.slice(0, 60) + '…' : qt });
  } else if (act === 'edit') {
    openMsgEdit(t);
  } else if (act === 'regen') {
    regenerateLast();
  } else if (act === 'recall') {
    recallMsg(t);
  } else if (act === 'delete') {
    openConfirm('删除这条消息？删除后 TA 也不会再看到', function() { deleteMsg(t); });
  } else if (act === 'regenFrom') {
    regenerateFrom(t.listId, t.msg);
  } else if (act === 'delRound') {
    deleteRound(t.listId, t.msg);
  } else if (act === 'select') {
    enterMsgSelect(t.listId, t.row);
  } else if (act === 'selBelow') {
    // 删除以下：进多选，把这条和后面的全部勾上，看一眼再点「删除」（用户要的，不用一条条点）
    selectFromHere(t.listId, t.row);
  }
});

// 消息所在的记录（聊天 / 剧情）
function histOfList(listId) {
  return listId === 'dramaMsgList' ? getDramaHistory(openingChatCharIdx) : getChatHistory(openingChatCharIdx);
}

// 删除：移出记录，并移除气泡及其引用块、状态栏
function deleteMsg(t) {
  var hist = histOfList(t.listId);
  var i = t.msg ? hist.indexOf(t.msg) : -1;
  if (i >= 0) hist.splice(i, 1);
  (t.row._extras || []).concat(t.row._actionNotes || [], t.row._errNotes || []).forEach(function(el) { el.remove(); });
  t.row.remove();
  saveHistories();
  var list = document.getElementById(t.listId);
  if (!list.querySelector('.chat-msg-row, .cr-recall-notice')) {
    var empty = list.querySelector('.chat-room-empty, .drama-empty-hint');
    if (empty) empty.style.display = 'flex';
    list.querySelectorAll('.cr-time-sep').forEach(function(el) { el.remove(); });   // 全删光了，时间也不用留
    list._lastTime = 0;
  }
}

// 撤回：原位置换成撤回提示。自己的消息保留原文供「重新编辑」，TA 只知道撤回了一条消息；
// 角色的消息由你撤回时，TA 下次回复会知道这条被撤回了（以及原本说了什么）
function recallMsg(t) {
  var m = t.msg;
  m.recalled = true;
  m.recalledBy = 'user';
  m.recalledText = m.role === 'assistant' ? (m.imgSrc ? '[图片]' : m.voice ? '[语音]' : (m.content || ''))
                                          : (m.imgSrc || m.sticker) ? '' : m.content;
  delete m.quote;
  delete m.status;
  var list = document.getElementById(t.listId);
  var notice = renderRecallNotice(m, list, null);
  list.insertBefore(notice, t.row);
  (t.row._extras || []).concat(t.row._actionNotes || []).forEach(function(el) { el.remove(); });
  t.row.remove();
  saveHistories();
}

// 编辑：改记录里的文字并刷新气泡
var msgEditOverlay = document.getElementById('msgEditOverlay');
var msgEditTarget = null;
function openMsgEdit(t) {
  msgEditTarget = t;
  document.getElementById('msgEditText').value = t.msg.content || '';
  msgEditOverlay.classList.add('open');
  document.getElementById('msgEditText').focus();
}
function closeMsgEdit() { msgEditOverlay.classList.remove('open'); msgEditTarget = null; }
document.getElementById('msgEditCancel').addEventListener('click', closeMsgEdit);
closeOnBackdrop(msgEditOverlay, closeMsgEdit);
document.getElementById('msgEditSave').addEventListener('click', function() {
  var ta = document.getElementById('msgEditText');
  var text = ta.value.trim();
  if (!text) { shakeEl(ta); return; }
  var t = msgEditTarget;
  t.msg.content = text;
  if (t.msg.narr) t.bubble.textContent = fillMacros(text, charList[openingChatCharIdx]);
  else setBubbleText(t.bubble, text, !t.isUser, t.listId === 'chatMsgList');
  var wEl = t.row && t.row.querySelector('.cr-head-words');
  if (wEl) wEl.textContent = text.replace(/\s+/g, '').length + ' 字';
  saveHistories();
  closeMsgEdit();
  showToast('✓ 已修改', 'success');
});
document.addEventListener('pointerdown', function(e) {
  if (msgCtxMenu.classList.contains('open') && !msgCtxMenu.contains(e.target)) closeMsgCtx();
});

// 剧情窗口文本框顶上的按钮（render.js 的 addDramaHead）：编辑、收藏直接做，「⋯」打开和长按一样的菜单
document.getElementById('dramaMsgList').addEventListener('click', function(e) {
  var btn = e.target.closest('.cr-head-acts button');
  if (!btn) return;
  e.stopPropagation();
  var row = btn.closest('.chat-msg-row'), bubble = row && row.querySelector('.chat-msg-bubble');
  if (!bubble || (typeof msgSelecting === 'function' && msgSelecting())) return;
  var k = btn.dataset.hact;
  if (k === 'more') { openMsgCtx(bubble, 'dramaMsgList', btn); return; }
  var t = snapshotBubble(bubble);
  t.source = '与 ' + chatRoomTitle.textContent + ' 的剧情';
  t.row = row; t.bubble = bubble; t.listId = 'dramaMsgList'; t.msg = row._msg; t.isUser = row.classList.contains('user');
  if (k === 'edit' && t.msg) openMsgEdit(t);
  else if (k === 'fav') addFav({ kind: t.kind, text: t.text, images: t.images, source: t.source, author: t.author, time: Date.now() });
});
