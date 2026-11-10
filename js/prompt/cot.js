// 眠花糖机 — Prompt：思维链（和世界书一样：一行一条带开关，点进去整页改，长按删；同一时间只开一条；最上面「不思考」「模型自带的」；用户要的）
// 选中的存 mphone_cot_mode：'off' / 'native' / 思维链的 id；每个角色还能在便捷拓展栏里单独选（char.cotMode）
// · off    不思考：不加思维链，模型自带的思考也尽量关掉（js/core/llm.js 的 llmThinkOff）
// · native 模型自带的：不加思维链、也不去关，模型有自己的思考就用，没有就直接回
// · 思维链：回复前按这张卡片想一想（COT_WRAP + 卡片内容），模型自带的思考关掉，用它代替
// 思维链只给聊天窗口（用户定的，和预设只给剧情对应）。在聊天里显示思考：开着时每次回复前面有一条很小的折叠条（js/chat/render.js 的 renderThinkBar），默认关
// 文字都是这个项目自己写的

// 格式要求固定加在前面，卡片里只写「想什么」，自己写的也照样能被认出来（takeThink）
var COT_WRAP = '【回复前先想一想】在回复最开头，用 <thinking></thinking> 写一段思考（中文，不要用你自带的英文思考），写完再写正式回复。思考内容{{user}}看不到。想这几件事：\n';
var COT_BUILTIN = [
  { id: 'mine', name: '轻量', desc: '几行就够，回得快', text:
    '- {{user}}这几条在说什么，此刻是什么情绪、想要什么\n' +
    '- {{user}}刚说过、回答过什么：别重复问，别装不知道；我上一轮说过什么：别重复\n' +
    '- 我（{{char}}）此刻在做什么、心情怎样，按人设会怎么回，语气和口头禅对不对\n' +
    '- 回几条、每条多短，要不要发表情包' },
  { id: 'deep', name: '全面', desc: '更懂情绪、更贴人设、更像真人聊天，会长一点', text:
    '- 读懂{{user}}：这几条在说什么？字面之外有没有没说出口的意思（想被安慰、想撒娇、只是想有人听、在试探、在闹别扭）？此刻情绪怎样，累不累\n' +
    '- 记得前文：{{user}}之前说过、回答过的事别再问、别装不知道；我上一轮说过的话、用过的句式和口头禅别再用\n' +
    '- 回到我自己：我是{{char}}，此刻在哪、在做什么、心情怎样，和{{user}}是什么关系；按人设我会怎么想、怎么说，口吻、用词、小习惯对不对，有没有哪句不像我\n' +
    '- 像真人聊天：先接住{{user}}的话，再说别的；不说教、不讲大道理、不像客服；可以带一点自己的事、自己的情绪，或者顺着聊开一个小话题，让{{user}}好接\n' +
    '- 这一轮怎么回：先说什么、再说什么，回几条、每条多长；动作、表情包、语音、撤回要不要用，别每次都一样' }
];
var cotLib = Object.assign({ edits: {}, custom: [] }, mphoneStore.load('mphone_cot_lib', {}) || {});
function saveCotLib() { mphoneStore.save('mphone_cot_lib', cotLib); }
function cotList() {
  return COT_BUILTIN.map(function(c) {
    var e = cotLib.edits[c.id];
    return { id: c.id, name: (e && e.name) || c.name, text: (e && e.text) || c.text, desc: c.desc, builtin: true, edited: !!e };
  }).concat((cotLib.custom || []).map(function(c) { return { id: c.id, name: c.name, text: c.text, desc: '自己写的', builtin: false }; }));
}
function cotById(id) { return cotList().filter(function(c) { return c.id === id; })[0] || null; }
function cotValid(m) { return m === 'off' || m === 'native' || !!cotById(m); }
function cotName(m) { return m === 'off' ? '不思考' : m === 'native' ? '模型自带的' : (cotById(m) || {}).name || '不思考'; }
function cotPrompt(m) { var c = cotById(m); return c ? COT_WRAP + c.text : ''; }

var cotMode = mphoneStore.load('mphone_cot_mode', null);
if (!cotMode) cotMode = String(mphoneStore.load('mphone_cot_enabled', 'false')) === 'true' ? 'mine' : 'off';   // 以前只有一个开关
if (!cotValid(cotMode)) cotMode = 'off';
function cotModeNow() { return cotMode; }
// 某个角色现在用哪种（拓展栏里单独选的，没选或那张删了就跟全局）；剧情窗口不加思维链
function cotModeFor(char, drama) {
  var m = (char && char.cotMode && cotValid(char.cotMode)) ? char.cotMode : cotMode;
  return drama && m !== 'native' ? 'off' : m;
}

