// 眠花糖机 — 备份：导出（分享面板 / 下载）、定期备份提醒、自动加密备份到 GitHub Gist

// =============================================
// 备份记录：上次本地导出 / 云端备份的时间、最近一次改动、提醒间隔
// 这一项不算「改动」，也不放进备份文件里
// =============================================
var BACKUP_META_KEY = 'mphone_backup_meta';
var backupMeta = Object.assign({ lastLocal: 0, lastCloud: 0, lastChange: 0, remindDays: 7, snooze: 0, cloudOn: false, gistId: '' },
  mphoneStore.load(BACKUP_META_KEY, {}));
var backupRawSave = mphoneStore.save;
function saveBackupMeta() { backupRawSave.call(mphoneStore, BACKUP_META_KEY, backupMeta); }

// 其他数据一有保存就记下「有新内容」，开着自动云备份时排一次备份
mphoneStore.save = function(key) {
  var r = backupRawSave.apply(mphoneStore, arguments);
  if (key !== BACKUP_META_KEY) {
    backupMeta.lastChange = Date.now();
    saveBackupMeta();
    scheduleCloudBackup();
  }
  return r;
};

function backupJson() {
  var data = {};
  mphoneStore.keys().forEach(function(k) { if (k !== BACKUP_META_KEY) data[k] = mphoneStore.load(k, null); });
  return JSON.stringify({ app: 'mphone', version: 2, data: data });
}
function backupFileName(ext) {
  var d = new Date();
  return 'mphone-backup-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.' + ext;
}
function fmtAgo(t) {
  if (!t) return '';
  var m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + ' 分钟前';
  if (m < 1440) return Math.floor(m / 60) + ' 小时前';
  return Math.floor(m / 1440) + ' 天前';
}
function paintBackupLast() {
  var parts = [];
  if (backupMeta.lastLocal) parts.push('本地 ' + fmtAgo(backupMeta.lastLocal));
  if (backupMeta.lastCloud) parts.push('云端 ' + fmtAgo(backupMeta.lastCloud));
  document.getElementById('backupLast').textContent = parts.length ? parts.join(' · ') : '还没有备份过';
}
function markLocalBackup() {
  backupMeta.lastLocal = Date.now();
  saveBackupMeta();
  paintBackupLast();
}

// =============================================
// 导出：分享面板（iPhone / 安卓都能存到「文件」、云盘、发微信），不支持分享时下载
// 安卓分享不认 .json，就换成 .txt（内容一样，导入时也认）
// =============================================
function shareBackupFiles(json) {
  if (!navigator.canShare) return null;
  var tries = [
    new File([json], backupFileName('json'), { type: 'application/json' }),
    new File([json], backupFileName('txt'), { type: 'text/plain' })
  ];
  for (var i = 0; i < tries.length; i++) {
    try { if (navigator.canShare({ files: [tries[i]] })) return [tries[i]]; } catch (_) {}
  }
  return null;
}
function downloadBackup(json) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = backupFileName('json');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
  markLocalBackup();
  showToast('✓ 已导出备份', 'success');
}
function shareBackup() {
  var json = backupJson(), files = shareBackupFiles(json);
  if (!files) { downloadBackup(json); return; }
  navigator.share({ files: files, title: '眠花糖机备份' }).then(function() {
    markLocalBackup();
    showToast('✓ 已导出备份', 'success');
  }, function(err) {
    if (err && err.name === 'AbortError') return;   // 自己点了取消
    downloadBackup(json);
  });
}

var backupExportOverlay = document.getElementById('backupExportOverlay');
function openBackupExport() {
  mphoneStore.flush();
  // 没有分享功能的浏览器（比如电脑）直接下载
  if (!shareBackupFiles('{}')) { downloadBackup(backupJson()); return; }
  backupExportOverlay.classList.add('open');
}
document.getElementById('backupShareBtn').addEventListener('click', function() {
  backupExportOverlay.classList.remove('open');
  shareBackup();
});
document.getElementById('backupDownloadBtn').addEventListener('click', function() {
  backupExportOverlay.classList.remove('open');
  downloadBackup(backupJson());
});
document.getElementById('backupExportCancel').addEventListener('click', function() { backupExportOverlay.classList.remove('open'); });

