// 眠花糖机 — 辅助功能：系统通知 + 后台保活

// =============================================
// 辅助功能（设置 → 辅助功能）
// 通知：应用在后台时（切到桌面或其他软件），角色回复 / 主动消息 / 新动态从屏幕上方弹出系统通知，点通知回到对话。
// 后台保活：循环播放一段听不见的声音，让手机不那么快暂停这个网页。
// 只在应用还在后台运行时有效；彻底关掉后收不到（那需要推送服务器）。
// =============================================
var assistCfg = Object.assign({ notify: false, keepAlive: false }, mphoneStore.load('mphone_assist', {}));
function saveAssistCfg() { mphoneStore.save('mphone_assist', assistCfg); }

var notifyOnInput    = document.getElementById('notifyOn');
var keepAliveOnInput = document.getElementById('keepAliveOn');
var notifyHintEl     = document.getElementById('notifyHint');
var NOTIFY_HINT      = notifyHintEl.textContent;

function notifySupported() { return 'Notification' in window; }
function notifyReady() { return assistCfg.notify && notifySupported() && Notification.permission === 'granted'; }

function refreshAssistUI() {
  notifyOnInput.checked = notifyReady();
  keepAliveOnInput.checked = assistCfg.keepAlive;
  notifyHintEl.textContent = !notifySupported()
    ? '这个浏览器不支持系统通知。iPhone 需要 iOS 16.4 以上，并且从桌面图标打开。'
    : Notification.permission === 'denied'
      ? '通知权限被拒绝了，需要到手机设置里给这个应用（或浏览器）打开通知权限。'
      : NOTIFY_HINT;
}

notifyOnInput.addEventListener('change', function() {
  if (!this.checked) { assistCfg.notify = false; saveAssistCfg(); refreshAssistUI(); return; }
  if (!notifySupported()) { refreshAssistUI(); showToast('✗ 这个浏览器不支持系统通知', 'error'); return; }
  Notification.requestPermission().then(function(p) {
    assistCfg.notify = p === 'granted';
    saveAssistCfg();
    refreshAssistUI();
    showToast(p === 'granted' ? '✓ 已开启消息通知' : '✗ 没有得到通知权限', p === 'granted' ? 'success' : 'error');
  });
});

// 发一条系统通知（有后台缓存程序时用它发，安卓只认这种；直接打开本地文件时退回普通通知）
function showSystemNotification(title, body, opts) {
  var options = Object.assign({ body: body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }, opts || {});
  var direct = function() { try { new Notification(title, options); } catch (_) {} };
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) { direct(); return; }
  navigator.serviceWorker.getRegistration().then(function(reg) {
    if (reg) reg.showNotification(title, options).catch(direct);
    else direct();
  }, direct);
}
// 头像图片不太大时用作通知图标
function notifyIcon(char) {
  var av = char && char.charAvatar;
  return av && av.length < 300000 ? av : 'icons/icon-192.png';
}
// 角色发来的新消息（只在应用处于后台时通知）
function notifyNewMessages(char, added) {
  if (!notifyReady() || document.visibilityState === 'visible' || !char || !added || !added.length) return;
  var last = added[added.length - 1];
  var body = msgPreviewText(last) + (added.length > 1 ? '（共 ' + added.length + ' 条）' : '');
  showSystemNotification(char.charAlias || char.charName || '新消息', body,
    { icon: notifyIcon(char), tag: 'chat-' + char.id, renotify: true, data: { open: 'chat', charId: char.id } });
}
function notifyFeedPost(char, post) {
  if (!notifyReady() || document.visibilityState === 'visible' || !char) return;
  showSystemNotification((char.charAlias || char.charName || '角色') + ' 发布了新动态', post.text || '[图片]',
    { icon: notifyIcon(char), tag: 'feed', renotify: true, data: { open: 'feed' } });
}

// 点通知：打开对应的对话 / 动态
function openFromNotification(data) {
  data = data || {};
  if (!document.getElementById('appChat').classList.contains('active')) dockChat.click();
  if (data.open === 'feed') {
    if (appChatRoom.classList.contains('active')) document.querySelector('#appChatRoom .back-btn').click();
    var tab = document.querySelector('.chat-tab-item[data-tab="feed"]');
    if (tab) tab.click();
    return;
  }
  var idx = findCharIdx(data.charId);
  if (idx < 0) return;
  if (!charList[idx].inChat) { charList[idx].inChat = true; saveCharList(); renderChatCharList(); }
  if (appChatRoom.classList.contains('active') && openingChatCharIdx === idx) return;
  var msgTab = document.querySelector('.chat-tab-item[data-tab="messages"]');
  if (msgTab) msgTab.click();
  var card = document.querySelector('#chatCharList .chat-char-card[data-index="' + idx + '"]');
  if (card) card.click();
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'mphone-open') openFromNotification(e.data);
  });
}
// 应用没开着时点通知：网址带 ?open=…，加载完再打开
(function() {
  var q = new URLSearchParams(location.search);
  if (!q.get('open')) return;
  var data = { open: q.get('open'), charId: q.get('char') || '' };
  history.replaceState(null, '', location.pathname);
  onMphoneReady(function() { setTimeout(function() { openFromNotification(data); }, 300); });
})();

// ---------- 后台保活 ----------
// 一段 2 秒、音量极低（约 -70 dB）的噪声循环播放：人听不见，但系统会把应用当成「正在播放声音」，不会很快暂停
var keepAliveAudio = null;
function keepAliveSoundUrl() {
  var rate = 8000, n = rate * 2;
  var buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  function str(o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (var i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round((Math.random() * 2 - 1) * 10), true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function startKeepAlive() {
  if (!keepAliveAudio) {
    keepAliveAudio = new Audio(keepAliveSoundUrl());
    keepAliveAudio.loop = true;
    keepAliveAudio.setAttribute('playsinline', '');
  }
  if ('mediaSession' in navigator && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: '眠花糖机 后台运行中', artist: '后台保活', artwork: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }] });
  }
  return keepAliveAudio.play();
}
function stopKeepAlive() {
  if (keepAliveAudio) keepAliveAudio.pause();
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
}
// 浏览器要求先点一下屏幕才能放声音：开着保活时，下一次点击屏幕就开始
function armKeepAlive() {
  if (!assistCfg.keepAlive || (keepAliveAudio && !keepAliveAudio.paused)) return;
  document.addEventListener('pointerdown', function once() {
    document.removeEventListener('pointerdown', once, true);
    if (assistCfg.keepAlive) startKeepAlive().catch(function() {});
  }, true);
}
keepAliveOnInput.addEventListener('change', function() {
  assistCfg.keepAlive = this.checked;
  saveAssistCfg();
  if (this.checked) {
    startKeepAlive().then(function() { showToast('✓ 已开启后台保活', 'success'); },
      function() { showToast('✗ 没能开始播放，点一下屏幕后会自动开始', 'error'); armKeepAlive(); });
  } else {
    stopKeepAlive();
  }
});
// 被其他声音打断、或回到前台时，继续保活
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') armKeepAlive();
});

refreshAssistUI();
armKeepAlive();
