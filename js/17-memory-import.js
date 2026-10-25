// 眠花糖机 — 记忆总结（按回合）、记忆备份、角色导入

// =============================================
// 记忆总结（按回合）、记忆备份、角色导入
// =============================================
// char.memory = { summaries: [{ id, text, from, to, time }], upTo: 已总结到第几回合（不含） }
function getCharMemory(char) {
  if (!char.memory) char.memory = { summaries: [], upTo: 0 };
  if (!char.memory.summaries) char.memory.summaries = [];
  return char.memory;
}

function roundsAsText(rounds, char) {
  var acc = resolveCharAccount(char);
  var cName = char.charAlias || char.charName || '角色';
  var uName = acc.nickname || '用户';
  return rounds.map(function(r) {
    return r.map(function(m) {
      var c = m.recalled ? '[撤回了一条消息]' : m.imgSrc ? '[图片]'
        : m.voice ? '[语音]' + (m.transcript || '')
        : String(m.content || '').replace(/〔译〕[\s\S]*$/, '').trim();
      if (m.quote && !m.recalled) c = '（引用 ' + m.quote.author + '：' + m.quote.text + '）' + c;
      return (m.role === 'user' ? uName : cName) + '：' + c;
    }).join('\n');
  }).join('\n');
}

// 总结第 from ~ to-1 回合，写入角色记忆
function summarizeRounds(idx, from, to) {
  var char = charList[idx];
  var rounds = splitRounds(getChatHistory(idx)).slice(from, to);
  if (!rounds.length) return Promise.resolve(null);
  var msgs = [
    { role: 'system', content: '你是记忆整理助手。请把下面这段聊天总结成简洁的记忆要点：用第三人称，保留关键事件、约定、情绪与关系变化、重要细节，不超过 200 字。只输出总结内容。' },
    { role: 'user', content: roundsAsText(rounds, char) }
  ];
  return callApiOnce(msgs).then(function(text) {
    var mem = getCharMemory(char);
    var item = { id: genFeedId('m'), text: text.trim(), from: from, to: to, time: Date.now() };
    mem.summaries.push(item);
    mem.upTo = Math.max(mem.upTo || 0, to);
    saveCharList();
    if (appCharSetting.classList.contains('active') && charList[editingCharIndex] === char) renderMemSummaries(char);
    return item;
  });
}

// 回复后检查：超出注意力范围且未总结的回合累计到设定值就自动总结
function maybeAutoSummarize(idx) {
  var char = charList[idx];
  var c = Object.assign({}, DEFAULT_CHAT_CFG, char && char.chatCfg || {});
  if (!char || !c.autoSum || char._sumBusy) return;
  // 每新增 N 个完整回合就总结一次（不含最新这一回合，它可能还没聊完）
  var end = splitRounds(getChatHistory(idx)).length - 1;
  var upTo = getCharMemory(char).upTo || 0;
  if (end - upTo < c.sumEvery) return;
  char._sumBusy = true;
  summarizeRounds(idx, upTo, end)
    .catch(function(err) { console.warn('[Mphone] 自动总结失败:', err); })
    .then(function() { delete char._sumBusy; });
}

function renderMemSummaries(char) {
  var list = document.getElementById('memSumList');
  list.innerHTML = '';
  var real = charList[findCharIdx(char.id)];
  if (!real || !real.memory || !real.memory.summaries.length) {
    list.innerHTML = '<div class="auto-hint">还没有总结</div>';
    return;
  }
  var mem = real.memory;
  mem.summaries.forEach(function(s, i) {
    var item = document.createElement('div');
    item.className = 'mem-sum-item';
    var head = document.createElement('div');
    head.className = 'mem-sum-head';
    var info = document.createElement('span');
    var d = new Date(s.time);
    info.textContent = '第 ' + (s.from + 1) + '–' + s.to + ' 回合 · ' + (d.getMonth() + 1) + '/' + d.getDate();
    var del = document.createElement('button');
    del.textContent = '删除';
    del.addEventListener('click', function() {
      openPfEntryDel('删除这段总结？', function() {
        mem.summaries.splice(i, 1);
        // 删的是最后一段：这些回合重新按原文发送，之后可再次总结
        if (i === mem.summaries.length) mem.upTo = s.from;
        saveCharList();
        renderMemSummaries(real);
      });
    });
    head.appendChild(info);
    head.appendChild(del);
    var ta = document.createElement('textarea');
    ta.className = 'mem-sum-text';
    ta.value = s.text;
    ta.addEventListener('change', function() { s.text = this.value.trim(); saveCharList(); });
    item.appendChild(head);
    item.appendChild(ta);
    list.appendChild(item);
  });
}

