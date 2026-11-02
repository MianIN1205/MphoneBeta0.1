// 眠花糖机 — 剧情开场白：剧情还空着时「添加开场白」（粘贴）/「随机开场白」（给个方向让 AI 写），以中立的旁白发出

// =============================================
// 开场白存成 { role: 'user', narr: true, content, time }：
// · 用 user 的身份放进记录，这样发出后既可以直接点 ❄️ 请求回复，也可以接着发自己的内容
// · 发给 AI 时标明是中立的旁白，不是用户说的话（见 js/chat/prompt.js 的 msgTextForAI）
// · 显示成居中的旁白块（见 js/chat/render.js 的 renderNarration），长按可以编辑、删除
// 角色卡导入时自带的开场白（char.openings）放在「添加开场白」里，点一下填进去
// =============================================
var openingOverlay = document.getElementById('openingOverlay');
var openingState = null;   // { idx, mode: 'add' | 'rand', step: 'ask' | 'result', dir }

function openOpening(idx, mode) {
  openingState = { idx: idx, mode: mode, step: 'ask', dir: '' };
  var ta = document.getElementById('openingText');
  ta.value = '';
  ta.placeholder = mode === 'add'
    ? '把开场白粘贴到这里…'
    : '想要什么样的开场？比如：雨夜，在便利店重逢。不写就完全随机';
  ta.classList.toggle('short', mode === 'rand');
  document.getElementById('openingTitle').textContent = mode === 'add' ? '添加开场白' : '随机开场白';
  document.getElementById('openingHint').textContent = mode === 'add'
    ? '会以旁白的样子发出；之后点 ❄️ 让 TA 接着写，或者先发你自己的内容。{{char}}、{{user}} 会自动换成名字'
    : '会按 TA 的人设和世界书写一段，先给你看，满意了再用';
  document.getElementById('openingRegen').style.display = 'none';
  var ok = document.getElementById('openingOk');
  ok.textContent = mode === 'add' ? '添加' : '生成';
  ok.disabled = false;
  // 角色卡自带的开场白
  var box = document.getElementById('openingPresets');
  box.innerHTML = '';
  var list = (mode === 'add' && charList[idx] && charList[idx].openings) || [];
  box.style.display = list.length ? '' : 'none';
  if (list.length) {
    var t = document.createElement('div');
    t.className = 'auto-hint';
    t.textContent = '角色卡自带的开场白，点一下填进去';
    box.appendChild(t);
    list.forEach(function(text) {
      var it = document.createElement('div');
      it.className = 'opening-preset';
      it.textContent = fillMacros(text, charList[idx]);
      it.addEventListener('click', function() { ta.value = text; });
      box.appendChild(it);
    });
  }
  openingOverlay.classList.add('open');
  setTimeout(function() { ta.focus(); }, 50);
}
function closeOpening() { openingOverlay.classList.remove('open'); openingState = null; }

// 发出去：放进剧情记录，画成旁白
function postOpening(idx, text) {
  // 聊天记录发给 AI 时不会再换 {{char}} / {{user}}，所以存的时候就换成名字
  var m = { role: 'user', narr: true, content: fillMacros(text, charList[idx]), time: Date.now() };
  getDramaHistory(idx).push(m);
  saveHistories();
  if (charList[openingChatCharIdx] === charList[idx]) {
    renderHistMsg(m, document.getElementById('dramaMsgList'), document.getElementById('dramaRoomEmpty'));
  }
}

// 让 AI 写一段开场：带上 TA 的人设、世界书、预设（和剧情回复时一样），再说清楚要什么
function generateOpening(idx, dir) {
  var char = charList[idx];
  var sys = buildMsgs(idx, getDramaHistory(idx)).filter(function(m) { return m.role === 'system'; });
  var ask = '请为接下来的剧情写一段开场白。\n要求：\n' +
    '- 用中立的旁白视角，交代时间、地点、氛围，以及{{char}}此刻在哪里、在做什么、状态如何\n' +
    '- 给{{user}}留出行动的空间：不要替{{user}}说话、做决定，也不要写{{user}}的心理\n' +
    '- 200～400 字，有画面感，结尾停在一个{{user}}可以接下去的地方\n' +
    '- 只输出开场白正文：不要标题，不要状态栏，不要任何标签\n' +
    (dir ? '想要的方向：' + dir : '方向不限：按人设和世界观自由发挥，给一个有意思的开头。');
  return llmRequest(sys.concat([{ role: 'user', content: fillMacros(ask, char) }]), { stream: false, cfg: getApiCfg(char) }).then(function(text) {
    text = String(text || '');
    if (typeof takeStatus === 'function') text = takeStatus(text).text;
    text = text.replace(/<(前情|记忆|日程|撤回|签名|拍一拍)[^>]*>[\s\S]*?<\/\1>/g, '')
      .replace(/^\s*(?:【?开场白】?|开场白)[：:]\s*/, '').trim();
    if (!text) throw new Error('未收到回复内容');
    return text;
  });
}

document.getElementById('openingOk').addEventListener('click', function() {
  var s = openingState, btn = this;
  if (!s) return;
  var ta = document.getElementById('openingText');
  var text = ta.value.trim();
  if (s.mode === 'add' || s.step === 'result') {
    if (!text) { shakeEl(ta); return; }
    postOpening(s.idx, text);
    closeOpening();
    return;
  }
  // 随机：先生成，给你看
  s.dir = text;
  runOpeningGen(btn);
});
function runOpeningGen() {
  var s = openingState, btn = document.getElementById('openingOk'), regen = document.getElementById('openingRegen');
  var ta = document.getElementById('openingText');
  btn.disabled = true; regen.disabled = true;
  btn.textContent = '生成中…';
  generateOpening(s.idx, s.dir).then(function(text) {
    if (openingState !== s) return;
    s.step = 'result';
    ta.classList.remove('short');
    ta.value = text;
    document.getElementById('openingHint').textContent = (s.dir ? '方向：' + s.dir + '。' : '') + '可以直接改；不满意点「换一个」';
    regen.style.display = '';
    btn.textContent = '用这个';
  }).catch(function(err) {
    if (openingState !== s) return;
    btn.textContent = s.step === 'result' ? '用这个' : '生成';
    showToast('✗ 生成失败：' + (typeof explainError === 'function' ? explainError(err).title : err.message), 'error');
  }).then(function() { btn.disabled = false; regen.disabled = false; });
}
document.getElementById('openingRegen').addEventListener('click', function() { if (openingState) runOpeningGen(); });
document.getElementById('openingCancel').addEventListener('click', closeOpening);
closeOnBackdrop(openingOverlay, closeOpening);
