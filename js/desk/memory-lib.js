// 眠花糖机 — 桌面「记忆库」：每个角色的记忆列表、问 TA 记得什么、导出 Word、编辑记忆

// =============================================
// 记忆库界面：首页每个角色一张卡片（一行两张），点进去看这个角色的珍贵 / 长期 / 短期记忆
// =============================================
var memLibChar = '', memLibFilter = 'precious';
function memCharById(id) { return charList.filter(function(c) { return c.id === id; })[0] || null; }
function memCounts(id) {
  var n = { precious: 0, long: 0, short: 0 };
  memList(id).forEach(function(m) { n[m.type] = (n[m.type] || 0) + 1; });
  return n;
}
function memCharName(c) { return (c && (c.charAlias || c.charName)) || '未命名'; }

function showMemHome() {
  memLibChar = '';
  document.getElementById('memHome').style.display = '';
  document.getElementById('memDetail').style.display = 'none';
  document.getElementById('memTitle').textContent = '记忆库';
  document.getElementById('memAddBtn').style.visibility = 'hidden';
  renderMemHome();
}
function renderMemHome() {
  var grid = document.getElementById('memCharGrid');
  grid.innerHTML = '';
  if (!charList.length) { grid.innerHTML = '<div class="auto-hint desk-empty">还没有角色</div>'; return; }
  charList.forEach(function(c) { if (c.isGroup) return;   // 群聊不算
    var n = memCounts(c.id), total = n.precious + n.long + n.short;
    var card = document.createElement('div');
    card.className = 'mem-char-card';
    var name = document.createElement('div');
    name.className = 'mem-char-name';
    name.textContent = memCharName(c);
    var stats = document.createElement('div');
    stats.className = 'mem-char-stats';
    stats.textContent = total ? '💎 ' + n.precious + ' · 长期 ' + n.long + ' · 短期 ' + n.short : '还没有记忆';
    card.appendChild(name);
    card.appendChild(stats);
    card.addEventListener('click', function() { openMemDetail(c.id); });
    grid.appendChild(card);
  });
}
function openMemDetail(id) {
  memLibChar = id;
  document.getElementById('memHome').style.display = 'none';
  document.getElementById('memDetail').style.display = '';
  document.getElementById('memTitle').textContent = memCharName(memCharById(id)) + ' 的记忆';
  document.getElementById('memAddBtn').style.visibility = '';
  renderMemLib();
}