document.getElementById('memSumNowBtn').addEventListener('click', function() {
  var btn = this;
  if (editingCharIndex < 0) { showToast('请先保存角色', 'error'); return; }
  var char = charList[editingCharIndex];
  var total = splitRounds(getChatHistory(editingCharIndex)).length;
  var upTo = getCharMemory(char).upTo || 0;
  if (total <= upTo) { showToast('没有需要总结的新内容', 'success'); return; }
  btn.disabled = true;
  btn.textContent = '总结中…';
  summarizeRounds(editingCharIndex, upTo, total)
    .then(function() { showToast('✓ 已生成总结', 'success'); })
    .catch(function(err) { showToast('✗ ' + err.message, 'error'); })
    .then(function() { btn.disabled = false; btn.textContent = '立即总结'; });
});

// ---------- 记忆备份：单个角色的设置 + 记录 + 总结 ----------
function downloadJson(obj, name) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
}

function pickFile(accept, cb) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', function() { if (this.files[0]) cb(this.files[0]); });
  input.click();
}

document.getElementById('memExportBtn').addEventListener('click', function() {
  if (editingCharIndex < 0) { showToast('请先保存角色', 'error'); return; }
  var char = charList[editingCharIndex];
  var c = Object.assign({}, char);
  delete c._autoBusy; delete c._lastChatAt; delete c._sumBusy;
  var d = new Date();
  downloadJson({
    app: 'mphone', type: 'char', version: 1, char: c,
    chat: chatHistories[char.id] || [], drama: dramaHistories[char.id] || [],
    mems: (typeof memStore !== 'undefined' && memStore[char.id]) || []
  }, (char.charAlias || 'char') + '-记忆备份-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json');
  showToast('✓ 已导出', 'success');
});

document.getElementById('memRestoreBtn').addEventListener('click', function() {
  if (editingCharIndex < 0) { showToast('请先保存角色', 'error'); return; }
  pickFile('.json,application/json', function(file) {
    file.text().then(function(t) {
      var b = JSON.parse(t);
      if (!b || b.app !== 'mphone' || b.type !== 'char' || !b.char) throw new Error('bad');
      openPfEntryDel('用备份覆盖当前角色？', function() {
        var cur = charList[editingCharIndex];
        var restored = Object.assign({}, b.char, { id: cur.id, inChat: cur.inChat });
        charList[editingCharIndex] = restored;
        chatHistories[cur.id]  = b.chat  || [];
        dramaHistories[cur.id] = b.drama || [];
        if (Array.isArray(b.mems) && typeof memStore !== 'undefined') { memStore[cur.id] = b.mems; saveMemStore(); }
        saveCharList();
        saveHistories();
        fillCharForm(restored);
        renderChatCharList();
        showToast('✓ 已恢复备份', 'success');
      });
    }).catch(function() { showToast('✗ 不是有效的角色备份文件', 'error'); });
  });
});

// ---------- 角色导入：酒馆角色卡 PNG / JSON、Word 文档 ----------
var contactsAddPopup = document.getElementById('contactsAddPopup');
document.getElementById('contactsAddBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  contactsAddPopup.classList.toggle('open');
});
document.addEventListener('click', function(e) {
  if (!document.getElementById('contactsRightWrap').contains(e.target)) contactsAddPopup.classList.remove('open');
});
document.getElementById('contactsNewBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  contactsAddPopup.classList.remove('open');
  openCharSetting(-1);
});
document.getElementById('contactsImportBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  contactsAddPopup.classList.remove('open');
  pickFile('.png,.json,.docx,image/png,application/json', function(file) {
    importCharFile(file)
      .then(function(draft) { openCharSetting(-1, draft); showToast('✓ 已读取，确认后点「保存」', 'success'); })
      .catch(function(err) { showToast('✗ ' + (err.message || '无法读取该文件'), 'error'); });
  });
});

function importCharFile(file) {
  var name = file.name.toLowerCase();
  if (/\.docx$/.test(name)) {
    return file.arrayBuffer().then(readDocxText).then(function(text) {
      if (!text.trim()) throw new Error('文档里没有文字');
      return { charAlias: file.name.replace(/\.docx$/i, ''), charPersona: text.trim() };
    });
  }
  if (/\.json$/.test(name)) {
    return file.text().then(function(t) { return cardToDraft(JSON.parse(t), ''); });
  }
  if (/\.png$/.test(name)) {
    return file.arrayBuffer().then(function(buf) {
      var json = readPngCard(buf);
      if (!json) throw new Error('这张图片里没有角色卡数据');
      return new Promise(function(resolve) {
        var r = new FileReader();
        r.onload = function(ev) { compressImage(ev.target.result, 512, resolve); };
        r.readAsDataURL(file);
      }).then(function(avatar) { return cardToDraft(JSON.parse(json), avatar); });
    });
  }
  return Promise.reject(new Error('只支持 PNG / JSON / DOCX'));
}