// =============================================
// 备份提醒：超过设定天数没备份、之后又有新内容，打开时提醒一次（「明天再说」一天内不再提醒）
// =============================================
var backupRemindSel = document.getElementById('backupRemind');
backupRemindSel.value = String(backupMeta.remindDays);
backupRemindSel.addEventListener('change', function() {
  backupMeta.remindDays = parseInt(this.value, 10) || 0;
  saveBackupMeta();
});
var backupRemindOverlay = document.getElementById('backupRemindOverlay');
function hasAnyChat() {
  var any = function(h) { return Object.keys(h || {}).some(function(k) { return h[k] && h[k].length; }); };
  return any(chatHistories) || any(dramaHistories);
}
function checkBackupRemind() {
  var days = backupMeta.remindDays, last = Math.max(backupMeta.lastLocal, backupMeta.lastCloud), now = Date.now();
  if (!days || !hasAnyChat() || backupMeta.lastChange <= last) return;
  if (last && now - last < days * 86400000) return;
  if (now - backupMeta.snooze < 86400000) return;
  document.getElementById('backupRemindText').textContent = (last ? '已经 ' + fmtAgo(last).replace('前', '') + '没有备份了。' : '还没有备份过。') +
    'iPhone 删掉桌面图标、换手机时，小手机里的数据会一起清空，存一份到外面更安心。';
  backupRemindOverlay.classList.add('open');
}
document.getElementById('backupRemindLater').addEventListener('click', function() {
  backupMeta.snooze = Date.now();
  saveBackupMeta();
  backupRemindOverlay.classList.remove('open');
});
document.getElementById('backupRemindNow').addEventListener('click', function() {
  backupRemindOverlay.classList.remove('open');
  shareBackup();
});

// =============================================
// 云端备份：先用备份密码加密（PBKDF2 + AES-GCM），再存进自己 GitHub 账号的私密 Gist
// 令牌和密码只放在这台手机的 localStorage（不带 mphone_ 前缀，不进备份）
// =============================================
var CLOUD_FILE = 'mphone-backup.enc.json', CLOUD_DESC = '眠花糖机备份（已加密）';
var cloudOnInput = document.getElementById('cloudOn');
var cloudTokenInput = document.getElementById('cloudToken');
var cloudPassInput = document.getElementById('cloudPass');
var cloudStatus = document.getElementById('cloudStatus');
function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }
function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (_) {} }
cloudOnInput.checked = !!backupMeta.cloudOn;
cloudTokenInput.value = lsGet('mphoneCloudToken');
cloudPassInput.value = lsGet('mphoneCloudPass');
cloudTokenInput.addEventListener('change', function() { lsSet('mphoneCloudToken', this.value.trim()); });
cloudPassInput.addEventListener('change', function() { lsSet('mphoneCloudPass', this.value); });
function cloudCreds() { return { token: cloudTokenInput.value.trim(), pass: cloudPassInput.value }; }
function paintCloudStatus(text) {
  cloudStatus.textContent = text || (backupMeta.lastCloud ? '上次云端备份：' + fmtAgo(backupMeta.lastCloud) : '');
}

