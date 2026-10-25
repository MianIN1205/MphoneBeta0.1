// 眠花糖机 后台缓存程序（Service Worker）
// 联网优先：每次都先取最新版本，成功就顺便更新缓存；断网时才用缓存，保证离线也能打开。
// 只处理本站文件，AI / 语音 / 生图等外部接口请求完全不经过这里。

// 文件拆分后 css/、js/ 也要预先缓存；改动这个列表时把版本号加一
const CACHE = 'mphone-v9';
const CSS = ['base', 'appearance', 'chat', 'notes', 'chat-list', 'char-settings', 'chat-room', 'mine',
             'dialogs', 'char-look', 'prompt', 'image-picker', 'messages', 'settings-subnav', 'prompt-presets']
  .map(function (n) { return './css/' + n + '.css'; });
const JS = ['00-boot', '01-core', '02-screens-appearance', '03-chat-tabs', '04-notes', '05-msg-controls',
            '06-char-settings', '07-chat-list-room', '08-char-look', '09-prompt', '10-image-picker',
            '11-persistence-data', '12-api-config', '13-chat-messages', '14-voice-room', '15-mine',
            '16-feed-auto', '17-memory-import', '18-media-api', '19-wallet-fav-menu', '20-media-send',
            '21-image-viewer', '22-assistant', '23-assist', '24-llm',
            '25-mcp', '26-desk-apps', '27-widgets', '28-memory']
  .map(function (n) { return './js/' + n + '.js'; });
const CORE = ['./', './index.html', './manifest.webmanifest',
              './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png']
  .concat(CSS, JS);

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-store' }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});

// 点系统通知：已经开着就切回去并打开对应对话；没开着就打开应用，网址里带上要打开的对话
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var data = event.notification.data || {};
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if ('focus' in list[i]) {
        list[i].postMessage({ type: 'mphone-open', open: data.open, charId: data.charId });
        return list[i].focus();
      }
    }
    return self.clients.openWindow('./?open=' + encodeURIComponent(data.open || 'chat') + '&char=' + encodeURIComponent(data.charId || ''));
  }));
});