// 酒馆角色卡（V1 / V2 / V3）→ 角色草稿；自带的世界书条目一并导入并关联
function cardToDraft(card, avatar) {
  var d = card.data || card;
  if (!d || !(d.name || d.description || d.char_name)) throw new Error('不是有效的角色卡');
  var parts = [];
  if (d.description) parts.push(d.description);
  if (d.personality) parts.push('性格：' + d.personality);
  if (d.scenario)    parts.push('场景：' + d.scenario);
  if (d.mes_example) parts.push('对话示例：\n' + d.mes_example);
  // 角色卡自带的世界书：只暂存，确认保存角色时才建文件夹写入
  var pendingEntries = [];
  var book = d.character_book;
  if (book && Array.isArray(book.entries)) {
    book.entries.forEach(function(e) {
      if (!e || !e.content) return;
      // 位置：角色描述前后 → 前；作者注释 → 中；按深度插入聊天记录 → 后
      var ext = (e.extensions && e.extensions.position);
      var pos = ext === 4 ? 'after' : (ext === 2 || ext === 3) ? 'middle' : 'before';
      pendingEntries.push({
        name: e.comment || e.name || (e.keys && e.keys[0]) || '导入条目',
        keywords: (e.constant ? '' : (e.keys || []).join(',')),
        content: e.content,
        pos: pos,
        enabled: e.enabled !== false
      });
    });
  }
  // 开场白：主开场白 + 备选开场白，供剧情选择
  var openings = [d.first_mes || d.char_greeting || ''].concat(d.alternate_greetings || [])
    .map(function(t) { return String(t || '').trim(); }).filter(Boolean);
  return {
    charName: d.name || d.char_name || '',
    charAlias: d.name || d.char_name || '',
    charPersona: parts.join('\n\n'),
    openings: openings,
    charAvatar: avatar || '',
    pendingWb: pendingEntries.length ? { entries: pendingEntries } : null
  };
}

// 读取 PNG 里 tEXt / iTXt 块中的 chara（或 ccv3）角色卡，返回 JSON 字符串
function readPngCard(buf) {
  var v = new DataView(buf), u8 = new Uint8Array(buf);
  if (v.getUint32(0) !== 0x89504E47) return null;
  var pos = 8, found = {};
  var latin1 = function(a) { var s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return s; };
  while (pos + 8 <= u8.length) {
    var len = v.getUint32(pos), type = latin1(u8.subarray(pos + 4, pos + 8));
    var data = u8.subarray(pos + 8, pos + 8 + len);
    if (type === 'tEXt' || type === 'iTXt') {
      var z = data.indexOf(0);
      var key = latin1(data.subarray(0, z)).toLowerCase();
      var text;
      if (type === 'tEXt') {
        text = latin1(data.subarray(z + 1));
      } else {
        // iTXt：关键字\0 压缩标记 压缩方式 语言\0 译名\0 文本（只支持未压缩）
        if (data[z + 1] !== 0) { pos += 12 + len; continue; }
        var p = z + 3;
        p = data.indexOf(0, p) + 1;
        p = data.indexOf(0, p) + 1;
        text = new TextDecoder().decode(data.subarray(p));
      }
      if (key === 'chara' || key === 'ccv3') found[key] = text;
    }
    if (type === 'IEND') break;
    pos += 12 + len;
  }
  var raw = found.ccv3 || found.chara;
  if (!raw) return null;
  try {
    var bin = atob(raw.trim());
    return new TextDecoder().decode(Uint8Array.from(bin, function(c) { return c.charCodeAt(0); }));
  } catch (_) {
    return raw;   // 少数卡直接存 JSON 文本
  }
}

// 解压 docx（zip）里的 word/document.xml 并提取段落文字
function readDocxText(buf) {
  return zipReadEntry(buf, function(name) { return name === 'word/document.xml'; }).then(function(bytes) {
    var text = new TextDecoder().decode(bytes)
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '');
    var ta = document.createElement('textarea');
    ta.innerHTML = text;   // 解码 &amp; 等实体
    return ta.value.replace(/\n{3,}/g, '\n\n');
  });
}

// ---------- 桌面：记忆库（界面和记忆系统在 28-memory.js） ----------
document.getElementById('dockMemory').addEventListener('click', function() {
  document.getElementById('appMemory').classList.add('active');
});
document.getElementById('backMemory').addEventListener('click', function() {
  document.getElementById('appMemory').classList.remove('active');
});
