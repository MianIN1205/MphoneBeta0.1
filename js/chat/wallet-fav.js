// 眠花糖机 — Chat「我的」：钱包（按账号分开）和收藏

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
      openConfirm('取消收藏这条内容？', function() { removeFav(f.id); renderFavs(); });
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
    kind: 'post', refId: post.id,
    text: (post.text || '') + (post.textImgs || []).map(function(t) { return '\n［文字图］' + t; }).join(''),
    images: (post.images || []).slice(),
    source: '动态', author: post.author.name, time: post.time
  });
}

// 切到「我的」时刷新余额和收藏数
document.querySelectorAll('.chat-tab-item').forEach(function(tab) {
  tab.addEventListener('click', function() { if (this.dataset.tab === 'mine') refreshMineEntries(); });
});
refreshMineEntries();
