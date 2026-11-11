// 眠花糖机 — 桌面「记忆库」：每个角色的记忆列表、问 TA 记得什么、导出 Word、编辑记忆

// =============================================
// 记忆库界面：首页每个角色一张卡片（一行两张），点进去看这个角色的珍贵 / 长期 / 短期记忆
// =============================================
var memLibChar = '', memLibFilter = 'precious', memLibEmo = '';   // memLibEmo：按情绪筛（空 = 全部）
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
  var stats = document.getElementById('memStats'), untagged = memUntagged(char);
  stats.textContent = '珍贵 ' + n.precious + ' · 长期 ' + n.long + ' · 短期 ' + n.short +
    (cfg.on ? '' : '（这个角色在「扩展」页关掉了记忆库，TA 暂时想不起来）');
  if (untagged.length) {   // 以前记的还没有情绪和线索：点一下让模型照原文补上
    var fill = document.createElement('button');
    fill.className = 'mem-fill-btn';
    fill.textContent = '给 ' + untagged.length + ' 条补上心情和画面';
    fill.addEventListener('click', function() { memFillTags(char, fill); });
    stats.appendChild(fill);
  }
  var box = document.getElementById('memList');
  box.innerHTML = '';
  var all = memList(char.id).filter(function(m) { return m.type === memLibFilter; });
  // 按情绪筛：只列这一类里出现过的情绪
  var emoRow = document.getElementById('memEmoFilter'), emos = MEM_EMOS.filter(function(e) { return all.some(function(m) { return m.emo === e; }); });
  if (emos.indexOf(memLibEmo) < 0) memLibEmo = '';
  emoRow.innerHTML = '';
  emos.forEach(function(e) {
    var c = document.createElement('button');
    c.className = 'mem-emo-chip' + (memLibEmo === e ? ' on' : '');
    c.textContent = e;
    c.addEventListener('click', function() { memLibEmo = memLibEmo === e ? '' : e; renderMemLib(); });
    emoRow.appendChild(c);
  });
  var list = all.filter(function(m) { return !memLibEmo || m.emo === memLibEmo; }).sort(function(a, b) { return b.time - a.time; });
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
    // 当时的心情和画面：一行小字（情绪后面的小点是强度）
    var tags = document.createElement('div');
    tags.className = 'mem-tags';
    if (m.emo) { var em = document.createElement('span'); em.className = 'mem-tag-emo'; em.textContent = m.emo + ' ' + '•••'.slice(0, m.emoW || 2); tags.appendChild(em); }
    (m.cues || []).forEach(function(c) { var t = document.createElement('span'); t.className = 'mem-tag-cue'; t.textContent = c; tags.appendChild(t); });
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
    if (tags.childNodes.length) card.appendChild(tags);
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
  var k = memKnow[char.id] || {};
  document.getElementById('memKnowText').value = k.text || '';
  document.getElementById('memKnowMeta').textContent = k.time ? '整理于' + memAgo(k.time) : '';
}
// 「TA 知道的你」：重新整理 / 自己改了保存
document.getElementById('memKnowRebuild').addEventListener('click', function() {
  var char = memCharById(memLibChar), btn = this;
  if (!char || btn.disabled) return;
  btn.disabled = true; btn.textContent = '整理中…';
  memBuildKnow(char).then(function(t) { showToast(t ? '✓ 整理好了' : '记忆里还没有关于你的事', t ? 'success' : 'plain'); })
    .catch(function(err) { showToast('✗ 没整理成：' + err.message, 'error'); })
    .then(function() { btn.disabled = false; btn.textContent = '重新整理'; });
});
document.getElementById('memKnowSave').addEventListener('click', function() {
  var char = memCharById(memLibChar);
  if (!char) return;
  var old = memKnow[char.id] || {};
  memKnow[char.id] = { text: document.getElementById('memKnowText').value.trim(), time: Date.now(), basedOn: old.basedOn || memImportant(char.id).length };
  saveMemKnow();
  renderMemLib();
  showToast('✓ 保存了', 'success');
});
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
var memEditEmo = '';
function paintMemEditEmo() {
  var row = document.getElementById('memEditEmo');
  row.innerHTML = '';
  MEM_EMOS.forEach(function(e) {
    var c = document.createElement('button');
    c.className = 'mem-emo-chip' + (memEditEmo === e ? ' on' : '');
    c.textContent = e;
    c.addEventListener('click', function() { memEditEmo = memEditEmo === e ? '' : e; paintMemEditEmo(); });
    row.appendChild(c);
  });
}
function openMemEdit(char, m) {
  memEditing = { char: char, m: m || null };
  document.getElementById('memEditTitle').textContent = m ? '编辑记忆' : '添加记忆';
  document.getElementById('memEditText').value = m ? m.text : '';
  memEditEmo = (m && m.emo) || '';
  paintMemEditEmo();
  document.getElementById('memEditCues').value = ((m && m.cues) || []).join('、');
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
    if (e.m.text !== text) { e.m.text = text.slice(0, typeof memTextMax === 'function' ? memTextMax(e.m.type) : 300); delete e.m.emb; delete e.m.embModel; }
    e.m.type = memEditType;
    if (memEditType === 'short') { if (!e.m.expires) e.m.expires = Date.now() + memCfgOf(e.char).shortDays * MEM_DAY; }
    else delete e.m.expires;
    if (memEditEmo) { if (e.m.emo !== memEditEmo) { e.m.emo = memEditEmo; e.m.emoW = e.m.emoW || 2; } } else { delete e.m.emo; delete e.m.emoW; }
    var cues = memNormCues(document.getElementById('memEditCues').value);
    if (cues.length) e.m.cues = cues; else delete e.m.cues;
    saveMemStore();
  } else {
    memAdd(e.char, { type: memEditType, text: text, source: 'user', emo: memEditEmo, cues: document.getElementById('memEditCues').value });
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

// ---------- 给以前记的补上心情和画面（长期 / 珍贵里还没有情绪和线索的）：一次 20 条，线索只能从原文里找，不编 ----------
function memUntagged(char) { return memList(char.id).filter(function(m) { return m.type !== 'short' && !m.emo && !(m.cues && m.cues.length) && !m.tagTried; }); }
function memFillTags(char, btn) {
  var todo = memUntagged(char);
  if (!todo.length || btn.disabled) return;
  btn.disabled = true;
  var done = 0, step = function() {
    var batch = todo.slice(done, done + 20);
    if (!batch.length) { btn.disabled = false; saveMemStore(); renderMemLib(); showToast('✓ 补好了 ' + done + ' 条', 'success'); return; }
    btn.textContent = '正在补… ' + done + ' / ' + todo.length;
    var ask = '下面是' + memCharName(char) + '的几条记忆。给每条补三样东西：\n' +
      '1. emo：当时的心情，只能从这些里选一个：' + MEM_EMOS.join('、') + '（看不出就写 平静）\n' +
      '2. w：情绪强度 1～3，越难忘越高\n' +
      '3. cues：3～6 个线索，只能从这条记忆原文里取具体的东西（看到的、听到的、闻到的、吃到的、摸到的、地点、物件、人），原文里没有的不要编；实在没有就少写\n' +
      '只输出 JSON 数组，不要别的字：[{"i":序号,"emo":"…","w":2,"cues":["…"]}]\n\n' +
      batch.map(function(m, i) { return i + '. ' + m.text; }).join('\n');
    callApiOnce([{ role: 'user', content: ask }], char).then(function(text) {
      var arr = [];
      try { arr = JSON.parse(String(text).replace(/^[\s\S]*?(\[[\s\S]*\])[\s\S]*$/, '$1')); } catch (_) {}
      batch.forEach(function(m, i) {
        var hit = (Array.isArray(arr) ? arr : []).filter(function(x) { return x && +x.i === i; })[0];
        if (hit) memSetTags(m, { emo: hit.emo, emoW: hit.w, cues: (Array.isArray(hit.cues) ? hit.cues : []).filter(function(c) { return m.text.indexOf(String(c).trim()) >= 0; }) });   // 原文里没有的线索丢掉
        else m.tagTried = 1;   // 没补上的不再反复问
      });
      done += batch.length;
      saveMemStore();
      step();
    }).catch(function(err) {
      btn.disabled = false; saveMemStore(); renderMemLib();
      showToast('✗ 补到第 ' + done + ' 条停下了：' + ((err && err.message) || '请求失败') + '，可以再点一次接着补', 'error');
    });
  };
  step();
}
