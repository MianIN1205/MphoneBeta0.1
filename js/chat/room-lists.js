// 眠花糖机 — 打开聊天室：画聊天和剧情两个列表（分页加载更早的）、相册发图、加号抽屉按钮

// 打开对话室时初始化消息列表与剧情列表，并绑定底栏相册图片按钮与加号扩展面板
(function() {
  var crAlbumBtn       = document.getElementById('crAlbumBtn');
  var crAlbumFileInput = document.getElementById('crAlbumFileInput');
  var chatRoomContent  = document.getElementById('chatRoomContent');

  // 点击剧情底栏「图片」按钮 → 打开设备相册发送图片
  if (crAlbumBtn && crAlbumFileInput) {
    crAlbumBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      crAlbumFileInput.value = '';
      crAlbumFileInput.click();
    });

    crAlbumFileInput.addEventListener('change', function() {
      var file = this.files && this.files[0];
      if (!file || openingChatCharIdx === -1) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        compressImage(ev.target.result, 1024, function(dataUrl) {
          var im = { role: 'user', content: '[图片消息]', imgSrc: dataUrl, time: Date.now() };
          if (pendingQuote) { im.quote = pendingQuote; clearQuote(); }
          getActiveHistory(openingChatCharIdx).push(im);
          renderHistMsg(im);
          saveHistories();
        });
      };
      reader.readAsDataURL(file);
    });
  }

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
        if (funcName === '相册' && crAlbumFileInput) {
          crAlbumFileInput.value = '';
          crAlbumFileInput.click();
          closeCrPlusPanel();
        } else if (funcName === '文件' && typeof openChatFilePicker === 'function') {
          openChatFilePicker();
        } else if (funcName === '查手机' && typeof openPeek === 'function') {
          closeCrPlusPanel();
          openPeek(openingChatCharIdx);
        } else {
          showToast('「' + funcName + '」功能开发中', 'success');
        }
      });
    });
  }

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
  if (!dList) { setTimeout(scrollPendingLists, 0); return; }
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
  setTimeout(scrollPendingLists, 0);
}
