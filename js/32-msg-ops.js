// 眠花糖机 — 消息操作：多选（批量删除 / 收藏）、按回合删除和重新生成、清空聊天 / 剧情记录

// =============================================
// 一轮回复 = 角色同一次回复拆成的几条（时间相同的连续角色消息）
// =============================================
function replyGroupOf(hist, m) {
  var i = hist.indexOf(m);
  if (i < 0) return null;
  var s = i, e = i;
  while (s > 0 && m.time && hist[s - 1].role === 'assistant' && hist[s - 1].time === m.time) s--;
  while (e < hist.length - 1 && m.time && hist[e + 1].role === 'assistant' && hist[e + 1].time === m.time) e++;
  return { start: s, end: e };
}

// 删除本轮：把这条所在的整轮回复删掉
function deleteRound(listId, m) {
  var hist = histOfList(listId), g = replyGroupOf(hist, m);
  if (!g) return;
  var n = g.end - g.start + 1;
  openPfEntryDel('删除这一轮回复（' + n + ' 条）？删除后 TA 也不会再看到', function() {
    hist.splice(g.start, n);
    saveHistories();
    renderRoomLists(openingChatCharIdx);
  });
}

// 从这里重新生成：删掉这一轮回复和之后的所有消息，再请 TA 重新回复这一轮
function regenerateFrom(listId, m) {
  if (genState) { showToast('正在回复中', 'error'); return; }
  var hist = histOfList(listId), g = replyGroupOf(hist, m);
  if (!g) return;
  var after = hist.length - g.start;
  openPfEntryDel('从这一轮重新生成？这一轮回复和之后的 ' + after + ' 条消息都会删掉', function() {
    hist.splice(g.start);
    saveHistories();
    renderRoomLists(openingChatCharIdx);
    sendMsg('', true);
  });
}

// =============================================
// 多选：长按消息选「多选」进入，点消息勾选；底部换成 全选 / 收藏 / 删除 / 完成
// =============================================
var msgSel = null;   // { list, listId, picked: [元素] }
var crSelectBar = document.getElementById('crSelectBar');
function msgSelecting() { return !!msgSel; }

// 能勾选的：消息行、撤回提示、拍一拍、操作卡片（都是列表的直接子元素，带 _msg）
function selectableEls(list) {
  return Array.prototype.filter.call(list.children, function(el) { return !!el._msg; });
}
function paintSelectBar() {
  var n = msgSel ? msgSel.picked.length : 0;
  document.getElementById('crSelCount').textContent = '已选 ' + n + ' 条';
  document.getElementById('crSelDel').disabled = !n;
  document.getElementById('crSelFav').disabled = !n;
  var all = msgSel && n && n === selectableEls(msgSel.list).length;
  document.getElementById('crSelAll').textContent = all ? '全不选' : '全选';
}
function togglePick(el, on) {
  var i = msgSel.picked.indexOf(el);
  if (on === undefined) on = i < 0;
  if (on && i < 0) msgSel.picked.push(el);
  if (!on && i >= 0) msgSel.picked.splice(i, 1);
  el.classList.toggle('cr-sel', on);
}
function enterMsgSelect(listId, firstEl) {
  exitMsgSelect();
  var list = document.getElementById(listId);
  msgSel = { list: list, listId: listId, picked: [] };
  list.classList.add('cr-selecting');
  if (firstEl && firstEl._msg) togglePick(firstEl, true);
  closeCrPlusPanel();
  if (typeof stkSuggest !== 'undefined') stkSuggest.classList.remove('open');
  crBottomBar.style.display = 'none';
  crSelectBar.classList.add('open');
  paintSelectBar();
}
function exitMsgSelect() {
  if (!msgSel) return;
  msgSel.list.classList.remove('cr-selecting');
  msgSel.picked.forEach(function(el) { el.classList.remove('cr-sel'); });
  msgSel = null;
  crSelectBar.classList.remove('open');
  crBottomBar.style.display = '';
}

// 多选时点消息 = 勾选（拦在气泡自己的点击前面，比如点图片看大图、点语音播放）
['chatMsgList', 'dramaMsgList'].forEach(function(id) {
  var list = document.getElementById(id);
  if (!list) return;
  list.addEventListener('click', function(e) {
    if (!msgSel || msgSel.list !== list) return;
    e.stopPropagation();
    e.preventDefault();
    var el = e.target;
    while (el && el.parentNode !== list) el = el.parentNode;
    if (!el || !el._msg) return;
    togglePick(el);
    paintSelectBar();
  }, true);
  // 多选时双击头像不拍一拍
  list.addEventListener('dblclick', function(e) { if (msgSel && msgSel.list === list) e.stopPropagation(); }, true);
});

