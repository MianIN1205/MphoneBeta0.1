// 眠花糖机 — 角色设置界面 + 通讯录联动

// =============================================
// 角色设置界面 + 通讯录联动
// =============================================
var appCharSetting  = document.getElementById('appCharSetting');
var backCharSetting = document.getElementById('backCharSetting');
var charSaveBtn     = document.getElementById('charSaveBtn');

var DEFAULT_CHAR_LIST = [
  { charName: '', charAlias: 'MianIN', userNickname: '', charPersona: '', builtinAssistant: true }   // 系统内置助手
];
var charsWereSaved = !!mphoneStore.load('mphone_chars', null);
var charList = mphoneStore.load('mphone_chars', null) || JSON.parse(JSON.stringify(DEFAULT_CHAR_LIST));   // 所有角色数据
var editingCharIndex = -1;   // -1 = 新建

// 每个角色有固定 id，聊天记录按 id 存，删除角色后其他角色的记录不会错位
function genCharId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
// inChat：是否出现在消息列表（通讯录里始终有全部角色）；旧数据默认都在
charList.forEach(function(c) {
  if (!c.id) c.id = genCharId();
  if (c.inChat === undefined) c.inChat = true;
  // 旧版每个角色单独填的 user 人设 → 作为对所有账号的默认印象（键 '*'）
  if (c.userPersona && !c.userImpressions) c.userImpressions = { '*': c.userPersona };
  delete c.userPersona; delete c.userName; delete c.userAvatar; delete c.userAvatarColor;
  // 旧版单个开场白 → 剧情开场白列表
  if (c.firstMes && !c.openings) c.openings = [c.firstMes];
  delete c.firstMes;
});

var chatHistories  = mphoneStore.load('mphone_chat_histories', {});
var dramaHistories = mphoneStore.load('mphone_drama_histories', {});
var chatUnread     = mphoneStore.load('mphone_unread', {});   // { 角色 id: 未读条数 }

// 旧版本没保存过角色列表时，默认角色每次打开都会换新 id，导致聊天记录对不上。
// 这里找回：把默认角色接到记录最多的那份「无主」聊天记录上，并立即保存角色列表固定 id。
if (!charsWereSaved) {
  var orphan = null, most = 0;
  Object.keys(chatHistories).forEach(function(k) {
    var n = (chatHistories[k] || []).length + ((dramaHistories[k] || []).length);
    if (n > most) { most = n; orphan = k; }
  });
  if (orphan && charList.length === 1) charList[0].id = orphan;
  saveCharList();
}

// _autoBusy / _lastChatAt 是自主活动的运行时状态，不写入存储
function saveCharList() {
  mphoneStore.save('mphone_chars', charList.map(function(c) {
    var o = Object.assign({}, c);
    delete o._autoBusy;
    delete o._lastChatAt;
    delete o._sumBusy;
    return o;
  }));
}

// 气泡颜色预设：[AI 气泡, 用户气泡]
var BUBBLE_PRESETS = [
  ['#BACEDE', '#EEBACA'],
  ['#C4BADC', '#D4D0DC'],
  ['#E8CEB8', '#B8D8C4'],
  ['#FFFFFF', '#B8D8C4']
];
var DEFAULT_BUBBLE = { preset: 0, opacity: 85, effect: 'none' };
var DEFAULT_CHAT_BG = { color: '#FFF0F5', image: '' };

// 头像：有图片用图片，否则兼容旧数据里的背景色
function paintAvatar(el, img, color) {
  el.classList.toggle('avatar-img', !!img);
  el.style.background = '';
  if (img) el.style.backgroundImage = 'url(' + img + ')';
  else if (color) el.style.background = color;
}
function paintCharAvatar(el, char) {
  if (char) paintAvatar(el, char.charAvatar, char.charAvatarColor);
}

// 头像框里暂存当前选择的图片（_img），保存时读取
function setAvatarBox(id, img, color) {
  var box = document.getElementById(id);
  box._img = img || '';
  box.style.border = '';
  paintAvatar(box, img, color);
}

// 角色设置界面里的 聊天背景 / 气泡 / 自定义 CSS 表单状态
function setChatBgForm(bg) {
  bg = bg || DEFAULT_CHAT_BG;
  selectedChatBgColor = bg.color || '';
  selectedChatBgImage = bg.image || '';
  chatBgPreview.style.background = selectedChatBgColor || DEFAULT_CHAT_BG.color;
  if (selectedChatBgImage) {
    chatBgPreview.style.backgroundImage    = 'url(' + selectedChatBgImage + ')';
    chatBgPreview.style.backgroundSize     = 'cover';
    chatBgPreview.style.backgroundPosition = 'center';
  }
  chatBgSwatches.querySelectorAll('.chat-bg-swatch').forEach(function(s) {
    s.classList.toggle('selected', !selectedChatBgImage && s.dataset.color === selectedChatBgColor);
  });
}

