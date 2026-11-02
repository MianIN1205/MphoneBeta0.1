// 眠花糖机 — 单个角色的记忆备份：导出 / 恢复角色设置、记录、总结、记忆和其他小手机的档案

// ---------- 记忆备份：单个角色的设置 + 记录 + 总结 ----------
function downloadJson(obj, name) {
  downloadBlob(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }), name);
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
    mems: (typeof memStore !== 'undefined' && memStore[char.id]) || [],
    milestone: (typeof memMilestones !== 'undefined' && memMilestones[char.id]) || null,
    archives: (typeof arcStore !== 'undefined' && arcStore[char.id]) || []
  }, (char.charAlias || 'char') + '-记忆备份-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json');
  showToast('✓ 已导出', 'success');
});

document.getElementById('memRestoreBtn').addEventListener('click', function() {
  if (editingCharIndex < 0) { showToast('请先保存角色', 'error'); return; }
  pickFile('.json,application/json', function(file) {
    file.text().then(function(t) {
      var b = JSON.parse(t);
      if (!b || b.app !== 'mphone' || b.type !== 'char' || !b.char) throw new Error('bad');
      openConfirm('用备份覆盖当前角色？', function() {
        var cur = charList[editingCharIndex];
        var restored = Object.assign({}, b.char, { id: cur.id, inChat: cur.inChat });
        charList[editingCharIndex] = restored;
        chatHistories[cur.id]  = b.chat  || [];
        dramaHistories[cur.id] = b.drama || [];
        if (Array.isArray(b.mems) && typeof memStore !== 'undefined') { memStore[cur.id] = b.mems; saveMemStore(); }
        if (b.milestone && typeof memMilestones !== 'undefined') { memMilestones[cur.id] = b.milestone; saveMilestones(); }
        if (Array.isArray(b.archives) && typeof arcStore !== 'undefined') { arcStore[cur.id] = b.archives; saveArcStore(); }
        saveCharList();
        saveHistories();
        fillCharForm(restored);
        renderChatCharList();
        showToast('✓ 已恢复备份', 'success');
      });
    }).catch(function() { showToast('✗ 不是有效的角色备份文件', 'error'); });
  });
});
