// 眠花糖机 — 启动：统一本地存储（IndexedDB）+ 加载各功能脚本

// =============================================
// 统一本地存储（IndexedDB）
// 启动时把全部数据读进内存，读取是同步的；写入先改内存，再合并批量写入 IndexedDB。
// IndexedDB 不可用时（隐私模式、静态预览等）退回 localStorage。
// =============================================
// 页面默认就是全屏；选过「手机边框」的，在第一次画出画面之前就换回边框（存储要异步读，所以单独记在 localStorage）
try {
  if (localStorage.getItem('mphoneFrameMode') === '1') {
    document.querySelector('.phone').classList.remove('fullscreen');
    document.body.classList.remove('phone-fullscreen');
  }
} catch (_) {}

var mphoneStore = (function() {
  var DB_NAME = 'mphone', STORE = 'kv';
  var cache = {};          // key → 已解析的值
  var dirty = {};          // 等待写入的 key
  var db = null;           // IndexedDB 连接；null 表示使用 localStorage
  var flushTimer = null;
  var warned = false;

  function warn(msg) {
    if (warned) return;
    warned = true;
    setTimeout(function() { if (typeof showToast === 'function') showToast(msg, 'error'); }, 0);
  }

  // localStorage 里旧版写入的值：JSON 文本或普通字符串（如 API 地址）
  function parseLegacy(raw) {
    try { return JSON.parse(raw); } catch (_) { return raw; }
  }

  function legacyKeys() {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('mphone_') === 0) keys.push(k);
      }
    } catch (_) {}
    return keys;
  }

  function openDb() {
    return new Promise(function(resolve, reject) {
      if (!window.indexedDB) { reject(new Error('no indexedDB')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function() { req.result.createObjectStore(STORE); };
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
    });
  }

  function readAll(conn) {
    return new Promise(function(resolve, reject) {
      var out = {};
      var tx = conn.transaction(STORE, 'readonly');
      var req = tx.objectStore(STORE).openCursor();
      req.onsuccess = function() {
        var cur = req.result;
        if (cur) { out[cur.key] = cur.value; cur.continue(); }
      };
      tx.oncomplete = function() { resolve(out); };
      tx.onerror = function() { reject(tx.error); };
    });
  }

  function writeKeys(keys) {
    if (!keys.length) return Promise.resolve();
    if (!db) {
      keys.forEach(function(k) {
        try {
          if (cache[k] === undefined) localStorage.removeItem(k);
          else localStorage.setItem(k, JSON.stringify(cache[k]));
        } catch (_) { warn('✗ 存储空间不足，部分数据未保存'); }
      });
      return Promise.resolve();
    }
    return new Promise(function(resolve) {
      var tx = db.transaction(STORE, 'readwrite');
      var os = tx.objectStore(STORE);
      keys.forEach(function(k) {
        if (cache[k] === undefined) os.delete(k);
        else os.put(cache[k], k);
      });
      tx.oncomplete = function() { resolve(); };
      tx.onerror = tx.onabort = function() {
        // 失败的 key 重新标记，下次再写
        keys.forEach(function(k) { dirty[k] = true; });
        warn('✗ 存储空间不足或写入失败，部分数据未保存');
        resolve();
      };
    });
  }

  function flush() {
    clearTimeout(flushTimer);
    flushTimer = null;
    var keys = Object.keys(dirty);
    dirty = {};
    return writeKeys(keys);
  }

  function scheduleFlush() {
    if (!flushTimer) flushTimer = setTimeout(flush, 250);
  }

  // 页面隐藏 / 关闭前立即写入
  document.addEventListener('visibilitychange', function() { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);

  return {
    init: function() {
      return openDb().then(function(conn) {
        db = conn;
        return readAll(conn);
      }).then(function(all) {
        cache = all;
        // 第一次使用 IndexedDB：把 localStorage 里的旧数据搬过来（旧数据保留作备份）
        if (!Object.keys(all).length) {
          var keys = legacyKeys();
          keys.forEach(function(k) { cache[k] = parseLegacy(localStorage.getItem(k)); });
          return writeKeys(keys);
        }
      }).then(function() {
        // 申请持久存储，降低空间紧张时被浏览器清理的风险
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function() {});
      }).catch(function() {
        db = null;
        legacyKeys().forEach(function(k) {
          try { cache[k] = parseLegacy(localStorage.getItem(k)); } catch (_) {}
        });
      });
    },
    load: function(key, def) {
      return cache[key] === undefined ? def : cache[key];
    },
    save: function(key, val) {
      cache[key] = (val === undefined) ? undefined : JSON.parse(JSON.stringify(val));
      dirty[key] = true;
      scheduleFlush();
      return true;
    },
    remove: function(key) {
      cache[key] = undefined;
      dirty[key] = true;
      scheduleFlush();
    },
    keys: function() {
      return Object.keys(cache).filter(function(k) { return cache[k] !== undefined; });
    },
    // 用一整份数据替换（导入备份用），写完后返回
    replaceAll: function(data) {
      var old = Object.keys(cache);
      cache = {};
      old.forEach(function(k) { cache[k] = undefined; });
      Object.keys(data).forEach(function(k) { cache[k] = data[k]; });
      dirty = {};
      return writeKeys(Object.keys(cache));
    },
    usingIndexedDB: function() { return !!db; },
    flush: flush
  };
})();