function setBubbleForm(b) {
  b = b || DEFAULT_BUBBLE;
  document.querySelectorAll('#bubblePresetRow .bubble-preset-item').forEach(function(i) {
    i.classList.toggle('selected', parseInt(i.dataset.preset, 10) === b.preset);
  });
  bubbleOpacitySlider.value = b.opacity;
  updateBubbleSliderThumb();
  document.querySelectorAll('#bubbleEffectChips .bubble-effect-chip').forEach(function(c) {
    c.classList.toggle('selected', c.dataset.effect === b.effect);
  });
}

function readBubbleForm() {
  var p = document.querySelector('#bubblePresetRow .bubble-preset-item.selected');
  var e = document.querySelector('#bubbleEffectChips .bubble-effect-chip.selected');
  return {
    preset:  p ? parseInt(p.dataset.preset, 10) : 0,
    opacity: parseInt(bubbleOpacitySlider.value, 10),
    effect:  e ? e.dataset.effect : 'none'
  };
}

function clearCharForm() {
  fillCharForm({});
}

// 聊天设置默认值（第二页）与外观默认值（第三页）
var DEFAULT_CHAT_CFG = {
  maxMem: 50, attention: 10, autoSum: false, sumEvery: 10,
  lang: '', translate: false, replyMin: 1, replyMax: 3,
  patOn: false, patSuffix: '', voiceId: '', vectorOn: false
};
var DEFAULT_LOOK = { showAvatar: true, headAvatar: false, headAlign: 'center', format: 'bubble', statusOn: false, statusFields: '心情,位置,在做什么,好感度', statusCss: '' };

// 表单里暂存的 USER 账号选择与各账号印象（切换账号时不丢）
// csAccUid 为 '' 表示跟随主账号（「我的」里当前使用的账号）
var csAccUid = '';
var csImpressions = {};

// 角色对某账号的印象；没单独写过时用旧数据迁移来的默认印象
function impressionFor(imps, uid) {
  imps = imps || {};
  return imps[uid] !== undefined ? imps[uid] : (imps['*'] || '');
}

function getMainAccount() {
  var accs = loadAccounts();
  var idx = mphoneStore.load('mphone_mine_active_idx_v1', 0);
  return accs[idx] || accs[0] || { uid: '', id: '@mphone', nickname: '我', persona: '' };
}
function findAccount(uid) {
  var found = null;
  if (uid) loadAccounts().forEach(function(a) { if (a.uid === uid) found = a; });
  return found;
}

// 该角色在本聊天使用的账号：单独设置过且仍存在就用它，否则用主账号
function resolveCharAccount(char) {
  return findAccount(char && char.userAccountUid) || getMainAccount();
}

function paintAccRow(avId, idId, acc) {
  var av = document.getElementById(avId);
  av.style.backgroundImage = acc.avatar ? 'url(' + acc.avatar + ')' : '';
  document.getElementById(idId).textContent = acc.id || '@mphone';
}

// 切换会话账号前，把印象输入框写回原账号
function stashImpression() {
  var uid = (findAccount(csAccUid) || getMainAccount()).uid;
  csImpressions[uid] = document.getElementById('charImpression').value;
}

function renderCsAccounts() {
  var main = getMainAccount();
  var cur  = findAccount(csAccUid) || main;
  paintAccRow('csMainAv', 'csMainId', main);
  paintAccRow('csCurAv', 'csCurId', cur);

  // 可选列表：跟随主账号 + 全部账号
  var list = document.getElementById('csAccList');
  list.innerHTML = '';
  [{ uid: '', nickname: '跟随主账号', avatar: main.avatar }].concat(loadAccounts()).forEach(function(acc) {
    var item = document.createElement('div');
    item.className = 'cs-acc-item' + (acc.uid === csAccUid ? ' active' : '');
    var av = document.createElement('div');
    av.className = 'cs-acc-av';
    if (acc.avatar) av.style.backgroundImage = 'url(' + acc.avatar + ')';
    var name = document.createElement('span');
    name.textContent = acc.uid ? ((acc.nickname || '未设置昵称') + ' ' + (acc.id || '')) : acc.nickname;
    item.appendChild(av);
    item.appendChild(name);
    item.addEventListener('click', function() {
      stashImpression();
      csAccUid = acc.uid;
      var useUid = (findAccount(csAccUid) || getMainAccount()).uid;
      document.getElementById('charImpression').value = impressionFor(csImpressions, useUid);
      list.classList.remove('open');
      renderCsAccounts();
    });
    list.appendChild(item);
  });

  document.getElementById('csAccPersona').textContent = cur.persona
    ? cur.persona
    : '这个账号还没有人设，可在「我的」→ 修改资料中填写';
}

