// 眠花糖机 — 「我的」— 钱包（按账号分开）与收藏

// =============================================
// 「我的」— 钱包（按账号分开）与收藏
// =============================================
// 钱包：{ 账号 uid: { balance, records: [{ id, amount, note, time }] } }，amount 正为收入、负为支出
function loadWallets() { return mphoneStore.load('mphone_wallet', {}) || {}; }
function getWallet(uid) {
  var all = loadWallets();
  return all[uid] || { balance: 0, records: [] };
}
// 记一笔账（以后红包、转账等功能也调用这里），返回新余额
function walletAdd(amount, note, uid) {
  uid = uid || getMainAccount().uid;
  var all = loadWallets();
  var w = all[uid] || { balance: 0, records: [] };
  w.balance = Math.round((w.balance + amount) * 100) / 100;
  w.records.unshift({ id: genFeedId('w'), amount: amount, note: note || (amount >= 0 ? '收入' : '支出'), time: Date.now() });
  all[uid] = w;
  mphoneStore.save('mphone_wallet', all);
  return w.balance;
}
function fmtMoney(n) { return (Math.round(n * 100) / 100).toFixed(2); }

// 收藏：内容快照单独保存，原消息 / 动态删除后仍在
// { id, kind: 'text' | 'image' | 'post', text, images: [], source, author, time, savedAt, refId }
function loadFavs() { return mphoneStore.load('mphone_favorites', []) || []; }
function saveFavs(list) { mphoneStore.save('mphone_favorites', list); }
function addFav(item) {
  var list = loadFavs();
  if (item.refId && list.some(function(f) { return f.refId === item.refId; })) {
    showToast('已经收藏过了', 'success');
    return;
  }
  item.id = genFeedId('f');
  item.savedAt = Date.now();
  list.unshift(item);
  saveFavs(list);
  refreshMineEntries();
  showToast('✓ 已收藏', 'success');
}
function removeFav(id) {
  saveFavs(loadFavs().filter(function(f) { return f.id !== id && f.refId !== id; }));
  refreshMineEntries();
}
function isFavRef(refId) { return loadFavs().some(function(f) { return f.refId === refId; }); }

// 「我的」入口上的余额 / 收藏数
function refreshMineEntries() {
  var bal = document.getElementById('mineWalletBalance');
  var cnt = document.getElementById('mineFavCount');
  if (!bal || !cnt) return;
  bal.textContent = '¥' + fmtMoney(getWallet(getMainAccount().uid).balance);
  var n = loadFavs().length;
  cnt.textContent = n ? n + ' 条' : '';
}

// ---------- 钱包页面 ----------
var appWallet = document.getElementById('appWallet');
function renderWallet() {
  var acc = getMainAccount();
  var w = getWallet(acc.uid);
  document.getElementById('walletOwner').textContent = (acc.nickname || '我') + ' ' + (acc.id || '');
  document.getElementById('walletBalance').textContent = fmtMoney(w.balance);
  var box = document.getElementById('walletRecords');
  box.innerHTML = '';
  if (!w.records.length) {
    box.innerHTML = '<div class="auto-hint" style="padding:12px 0;text-align:center;">还没有收支记录</div>';
    return;
  }
  w.records.forEach(function(r) {
    var row = document.createElement('div');
    row.className = 'wallet-rec';
    var main = document.createElement('div');
    main.className = 'wallet-rec-main';
    var note = document.createElement('div');
    note.className = 'wallet-rec-note';
    note.textContent = r.note;
    var time = document.createElement('div');
    time.className = 'wallet-rec-time';
    var d = new Date(r.time);
    time.textContent = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    main.appendChild(note);
    main.appendChild(time);
    var amt = document.createElement('div');
    amt.className = 'wallet-rec-amt' + (r.amount < 0 ? ' out' : '');
    amt.textContent = (r.amount >= 0 ? '+' : '') + fmtMoney(r.amount);
    row.appendChild(main);
    row.appendChild(amt);
    box.appendChild(row);
  });
}
document.getElementById('mineWalletEntry').addEventListener('click', function() {
  renderWallet();
  appWallet.classList.add('active');
});
document.getElementById('backWallet').addEventListener('click', function() {
  appWallet.classList.remove('active');
  refreshMineEntries();
});
// 充值：复用「备注名称」小弹窗输入金额
var _walletTopupPending = false;
document.getElementById('walletTopupBtn').addEventListener('click', function() {
  presetModalMode = 'wallet';
  _walletTopupPending = true;
  document.querySelector('#presetModal .modal-title').textContent = '充值金额（元）';
  presetNameInput.value = '';
  presetModal.classList.add('open');
  presetNameInput.focus();
});
function confirmWalletTopup(text) {
  var amount = Math.round(parseFloat(text) * 100) / 100;
  if (!(amount > 0) || amount > 1e8) return false;
  walletAdd(amount, '充值');
  renderWallet();
  refreshMineEntries();
  showToast('✓ 已充值 ¥' + fmtMoney(amount), 'success');
  return true;
}

