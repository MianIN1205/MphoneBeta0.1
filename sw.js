// 眠花糖机 后台缓存程序（Service Worker）
// 联网优先：每次都先取最新版本，成功就顺便更新缓存；断网时才用缓存，保证离线也能打开。
// 只处理本站文件，AI / 语音 / 生图等外部接口请求完全不经过这里。

// 文件拆分后 css/、js/ 也要预先缓存；改动这个列表时把版本号加一
const CACHE = 'mphone-v42';
const CSS = ['core/base', 'core/app-screen', 'core/controls', 'core/avatar', 'core/image-picker',
             'desk/statusbar', 'desk/desktop', 'desk/widgets', 'desk/appearance', 'desk/bookshelf',
             'settings/settings', 'settings/mcp', 'desk/desk-apps', 'desk/memory-lib', 'core/dialogs',
             'chat/tabs', 'chat/header', 'chat/contacts', 'chat/list', 'chat/new-chat',
             'chat/feed', 'char/settings', 'chat/mine', 'chat/room', 'chat/messages',
             'chat/msg-menu', 'chat/msg-ops', 'chat/calendar', 'chat/quick-bar', 'chat/status-panel',
             'chat/stickers', 'char/look', 'char/assistant', 'prompt/prompt', 'desk/pet', 'chat/file-send', 'chat/peek', 'desk/places', 'desk/books']
  .map(function (n) { return './css/' + n + '.css'; });
const JS = ['core/boot', 'core/utils', 'desk/statusbar', 'settings/api', 'core/api-errors',
            'desk/screens', 'desk/appearance', 'chat/tabs', 'desk/bookshelf', 'chat/header',
            'chat/room-view', 'char/settings', 'chat/contacts', 'chat/new-chat', 'char/settings-save',
            'chat/list', 'chat/room', 'char/look', 'prompt/tabs', 'prompt/worldbook',
            'prompt/cot', 'prompt/style-lib', 'prompt/presets', 'prompt/scene', 'core/image-picker', 'desk/appearance-store',
            'settings/data', 'settings/api-restore', 'chat/history', 'chat/prompt', 'chat/render',
            'chat/reply', 'chat/input', 'chat/voice', 'chat/room-lists', 'chat/mine',
            'chat/feed', 'char/auto', 'char/summary', 'char/backup', 'char/import',
            'desk/memory-open', 'settings/media-api', 'chat/wallet-fav', 'chat/msg-menu', 'chat/media-send', 'chat/file-send', 'chat/compose-plus', 'chat/img-use', 'char/look-share', 'desk/desk-icons', 'chat/msg-shot', 'char/css-preview', 'chat/peek',
            'core/image-viewer', 'char/assistant', 'settings/assist', 'core/llm', 'core/mcp', 'core/mcp-builtin',
            'desk/gallery', 'desk/anniv', 'desk/diary', 'desk/widgets', 'char/memory',
            'desk/memory-lib', 'chat/quick-bar', 'chat/status-panel', 'chat/stickers', 'chat/msg-ops',
            'settings/backup', 'chat/calendar', 'core/errors', 'char/archive', 'chat/opening', 'desk/places', 'desk/pet', 'desk/letters', 'desk/greenhouse', 'desk/starjar', 'desk/books', 'chat/moments', 'char/life', 'char/migrate', 'prompt/wb-import']
  .map(function (n) { return './js/' + n + '.js'; });
const CORE = ['./', './index.html', './manifest.webmanifest',
              './icons/icon.png', './icons/logo.png', './icons/badge.png', './icons/mianin.jpg']
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