// 点当前会话那一行（称呼输入框除外）展开 / 收起账号列表
document.getElementById('csCurRow').addEventListener('click', function(e) {
  if (e.target.id === 'userNickname') return;
  document.getElementById('csAccList').classList.toggle('open');
});

// 开场白列表（剧情用）
function addOpeningInput(text) {
  var item = document.createElement('div');
  item.className = 'cs-opening-item';
  var ta = document.createElement('textarea');
  ta.className = 'persona-textarea';
  ta.placeholder = '剧情开始时 TA 说的第一段话…';
  ta.value = text || '';
  var del = document.createElement('button');
  del.className = 'cs-opening-del';
  del.textContent = '✕';
  del.addEventListener('click', function() { item.remove(); });
  item.appendChild(ta);
  item.appendChild(del);
  document.getElementById('csOpeningList').appendChild(item);
  return ta;
}
function setOpeningsForm(list) {
  document.getElementById('csOpeningList').innerHTML = '';
  (list || []).forEach(function(t) { addOpeningInput(t); });
}
function readOpeningsForm() {
  return Array.from(document.querySelectorAll('#csOpeningList textarea'))
    .map(function(t) { return t.value.trim(); }).filter(Boolean);
}
document.getElementById('csOpeningAdd').addEventListener('click', function() { addOpeningInput('').focus(); });

function setChatCfgForm(c) {
  c = Object.assign({}, DEFAULT_CHAT_CFG, c || {});
  var $ = function(id) { return document.getElementById(id); };
  $('memMax').value = c.maxMem;
  $('memAttention').value = c.attention;
  $('memAutoSum').checked = c.autoSum;
  $('memSumEvery').value  = c.sumEvery;
  $('chatLang').value     = c.lang;
  $('chatTranslate').checked = c.translate;
  $('replyMin').value     = c.replyMin;
  $('replyMax').value     = c.replyMax;
  $('patOn').checked      = c.patOn;
  $('patSuffix').value    = c.patSuffix;
  $('voiceId').value      = c.voiceId;
  $('vectorMemOn').checked = c.vectorOn;
  $('memAutoSumSub').classList.toggle('open', c.autoSum);
}

function readChatCfgForm() {
  var $ = function(id) { return document.getElementById(id); };
  var num = function(id, def, min, max) {
    var v = parseInt($(id).value, 10);
    return Math.max(min, Math.min(max, isNaN(v) ? def : v));
  };
  var rMin = num('replyMin', 1, 1, 10), rMax = num('replyMax', 3, 1, 10);
  return {
    maxMem:    num('memMax', 50, 1, 1000),
    attention: num('memAttention', 10, 1, 1000),
    autoSum:   $('memAutoSum').checked,
    sumEvery:  num('memSumEvery', 10, 1, 200),
    lang:      $('chatLang').value.trim(),
    translate: $('chatTranslate').checked,
    replyMin:  Math.min(rMin, rMax),
    replyMax:  Math.max(rMin, rMax),
    patOn:     $('patOn').checked,
    patSuffix: $('patSuffix').value.trim(),
    voiceId:   $('voiceId').value.trim(),
    vectorOn:  $('vectorMemOn').checked
  };
}

function setLookForm(l) {
  l = Object.assign({}, DEFAULT_LOOK, l || {});
  document.getElementById('layoutAvatar').checked = l.showAvatar;
  document.getElementById('layoutHeadAvatar').checked = l.headAvatar;
  document.querySelectorAll('#layoutHeadAlignRow .pf-radio-btn').forEach(function(b) {
    b.classList.toggle('selected', b.dataset.align === l.headAlign);
  });
  document.querySelectorAll('#layoutFormatRow .pf-radio-btn').forEach(function(b) {
    b.classList.toggle('selected', b.dataset.format === l.format);
  });
  document.getElementById('statusOn').checked = l.statusOn;
  document.getElementById('statusFields').value = l.statusFields;
  document.getElementById('statusCss').value = l.statusCss;
  document.getElementById('statusSub').classList.toggle('open', l.statusOn);
}

function readLookForm() {
  var a = document.querySelector('#layoutHeadAlignRow .pf-radio-btn.selected');
  var fm = document.querySelector('#layoutFormatRow .pf-radio-btn.selected');
  return {
    showAvatar:   document.getElementById('layoutAvatar').checked,
    headAvatar:   document.getElementById('layoutHeadAvatar').checked,
    headAlign:    a ? a.dataset.align : 'center',
    format:       fm ? fm.dataset.format : 'bubble',
    statusOn:     document.getElementById('statusOn').checked,
    statusFields: document.getElementById('statusFields').value.trim() || DEFAULT_LOOK.statusFields,
    statusCss:    document.getElementById('statusCss').value
  };
}

