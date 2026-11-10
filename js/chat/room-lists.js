// 眠花糖机 — 打开聊天室：画聊天和剧情两个列表（分页加载更早的）、相册发图、加号抽屉按钮

// 打开对话室时初始化消息列表与剧情列表，并绑定底栏相册图片按钮与加号扩展面板
(function() {
  var crAlbumBtn       = document.getElementById('crAlbumBtn');
  var crAlbumFileInput = document.getElementById('crAlbumFileInput');
  var chatRoomContent  = document.getElementById('chatRoomContent');

  // 点击剧情底栏「图片」按钮 → 打开设备相册发送图片
  if (crAlbumBtn && crAlbumFileInput) {
    // 相册：弹出「照片 / 拍照 / 文字图片」三选一（js/chat/compose-plus.js）
    crAlbumBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (typeof openAlbumPick === 'function') openAlbumPick(crAlbumBtn);
      else { crAlbumFileInput.value = ''; crAlbumFileInput.click(); }
    });

    crAlbumFileInput.addEventListener('change', function() { sendPickedImage(this.files); });   // 能多选
  }
})();
// 选好（或拍好）的照片：先在小手机里看一眼再发（用户要的）；相册能多选（最多 9 张），预览里点一张取消 / 选上，长按看大图
// 和回车一样，只发自己的，不叫 AI
var PICK_MAX = 9;
function confirmPickedImage(srcs, onSend) {
  if (typeof srcs === 'string') srcs = [srcs];
  var on = srcs.map(function() { return true; });
  var ov = document.createElement('div');
  ov.className = 'mine-acc-overlay open';
  ov.style.zIndex = '2600';
  var one = srcs.length === 1;
  ov.innerHTML = '<div class="mine-acc-modal pick-modal">' + (one ? '' : '<div class="mine-acc-title pick-title"></div>') +
    '<div class="' + (one ? 'pick-one' : 'pick-grid') + '"></div>' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close">取消</button><button class="mine-acc-btn mine-acc-btn-add">发送</button></div></div>';
  var grid = ov.querySelector(one ? '.pick-one' : '.pick-grid'), sendBtn = ov.querySelector('.mine-acc-btn-add');
  var sync = function() {
    var n = on.filter(Boolean).length;
    if (!one) ov.querySelector('.pick-title').textContent = '选了 ' + n + ' 张' + (srcs.length > n ? '（共 ' + srcs.length + ' 张）' : '');
    sendBtn.textContent = one ? '发送' : '发送（' + n + '）';
    sendBtn.disabled = !n;
  };
  srcs.forEach(function(src, i) {
    var cell = document.createElement('div');
    cell.className = 'pick-cell on';
    var img = document.createElement('img');
    img.src = src; img.alt = '';
    cell.appendChild(img);
    if (!one) {
      var mark = document.createElement('i');
      cell.appendChild(mark);
      var big = function() { if (typeof openImgViewer === 'function') openImgViewer(src); };
      if (typeof bindPress === 'function') bindPress(cell, function() { on[i] = !on[i]; cell.classList.toggle('on', on[i]); sync(); }, big);
      else cell.addEventListener('click', function() { on[i] = !on[i]; cell.classList.toggle('on', on[i]); sync(); });
    }
    grid.appendChild(cell);
  });
  sync();
  var close = function() { ov.remove(); };
  ov.querySelector('.mine-acc-btn-close').addEventListener('click', close);
  sendBtn.addEventListener('click', function() { close(); onSend(srcs.filter(function(_, i) { return on[i]; })); });
  ov.addEventListener('click', function(e) { if (e.target === ov) close(); });
  (document.querySelector('.phone') || document.body).appendChild(ov);
}
function sendPickedImage(files) {
  if (!files || openingChatCharIdx === -1) return;
  var list = Array.prototype.slice.call(files.length !== undefined ? files : [files], 0, PICK_MAX);
  if (!list.length) return;
  if (files.length > PICK_MAX) showToast('一次最多选 ' + PICK_MAX + ' 张，先发前 ' + PICK_MAX + ' 张', 'plain');
  var srcs = [], left = list.length;
  var finish = function() {
    if (--left) return;
    var got = srcs.filter(Boolean);
    if (!got.length) { showToast('图片读不出来', 'error'); return; }
    confirmPickedImage(got, function(chosen) {
      var hist = getActiveHistory(openingChatCharIdx), now = Date.now();
      chosen.forEach(function(src, k) {
        var im = { role: 'user', content: '[图片消息]', imgSrc: src, time: now + k };
        if (k === 0 && pendingQuote) { im.quote = pendingQuote; clearQuote(); }
        hist.push(im);
        renderHistMsg(im);
      });
      saveHistories();
    });
  };
  list.forEach(function(file, i) {
    var reader = new FileReader();
    reader.onload = function(ev) { compressImage(ev.target.result, 1024, function(dataUrl) { srcs[i] = dataUrl; finish(); }); };
    reader.onerror = finish;
    reader.readAsDataURL(file);
  });
}
(function() {
  var crAlbumFileInput = document.getElementById('crAlbumFileInput');
  var chatRoomContent  = document.getElementById('chatRoomContent');

  // 点击底栏「+」按钮 → 底栏上升，下方展开/收起 4×2 微信小功能面板
  if (crPlusBtn && crPlusPanel) {
    crPlusBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleCrDrawer(crPlusPanel, crPlusBtn);
    });

    // 表情键 → 升起表情包抽屉（内容暂时留空）
    if (crEmojiBtn && crEmojiPanel) {
      crEmojiBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleCrDrawer(crEmojiPanel, crEmojiBtn);
      });
    }

    // 点击 4×2 面板中的功能按键（其中「相册」也可直接调起设备相册发送图片）
    crPlusPanel.querySelectorAll('.cr-plus-item').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var funcName = this.dataset.func || '';
        var curC = charList[openingChatCharIdx];
        if (curC && curC.isGroup && (funcName === '查手机' || funcName === '一起看')) { showToast('群聊里用不了「' + funcName + '」', 'plain'); return; }
        // 群里的小互动（js/chat/group-play.js）：投票、抽奖、拼手气红包
        if (curC && curC.isGroup && typeof gpOpenVote === 'function' && { '投票': 1, '抽奖': 1, '红包': 1 }[funcName]) {
          (funcName === '投票' ? gpOpenVote : funcName === '抽奖' ? gpOpenLottery : gpOpenHb)();
          return;
        }
        if (funcName === '相册' && crAlbumFileInput) {
          // 抽屉先不收，小菜单从「相册」这个图标上方冒出来（用户要的）；选好了再收
          if (typeof openAlbumPick === 'function') openAlbumPick(this.querySelector('.cr-plus-box') || this);
          else { closeCrPlusPanel(); crAlbumFileInput.value = ''; crAlbumFileInput.click(); }
        } else if (funcName === '文件' && typeof openChatFilePicker === 'function') {
          openChatFilePicker();
        } else if (funcName === '查手机' && typeof openPeek === 'function') {
          closeCrPlusPanel();
          openPeek(openingChatCharIdx);
        } else if (funcName === '提示词' && typeof openPromptPreview === 'function') {
          // 看这次会发给 TA 什么：直接打开当前这个角色、当前这个窗口的，先显示精简版
          closeCrPlusPanel();
          openPromptPreview({ charId: charList[openingChatCharIdx] && charList[openingChatCharIdx].id, view: currentCrSubView === 'contacts' ? 'drama' : 'chat', compact: true });
        } else if (funcName === '一起看' && typeof openTogether === 'function') {
          closeCrPlusPanel();
          openTogether(openingChatCharIdx);
        } else {
          showToast('「' + funcName + '」功能开发中', 'success');
        }
      });
    });
  }

  // 加号抽屉两页：左右滑，下面两个小圆点
  var plusPages = document.getElementById('crPlusPages');
  if (plusPages) plusPages.addEventListener('scroll', function() {
    var cur = Math.round(plusPages.scrollLeft / Math.max(1, plusPages.clientWidth));
    document.querySelectorAll('#crPlusDots i').forEach(function(d, i) { d.classList.toggle('on', i === cur); });
  });

  // 点击聊天内容区或聚焦输入框时收起底部加号面板
  if (chatRoomContent) {
    chatRoomContent.addEventListener('click', function() {
      closeCrPlusPanel();
    });
  }
  if (crInput) {
    crInput.addEventListener('focus', function() {
      closeCrPlusPanel();
    });
  }

  var origRender = renderChatCharList;
  renderChatCharList = function() {
    origRender();
    document.querySelectorAll('#chatCharList .chat-char-card').forEach(function(card) {
      card.addEventListener('click', function() {
        chatRoomSession++;   // 新的一次对话：角色设置界面回到第一页
        // 这个监听是抢先执行的（比消息列表里「打开对话」那个早），先记下现在打开的是谁，
        // 否则画消息时头像、名字、{{char}} 用的还是上一个打开的角色
        openingChatCharIdx = parseInt(this.dataset.index, 10);
        msgBtnChat.classList.remove('has-new'); msgBtnContacts.classList.remove('has-new');   // 换了一个角色，另一边的小红点不算数了
        renderRoomLists(openingChatCharIdx);
      }, true);
    });
  };
  renderChatCharList();
})();

