// 眠花糖机 — 导入角色时选 uwu 小手机的完整备份：选一个角色，把人设、头像、世界书、聊天记录一起变成新角色

// =============================================
// 认得 uwu / ovo 小手机导出的完整备份（.ee：gzip 压缩，里面一行一个 JSON，header 的 format 是 *-stream-backup）
// · 第一遍只读角色资料和世界书（聊天记录只数条数），选好要搬的东西后，第二遍才把那个角色的聊天记录取出来
// · 在通讯录「导入角色」里选备份（见 js/char/import.js）→ 这里选角色、勾要带的东西 → 变成新角色的草稿，进角色设置点「保存」才真正加进来；
//   世界书按原来的分类放进文件夹，聊天记录保存时存成档案（见 js/char/settings-save.js）
// · 备份里的 API 设置、密钥一概不读
// =============================================
var migOverlay = document.getElementById('migOverlay');
var migState = null;   // { file, chars: [{ idx, name, persona, avatar, wbIds, count }], books: [], pick }

// 一行一行读：gzip 的先解压；读到一行就交给 onObj
// want(行开头的一小段)：返回 false 的行不解析（备份里有几十 MB 的一行用不到，比如别的小程序的存档），省时间省内存
function migReadLines(file, onObj, want) {
  return file.slice(0, 2).arrayBuffer().then(function(b) {
    var u = new Uint8Array(b), gz = u[0] === 0x1f && u[1] === 0x8b;
    var stream = file.stream();
    if (gz) {
      if (typeof DecompressionStream !== 'function') throw new Error('这个浏览器解不开压缩的备份，换个新一点的浏览器试试');
      stream = stream.pipeThrough(new DecompressionStream('gzip'));
    }
    var reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    // 一行还没读完时先把小块存起来，读到换行再拼成一整行（很长的一行也只拼一次）
    var pieces = [], head = '', skip = false;
    var eat = function(l) {
      if (skip) return;
      l = l.trim(); if (!l) return;
      var o; try { o = JSON.parse(l); } catch (_) { return; }
      onObj(o);
    };
    var feed = function(chunk) {
      var at = 0, nl;
      while ((nl = chunk.indexOf('\n', at)) >= 0) {
        var tail = chunk.slice(at, nl);
        if (!head) head = tail.slice(0, 120); else if (head.length < 120) head = (head + tail).slice(0, 120);
        if (!skip && want && !want(head)) skip = true;
        if (!skip) { pieces.push(tail); eat(pieces.join('')); }
        pieces = []; head = ''; skip = false;
        at = nl + 1;
      }
      var rest = chunk.slice(at);
      if (!rest) return;
      if (!pieces.length && !head) head = rest.slice(0, 120);
      else if (head.length < 120) head = (head + rest).slice(0, 120);
      if (!skip && want && head.length >= 120 && !want(head)) { skip = true; pieces = []; }
      if (!skip) pieces.push(rest);
    };
    function pump() {
      return reader.read().then(function(r) {
        if (r.done) { if (pieces.length) eat(pieces.join('')); return; }
        feed(r.value);
        return pump();
      });
    }
    return pump();
  });
}

