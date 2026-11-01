// 眠花糖机 — 导入角色：酒馆角色卡 PNG / JSON、Word 文档

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
