// 眠花糖机 — 输入栏：回车只发自己的消息、↵ 换行、引用条、❄️ 请求回复

var crSendBtn = document.querySelector('.cr-send-btn');
var crInput   = document.getElementById('crInput');

// 追加用户消息到历史和界面（不触发 AI）；有待发送的引用就一起带上
function appendUserMsg(text) {
  if (!text || openingChatCharIdx === -1) return;
  var m = { role: 'user', content: text, time: Date.now() };
  if (pendingQuote) { m.quote = pendingQuote; clearQuote(); }
  getActiveHistory(openingChatCharIdx).push(m);
  saveHistories();
  renderHistMsg(m);
}

// ---------- 引用：输入框上方的引用条 ----------
var pendingQuote = null;   // { author, text }
function setQuote(q) {
  pendingQuote = q;
  document.getElementById('crQuoteText').textContent = '引用 ' + q.author + '：' + q.text;
  document.getElementById('crQuoteBar').classList.add('open');
  crInput.focus();
}
function clearQuote() {
  pendingQuote = null;
  document.getElementById('crQuoteBar').classList.remove('open');
}
document.getElementById('crQuoteClose').addEventListener('click', clearQuote);

// 输入框里没发出去的字和引用，每个角色的聊天 / 剧情窗口各留各的（以前切到别的角色还带着上一个的草稿和引用，会发错地方）
var crDrafts = {}, crDraftKey = '';
function crDraftSwap() {
  var c = charList[openingChatCharIdx], key = c ? c.id + ':' + currentCrSubView : '';
  if (key === crDraftKey) return;
  if (crDraftKey) {
    if (crInput.value || pendingQuote) crDrafts[crDraftKey] = { text: crInput.value, quote: pendingQuote };
    else delete crDrafts[crDraftKey];
  }
  crDraftKey = key;
  var d = crDrafts[key];
  crInput.value = d ? d.text : '';
  crInput.style.height = '';
  if (crInput.value) crInput.dispatchEvent(new Event('input'));
  if (d && d.quote) {
    pendingQuote = d.quote;
    document.getElementById('crQuoteText').textContent = '引用 ' + d.quote.author + '：' + d.quote.text;
    document.getElementById('crQuoteBar').classList.add('open');
  } else clearQuote();
}

// cr-send-btn（↵ 图标）：在输入框光标处插入换行，不发送
crSendBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  var start = crInput.selectionStart, end = crInput.selectionEnd;
  crInput.value = crInput.value.substring(0, start) + '\n' + crInput.value.substring(end);
  crInput.selectionStart = crInput.selectionEnd = start + 1;
  crInput.dispatchEvent(new Event('input'));
  crInput.focus();
});

// 键盘 Enter（无 Shift）：将输入框内容作为一条用户消息发送，不触发 AI
crInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    var text = crInput.value.trim();
    if (!text) return;
    appendUserMsg(text);
    crInput.value = ''; crInput.style.height = '';
  }
});

crInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 80) + 'px'; });

// ❄️ 请求回复：触发 AI 调用，使用已有历史，不追加用户消息
document.querySelector('.cr-emoji-btn').addEventListener('click', function(e) {
  e.stopPropagation();
  if (genHere()) { stopGenerating(); return; }
  if (openingChatCharIdx !== -1) sendMsg('', true);
});