// 存储就绪后，按顺序加载各功能脚本（普通脚本，直接打开本地文件也能用）
var MPHONE_SCRIPTS = [
  "js/01-core.js",
  "js/02-screens-appearance.js",
  "js/03-chat-tabs.js",
  "js/04-notes.js",
  "js/05-msg-controls.js",
  "js/06-char-settings.js",
  "js/07-chat-list-room.js",
  "js/08-char-look.js",
  "js/09-prompt.js",
  "js/10-image-picker.js",
  "js/11-persistence-data.js",
  "js/12-api-config.js",
  "js/13-chat-messages.js",
  "js/14-voice-room.js",
  "js/15-mine.js",
  "js/16-feed-auto.js",
  "js/17-memory-import.js",
  "js/18-media-api.js",
  "js/19-wallet-fav-menu.js",
  "js/20-media-send.js",
  "js/21-image-viewer.js",
  "js/22-assistant.js",
  "js/23-assist.js",
  "js/24-llm.js",
  "js/25-mcp.js",
  "js/26-desk-apps.js",
  "js/27-widgets.js",
  "js/28-memory.js",
  "js/29-quick-bar.js",
  "js/30-status-panel.js",
  "js/31-stickers.js"
];

// 要等全部脚本执行完才能跑的初始化（会用到后面脚本里的函数），用 onMphoneReady 登记
var mphoneReadyFns = [];
function onMphoneReady(fn) { mphoneReadyFns.push(fn); }

// 载入页：加载完淡出；至少停留一小会儿免得一闪而过，万一卡住 10 秒后也收起来
var bootSplashStart = Date.now();
function hideBootSplash() {
  var el = document.getElementById('bootSplash');
  if (!el || el.classList.contains('hide')) return;
  setTimeout(function() {
    el.classList.add('hide');
    setTimeout(function() { el.remove(); }, 450);
  }, Math.max(0, 600 - (Date.now() - bootSplashStart)));
}
setTimeout(hideBootSplash, 10000);

mphoneStore.init().then(function() {
  MPHONE_SCRIPTS.forEach(function(src, i) {
    var s = document.createElement('script');
    s.src = src;
    s.async = false;   // 动态插入的脚本按插入顺序执行
    if (i === MPHONE_SCRIPTS.length - 1) s.onload = function() {
      mphoneReadyFns.forEach(function(fn) { try { fn(); } catch (e) { console.error(e); } });
      hideBootSplash();
    };
    document.body.appendChild(s);
  });
});

// 注册后台缓存程序：可安装为桌面程序、断网也能打开（直接打开本地文件时浏览器不支持，跳过）
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').catch(function(err) {
      console.warn('[Mphone] 后台缓存程序注册失败:', err);
    });
  });
}

