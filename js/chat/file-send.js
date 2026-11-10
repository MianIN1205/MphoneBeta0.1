// 眠花糖机 — 发文件给角色读：加号抽屉里的「文件」，读出文字（txt / md / json / csv / 代码、Word、PDF），聊天里是一张文件卡片，点开看全文；
// 发给 AI 时全文放在聊天记录前面一段「用户发来的文件」里（不算进上下文上限，单独有预算），记录里那条只写「[文件：《名字》]」

var FILE_TEXT_MAX = 300000;   // 一个文件最多存多少字
var FILE_AI_BUDGET = 60000;   // 一次请求里文件全文最多带多少 token（估算），新发的优先
var FILE_TEXT_EXTS = ['txt', 'md', 'markdown', 'json', 'jsonl', 'csv', 'tsv', 'log', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'h',
  'cs', 'go', 'rs', 'rb', 'php', 'sh', 'bat', 'ps1', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'srt', 'ass', 'vtt', 'lrc', 'sql', 'tex', 'rtf', 'swift', 'kt', 'lua', 'vue', 'jsx', 'tsx'];

// 文字编码：先按 UTF-8，不对再按中文 GBK（旧的 Windows 记事本文件）
function fileDecodeText(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
  catch (_) { try { return new TextDecoder('gb18030').decode(buf); } catch (e) { return new TextDecoder().decode(buf); } }
}
// PDF：用到时才加载 pdf.js（放在仓库的 lib/pdfjs 里，3.11.174，不从外网拉）
var filePdfLib = null;
function fileLoadPdfJs() {
  if (filePdfLib) return filePdfLib;
  var base = 'lib/pdfjs/';
  filePdfLib = new Promise(function(resolve, reject) {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    var s = document.createElement('script');
    s.src = base + 'pdf.min.js';
    s.onload = function() {
      if (!window.pdfjsLib) { reject(new Error('PDF 工具没加载上')); return; }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = function() { filePdfLib = null; reject(new Error('PDF 工具没加载上，刷新一下再试')); };
    document.head.appendChild(s);
  });
  return filePdfLib;
}
function fileReadPdf(buf) {
  return fileLoadPdfJs().then(function(lib) { return lib.getDocument({ data: new Uint8Array(buf) }).promise; }).then(function(pdf) {
    var pages = [], n = pdf.numPages;
    var next = function(i) {
      if (i > n) return Promise.resolve(pages.join('\n\n'));
      return pdf.getPage(i).then(function(pg) { return pg.getTextContent(); }).then(function(tc) {
        // 按行拼：同一行的字连起来，换行的地方断开
        var out = '', lastY = null;
        tc.items.forEach(function(it) {
          var y = it.transform ? it.transform[5] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) out += '\n';
          out += it.str;
          if (it.hasEOL) out += '\n';
          lastY = y;
        });
        pages.push(out.replace(/\n{3,}/g, '\n\n').trim());
        return next(i + 1);
      });
    };
    return next(1);
  });
}
// 读一个文件，得到 { name, size, ext, text, cut }
function fileReadForChat(file) {
  var name = file.name || '文件', ext = (name.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
  return file.arrayBuffer().then(function(buf) {
    if (ext === 'docx') return readDocxText(buf, { links: true });
    if (ext === 'pdf') return fileReadPdf(buf);
    if (FILE_TEXT_EXTS.indexOf(ext) >= 0 || /^text\//.test(file.type) || /json|xml|javascript/.test(file.type)) return fileDecodeText(buf);
    if (ext === 'doc') throw new Error('老式 .doc 读不了，用 Word 另存成 .docx 再发');
    throw new Error('这种文件（.' + (ext || '?') + '）还读不了，可以发 txt、md、Word（.docx）、PDF 这些');
  }).then(function(text) {
    text = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (!text) throw new Error(ext === 'pdf' ? '这个 PDF 里读不出文字，可能是扫描的图片' : '文件里没有文字');
    var cut = text.length > FILE_TEXT_MAX;
    return { name: name, size: file.size, ext: ext, text: cut ? text.slice(0, FILE_TEXT_MAX) : text, cut: cut };
  });
}
function fileSizeText(n) {
  if (!n) return '';
  return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
}
// 选文件 → 读出来 → 作为你的消息发出去（和发图片一样，不会自动叫 TA 回复，点 ❄️ 才回）
function openChatFilePicker() {
  var input = document.getElementById('crFileInput');
  input.value = '';
  input.click();
}
document.getElementById('crFileInput').addEventListener('change', function() {
  var files = Array.prototype.slice.call(this.files || []);
  if (!files.length || openingChatCharIdx === -1) return;
  closeCrPlusPanel();
  var hist = getActiveHistory(openingChatCharIdx);
  var one = function(i) {
    if (i >= files.length) return;
    showToast('正在读「' + files[i].name + '」…', 'plain');
    fileReadForChat(files[i]).then(function(f) {
      var m = { role: 'user', content: '[文件] ' + f.name, file: f, time: Date.now() };
      if (pendingQuote) { m.quote = pendingQuote; clearQuote(); }
      hist.push(m);
      if (getActiveHistory(openingChatCharIdx) === hist) renderHistMsg(m);
      saveHistories();
      showToast('✓ 已发送「' + f.name + '」' + (f.cut ? '（太长了，只存了前 ' + FILE_TEXT_MAX / 10000 + ' 万字）' : ''), 'success');
    }, function(err) {
      showToast('✗ ' + ((err && err.message) || '读不了这个文件'), 'error');
    }).then(function() { one(i + 1); });
  };
  one(0);
});

// =============================================
// 聊天里的文件卡片：图标 + 名字 + 大小和字数，点开看全文
// =============================================
function appendFileMsg(role, m, list, empty) {
  list = list || getActiveMsgListEl();
  empty = empty || getActiveEmptyEl();
  if (empty) empty.style.display = 'none';
  var f = m.file || {};
  var row = document.createElement('div');
  row.className = 'chat-msg-row ' + (role === 'user' ? 'user' : 'ai');
  row.appendChild(createMsgAvatar(role));
  var bubble = document.createElement('div');
  bubble.className = 'chat-msg-bubble file-bubble';
  bubble.innerHTML = '<div class="file-card-info"><div class="file-card-name"></div><div class="file-card-sub"></div></div>' +
    '<div class="file-card-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg><span></span></div>';
  bubble.querySelector('.file-card-name').textContent = f.name || '文件';
  bubble.querySelector('.file-card-sub').textContent = [fileSizeText(f.size), f.text ? f.text.length + ' 字' : ''].filter(Boolean).join(' · ');
  bubble.querySelector('.file-card-icon span').textContent = (f.ext || '').slice(0, 4).toUpperCase();
  bubble.addEventListener('click', function() { openFileView(m); });
  row.appendChild(bubble);
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
  return { row: row, bubble: bubble };
}
var fileViewOverlay = document.getElementById('fileViewOverlay');
var fileViewing = null;
function openFileView(m) {
  var f = m.file || {};
  fileViewing = f;
  document.getElementById('fileViewTitle').textContent = f.name || '文件';
  document.getElementById('fileViewSub').textContent = [fileSizeText(f.size), (f.text || '').length + ' 字', f.cut ? '太长了，只存了前面一部分' : ''].filter(Boolean).join(' · ');
  var body = document.getElementById('fileViewBody');
  body.textContent = f.text || '';
  body.scrollTop = 0;
  fileViewOverlay.classList.add('open');
}
document.getElementById('fileViewClose').addEventListener('click', function() { fileViewOverlay.classList.remove('open'); });
// 保存成文件（MianIN 发来的 CSS、世界书这些，用户要能直接存下来）
document.getElementById('fileViewSave').addEventListener('click', function() {
  if (!fileViewing) return;
  shareOrDownload(new Blob([fileViewing.text || ''], { type: 'text/plain;charset=utf-8' }), fileViewing.name || '文件.txt');
});
document.getElementById('fileViewCopy').addEventListener('click', function() {
  if (!fileViewing || !navigator.clipboard) { showToast('✗ 这里不能复制', 'error'); return; }
  navigator.clipboard.writeText(fileViewing.text || '').then(function() { showToast('✓ 已复制', 'success'); }, function() { showToast('✗ 复制失败', 'error'); });
});
closeOnBackdrop(fileViewOverlay);

// =============================================
// 发给 AI：记录里那条只是个标记，全文另外放一段（新发的优先，超出预算的这次不带）
// =============================================
function fileTextForAI(m) {
  var f = m.file || {};
  return (m.role === 'assistant' ? '[你发了一个文件：《' : '[发来一个文件：《') + (f.name || '文件') + '》' + (f.text ? '，全文在前面「聊天里的文件」里' : '') + ']';
}
// MianIN 回复里的 <文件 名字="…">内容</文件> 变成一个文件（整段包在 ``` 里的去掉外壳）
function fileFromText(name, text) {
  text = String(text || '').replace(/^\s*\n/, '').replace(/\s+$/, '');
  var fence = text.match(/^```[\w-]*\n([\s\S]*?)\n?```$/);
  if (fence) text = fence[1];
  if (!text.trim()) return null;
  name = String(name).trim() || '文件.txt';
  return { name: name, size: new Blob([text]).size, ext: (name.match(/\.([a-z0-9]{1,6})$/i) || [, 'txt'])[1].toLowerCase(), text: text };
}
function filesContextFor(history) {
  var files = (history || []).filter(function(m) { return m.file && m.file.text && !m.recalled; });
  if (!files.length) return null;
  var left = FILE_AI_BUDGET, parts = [];
  for (var i = files.length - 1; i >= 0; i--) {
    var f = files[i].file, when = files[i].time ? fmtMsgTime(files[i].time) : '';
    var head = '《' + f.name + '》' + (when ? '（' + when + (files[i].role === 'assistant' ? ' 你发的）' : ' 发来）') : (files[i].role === 'assistant' ? '（你发的）' : ''));
    var cost = estTokens(f.text);
    if (left <= 500) { parts.unshift(head + '：这次放不下全文了（前面的文件太长）。需要的话请用户重新发一次。'); continue; }
    var text = f.text;
    if (cost > left) {   // 放不下整篇：带前面能放下的部分
      text = f.text.slice(0, Math.floor(f.text.length * left / cost));
      text += '\n……（后面太长，这次没带上）';
      cost = left;
    }
    left -= cost;
    parts.unshift(head + (f.cut ? '（原文件太长，只存了前面一部分）' : '') + '\n<<<文件开始>>>\n' + text + '\n<<<文件结束>>>');
  }
  return { role: 'system', content: '【聊天里的文件】下面是聊天里发过的文件全文（按发送先后，标着「你发的」是你自己发给用户的）。聊天记录里写着「[发来一个文件：《…》]」「[你发了一个文件：《…》]」的，就是这些文件。' +
    '用户让你读、参考、总结、修改的时候以这里的原文为准，可以引用原句；没问到的时候不用主动复述。\n\n' + parts.join('\n\n') };
}