// ---------- Prompt 页「思维链」那一栏 ----------
function setCotMode(m) { cotMode = m; mphoneStore.save('mphone_cot_mode', m); paintCotMode(); if (typeof renderQuickBar === 'function') renderQuickBar(); }
function paintCotMode() {
  document.querySelectorAll('#cotModeRow .pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.mode === cotMode); });
  var box = document.getElementById('cotLibList');
  box.innerHTML = '';
  cotList().forEach(function(c) {
    var card = document.createElement('div');
    card.className = 'pf-entry-card' + (cotMode === c.id ? '' : ' disabled');
    card.innerHTML = '<div class="pf-entry-card-body"><div class="pf-entry-card-name"></div><div class="pf-entry-card-sub"></div></div>' +
      '<label class="st-toggle-wrap"><input type="checkbox"><span class="st-toggle-slider"></span></label>' +
      '<svg class="pf-entry-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    card.querySelector('.pf-entry-card-name').textContent = c.name;
    card.querySelector('.pf-entry-card-sub').textContent = c.builtin ? '自带' + (c.edited ? '（改过）' : '') + ' · ' + c.desc : '自己写的';
    var tl = card.querySelector('.st-toggle-wrap'), tcb = tl.querySelector('input');
    tcb.checked = cotMode === c.id;
    tl.addEventListener('click', function(e) { e.stopPropagation(); });
    tcb.addEventListener('change', function() { setCotMode(this.checked ? c.id : 'off'); });   // 开一条，别的自动关
    card.addEventListener('click', function() { openCotDetail(c.id); });
    wbLongPress(card, function() { askDelCot(c); });
    box.appendChild(card);
  });
}
document.querySelectorAll('#cotModeRow .pf-radio-btn').forEach(function(b) {
  b.addEventListener('click', function() { setCotMode(this.dataset.mode); });
});
// 自带的「删除」= 恢复成自带的写法（改过才有）；自己写的真删
function askDelCot(c, after) {
  if (c.builtin && !c.edited) { showToast('自带的删不掉，可以点进去改', 'plain'); return; }
  openConfirm(c.builtin ? '把「' + c.name + '」恢复成自带的写法？' : '删除思维链「' + c.name + '」？', function() {
    if (c.builtin) delete cotLib.edits[c.id];
    else { cotLib.custom = cotLib.custom.filter(function(x) { return x.id !== c.id; }); if (cotMode === c.id) cotMode = 'off', mphoneStore.save('mphone_cot_mode', 'off'); }
    saveCotLib(); paintCotMode(); if (after) after();
  });
}
var cotEditingId = null;
function openCotDetail(id) {
  var c = id ? cotById(id) : null;
  cotEditingId = c ? c.id : null;
  document.getElementById('cotDetailTitle').textContent = c ? c.name : '新建思维链';
  document.getElementById('cotEntryName').value = c ? c.name : '';
  document.getElementById('cotEntryText').value = c ? c.text : '';
  var del = document.getElementById('cotDetailDelete');
  del.textContent = c && c.builtin ? '恢复默认' : '删除此条';
  del.classList.toggle('hidden', !c || (c.builtin && !c.edited));
  document.getElementById('cotDetailView').classList.add('open');
}
function closeCotDetail() { document.getElementById('cotDetailView').classList.remove('open'); }
document.getElementById('cotDetailBack').addEventListener('click', closeCotDetail);
document.getElementById('cotLibAdd').addEventListener('click', function() { openCotDetail(''); });
document.getElementById('cotDetailSave').addEventListener('click', function() {
  var name = document.getElementById('cotEntryName').value.trim() || '未命名';
  var text = document.getElementById('cotEntryText').value.trim();
  if (!text) { showToast('写一点要想的内容吧', 'plain'); return; }
  var c = cotEditingId ? cotById(cotEditingId) : null;
  if (c && c.builtin) cotLib.edits[c.id] = { name: name, text: text };
  else if (c) cotLib.custom.forEach(function(x) { if (x.id === c.id) { x.name = name; x.text = text; } });
  else cotLib.custom.push({ id: genWbId('cot'), name: name, text: text });
  saveCotLib(); paintCotMode(); closeCotDetail();
});
document.getElementById('cotDetailDelete').addEventListener('click', function() {
  var c = cotEditingId && cotById(cotEditingId);
  if (c) askDelCot(c, closeCotDetail); else closeCotDetail();
});
paintCotMode();

var cotShowToggle = document.getElementById('cotShowToggle');
cotShowToggle.checked = !!mphoneStore.load('mphone_cot_show', false);
cotShowToggle.addEventListener('change', function() {
  mphoneStore.save('mphone_cot_show', this.checked);
  // 正在看的聊天马上按新的设置重画
  if (typeof renderRoomLists === 'function' && typeof openingChatCharIdx !== 'undefined' && openingChatCharIdx >= 0 && appChatRoom.classList.contains('active')) {
    renderRoomLists(openingChatCharIdx);
  }
});