// ---------- 美化：聊天窗口 / 剧情窗口各一套 ----------
// 剧情窗口没单独设置过时，沿用聊天窗口的样子（状态栏只有聊天窗口有）
var csLookView = 'chat';
var csLookParts = { chat: {}, drama: {} };
function lookPartsOf(char) {
  var chat = { chatBg: char.chatBg, bubble: char.bubble, look: char.look, customCss: char.customCss || '' };
  return { chat: chat, drama: char.dramaLook ? Object.assign({}, char.dramaLook) : JSON.parse(JSON.stringify(chat)) };
}
function readLookPartForm() {
  return {
    chatBg:    { color: selectedChatBgColor, image: selectedChatBgImage },
    bubble:    readBubbleForm(),
    look:      readLookForm(),
    customCss: customCssInput.value
  };
}
function setLookPartForm(view) {
  var p = csLookParts[view];
  setChatBgForm(p.chatBg);
  setBubbleForm(p.bubble);
  setLookForm(p.look);
  customCssInput.value = p.customCss || '';
  document.getElementById('csStatusWrap').style.display = view === 'chat' ? '' : 'none';
  document.getElementById('customCssLabel').textContent =
    (view === 'chat' ? '聊天窗口' : '剧情窗口') + '专属样式（进入该角色' + (view === 'chat' ? '聊天' : '剧情') + '时生效）';
  document.querySelectorAll('#csLookViewRow .pf-radio-btn').forEach(function(b) {
    b.classList.toggle('selected', b.dataset.view === view);
  });
  paintLookPreview();
}
function switchLookView(view) {
  if (view === csLookView) return;
  csLookParts[csLookView] = readLookPartForm();
  csLookView = view;
  setLookPartForm(view);
}
document.querySelectorAll('#csLookViewRow .pf-radio-btn').forEach(function(b) {
  b.addEventListener('click', function(e) { e.stopPropagation(); switchLookView(this.dataset.view); });
});

// 美化页顶部的小预览
var csLookPreviewStyle = document.createElement('style');
document.head.appendChild(csLookPreviewStyle);
function paintLookPreview() {
  var p = csLookParts[csLookView];
  var box = document.getElementById('csLookPreview');
  var bg = p.chatBg || DEFAULT_CHAT_BG;
  box.style.background = bg.image ? 'url(' + bg.image + ') center / cover no-repeat' : (bg.color || DEFAULT_CHAT_BG.color);
  csLookPreviewStyle.textContent = (typeof lookCss === 'function') ? lookCss(p, '#csLookPreview') : '';
}

// 美化页的改动立刻生效：写回角色并刷新聊天窗口（新建角色只更新预览）
var csLookTimer = null;
function liveApplyLook() {
  csLookParts[csLookView] = readLookPartForm();
  paintLookPreview();
  var char = charList[editingCharIndex];
  if (!char || !appCharSetting.classList.contains('active')) return;
  var c = csLookParts.chat;
  char.chatBg = c.chatBg;
  char.bubble = c.bubble;
  char.look = c.look;
  char.customCss = c.customCss;
  char.dramaLook = csLookParts.drama;
  saveCharList();
  if (charList[openingChatCharIdx] === char && typeof applyChatRoomStyle === 'function') applyChatRoomStyle(char);
}
function scheduleLiveLook() {
  clearTimeout(csLookTimer);
  csLookTimer = setTimeout(liveApplyLook, 150);
}
['click', 'input', 'change'].forEach(function(ev) {
  document.getElementById('csLookPage').addEventListener(ev, function(e) {
    if (e.target.closest('#csLookViewRow')) return;
    scheduleLiveLook();
  });
});

function fillCharForm(char) {
  document.getElementById('charName').value     = char.charName      || '';
  document.getElementById('charAlias').value    = char.charAlias     || '';
  document.getElementById('userNickname').value = char.userNickname  || '';
  document.getElementById('charPersona').value  = char.charPersona   || '';
  setOpeningsForm(char.openings);
  setAvatarBox('charAvatarBox', char.charAvatar, char.charAvatarColor);
  if (typeof fillAssistantForm === 'function') fillAssistantForm(char);
  fillCircleForm(char);
  fillMemCfgForm(char.memCfg);

  csAccUid = findAccount(char.userAccountUid) ? char.userAccountUid : '';
  csImpressions = Object.assign({}, char.userImpressions || {});
  document.getElementById('charImpression').value = impressionFor(csImpressions, resolveCharAccount(char).uid);
  document.getElementById('csAccList').classList.remove('open');
  renderCsAccounts();

  // 导入角色卡带的世界书：先暂存，保存角色时才写入
  csPendingWb = char.pendingWb || null;

  csLookParts = lookPartsOf(char);
  csLookView = 'chat';
  setLookPartForm('chat');
  setAutoForm(char.auto);
  setChatCfgForm(char.chatCfg);
  renderCharWbLinks(char.worldbookIds || [], char.worldbookFolders || []);
  renderMemSummaries(char);
}