// 打开对话时绘制聊天、剧情两个列表；只画最近 ROOM_PAGE 条，滑到顶部再加载更早的
var ROOM_PAGE = 50;
function renderMsgPage(list, empty, hist, count) {
  list.innerHTML = '';
  list._away = false;
  if (typeof crPillReset === 'function') crPillReset(list);
  list.appendChild(empty);
  empty.style.display = hist.length ? 'none' : 'flex';
  var start = Math.max(0, hist.length - count);
  list._hist = hist;
  list._empty = empty;
  list._firstMsg = hist[start] || null;
  list._lastTime = 0;
  list._altTime = 0;
  list._needBottom = true;   // 隐藏时设不了滚动位置，显示出来后再滚到底
  if (start > 0) {
    var more = document.createElement('div');
    more.className = 'cr-load-more';
    more.textContent = '上滑查看更早的消息';
    list.appendChild(more);
  }
  if (start === 0 && typeof errRenderSaved === 'function') errRenderSaved(list, null, null, hist);
  hist.slice(start).forEach(function(m) {
    var row = renderHistMsg(m, list, empty);
    if (m.errs && typeof errRenderSaved === 'function') errRenderSaved(list, m, row, hist);
  });
}
// 滑到顶部：多画一页，并保持当前看到的位置不动
function loadEarlierMsgs(list) {
  var hist = list._hist;
  if (!hist || list._loading || list._needBottom) return;
  var start = hist.indexOf(list._firstMsg);
  if (start <= 0) return;
  list._loading = true;
  var oldH = list.scrollHeight, oldTop = list.scrollTop;
  renderMsgPage(list, list._empty, hist, hist.length - start + ROOM_PAGE);
  list._needBottom = false;
  list.scrollTop = list.scrollHeight - oldH + oldTop;
  list._loading = false;
}
['chatMsgList', 'dramaMsgList'].forEach(function(id) {
  var list = document.getElementById(id);
  if (list) list.addEventListener('scroll', function() { if (list.scrollTop < 30) loadEarlierMsgs(list); });
});
function scrollPendingLists() {
  ['chatMsgList', 'dramaMsgList'].forEach(function(id) {
    var list = document.getElementById(id);
    if (list && list._needBottom && list.clientHeight) { list.scrollTop = list.scrollHeight; list._needBottom = false; }
  });
}