// 某个角色的记忆列表（按类型分页，新的在前）
function renderMemLib() {
  var char = memCharById(memLibChar);
  if (!char) { showMemHome(); return; }
  renderMemMilestone(char);
  document.querySelectorAll('#memFilterRow .pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.f === memLibFilter); });
  var n = memCounts(char.id), cfg = memCfgOf(char);
  document.getElementById('memStats').textContent = '珍贵 ' + n.precious + ' · 长期 ' + n.long + ' · 短期 ' + n.short +
    (cfg.on ? '' : '（这个角色在「扩展」页关掉了记忆库，TA 暂时想不起来）');
  var box = document.getElementById('memList');
  box.innerHTML = '';
  var list = memList(char.id).filter(function(m) { return m.type === memLibFilter; })
    .sort(function(a, b) { return b.time - a.time; });
  if (!list.length) {
    box.innerHTML = '<div class="auto-hint desk-empty">还没有' + MEM_TYPE_NAME[memLibFilter] + '记忆。聊天时 TA 会自己记下，你也可以点右上角「添加」。</div>';
    return;
  }
  list.forEach(function(m) {
    var card = document.createElement('div');
    card.className = 'mem-card type-' + m.type;
    var head = document.createElement('div');
    head.className = 'mem-card-head';
    var badge = document.createElement('span');
    badge.className = 'mem-badge ' + m.type;
    badge.textContent = (m.type === 'precious' ? '💎 ' : '') + MEM_TYPE_NAME[m.type];
    var meta = document.createElement('span');
    meta.className = 'mem-meta';
    meta.textContent = memSourceText(m) + (m.scene === 'drama' ? ' · 剧情空间' : '') + ' · ' + (m.source === 'import' ? memDateText(m.time).split(' ')[0] : memAgo(m.time)) +
      (m.type === 'short' && m.expires ? ' · ' + Math.max(1, Math.ceil((m.expires - Date.now()) / MEM_DAY)) + ' 天后忘掉' : '');
    head.appendChild(badge);
    head.appendChild(meta);
    var text = document.createElement('div');
    text.className = 'mem-text';
    text.textContent = m.text;
    var acts = document.createElement('div');
    acts.className = 'anniv-acts';
    function btn(label, on, fn) {
      var b = document.createElement('button');
      b.className = 'anniv-flag' + (on ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', fn);
      acts.appendChild(b);
      return b;
    }
    btn(m.type === 'precious' ? '💎 取消珍贵' : '💎 设为珍贵', m.type === 'precious', function() {
      m.type = m.type === 'precious' ? 'long' : 'precious';
      delete m.expires;
      saveMemStore();
      renderMemLib();
    });
    btn('编辑', false, function() { openMemEdit(char, m); });
    btn('删除', false, function() {
      openConfirm('删除这条记忆？', function() {
        memStore[char.id] = memList(char.id).filter(function(x) { return x !== m; });
        saveMemStore();
        renderMemLib();
      });
    }).classList.add('anniv-del');
    card.appendChild(head);
    card.appendChild(text);
    card.appendChild(acts);
    box.appendChild(card);
  });
}
document.querySelectorAll('#memFilterRow .pf-radio-btn').forEach(function(b) {
  b.addEventListener('click', function() { memLibFilter = this.dataset.f; renderMemLib(); });
});
// 记忆库里的关系里程碑卡片：看、改、重新整理
function renderMemMilestone(char) {
  var ms = memMilestones[char.id] || {};
  document.getElementById('memMilestoneText').value = ms.text || '';
  document.getElementById('memMilestoneMeta').textContent = ms.time ? '整理于' + memAgo(ms.time) : '';
}
document.getElementById('memMilestoneRebuild').addEventListener('click', function() {
  var char = memCharById(memLibChar), btn = this;
  if (!char || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '整理中…';
  memBuildMilestone(char).then(function(t) {
    showToast(t ? '✓ 整理好了' : '还没有能算作里程碑的事', t ? 'success' : '');
  }).catch(function(err) {
    showToast('✗ 没整理成：' + err.message, 'error');
  }).then(function() {
    btn.disabled = false;
    btn.textContent = '重新整理';
  });
});
document.getElementById('memMilestoneSave').addEventListener('click', function() {
  var char = memCharById(memLibChar);
  if (!char) return;
  var old = memMilestones[char.id] || {};
  memMilestones[char.id] = { text: document.getElementById('memMilestoneText').value.trim(), time: Date.now(),
    basedOn: old.basedOn !== undefined ? old.basedOn : memImportant(char.id).length };
  saveMilestones();
  renderMemMilestone(char);
  showToast('✓ 已保存', 'success');
});
document.getElementById('dockMemory').addEventListener('click', function() {
  document.getElementById('memEmbedModel').value = memEmbedModel;
  showMemHome();
});
// 在某个角色的记忆里点返回：先回到角色卡片
document.getElementById('backMemory').addEventListener('click', function(e) {
  if (document.getElementById('memDetail').style.display !== 'none') {
    e.stopImmediatePropagation();
    showMemHome();
  }
}, true);

// ---------- 问问 TA 记得什么：用平时聊天一样的方式问，看 TA 能不能想起来、知不知道这是自己的记忆 ----------
var memAskOverlay = document.getElementById('memAskOverlay');
function memStripTags(text) { return String(text || '').replace(MEM_TAG_RE, '').replace(/\n{3,}/g, '\n\n').trim(); }
document.getElementById('memAskBtn').addEventListener('click', function() {
  var idx = findCharIdx(memLibChar), char = charList[idx];
  if (!char) return;
  var askText = document.getElementById('memAskText');
  document.getElementById('memAskTitle').textContent = memCharName(char) + ' 记得的事';
  askText.textContent = '正在问 TA…';
  memAskOverlay.classList.add('open');
  var q = '（私下问你一下）你还记得关于我、关于我们的哪些事？用你自己的话说说，挑你觉得最重要的讲，简短一点。';
  var msgs = buildMsgs(idx, getChatHistory(idx).concat([{ role: 'user', content: q }]));
  callApiOnce(msgs, char).then(function(text) {
    askText.textContent = fillMacros(memStripTags(text), char) || '（TA 没有回答）';
  }, function(err) {
    askText.textContent = '没问成：' + err.message;
  });
});
document.getElementById('memAskClose').addEventListener('click', function() { memAskOverlay.classList.remove('open'); });
closeOnBackdrop(memAskOverlay);

// ---------- 导出为 Word（.docx）：按重要程度（珍贵 → 长期 → 短期）分组，组内按时间从早到晚 ----------
var MEM_CRC_TABLE = (function() {
  var t = [];
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function memCrc32(bytes) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) c = MEM_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// 不压缩的 zip（docx 就是 zip 包）
function memZip(files) {
  var enc = new TextEncoder(), parts = [], central = [], offset = 0;
  files.forEach(function(f) {
    var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = memCrc32(data);
    var h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    var c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  });
  var cdSize = central.reduce(function(s, p) { return s + p.length; }, 0);
  var e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
  return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
function memXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
// 一段文字：{ text, size（半磅）, bold, color, after（段后间距）, pageBreak }
function memDocxPara(p) {
  if (p.pageBreak) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  var rPr = '<w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei" w:hAnsi="Microsoft YaHei"/>' +
    (p.bold ? '<w:b/>' : '') + (p.color ? '<w:color w:val="' + p.color + '"/>' : '') + '<w:sz w:val="' + (p.size || 22) + '"/></w:rPr>';
  var runs = String(p.text).split('\n').map(function(line, i) {
    return (i ? '<w:r>' + rPr + '<w:br/></w:r>' : '') + '<w:r>' + rPr + '<w:t xml:space="preserve">' + memXml(line) + '</w:t></w:r>';
  }).join('');
  return '<w:p><w:pPr><w:spacing w:after="' + (p.after == null ? 120 : p.after) + '" w:line="320" w:lineRule="auto"/></w:pPr>' + runs + '</w:p>';
}
function memBuildDocx(paras) {
  var body = paras.map(memDocxPara).join('');
  return memZip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>' }
  ]);
}
function memDateText(t) {
  var d = new Date(t);
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
// 一个角色的段落
function memDocxCharParas(char) {
  var paras = [
    { text: memCharName(char) + ' 的记忆', size: 36, bold: true, color: 'C0506A', after: 60 },
    { text: '导出时间：' + memDateText(Date.now()) + '　·　按重要程度排列，同类按时间从早到晚', size: 18, color: '998888', after: 240 }
  ];
  var msText = (memMilestones[char.id] || {}).text;
  if (msText) {
    paras.push({ text: '📌 关系里程碑', size: 28, bold: true, color: '5A4249', after: 120 });
    msText.split('\n').forEach(function(l) { if (l.trim()) paras.push({ text: l.trim(), size: 22, after: 80 }); });
    paras.push({ text: '', size: 22, after: 160 });
  }
  var all = memList(char.id);
  ['precious', 'long', 'short'].forEach(function(type) {
    var list = all.filter(function(m) { return m.type === type; }).sort(function(a, b) { return a.time - b.time; });
    paras.push({ text: (type === 'precious' ? '💎 珍贵的记忆' : MEM_TYPE_NAME[type] + '记忆') + '（' + list.length + ' 条）', size: 28, bold: true, color: '5A4249', after: 120 });
    if (!list.length) paras.push({ text: '（还没有）', size: 20, color: 'AAAAAA', after: 200 });
    list.forEach(function(m) {
      paras.push({ text: memDateText(m.time) + '　·　' + memSourceText(m) +
        (m.type === 'short' && m.expires ? '　·　' + memDateText(m.expires) + ' 忘掉' : ''), size: 18, color: '998888', after: 20 });
      paras.push({ text: m.text, size: 22, after: 160 });
    });
  });
  return paras;
}
function memExportDocx(chars) {
  var paras = [];
  chars.forEach(function(c, i) {
    if (i) paras.push({ pageBreak: true });
    paras = paras.concat(memDocxCharParas(c));
  });
  var d = new Date(), stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  shareOrDownload(memBuildDocx(paras), (chars.length === 1 ? memCharName(chars[0]) + '的记忆_' : '全部角色的记忆_') + stamp + '.docx');
  showToast('✓ 已导出 Word 文档', 'success');
}
document.getElementById('memLibExport').addEventListener('click', function() {
  var c = memCharById(memLibChar);
  if (c) memExportDocx([c]);
});
document.getElementById('memExportAll').addEventListener('click', function() {
  if (charList.length) memExportDocx(charList.filter(function(c) { return !c.isGroup; }));
});

// 添加 / 编辑一条记忆
var memEditOverlay = document.getElementById('memEditOverlay');
var memEditing = null, memEditType = 'long';
function setMemEditType(t) {
  memEditType = t;
  document.querySelectorAll('#memEditType .pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.type === t); });
}
function openMemEdit(char, m) {
  memEditing = { char: char, m: m || null };
  document.getElementById('memEditTitle').textContent = m ? '编辑记忆' : '添加记忆';
  document.getElementById('memEditText').value = m ? m.text : '';
  setMemEditType(m ? m.type : memLibFilter);
  memEditOverlay.classList.add('open');
}
document.querySelectorAll('#memEditType .pf-radio-btn').forEach(function(b) {
  b.addEventListener('click', function() { setMemEditType(this.dataset.type); });
});
document.getElementById('memAddBtn').addEventListener('click', function() {
  var char = memCharById(memLibChar);
  if (char) openMemEdit(char, null);
});
document.getElementById('memEditCancel').addEventListener('click', function() { memEditOverlay.classList.remove('open'); });
closeOnBackdrop(memEditOverlay);
document.getElementById('memEditSave').addEventListener('click', function() {
  var ta = document.getElementById('memEditText'), text = ta.value.trim();
  if (!text) { shakeEl(ta); return; }
  var e = memEditing;
  if (e.m) {
    if (e.m.text !== text) { e.m.text = text.slice(0, 300); delete e.m.emb; delete e.m.embModel; }
    e.m.type = memEditType;
    if (memEditType === 'short') { if (!e.m.expires) e.m.expires = Date.now() + memCfgOf(e.char).shortDays * MEM_DAY; }
    else delete e.m.expires;
    saveMemStore();
  } else {
    memAdd(e.char, { type: memEditType, text: text, source: 'user' });
  }
  memEditOverlay.classList.remove('open');
  renderMemLib();
});

// 向量模型：保存 / 测试
document.getElementById('memEmbedSave').addEventListener('click', function() {
  memEmbedModel = document.getElementById('memEmbedModel').value.trim();
  mphoneStore.save('mphone_mem_embed_model', memEmbedModel);
  showToast(memEmbedModel ? '✓ 已保存向量模型' : '已清空，改用本地相似度', 'success');
});
document.getElementById('memEmbedTest').addEventListener('click', function() {
  var hint = document.getElementById('memEmbedHint');
  memEmbedModel = document.getElementById('memEmbedModel').value.trim();
  if (!memEmbedModel) { hint.textContent = '先填一个向量模型名'; return; }
  hint.textContent = '正在测试…';
  memEmbed(['今天天气很好', '今天阳光明媚', '我想吃火锅']).then(function(e) {
    var near = memEmbCos(e[0], e[1]), far = memEmbCos(e[0], e[2]);
    hint.textContent = '✓ 可以用：向量长度 ' + e[0].length + '，相近的两句相似度 ' + near.toFixed(2) + '，不相干的 ' + far.toFixed(2);
  }, function(err) { hint.textContent = '✗ 不能用：' + err.message; });
});