// ---------- 收藏页面 ----------
var appFav = document.getElementById('appFav');
var favKind = 'all';
function renderFavs() {
  var list = document.getElementById('favList');
  list.innerHTML = '';
  var items = loadFavs().filter(function(f) { return favKind === 'all' || f.kind === favKind; });
  if (!items.length) {
    list.innerHTML = '<div class="feed-empty-hint">还没有收藏</div>';
    return;
  }
  items.forEach(function(f) {
    var el = document.createElement('div');
    el.className = 'fav-item';
    var head = document.createElement('div');
    head.className = 'fav-item-head';
    var info = document.createElement('span');
    var d = new Date(f.time || f.savedAt);
    info.textContent = (f.source || '') + (f.author ? ' · ' + f.author : '') + ' · ' + (d.getMonth() + 1) + '/' + d.getDate();
    var un = document.createElement('button');
    un.textContent = '取消收藏';
    un.addEventListener('click', function() {
      openPfEntryDel('取消收藏这条内容？', function() { removeFav(f.id); renderFavs(); });
    });
    head.appendChild(info);
    head.appendChild(un);
    el.appendChild(head);
    if (f.text) {
      var t = document.createElement('div');
      t.className = 'fav-item-text';
      t.textContent = f.text;
      el.appendChild(t);
    }
    if (f.images && f.images.length) {
      var imgs = document.createElement('div');
      imgs.className = 'fav-item-imgs' + (f.images.length === 1 ? ' single' : '');
      f.images.forEach(function(src) {
        var img = document.createElement('img');
        img.src = src;
        imgs.appendChild(img);
      });
      el.appendChild(imgs);
    }
    list.appendChild(el);
  });
}
document.querySelectorAll('#favFilter .fav-filter-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    favKind = this.dataset.kind;
    document.querySelectorAll('#favFilter .fav-filter-btn').forEach(function(b) { b.classList.toggle('active', b === btn); });
    renderFavs();
  });
});
document.getElementById('mineFavEntry').addEventListener('click', function() {
  renderFavs();
  appFav.classList.add('active');
});
document.getElementById('backFav').addEventListener('click', function() {
  appFav.classList.remove('active');
  refreshMineEntries();
});

// 动态收藏（按钮在每条动态下方）
function toggleFavPost(post) {
  if (isFavRef(post.id)) { removeFav(post.id); showToast('已取消收藏', 'success'); return; }
  addFav({
    kind: 'post', refId: post.id, text: post.text || '', images: (post.images || []).slice(),
    source: '动态', author: post.author.name, time: post.time
  });
}

// ---------- 聊天消息长按：收藏 / 复制 ----------
var msgCtxMenu = document.getElementById('msgCtxMenu');
var ctxTarget = null;     // { kind, text, images, author }
var suppressClick = false;

function closeMsgCtx() { msgCtxMenu.classList.remove('open'); ctxTarget = null; }

function snapshotBubble(bubble) {
  var row = bubble.closest('.chat-msg-row');
  var isUser = row && row.classList.contains('user');
  var char = charList[openingChatCharIdx] || {};
  var author = isUser ? (resolveCharAccount(char).nickname || '我') : (char.charAlias || char.charName || '角色');
  var img = bubble.querySelector('img');
  if (img) return { kind: 'image', text: '', images: [img.src], author: author };
  if (bubble.querySelector('.voice-bubble-inner')) {
    var vm = row && row._msg;
    return { kind: 'text', text: '[语音消息]' + (vm && vm.transcript ? '：' + vm.transcript : ''), images: [], author: author };
  }
  var tr = bubble.querySelector('.cr-translation');
  var text = tr ? bubble.firstChild.textContent + '\n（译）' + tr.textContent : bubble.textContent;
  return { kind: 'text', text: text, images: [], author: author };
}