// 扩展页 — 记忆权限：开关、读取条数、可写入的类型、短期保留天数、动态是否记入
var DEFAULT_MEM_CFG = { on: true, read: true, topK: 6, write: true, types: { short: true, long: true, precious: true }, shortDays: 3, feed: true };
function fillMemCfgForm(m) {
  m = Object.assign({}, DEFAULT_MEM_CFG, m || {});
  var types = Object.assign({}, DEFAULT_MEM_CFG.types, m.types || {});
  document.getElementById('memOn').checked = m.on;
  document.getElementById('memOnSub').classList.toggle('open', m.on);
  document.getElementById('memRead').checked = m.read;
  document.getElementById('memTopK').value = m.topK;
  document.getElementById('memWrite').checked = m.write;
  document.getElementById('memShortDays').value = m.shortDays;
  document.getElementById('memFeed').checked = m.feed;
  document.querySelectorAll('#memTypeChips .feed-visible-chip').forEach(function(c) { c.classList.toggle('on', !!types[c.dataset.type]); });
}
function readMemCfgForm() {
  var num = function(id, def, min, max) { var v = parseInt(document.getElementById(id).value, 10); return isNaN(v) ? def : Math.max(min, Math.min(max, v)); };
  var types = {};
  document.querySelectorAll('#memTypeChips .feed-visible-chip').forEach(function(c) { types[c.dataset.type] = c.classList.contains('on'); });
  return {
    on:        document.getElementById('memOn').checked,
    read:      document.getElementById('memRead').checked,
    topK:      num('memTopK', 6, 1, 30),
    write:     document.getElementById('memWrite').checked,
    types:     types,
    shortDays: num('memShortDays', 3, 1, 60),
    feed:      document.getElementById('memFeed').checked
  };
}
document.getElementById('memOn').addEventListener('change', function() {
  document.getElementById('memOnSub').classList.toggle('open', this.checked);
});
document.querySelectorAll('#memTypeChips .feed-visible-chip').forEach(function(c) {
  c.addEventListener('click', function() { this.classList.toggle('on'); });
});

// 社交圈：列出其他角色，点亮 = 认识
function fillCircleForm(char) {
  var box = document.getElementById('csCircleList');
  box.innerHTML = '';
  var mine = (char && char.circle) || [];
  charList.forEach(function(c) {
    if (c === char || (char && char.id && c.id === char.id)) return;
    var chip = document.createElement('span');
    chip.className = 'feed-visible-chip' + (mine.indexOf(c.id) >= 0 ? ' on' : '');
    chip.dataset.id = c.id;
    chip.textContent = c.charAlias || c.charName || '未命名';
    chip.addEventListener('click', function() { this.classList.toggle('on'); });
    box.appendChild(chip);
  });
  if (!box.children.length) {
    var none = document.createElement('span');
    none.className = 'auto-hint';
    none.textContent = '还没有其他角色';
    box.appendChild(none);
  }
}
function readCircleForm() {
  return Array.prototype.map.call(document.querySelectorAll('#csCircleList .feed-visible-chip.on'), function(c) { return c.dataset.id; });
}
// 认识是双向的：保存后同步到其他角色
function syncCharCircle(char) {
  var mine = char.circle || [];
  charList.forEach(function(c) {
    if (c === char) return;
    var list = (c.circle || []).filter(function(id) { return id !== char.id; });
    if (mine.indexOf(c.id) >= 0) list.push(char.id);
    c.circle = list;
  });
}