document.getElementById('crSelAll').addEventListener('click', function() {
  if (!msgSel) return;
  var els = selectableEls(msgSel.list), all = msgSel.picked.length === els.length;
  els.forEach(function(el) { togglePick(el, !all); });
  paintSelectBar();
});
document.getElementById('crSelDone').addEventListener('click', exitMsgSelect);

document.getElementById('crSelDel').addEventListener('click', function() {
  if (!msgSel || !msgSel.picked.length) return;
  var sel = msgSel, n = sel.picked.length;
  openPfEntryDel('删除选中的 ' + n + ' 条消息？删除后 TA 也不会再看到', function() {
    var hist = histOfList(sel.listId);
    sel.picked.forEach(function(el) {
      var i = hist.indexOf(el._msg);
      if (i >= 0) hist.splice(i, 1);
    });
    exitMsgSelect();
    saveHistories();
    renderRoomLists(openingChatCharIdx);
    showToast('✓ 已删除 ' + n + ' 条', 'success');
  });
});

// 收藏：选中的几条合成一条「聊天记录」收藏（按聊天里的先后顺序）
document.getElementById('crSelFav').addEventListener('click', function() {
  if (!msgSel || !msgSel.picked.length) return;
  var char = charList[openingChatCharIdx] || {};
  var charName = char.charAlias || char.charName || '角色';
  var myName = resolveCharAccount(char).nickname || '我';
  var lines = [], images = [];
  selectableEls(msgSel.list).filter(function(el) { return msgSel.picked.indexOf(el) >= 0; }).forEach(function(el) {
    var m = el._msg;
    if (m.imgSrc && !m.recalled) images.push(m.imgSrc);
    var text = m.recalled ? '[撤回了一条消息]' : m.pat ? '[拍一拍]' : m.action ? '[操作]' : m.imgSrc ? '[图片]'
      : m.voice ? '[语音]' + (m.transcript ? ' ' + m.transcript : '') : String(m.content || '').replace(/〔译〕/, '\n（译）');
    if (m.role === 'assistant') text = fillMacros(text, char);
    lines.push((m.role === 'user' ? myName : charName) + '：' + text);
  });
  addFav({ kind: 'text', text: lines.join('\n'), images: images, author: '聊天记录',
           source: '与 ' + charName + (msgSel.listId === 'dramaMsgList' ? ' 的剧情' : ' 的聊天'), time: Date.now() });
  exitMsgSelect();
});

// 离开聊天窗口、切换聊天 / 剧情时退出多选
(function() {
  var back = document.querySelector('#appChatRoom .back-btn');
  if (back) back.addEventListener('click', exitMsgSelect);
  [msgBtnChat, msgBtnContacts].forEach(function(b) { b.addEventListener('click', exitMsgSelect); });
})();

// =============================================
// 清空记录（角色设置「聊天」页）
// =============================================
function clearCharHistory(kind) {
  if (editingCharIndex < 0) { showToast('请先保存角色', 'error'); return; }
  var char = charList[editingCharIndex];
  var store = kind === 'drama' ? dramaHistories : chatHistories;
  var n = (store[char.id] || []).length;
  var label = kind === 'drama' ? '剧情' : '聊天';
  if (!n) { showToast('还没有' + label + '记录', 'success'); return; }
  openPfEntryDel('清空和「' + (char.charAlias || char.charName || '这个角色') + '」的全部' + label + '记录（' + n + ' 条）？清空后找不回来', function() {
    store[char.id] = [];
    saveHistories();
    if (openingChatCharIdx === editingCharIndex) { exitMsgSelect(); renderRoomLists(openingChatCharIdx); }
    if (typeof renderChatCharList === 'function') renderChatCharList();
    showToast('✓ 已清空' + label + '记录', 'success');
  });
}
document.getElementById('csClearChat').addEventListener('click', function() { clearCharHistory('chat'); });
document.getElementById('csClearDrama').addEventListener('click', function() { clearCharHistory('drama'); });