['chatMsgList', 'dramaMsgList'].forEach(function(listId) {
  var list = document.getElementById(listId);
  var timer = null, sx = 0, sy = 0;
  list.addEventListener('pointerdown', function(e) {
    var bubble = e.target.closest('.chat-msg-bubble');
    if (!bubble || bubble.querySelector('.typing-dots')) return;
    sx = e.clientX; sy = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(function() {
      timer = null;
      ctxTarget = snapshotBubble(bubble);
      ctxTarget.source = '与 ' + chatRoomTitle.textContent + (listId === 'dramaMsgList' ? ' 的剧情' : ' 的聊天');
      var row = bubble.closest('.chat-msg-row');
      ctxTarget.row = row;
      ctxTarget.bubble = bubble;
      ctxTarget.listId = listId;
      ctxTarget.msg = row && row._msg;
      ctxTarget.isUser = !!(row && row.classList.contains('user'));
      // 按消息类型显示可用操作：撤回只限自己的消息；图片、语音不能编辑
      var m = ctxTarget.msg;
      var show = {
        quote:  !!m,
        edit:   !!m && !m.imgSrc,
        recall: !!m && ctxTarget.isUser,
        // 重新生成只对最新一组回复，且当前没在生成
        regen:  !!m && !ctxTarget.isUser && !genState && trailingReplyGroup(histOfList(listId)).msgs.indexOf(m) >= 0,
        delete: true, fav: true, copy: true
      };
      msgCtxMenu.querySelectorAll('button').forEach(function(btn) { btn.classList.toggle('hide', !show[btn.dataset.act]); });
      var r = bubble.getBoundingClientRect();
      msgCtxMenu.classList.add('open');
      var mw = msgCtxMenu.offsetWidth, mh = msgCtxMenu.offsetHeight;
      var left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left + r.width / 2 - mw / 2));
      var top = r.top - mh - 6 < 8 ? r.bottom + 6 : r.top - mh - 6;
      msgCtxMenu.style.left = left + 'px';
      msgCtxMenu.style.top = top + 'px';
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
    setQuote({ author: t.author, text: qt.length > 60 ? qt.slice(0, 60) + '…' : qt });
  } else if (act === 'edit') {
    openMsgEdit(t);
  } else if (act === 'regen') {
    regenerateLast();
  } else if (act === 'recall') {
    recallMsg(t);
  } else if (act === 'delete') {
    openPfEntryDel('删除这条消息？删除后 TA 也不会再看到', function() { deleteMsg(t); });
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
  (t.row._extras || []).forEach(function(el) { el.remove(); });
  t.row.remove();
  saveHistories();
  var list = document.getElementById(t.listId);
  if (!list.querySelector('.chat-msg-row, .cr-recall-notice')) {
    var empty = list.querySelector('.chat-room-empty, .drama-empty-hint');
    if (empty) empty.style.display = 'flex';
  }
}

// 撤回：原位置换成撤回提示，保留原文供「重新编辑」，TA 只知道撤回了一条消息
function recallMsg(t) {
  var m = t.msg;
  m.recalled = true;
  m.recalledText = m.imgSrc ? '' : m.content;
  delete m.quote;
  delete m.status;
  var list = document.getElementById(t.listId);
  var notice = renderRecallNotice(m, list, null);
  list.insertBefore(notice, t.row);
  (t.row._extras || []).forEach(function(el) { el.remove(); });
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
msgEditOverlay.addEventListener('click', function(e) { if (e.target === msgEditOverlay) closeMsgEdit(); });
document.getElementById('msgEditSave').addEventListener('click', function() {
  var ta = document.getElementById('msgEditText');
  var text = ta.value.trim();
  if (!text) { shakeEl(ta); return; }
  var t = msgEditTarget;
  t.msg.content = text;
  setBubbleText(t.bubble, text, !t.isUser);
  saveHistories();
  closeMsgEdit();
  showToast('✓ 已修改', 'success');
});
document.addEventListener('pointerdown', function(e) {
  if (msgCtxMenu.classList.contains('open') && !msgCtxMenu.contains(e.target)) closeMsgCtx();
});

// 切到「我的」时刷新余额和收藏数
document.querySelectorAll('.chat-tab-item').forEach(function(tab) {
  tab.addEventListener('click', function() { if (this.dataset.tab === 'mine') refreshMineEntries(); });
});
refreshMineEntries();