// 在原角色数据上覆盖表单字段（保留 id、记忆总结、inChat 等不在表单里的字段）
function readCharForm() {
  var old = charList[editingCharIndex] || {};
  stashImpression();
  csLookParts[csLookView] = readLookPartForm();
  var lc = csLookParts.chat;
  return Object.assign({}, old, {
    charName:         document.getElementById('charName').value.trim(),
    charAlias:        document.getElementById('charAlias').value.trim(),
    userNickname:     document.getElementById('userNickname').value.trim(),
    charPersona:      document.getElementById('charPersona').value,
    openings:         readOpeningsForm(),
    charAvatar:       document.getElementById('charAvatarBox')._img || '',
    userAccountUid:   csAccUid,
    userImpressions:  csImpressions,
    chatBg:           lc.chatBg,
    bubble:           lc.bubble,
    customCss:        lc.customCss,
    dramaLook:        csLookParts.drama,
    worldbookIds:     readCharWbLinks(),
    worldbookFolders: readCharWbFolders(),
    auto:             readAutoForm(),
    chatCfg:          readChatCfgForm(),
    look:             lc.look,
    circle:           readCircleForm(),
    memCfg:           readMemCfgForm(),
    assistant:        (typeof readAssistantForm === 'function') ? readAssistantForm(old) : old.assistant
  });
}

// 角色设置 — 关联世界书：按文件夹显示，可整个文件夹关联，也可展开后单独勾选条目
// csPendingWb：导入角色卡时暂存的世界书（保存角色时才真正写入）
var csPendingWb = null;

function renderCharWbLinks(ids, folderIds) {
  var wrap = document.getElementById('wbContent');
  wrap.innerHTML = '';
  var groups = wbGroups();

  if (csPendingWb && csPendingWb.entries.length) {
    var pending = document.createElement('div');
    pending.className = 'wb-link-folder';
    pending.innerHTML = '<div class="wb-link-folder-head wb-link-pending"><label>' +
      '<input type="checkbox" id="wbPendingCb" checked><span></span></label></div>';
    pending.querySelector('span').textContent = '（导入）' + csPendingWb.entries.length + ' 条，保存角色时创建文件夹';
    pending.querySelector('input').addEventListener('change', updateCharWbCount);
    wrap.appendChild(pending);
  } else if (!groups.length) {
    wrap.innerHTML = '<div class="wb-empty-hint">暂无关联世界书</div>';
  }

  groups.forEach(function(g) {
    var box = document.createElement('div');
    box.className = 'wb-link-folder';
    var head = document.createElement('div');
    head.className = 'wb-link-folder-head';
    var label = document.createElement('label');
    var fcb = document.createElement('input');
    fcb.type = 'checkbox';
    fcb.className = 'wb-link-folder-cb';
    fcb.value = g.id;
    fcb.checked = folderIds.indexOf(g.id) >= 0;
    var name = document.createElement('span');
    name.textContent = g.name;
    label.appendChild(fcb);
    label.appendChild(name);
    var count = document.createElement('span');
    count.className = 'wb-folder-count';
    count.textContent = g.entries.length + ' 条';
    var expand = document.createElement('button');
    expand.className = 'wb-link-expand';
    expand.innerHTML = FOLDER_ARROW;
    expand.addEventListener('click', function() { box.classList.toggle('open'); });
    head.appendChild(label);
    head.appendChild(count);
    head.appendChild(expand);
    box.appendChild(head);

    var list = document.createElement('div');
    list.className = 'wb-link-folder-entries';
    g.entries.forEach(function(entry) {
      var el = document.createElement('label');
      el.className = 'wb-link-item';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'wb-link-entry-cb';
      cb.value = entry.id;
      cb.checked = ids.indexOf(entry.id) >= 0;
      cb.addEventListener('change', updateCharWbCount);
      var span = document.createElement('span');
      span.textContent = entry.name || '未命名';
      el.appendChild(cb);
      el.appendChild(span);
      list.appendChild(el);
    });
    box.appendChild(list);

    // 整个文件夹已关联时，里面的条目显示为已勾选且不可单独改
    function syncFolder() {
      list.querySelectorAll('input').forEach(function(cb) {
        cb.disabled = fcb.checked;
        if (fcb.checked) cb.checked = true;
      });
      updateCharWbCount();
    }
    fcb.addEventListener('change', function() {
      if (!fcb.checked) list.querySelectorAll('input').forEach(function(cb) { cb.checked = ids.indexOf(cb.value) >= 0; });
      syncFolder();
    });
    syncFolder();
    wrap.appendChild(box);
  });
  updateCharWbCount();
}

function readCharWbFolders() {
  return Array.from(document.querySelectorAll('#wbContent .wb-link-folder-cb:checked')).map(function(cb) { return cb.value; });
}
// 单独关联的条目（所在文件夹已整体关联的不重复记录）
function readCharWbLinks() {
  return Array.from(document.querySelectorAll('#wbContent .wb-link-entry-cb:checked:not(:disabled)')).map(function(cb) { return cb.value; });
}
function updateCharWbCount() {
  var n = readCharWbFolders().length + readCharWbLinks().length;
  var p = document.getElementById('wbPendingCb');
  if (p && p.checked) n++;
  document.getElementById('wbCount').textContent = '已关联 ' + n + ' 个';
}