function bufToB64(buf) {
  var u = new Uint8Array(buf), s = '';
  for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBuf(s) {
  var bin = atob(s), u = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function streamThrough(bytes, ts) {
  return new Response(new Blob([bytes]).stream().pipeThrough(ts)).arrayBuffer();
}
function cloudKey(pass, salt, iter) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']).then(function(k) {
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, k,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  });
}
// 聊天文字压缩后小很多；浏览器不支持压缩就直接加密
function encryptBackup(json, pass) {
  var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 200000;
  var raw = new TextEncoder().encode(json);
  var gz = typeof CompressionStream === 'function';
  return (gz ? streamThrough(raw, new CompressionStream('gzip')) : Promise.resolve(raw)).then(function(plain) {
    return cloudKey(pass, salt, iter).then(function(key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plain);
    });
  }).then(function(cipher) {
    return JSON.stringify({ app: 'mphone', enc: 'aes-gcm', kdf: 'pbkdf2-sha256', iter: iter, gz: gz,
      salt: bufToB64(salt), iv: bufToB64(iv), time: Date.now(), data: bufToB64(cipher) });
  });
}
function decryptBackup(text, pass) {
  var env = JSON.parse(text);
  if (!env || env.app !== 'mphone' || env.enc !== 'aes-gcm') return Promise.reject(new Error('云端的备份格式不对'));
  return cloudKey(pass, b64ToBuf(env.salt), env.iter).then(function(key) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(env.iv) }, key, b64ToBuf(env.data));
  }).catch(function() { throw new Error('备份密码不对'); }).then(function(plain) {
    if (!env.gz) return plain;
    if (typeof DecompressionStream !== 'function') throw new Error('这个浏览器解不开压缩过的备份');
    return streamThrough(new Uint8Array(plain), new DecompressionStream('gzip'));
  }).then(function(buf) {
    return { json: new TextDecoder().decode(buf), time: env.time };
  });
}

function ghFetch(path, token, opts) {
  opts = opts || {};
  opts.headers = Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, opts.headers || {});
  return fetch('https://api.github.com' + path, opts).then(function(r) {
    if (r.ok) return r.json();
    return r.json().catch(function() { return {}; }).then(function(j) {
      var msg = r.status === 401 ? '令牌不对或者过期了'
        : r.status === 403 ? '令牌没有 gist 权限，或者请求太频繁了'
        : r.status === 404 ? '找不到（令牌要勾上 gist 权限）'
        : r.status === 413 || r.status === 422 ? '备份太大，GitHub 不收（可以清理一些图片后再试）'
        : 'GitHub 返回错误 ' + r.status + (j.message ? '：' + j.message : '');
      var e = new Error(msg); e.status = r.status; throw e;
    });
  }, function() { throw new Error('连不上 GitHub，检查一下网络'); });
}
// 找到之前的备份 Gist（换手机后不用记 id）
function findBackupGist(token) {
  if (backupMeta.gistId) return Promise.resolve(backupMeta.gistId);
  return ghFetch('/gists?per_page=100', token).then(function(list) {
    var g = (list || []).filter(function(x) { return x.description === CLOUD_DESC || (x.files && x.files[CLOUD_FILE]); })[0];
    return g ? g.id : '';
  });
}

var cloudBusy = false, cloudTimer = null;
function cloudBackup(manual) {
  var c = cloudCreds();
  if (!c.token || !c.pass) {
    if (manual) showToast('先填好 GitHub 令牌和备份密码', 'error');
    return Promise.resolve(false);
  }
  if (cloudBusy) return Promise.resolve(false);
  cloudBusy = true;
  paintCloudStatus('正在备份到云端…');
  mphoneStore.flush();
  var started = Date.now();
  return encryptBackup(backupJson(), c.pass).then(function(content) {
    var body = { description: CLOUD_DESC, files: {} };
    body.files[CLOUD_FILE] = { content: content };
    return findBackupGist(c.token).then(function(id) {
      var create = function() {
        body.public = false;
        return ghFetch('/gists', c.token, { method: 'POST', body: JSON.stringify(body) });
      };
      if (!id) return create();
      return ghFetch('/gists/' + id, c.token, { method: 'PATCH', body: JSON.stringify(body) }).catch(function(e) {
        if (e.status === 404) { backupMeta.gistId = ''; return create(); }   // 之前那个被删掉了
        throw e;
      });
    });
  }).then(function(g) {
    backupMeta.gistId = g.id;
    backupMeta.lastCloud = started;
    saveBackupMeta();
    paintCloudStatus();
    paintBackupLast();
    if (manual) showToast('✓ 已备份到云端', 'success');
    return true;
  }).catch(function(e) {
    paintCloudStatus('云端备份没成功：' + e.message);
    if (manual) showToast('✗ ' + e.message, 'error');
    return false;
  }).then(function(ok) { cloudBusy = false; return ok; });
}