function renderRoomLists(idx) {
  // 聊天子视图
  var list = document.getElementById('chatMsgList');
  var emptyDiv = document.createElement('div');
  emptyDiv.className = 'chat-room-empty'; emptyDiv.id = 'chatRoomEmpty';
  emptyDiv.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span>开始聊天吧</span>';
  renderMsgPage(list, emptyDiv, getChatHistory(idx), ROOM_PAGE);

  // 剧情子视图
  var dList = document.getElementById('dramaMsgList');
  if (!dList) { setTimeout(scrollPendingLists, 0); if (typeof genReattach === 'function') genReattach(); return; }
  var dEmpty = document.createElement('div');
  dEmpty.className = 'drama-empty-hint'; dEmpty.id = 'dramaRoomEmpty';
  dEmpty.innerHTML = '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="17" y1="7" x2="22" y2="7"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="2" y1="17" x2="7" y2="17"></line></svg><span>暂无剧情</span>';
  var dHist = getDramaHistory(idx);
  renderMsgPage(dList, dEmpty, dHist, ROOM_PAGE);

  // 剧情还没开始：添加开场白（粘贴）/ 随机开场白（AI 写），也可以直接发消息开始（见 js/chat/opening.js）
  if (!dHist.length) {
    var picker = document.createElement('div');
    picker.className = 'drama-opening-picker';
    [['add', '添加开场白'], ['rand', '随机开场白']].forEach(function(b) {
      var btn = document.createElement('button');
      btn.className = 'drama-opening-btn';
      btn.textContent = b[1];
      btn.addEventListener('click', function(e) { e.stopPropagation(); if (typeof openOpening === 'function') openOpening(idx, b[0]); });
      picker.appendChild(btn);
    });
    var tip = document.createElement('div');
    tip.className = 'drama-opening-title';
    tip.textContent = '也可以直接发消息开始';
    dEmpty.appendChild(picker);
    dEmpty.appendChild(tip);
  }
  if (typeof genReattach === 'function') genReattach();   // 这个角色还在生成的回复放回去
  setTimeout(scrollPendingLists, 0);
}