// 打开角色设置：idx = -1 为新建
// draft：新建时预填的数据（导入角色卡用）
// keepView：从聊天室打开时，本次对话期间保持上次退出时的页面和滚动位置
function openCharSetting(idx, draft, keepView) {
  editingCharIndex = idx;
  if (idx === -1) fillCharForm(draft || {});
  else fillCharForm(charList[idx]);
  document.getElementById('charDeleteBtn').style.display = (idx === -1) ? 'none' : '';
  appCharSetting.classList.add('active');
  var v = csViewState;
  var keep = keepView && v && charList[idx] && v.id === charList[idx].id && v.session === chatRoomSession;
  goCsPage(keep ? v.page : 0, false);
  document.querySelectorAll('#csPages .cs-page').forEach(function(p, i) { p.scrollTop = keep ? (v.tops[i] || 0) : 0; });
}

// 退出角色设置时记下当前在哪一页、每页滚到哪里（只在同一次打开的对话里沿用）
var csViewState = null;
var chatRoomSession = 0;   // 每次从消息列表打开对话加一
function rememberCsView() {
  var char = charList[editingCharIndex];
  if (!char || editingCharIndex !== openingChatCharIdx) { csViewState = null; return; }
  csViewState = {
    id: char.id, session: chatRoomSession,
    page: Math.round(csPages.scrollLeft / Math.max(1, csPages.clientWidth)),
    tops: Array.prototype.map.call(document.querySelectorAll('#csPages .cs-page'), function(p) { return p.scrollTop; })
  };
}

// 角色设置 — 三页切换：点标签跳页，左右滑动时同步标签
var csPages = document.getElementById('csPages');
var csToggleSlider = document.getElementById('csToggleSlider');
var csTabTarget = null;   // 点标签跳页时的目标页；滚到之前不让中间页打断滑块
var csTabTimer = null;
function goCsPage(i, smooth) {
  csTabTarget = smooth === false ? null : i;
  clearTimeout(csTabTimer);
  if (csTabTarget !== null) csTabTimer = setTimeout(function() { csTabTarget = null; }, 900);
  csPages.scrollTo({ left: i * csPages.clientWidth, behavior: smooth === false ? 'auto' : 'smooth' });
  setCsTab(i, true);
}
function csTabWidth() {
  var tab = document.querySelector('#csTabs .cs-tab');
  return (tab && tab.offsetWidth) || 52;
}
// 高亮对应标签；pos 是页码（可带小数），animate = 点标签时平滑移过去，手指滑动时直接跟手
function setCsTab(pos, animate) {
  var i = Math.round(pos);
  document.querySelectorAll('#csTabs .cs-tab').forEach(function(t) {
    t.classList.toggle('active', parseInt(t.dataset.page, 10) === i);
  });
  csToggleSlider.style.transition = animate ? 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
  csToggleSlider.style.transform = 'translateX(' + (pos * csTabWidth()) + 'px)';
}
document.querySelectorAll('#csTabs .cs-tab').forEach(function(t) {
  t.addEventListener('click', function() { goCsPage(parseInt(this.dataset.page, 10)); });
});
csPages.addEventListener('scroll', function() {
  var pos = csPages.scrollLeft / Math.max(1, csPages.clientWidth);
  if (csTabTarget !== null) {
    if (Math.abs(pos - csTabTarget) > 0.002) return;   // 还在滑向目标页
    csTabTarget = null;
    return;   // 已经到了，滑块本来就在目标位置
  }
  setCsTab(pos, false);
});
// 手指开始滑动时不再等点标签的目标页
csPages.addEventListener('touchstart', function() { csTabTarget = null; }, { passive: true });

// 子选项随开关展开
document.getElementById('memAutoSum').addEventListener('change', function() {
  document.getElementById('memAutoSumSub').classList.toggle('open', this.checked);
});
document.getElementById('statusOn').addEventListener('change', function() {
  document.getElementById('statusSub').classList.toggle('open', this.checked);
});
document.querySelectorAll('#layoutFormatRow .pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#layoutFormatRow .pf-radio-btn').forEach(function(b) { b.classList.remove('selected'); });
    this.classList.add('selected');
  });
});
document.querySelectorAll('#layoutHeadAlignRow .pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#layoutHeadAlignRow .pf-radio-btn').forEach(function(b) { b.classList.remove('selected'); });
    this.classList.add('selected');
  });
});

// 消息页加号菜单：[0] 新建对话，[1] 新建群聊
var msgPlusItems = document.querySelectorAll('.msg-plus-popup-item');