// 自动备份：有改动后等 2 分钟再备份（连着改只备份一次），两次之间至少隔半小时
function scheduleCloudBackup() {
  if (!backupMeta.cloudOn || cloudTimer) return;
  var wait = Math.max(2 * 60000, backupMeta.lastCloud + 30 * 60000 - Date.now());
  cloudTimer = setTimeout(function() {
    cloudTimer = null;
    if (backupMeta.cloudOn && backupMeta.lastChange > backupMeta.lastCloud) cloudBackup(false);
  }, wait);
}

cloudOnInput.addEventListener('change', function() {
  var c = cloudCreds();
  if (this.checked && (!c.token || !c.pass)) {
    this.checked = false;
    showToast('先填好 GitHub 令牌和备份密码', 'error');
    return;
  }
  backupMeta.cloudOn = this.checked;
  saveBackupMeta();
  if (this.checked) cloudBackup(true);
});
document.getElementById('cloudBackupNow').addEventListener('click', function() { cloudBackup(true); });

document.getElementById('cloudRestore').addEventListener('click', function() {
  var c = cloudCreds();
  if (!c.token || !c.pass) { showToast('先填好 GitHub 令牌和备份密码', 'error'); return; }
  showToast('正在从云端读取…', 'success');
  findBackupGist(c.token).then(function(id) {
    if (!id) throw new Error('这个 GitHub 账号里还没有小手机的备份');
    return ghFetch('/gists/' + id, c.token).then(function(g) {
      var f = g.files && g.files[CLOUD_FILE];
      if (!f) throw new Error('这个 GitHub 账号里还没有小手机的备份');
      backupMeta.gistId = id;
      // 太大的文件接口只返回一部分，要去原始地址拿全文
      return f.truncated ? fetch(f.raw_url).then(function(r) { return r.text(); }) : f.content;
    });
  }).then(function(text) {
    return decryptBackup(text, c.pass);
  }).then(function(res) {
    var parsed = JSON.parse(res.json);
    if (!parsed || parsed.app !== 'mphone' || typeof parsed.data !== 'object') throw new Error('云端的备份格式不对');
    openPfEntryDel('找到 ' + fmtAgo(res.time) + '的云端备份。恢复会覆盖现在的全部数据，确定继续吗？', function() {
      var data = parsed.data;
      data[BACKUP_META_KEY] = Object.assign({}, backupMeta, { lastCloud: res.time, lastChange: res.time, snooze: 0 });
      mphoneStore.replaceAll(data).then(function() {
        showToast('✓ 已恢复，正在刷新', 'success');
        setTimeout(function() { location.reload(); }, 800);
      });
    });
  }).catch(function(e) { showToast('✗ ' + e.message, 'error'); });
});

// 点弹窗外面关掉
[backupExportOverlay, backupRemindOverlay].forEach(function(ov) {
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.classList.remove('open'); });
});

// 打开设置时刷新「上次备份」；启动后看要不要提醒、要不要补一次云备份
dockSettings.addEventListener('click', function() { paintBackupLast(); paintCloudStatus(); });
paintBackupLast();
paintCloudStatus();
onMphoneReady(function() {
  setTimeout(checkBackupRemind, 1500);
  if (backupMeta.cloudOn && backupMeta.lastChange > backupMeta.lastCloud) scheduleCloudBackup();
});
