// 眠花糖机 — 记忆总结：按回合把聊天总结进角色记忆

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
  return callApiOnce(msgs, char).then(function(text) {
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
      openConfirm('删除这段总结？', function() {
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