// =============================================
// 通讯录：全部角色；点卡片编辑，右上角添加角色
// =============================================
// 名字的首字母：英文取本身，中文按拼音排序规则判断（不需要拼音库），其余归到 #
var PINYIN_LETTERS = 'ABCDEFGHJKLMNOPQRSTWXYZ';
var PINYIN_BOUNDS  = '阿八嚓哒妸发旮哈讥咔垃痳拏噢妑七呥扨它穵夕丫帀';
var pinyinCollator = (window.Intl && Intl.Collator) ? new Intl.Collator('zh-Hans-CN-u-co-pinyin') : null;
function nameInitial(name) {
  var ch = String(name || '').trim().charAt(0);
  if (/[a-z]/i.test(ch)) return ch.toUpperCase();
  if (/[一-鿿]/.test(ch) && pinyinCollator) {
    for (var i = PINYIN_BOUNDS.length - 1; i >= 0; i--) {
      if (pinyinCollator.compare(ch, PINYIN_BOUNDS[i]) >= 0) return PINYIN_LETTERS[i];
    }
  }
  return '#';
}

// 通讯录：顶部星标好友，其余按首字母分组；左侧目录点击跳到对应分组
function renderContactList() {
  var list = document.getElementById('contactList');
  var index = document.getElementById('contactIndex');
  list.innerHTML = '';
  index.innerHTML = '';
  var displayName = function(c) { return c.charAlias || c.charName || '未命名'; };
  var items = charList.map(function(c, i) { return { char: c, idx: i, letter: nameInitial(displayName(c)) }; });
  var groups = [];
  var starred = items.filter(function(it) { return it.char.starred; });
  if (starred.length) groups.push({ key: '★', label: '星标好友', items: starred });
  var byLetter = {};
  items.forEach(function(it) { (byLetter[it.letter] = byLetter[it.letter] || []).push(it); });
  Object.keys(byLetter).sort(function(a, b) {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a < b ? -1 : 1;
  }).forEach(function(l) {
    byLetter[l].sort(function(a, b) {
      var x = displayName(a.char), y = displayName(b.char);
      return pinyinCollator ? pinyinCollator.compare(x, y) : (x < y ? -1 : 1);
    });
    groups.push({ key: l, label: l, items: byLetter[l] });
  });

  var labels = {};   // 分组 key → 分组标题元素
  groups.forEach(function(g) {
    var label = document.createElement('div');
    label.className = 'contact-section-label';
    label.textContent = g.label;
    list.appendChild(label);
    labels[g.key] = label;
    g.items.forEach(function(it) { list.appendChild(createContactCard(it.char, it.idx)); });
  });

  // 左侧目录始终显示完整的 ★ A–Z #；没有角色的字母变浅，点击跳到之后最近的分组
  var ALL_KEYS = ['★'].concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), ['#']);
  ALL_KEYS.forEach(function(key, i) {
    var mark = document.createElement('span');
    mark.textContent = key;
    if (!labels[key]) mark.classList.add('empty');
    mark.addEventListener('click', function() {
      var target = null;
      for (var j = i; j < ALL_KEYS.length && !target; j++) target = labels[ALL_KEYS[j]];
      for (var k = i - 1; k >= 0 && !target; k--) target = labels[ALL_KEYS[k]];
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    index.appendChild(mark);
  });
}

function createContactCard(char, i) {
    var card = document.createElement('div');
    card.className = 'chat-char-card';
    card.dataset.index = i;

    var av = document.createElement('div');
    av.className = 'chat-char-card-avatar';
    paintCharAvatar(av, char);

    var info = document.createElement('div');
    info.className = 'chat-char-card-info';
    var nameEl = document.createElement('div');
    nameEl.className = 'chat-char-card-name';
    nameEl.textContent = char.charAlias || char.charName || '未命名';
    info.appendChild(nameEl);
    if (char.charName && char.charName !== char.charAlias) {
      var sub = document.createElement('div');
      sub.className = 'chat-char-card-last';
      sub.textContent = char.charName;
      info.appendChild(sub);
    }

    // 右侧星标：点一下加入 / 移出星标好友
    var star = document.createElement('button');
    star.className = 'contact-star-btn' + (char.starred ? ' on' : '');
    star.textContent = char.starred ? '★' : '☆';
    star.title = char.starred ? '取消星标' : '设为星标好友';
    star.addEventListener('click', function(e) {
      e.stopPropagation();
      char.starred = !char.starred;
      saveCharList();
      renderContactList();
    });

    card.appendChild(av);
    card.appendChild(info);
    card.appendChild(star);
    card.addEventListener('click', function() {
      openCharSetting(parseInt(this.dataset.index, 10));
    });
    return card;
}