// 第一遍：角色资料 + 世界书 + 每个角色的聊天条数
function migScan(file) {
  var chars = {}, books = [], ok = false, first = true;
  return migReadLines(file, function(o) {
    if (first) { first = false; ok = o.type === 'header' && /stream-backup/.test(o.format || ''); if (!ok) throw new Error('不是小手机的完整备份'); return; }
    if (o.type === 'chat-start' && o.key === 'characters' && o.value) {
      var v = o.value;
      chars[o.chatIndex] = { idx: o.chatIndex, name: v.remarkName || v.realName || v.name || '角色' + o.chatIndex, realName: v.realName || '',
        persona: String(v.persona || ''), avatar: /^data:image\//.test(v.avatar || '') ? v.avatar : '', wbIds: v.worldBookIds || [], count: 0 };
    } else if (o.type === 'chat-history' && o.key === 'characters' && chars[o.chatIndex]) {
      chars[o.chatIndex].count += Array.isArray(o.value) ? o.value.length : 1;
    } else if (o.type === 'array-item' && o.key === 'worldBooks' && o.value && o.value.content) {
      books.push(o.value);
    }
  }, function(h) { return first || /"(header|chat-start|chat-history)"|"key":"worldBooks"/.test(h); }).then(function() {
    if (!ok) throw new Error('不是小手机的完整备份');
    return { chars: Object.keys(chars).map(function(k) { return chars[k]; }), books: books };
  });
}
// 第二遍：取出一个角色的聊天记录，换成档案的格式
function migReadHistory(file, idx) {
  var out = [], unknown = {};
  return migReadLines(file, function(o) {
    if (o.type !== 'chat-history' || o.key !== 'characters' || o.chatIndex !== idx) return;
    (Array.isArray(o.value) ? o.value : [o.value]).forEach(function(h) {
      var m = typeof arcFromUwu === 'function' ? arcFromUwu(h, unknown) : null;
      if (m) out.push(m);
    });
  }, function(h) { return /"chat-history"/.test(h); }).then(function() { out.sort(function(a, b) { return (a.time || 0) - (b.time || 0); }); return out; });
}

// ---------- 弹窗：导入角色时选了备份 → 选角色、勾要带的东西 → 变成新角色的草稿 ----------
// migPickFromBackup(file) 返回 Promise：选好了给草稿（交给角色设置，点「保存」才真正加进来），取消了给 null
var migResolve = null;
function migPickFromBackup(file) {
  showToast('正在读备份…', 'plain');
  return migScan(file).then(function(r) {
    if (!r.chars.length) throw new Error('备份里没有角色');
    migState = { file: file, chars: r.chars, books: r.books, pick: r.chars.filter(function(c) { return c.count; }).sort(function(a, b) { return b.count - a.count; })[0] || r.chars[0] };
    document.getElementById('migFrom').value = 'uwu 小手机';
    migRender();
    migOverlay.classList.add('open');
    return new Promise(function(res) { migResolve = res; });
  });
}
function migClose(result) {
  migOverlay.classList.remove('open');
  migState = null;
  var r = migResolve; migResolve = null;
  if (r) r(result || null);
}

function migRender() {
  var s = migState, c = s.pick;
  var row = document.getElementById('migChars');
  row.innerHTML = '';
  s.chars.forEach(function(x) {
    var chip = document.createElement('span');
    chip.className = 'feed-visible-chip' + (x === c ? ' on' : '');
    chip.textContent = x.name;
    chip.addEventListener('click', function() { s.pick = x; migRender(); });
    row.appendChild(chip);
  });
  document.getElementById('migPersonaText').textContent = '人设（' + c.persona.length + ' 字）';
  document.getElementById('migPersona').checked = !!c.persona;
  document.getElementById('migPersona').disabled = !c.persona;
  document.getElementById('migAvatar').checked = !!c.avatar;
  document.getElementById('migAvatar').disabled = !c.avatar;
  document.getElementById('migAvatarRow').style.display = c.avatar ? '' : 'none';
  document.getElementById('migHistText').textContent = '聊天记录存成档案（' + c.count + ' 条，可以之后再整理成记忆）';
  document.getElementById('migHistory').checked = c.count > 0;
  document.getElementById('migHistory').disabled = !c.count;
  // 世界书：TA 关联的勾上；原来对所有角色生效的、其他的放在后面，默认不勾
  var box = document.getElementById('migWbList');
  box.innerHTML = '';
  var linked = s.books.filter(function(b) { return c.wbIds.indexOf(b.id) >= 0; });
  var global = s.books.filter(function(b) { return b.isGlobal && linked.indexOf(b) < 0; });
  var rest = s.books.filter(function(b) { return linked.indexOf(b) < 0 && global.indexOf(b) < 0; });
  [[linked, c.name + ' 关联的', true], [global, '原来对所有角色都生效的', false], [rest, '其他', false]].forEach(function(g) {
    if (!g[0].length) return;
    var h = document.createElement('div');
    h.className = 'mig-sub';
    h.textContent = g[1] + '（' + g[0].length + ' 本）';
    box.appendChild(h);
    g[0].forEach(function(b) {
      var lab = document.createElement('label');
      lab.className = 'mig-row';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = g[2];
      cb._book = b;
      var t = document.createElement('span');
      t.textContent = b.name + (b.category ? ' · ' + b.category : '') + ' · ' + String(b.content).length + ' 字' + (b.disabled ? ' · 原来是关着的' : '');
      lab.appendChild(cb);
      lab.appendChild(t);
      box.appendChild(lab);
    });
  });
  if (!s.books.length) box.innerHTML = '<div class="auto-hint">备份里没有世界书</div>';
  document.getElementById('migNote').textContent = '会新建一个角色「' + c.name + '」：确认后进角色设置再看一眼，点「保存」才真正加进来。世界书按原来的分类放进文件夹，已经有一模一样的就直接关联，不重复建。';
}

document.getElementById('migCancel').addEventListener('click', function() { migClose(null); });
closeOnBackdrop(migOverlay, function() { migClose(null); });

document.getElementById('migOk').addEventListener('click', function() {
  var s = migState, btn = this;
  if (!s) return;
  var c = s.pick;
  var draft = { charName: c.realName || c.name, charAlias: c.name, charPersona: '' };
  if (document.getElementById('migPersona').checked) draft.charPersona = c.persona;
  if (document.getElementById('migAvatar').checked && c.avatar) draft.charAvatar = c.avatar;
  // 世界书：带上原来的分类，保存角色时按分类放进文件夹（见 js/char/settings-save.js）
  var picked = Array.prototype.filter.call(document.querySelectorAll('#migWbList input'), function(cb) { return cb.checked; }).map(function(cb) { return cb._book; });
  if (picked.length) {
    draft.pendingWb = { entries: picked.map(function(b) {
      var e = { name: String(b.name || '未命名').slice(0, 60), content: String(b.content || ''), pos: 'auto',
        keywords: b.alwaysOn ? '' : Array.isArray(b.keywords) ? b.keywords.join(',') : (typeof b.keywords === 'string' ? b.keywords : ''),
        folderName: String(b.category || '').trim() || '来自小手机' };
      if (b.disabled) e.enabled = false;
      return e;
    }) };
  }
  var from = document.getElementById('migFrom').value.trim().replace(/^来自\s*/, '') || 'uwu 小手机';
  if (!(document.getElementById('migHistory').checked && c.count > 0)) { migClose(draft); return; }
  // 聊天记录：第二遍读出来，跟着草稿走，保存角色时存成档案
  btn.disabled = true; btn.textContent = '正在读聊天记录…';
  migReadHistory(s.file, c.idx).then(function(msgs) {
    if (msgs.length) draft.pendingArc = { from: from.slice(0, 16), file: s.file.name, msgs: msgs };
  }).catch(function(err) {
    showToast('✗ 聊天记录没读出来：' + ((err && err.message) || '出错了'), 'error');
  }).then(function() {
    btn.disabled = false; btn.textContent = '确认';
    migClose(draft);
  });
});
