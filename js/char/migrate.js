// 眠花糖机 — 从别的小手机的完整备份迁移一个角色：人设、头像、世界书、聊天记录（存成档案）

// =============================================
// 认得 uwu / ovo 小手机导出的完整备份（.ee：gzip 压缩，里面一行一个 JSON，header 的 format 是 *-stream-backup）
// · 第一遍只读角色资料和世界书（聊天记录只数条数），选好要搬的东西后，第二遍才把那个角色的聊天记录取出来
// · 迁到「当前正在设置的这个角色」上：人设、头像替换；世界书按原来的分类建文件夹、逐条关联给 TA；聊天记录存成档案（见 js/char/archive.js）
// · 备份里的 API 设置、密钥一概不读
// =============================================
var migOverlay = document.getElementById('migOverlay');
var migState = null;   // { char, file, chars: [{ idx, name, persona, avatar, wbIds, count }], books: [], pick }

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

// ---------- 弹窗 ----------
document.getElementById('migBtn').addEventListener('click', function() {
  if (editingCharIndex < 0) { showToast('请先保存角色', 'error'); return; }
  var char = charList[editingCharIndex];
  pickFile('.ee,.gz,.json,.txt,application/gzip,application/json', function(file) {
    showToast('正在读备份…', 'plain');
    migScan(file).then(function(r) {
      if (!r.chars.length) throw new Error('备份里没有角色');
      var name = char.charAlias || char.charName || '';
      var pick = r.chars.filter(function(c) { return c.name === name || c.realName === name; })[0] || r.chars[0];
      migState = { char: char, file: file, chars: r.chars, books: r.books, pick: pick };
      document.getElementById('migFrom').value = 'uwu 小手机';
      migRender();
      migOverlay.classList.add('open');
    }).catch(function(err) { showToast('✗ 读不出来：' + ((err && err.message) || '格式不认识'), 'error'); });
  });
});

function migRender() {
  var s = migState, c = s.pick, n = arcNames(s.char);
  // 角色
  var row = document.getElementById('migChars');
  row.innerHTML = '';
  s.chars.forEach(function(x) {
    var chip = document.createElement('span');
    chip.className = 'feed-visible-chip' + (x === c ? ' on' : '');
    chip.textContent = x.name;
    chip.addEventListener('click', function() { s.pick = x; migRender(); });
    row.appendChild(chip);
  });
  document.getElementById('migPersonaText').textContent = '人设（' + c.persona.length + ' 字' + (s.char.charPersona ? '，会替换现在的人设' : '') + '）';
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
  document.getElementById('migNote').textContent = '都会迁到现在这个角色「' + n.c + '」身上。世界书按原来的分类建文件夹，已经有一模一样的就不重复建。';
}

document.getElementById('migCancel').addEventListener('click', function() { migOverlay.classList.remove('open'); migState = null; });
closeOnBackdrop(migOverlay, function() { migOverlay.classList.remove('open'); migState = null; });

document.getElementById('migOk').addEventListener('click', function() {
  var s = migState, btn = this;
  if (!s) return;
  var c = s.pick, char = s.char, done = [];
  if (charList.indexOf(char) < 0) { migOverlay.classList.remove('open'); return; }
  // 人设、头像
  if (document.getElementById('migPersona').checked && c.persona) { char.charPersona = c.persona; done.push('人设'); }
  if (document.getElementById('migAvatar').checked && c.avatar) { char.charAvatar = c.avatar; done.push('头像'); }
  // 世界书
  var picked = Array.prototype.filter.call(document.querySelectorAll('#migWbList input'), function(cb) { return cb.checked; }).map(function(cb) { return cb._book; });
  var added = 0, linked = 0;
  picked.forEach(function(b) {
    var name = String(b.name || '未命名').slice(0, 60), content = String(b.content || '');
    var exist = wbEntries.filter(function(e) { return e.name === name && e.content === content; })[0];
    if (!exist) {
      var fname = b.category || '来自小手机';
      var f = wbFolders.filter(function(x) { return x.name === fname; })[0];
      if (!f) { f = { id: genWbId('wf'), name: fname }; wbFolders.push(f); }
      var kw = b.alwaysOn ? '' : Array.isArray(b.keywords) ? b.keywords.join(',') : (typeof b.keywords === 'string' ? b.keywords : '');
      exist = { id: genWbId('wb'), name: name, keywords: kw, content: content, pos: 'auto', folderId: f.id };
      if (b.disabled) exist.enabled = false;
      wbEntries.push(exist);
      added++;
    }
    char.worldbookIds = char.worldbookIds || [];
    if (char.worldbookIds.indexOf(exist.id) < 0) { char.worldbookIds.push(exist.id); linked++; }
  });
  if (picked.length) {
    saveWbEntries();
    if (typeof renderWbList === 'function') renderWbList();
    done.push('世界书 ' + picked.length + ' 本' + (added < picked.length ? '（' + (picked.length - added) + ' 本本来就有）' : ''));
  }
  saveCharList();
  if (appCharSetting.classList.contains('active') && charList[editingCharIndex] === char) fillCharForm(char);
  if (typeof renderChatCharList === 'function') renderChatCharList();
  // 聊天记录：第二遍读出来，存成档案（之前导入过的跳过）
  var wantHist = document.getElementById('migHistory').checked && c.count > 0;
  var from = document.getElementById('migFrom').value.trim().replace(/^来自\s*/, '') || 'uwu 小手机';
  var finish = function(extra) {
    migOverlay.classList.remove('open');
    migState = null;
    btn.disabled = false; btn.textContent = '开始迁移';
    if (extra) done.push(extra);
    showToast(done.length ? '✓ 迁好了：' + done.join('、') : '没有选要迁的东西', done.length ? 'success' : 'plain');
  };
  if (!wantHist) { finish(); return; }
  btn.disabled = true; btn.textContent = '正在读聊天记录…';
  migReadHistory(s.file, c.idx).then(function(msgs) {
    var seen = typeof arcSeenKeys === 'function' ? arcSeenKeys(char.id) : {};
    var fresh = msgs.filter(function(m) { return !(m.time && seen[arcMsgKey(m)]); });
    if (!fresh.length) { finish('聊天记录之前都导入过了'); return; }
    var arc = { id: 'arc' + Date.now().toString(36), from: from.slice(0, 16), file: s.file.name, importTime: Date.now(), msgs: fresh,
      mem: { pos: 0, count: 0, seg: 0, budget: ARC_BUDGET, careful: false, withStatus: true, done: false, err: '' } };
    (arcStore[char.id] = arcListOf(char.id)).push(arc);
    saveArcStore();
    renderArchiveList(char);
    finish('聊天记录 ' + fresh.length + ' 条存成了档案');
  }).catch(function(err) {
    finish('聊天记录没读出来（' + ((err && err.message) || '出错了') + '）');
  });
});
