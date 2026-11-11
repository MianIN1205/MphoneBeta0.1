// 眠花糖机 — 角色设置界面：四页表单（角色 / 聊天 / 美化 / 扩展）的填写和读取、默认值、打开角色设置

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
// 每次回复条数的默认值从 1~3 改成 2~5（2026-11-02，用户要更像微信一条条发）：还是旧默认值的角色一起改过来，只改一次
if (!mphoneStore.load('mphone_reply_count_v2', false)) {
  charList.forEach(function(c) {
    if (c.chatCfg && c.chatCfg.replyMin === 1 && c.chatCfg.replyMax === 3) { c.chatCfg.replyMin = 2; c.chatCfg.replyMax = 5; }
  });
  mphoneStore.save('mphone_reply_count_v2', true);
  if (typeof saveCharList === 'function') setTimeout(saveCharList, 0);
}

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
var DEFAULT_BUBBLE = { preset: 0, opacity: 85, effect: 'none', tpl: 'plain' };
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
  bubbleTplCur = b.tpl || 'plain';
  renderBubbleTpls();
}
// 气泡模板：每张小卡片里画两个真的小气泡（用 lookCss 套上现在的主题色、透明度和这个模板），点一下就换
var bubbleTplCur = 'plain';
var bubbleTplStyle = document.createElement('style');
document.head.appendChild(bubbleTplStyle);
function renderBubbleTpls() {
  var row = document.getElementById('bubbleTplRow');
  if (!row || typeof BUBBLE_TPLS === 'undefined') return;
  var p = document.querySelector('#bubblePresetRow .bubble-preset-item.selected');
  var base = { preset: p ? parseInt(p.dataset.preset, 10) : 0, opacity: parseInt(bubbleOpacitySlider.value, 10), effect: 'none' };
  var css = '';
  row.innerHTML = '';
  var drama = typeof csLookView !== 'undefined' && csLookView === 'drama';
  var tpls = BUBBLE_TPLS.filter(function(t) { return drama ? !t.chat : !t.drama; });   // 聊天窗口、剧情窗口各有各的（剧情窗口是默认和剧情版仿siya）
  if (!tpls.some(function(t) { return t.id === bubbleTplCur; })) bubbleTplCur = 'plain';
  tpls.forEach(function(t) {
    var c = document.createElement('div');
    c.className = 'bubble-tpl' + (t.id === bubbleTplCur ? ' selected' : '');
    c.id = 'btpl-' + t.id;
    c.dataset.v = t.id;
    c.innerHTML = '<div class="btpl-box"><div class="chat-msg-row ai"><div class="chat-msg-bubble">嗨</div></div><div class="chat-msg-row user"><div class="chat-msg-bubble">在呢</div></div></div><b></b>';
    c.querySelector('b').textContent = t.name;
    c.addEventListener('click', function() {
      bubbleTplCur = t.id;
      row.querySelectorAll('.bubble-tpl').forEach(function(x) { x.classList.toggle('selected', x === c); });
      document.getElementById('bubbleTplHint').textContent = t.desc;
    });
    row.appendChild(c);
    if (typeof lookCss === 'function') css += lookCss({ bubble: Object.assign({}, base, { tpl: t.id }), look: { format: 'bubble', showAvatar: false } }, '#btpl-' + t.id);
  });
  bubbleTplStyle.textContent = css;
  var cur = BUBBLE_TPLS.filter(function(t) { return t.id === bubbleTplCur; })[0];
  document.getElementById('bubbleTplHint').textContent = cur ? cur.desc : '';
}

function readBubbleForm() {
  var p = document.querySelector('#bubblePresetRow .bubble-preset-item.selected');
  var e = document.querySelector('#bubbleEffectChips .bubble-effect-chip.selected');
  return {
    preset:  p ? parseInt(p.dataset.preset, 10) : 0,
    opacity: parseInt(bubbleOpacitySlider.value, 10),
    effect:  e ? e.dataset.effect : 'none',
    tpl:     bubbleTplCur || 'plain'
  };
}

// 聊天设置默认值（第二页）与外观默认值（第三页）
var DEFAULT_CHAT_CFG = {
  maxMem: 50, attention: 10, autoSum: false, sumEvery: 10,
  lang: '', translate: false, replyMin: 2, replyMax: 5,
  patOn: true, patSuffix: '', voiceId: '', vectorOn: false, quickBar: true, actionOn: true, ctxTokens: 16000,
  recallOn: false, recallPeek: true, timeOn: true, timeZone: '', peekNotice: false, peekLock: false, starOn: true
};
// 状态栏 HTML 模板：用 {{心情}} 这样的占位符标出要填的地方，AI 只输出这些字段的内容，小手机按模板画出来
// （清空模板就按「字段」显示成线条本卡片；模板里没有占位符的旧写法，仍让 AI 直接输出整段 HTML）
var DEFAULT_STATUS_TPL = [
  '<style>',
  '.box{color:#5a4650;font-size:12px}',
  '.hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}',
  '.nm{font-weight:700;font-size:14px;color:#c05070}',
  '.tg{background:#ffe3ea;color:#c05070;border-radius:10px;padding:1px 8px;font-size:11px}',
  '.row{display:flex;gap:6px;margin:4px 0}',
  '.k{color:#a08890;width:52px;flex-shrink:0}',
  '.bar{height:6px;border-radius:3px;background:#f3dde3;overflow:hidden;margin-top:6px}',
  '.bar i{display:block;height:100%;background:linear-gradient(90deg,#f6a5b8,#e06b8b)}',
  '.ft{margin-top:8px;padding-top:6px;border-top:1px dashed #e8c8d0;color:#8a6a76;font-style:italic}',
  '</style>',
  '<div class="box">',
  '<div class="hd"><span class="nm">{{char}}</span><span class="tg">☁ {{天气}}</span></div>',
  '<div class="row"><span class="k">心情</span><span>{{心情}}</span></div>',
  '<div class="row"><span class="k">位置</span><span>{{位置}}</span></div>',
  '<div class="row"><span class="k">在做什么</span><span>{{在做什么}}</span></div>',
  '<div class="row"><span class="k">好感度</span><span>{{好感度}} / 100</span></div>',
  '<div class="bar"><i style="width:{{好感度}}%"></i></div>',
  '<div class="ft">「{{心里话}}」</div>',
  '</div>'
].join('\n');
// 上一版默认模板（让 AI 直接写整段 HTML）：存着这一版的角色自动换成新模板
var STATUS_TPL_V1 = [
  '<style>',
  '.box{color:#5a4650;font-size:12px}',
  '.hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}',
  '.nm{font-weight:700;font-size:14px;color:#c05070}',
  '.tg{background:#ffe3ea;color:#c05070;border-radius:10px;padding:1px 8px;font-size:11px}',
  '.row{display:flex;gap:6px;margin:4px 0}',
  '.k{color:#a08890;width:52px;flex-shrink:0}',
  '.bar{height:6px;border-radius:3px;background:#f3dde3;overflow:hidden;margin-top:6px}',
  '.bar i{display:block;height:100%;background:linear-gradient(90deg,#f6a5b8,#e06b8b)}',
  '.ft{margin-top:8px;padding-top:6px;border-top:1px dashed #e8c8d0;color:#8a6a76;font-style:italic}',
  '</style>',
  '<div class="box">',
  '<div class="hd"><span class="nm">{{char}}</span><span class="tg">☁ 时段 · 天气</span></div>',
  '<div class="row"><span class="k">心情</span><span>…</span></div>',
  '<div class="row"><span class="k">位置</span><span>…</span></div>',
  '<div class="row"><span class="k">在做什么</span><span>…</span></div>',
  '<div class="row"><span class="k">好感度</span><span>… / 100</span></div>',
  '<!-- 进度条宽度 = 好感度 -->',
  '<div class="bar"><i style="width:50%"></i></div>',
  '<div class="ft">「此刻的心里话」</div>',
  '</div>'
].join('\n');
function statusTplOf(look) {
  var t = (look && look.statusTpl !== undefined) ? look.statusTpl : DEFAULT_STATUS_TPL;
  return t === STATUS_TPL_V1 ? DEFAULT_STATUS_TPL : (t || '');
}
// 模板里要 AI 填的字段（{{char}} / {{user}} 这类通用写法除外），按出现顺序
var STATUS_FIELD_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;
function statusTplFields(tpl) {
  var seen = {}, out = [];
  String(tpl || '').replace(STATUS_FIELD_RE, function(all, n) {
    n = n.trim();
    if (n && !seen[n] && !/^(char|user|trim|newline)$/i.test(n) && n.indexOf('//') !== 0) {
      seen[n] = true;
      out.push(n);
    }
    return all;
  });
  return out;
}

// ---------- 状态栏只有一种写法（用户要的，和酒馆的正则状态栏一样）：生成规则 + 匹配正则 + 美化 HTML（$1、$2…）----------
// 以前的 {{心情}} 模板、只填「字段」的写法，用的时候现场换算成这一种；打开设置时表单里显示换算好的，保存后就存成新写法。
// 换算出来的正则外层标签可有可无、字段之间也认「|」，以前记录里存的「心情：… | 位置：…」照样画得出来
var STATUS_FIELD_HINT = { 天气: '此刻的时段和天气，比如 傍晚 · 小雨', 心情: '一两个词', 位置: '在哪里', 在做什么: '正在做的事', 好感度: '0-100 的纯数字', 心里话: '此刻没说出口的一句话' };
function statusReEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
function statusConvertTpl(tpl, fieldsCsv) {
  var fields = statusTplFields(tpl), html = tpl || '';
  if (!fields.length) {
    fields = String(fieldsCsv || DEFAULT_LOOK.statusFields).split(/[,，、]/).map(function(s) { return s.trim(); }).filter(Boolean);
    html = fields.map(function(f) { return '<div style="margin:2px 0"><b style="color:#a08890;font-weight:500">' + f + '</b>　{{' + f + '}}</div>'; }).join('\n');
  }
  fields.forEach(function(f, i) {
    html = html.replace(new RegExp('\\{\\{\\s*' + statusReEsc(f) + '\\s*\\}\\}', 'g'), function() { return '$' + (i + 1); });
  });
  var find = '(?:<状态栏>|\\[状态栏\\])?\\s*' + fields.map(function(f) { return statusReEsc(f) + '[:：]\\s*([\\s\\S]*?)'; }).join('\\s*(?:[|｜]\\s*)?') +
             '\\s*(?:<\\/状态栏>|\\[\\/状态栏\\]|$)';
  var rules = '每次回复的最后另起一行，按下面的格式写你此刻的状态，用 <状态栏> 和 </状态栏> 包住；每项一行，写简短的内容，数值只写数字：\n<状态栏>\n' +
    fields.map(function(f) { return f + '：' + (STATUS_FIELD_HINT[f] || '…'); }).join('\n') + '\n</状态栏>';
  return { find: find, tpl: html, rules: rules };
}
// 一个角色（或预设）的状态栏，统一成 { find, tpl, rules }；最老的「AI 直接照模板写整段 HTML」（模板里没有占位符）返回 null
function statusSpec(look) {
  look = Object.assign({}, DEFAULT_LOOK, look || {});
  var tpl = statusTplOf(look);
  if (look.statusFind) return { find: look.statusFind, tpl: tpl, rules: look.statusRules || '' };
  if (tpl && !statusTplFields(tpl).length) return null;
  var c = statusConvertTpl(tpl, look.statusFields);
  if (look.statusRules) c.rules += '\n每一项的要求：\n' + look.statusRules;
  return c;
}

// 每日日记（「扩展」页）：到点自动写一篇当天的日记，最多两个时间
var DEFAULT_DIARY_CFG = { on: false, times: ['21:30', ''] };
function setDiaryCfgForm(d) {
  d = Object.assign({}, DEFAULT_DIARY_CFG, d || {});
  document.getElementById('diaryAutoOn').checked = d.on;
  document.getElementById('diaryTime1').value = d.times[0] || '';
  document.getElementById('diaryTime2').value = d.times[1] || '';
  document.getElementById('diaryAutoSub').classList.toggle('open', d.on);
}
function readDiaryCfgForm() {
  return {
    on: document.getElementById('diaryAutoOn').checked,
    times: [document.getElementById('diaryTime1').value, document.getElementById('diaryTime2').value]
  };
}
document.getElementById('diaryAutoOn').addEventListener('change', function() {
  document.getElementById('diaryAutoSub').classList.toggle('open', this.checked);
});
var DEFAULT_LOOK = { showAvatar: true, headAvatar: false, headAlign: 'center', format: 'bubble', boxLayout: 'side', boxStyle: 'soft', boxMeta: true, boxActs: true, statusOn: false, statusDrama: false, statusFields: '心情,位置,在做什么,好感度', statusTpl: DEFAULT_STATUS_TPL, statusCss: '', statusFind: '', statusRules: '' };

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

function setChatCfgForm(c) {
  c = Object.assign({}, DEFAULT_CHAT_CFG, c || {});
  var $ = function(id) { return document.getElementById(id); };
  $('memMax').value = c.maxMem;
  $('memAttention').value = c.attention;
  $('memCtxTokens').value = c.ctxTokens;
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
  $('quickBarOn').checked = c.quickBar;
  $('chatActionOn').checked = c.actionOn;
  $('recallOn').checked   = c.recallOn;
  $('recallPeek').checked = c.recallPeek;
  $('peekNotice').checked = c.peekNotice;
  $('peekLock').checked = c.peekLock;
  $('starOn').checked = c.starOn;
  $('timeOn').checked     = c.timeOn;
  $('timeZone').value     = c.timeZone;
  $('memAutoSumSub').classList.toggle('open', c.autoSum);
}

function readChatCfgForm() {
  var $ = function(id) { return document.getElementById(id); };
  var num = function(id, def, min, max) {
    var v = parseInt($(id).value, 10);
    return Math.max(min, Math.min(max, isNaN(v) ? def : v));
  };
  var rMin = num('replyMin', 2, 1, 10), rMax = num('replyMax', 5, 1, 10);
  return {
    maxMem:    num('memMax', 50, 1, 1000),
    attention: num('memAttention', 10, 1, 1000),
    ctxTokens: num('memCtxTokens', 16000, 0, 1000000),
    autoSum:   $('memAutoSum').checked,
    sumEvery:  num('memSumEvery', 10, 1, 200),
    lang:      $('chatLang').value.trim(),
    translate: $('chatTranslate').checked,
    replyMin:  Math.min(rMin, rMax),
    replyMax:  Math.max(rMin, rMax),
    patOn:     $('patOn').checked,
    patSuffix: $('patSuffix').value.trim(),
    voiceId:   $('voiceId').value.trim(),
    quickBar:  $('quickBarOn').checked,
    actionOn:  $('chatActionOn').checked,
    recallOn:  $('recallOn').checked,
    recallPeek: $('recallPeek').checked,
    peekNotice: $('peekNotice').checked,
    peekLock:  $('peekLock').checked,
    starOn:    $('starOn').checked,
    timeOn:    $('timeOn').checked,
    timeZone:  $('timeZone').value,
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
  // 剧情窗口的三种格式；以前的「文段」算文本框
  var dfm = l.format === 'text' ? 'box' : (['bubble', 'box', 'custom'].indexOf(l.format) >= 0 ? l.format : 'bubble');
  document.querySelectorAll('#dramaFormatRow .pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.format === dfm); });
  document.querySelectorAll('#dramaBoxLayoutRow .pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.v === l.boxLayout); });
  renderDramaBoxStyles(l.boxStyle);
  document.getElementById('dramaBoxMeta').checked = l.boxMeta !== false;
  document.getElementById('dramaBoxActs').checked = l.boxActs !== false;
  document.getElementById('statusOn').checked = l.statusOn;
  document.getElementById('statusDrama').checked = !!l.statusDrama;
  document.getElementById('statusFields').value = l.statusFields;
  document.getElementById('statusTpl').value = statusTplOf(l);
  document.getElementById('statusCss').value = l.statusCss;
  document.getElementById('statusFind').value = l.statusFind || '';
  document.getElementById('statusRules').value = l.statusRules || '';
  if (typeof syncStatusRegexForm === 'function') syncStatusRegexForm(true);
  document.getElementById('statusSub').classList.toggle('open', l.statusOn);
  if (typeof statusPresetBox !== 'undefined') statusPresetBox.refresh();   // 预设抽屉上写现在用的是哪个
}

function readLookForm() {
  var a = document.querySelector('#layoutHeadAlignRow .pf-radio-btn.selected');
  var fm = document.querySelector(csLookView === 'drama' ? '#dramaFormatRow .pf-radio-btn.selected' : '#layoutFormatRow .pf-radio-btn.selected');
  return {
    showAvatar:   document.getElementById('layoutAvatar').checked,
    headAvatar:   document.getElementById('layoutHeadAvatar').checked,
    headAlign:    a ? a.dataset.align : 'center',
    format:       fm ? fm.dataset.format : 'bubble',
    boxLayout:    (document.querySelector('#dramaBoxLayoutRow .pf-radio-btn.selected') || { dataset: { v: 'side' } }).dataset.v,
    boxStyle:     (document.querySelector('#dramaBoxStyleRow .drama-box-style.selected') || { dataset: { v: 'soft' } }).dataset.v,
    boxMeta:      document.getElementById('dramaBoxMeta').checked,
    boxActs:      document.getElementById('dramaBoxActs').checked,
    statusOn:     document.getElementById('statusOn').checked,
    statusDrama:  document.getElementById('statusDrama').checked,
    statusFields: document.getElementById('statusFields').value.trim() || DEFAULT_LOOK.statusFields,
    statusTpl:    document.getElementById('statusTpl').value.trim(),
    statusCss:    document.getElementById('statusCss').value,
    statusFind:   document.getElementById('statusFind').value.trim(),
    statusRules:  document.getElementById('statusRules').value.trim()
  };
}

// ---------- 美化：聊天窗口 / 剧情窗口各一套 ----------
// 剧情窗口没单独设置过时，沿用聊天窗口的样子（状态栏只有聊天窗口有）
var csLookView = 'chat';
var csLookParts = { chat: {}, drama: {} };
function lookPartsOf(char) {
  // 两边各拷一份，互不牵连；剧情窗口没单独设置过时只借聊天窗口的背景和颜色（viewLookPart，不带聊天的 CSS 和聊天专用的气泡模板）
  var cp = function(x) { var o = JSON.parse(JSON.stringify(x)); delete o._borrowed; o.customCss = o.customCss || ''; return o; };
  var parts = { chat: cp(viewLookPart(char, false)), drama: cp(viewLookPart(char, true)) };
  // 新角色默认打开状态栏（自带的「默认」文字状态栏，用户要的）；存过的照存的，小梦和群不加
  if (!(char && char.look && 'statusOn' in char.look) && !(char && (char.builtinAssistant || char.isGroup))) parts.chat.look = Object.assign({}, parts.chat.look, { statusOn: true });
  return parts;
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
  if (typeof customCssPresetBox !== 'undefined') customCssPresetBox.refresh();
  document.getElementById('csStatusWrap').style.display = view === 'chat' ? '' : 'none';
  document.querySelectorAll('#csLookViewRow .pf-radio-btn').forEach(function(b) {
    b.classList.toggle('selected', b.dataset.view === view);
  });
  syncDramaFormatUi();
  paintLookPreview();
}
// 剧情窗口：气泡（和现在一样）/ 文本框（像酒馆那样一整块带框的，框的颜色用主题颜色，样子可以用 CSS 再调）/ 自定义（整个剧情窗口都用 CSS 改）
var DRAMA_FORMAT_HINT = {
  bubble: '和聊天窗口一样的气泡，颜色在下面的「主题」里选。',
  box: '像酒馆那样一整块带框的文本框：顶上是头像、名字、时间、楼层和字数，还有编辑、收藏、更多按钮（不用长按了），下面正文像文档一样，引号里的对话换个颜色；同一个人连着发的几条合在一个框里。头像位置和模板在下面选，想再改在最下面的「文本框样式」里写 CSS，也可以让 MianIN 帮你设计。',
  custom: '排版和文本框一样（信息区 + 正文，连着发的合成一个框，头像位置在下面选），但不加颜色和边框，整个剧情窗口都用最下面的 CSS 来改，像酒馆的美化主题一样。不会写可以跟 MianIN 说想要什么样子，祂会写好给你看效果。'
};
function syncDramaFormatUi() {
  var drama = csLookView === 'drama';
  var sel = document.querySelector('#dramaFormatRow .pf-radio-btn.selected');
  var fmt = drama && sel ? sel.dataset.format : '';
  document.getElementById('csDramaFmtWrap').style.display = drama ? '' : 'none';
  document.getElementById('csLookPreview').style.display = drama ? 'none' : '';   // 气泡小预览只给聊天窗口
  document.getElementById('layoutFormatAutoRow').style.display = drama ? 'none' : '';
  document.getElementById('csThemeWrap').style.display = fmt === 'custom' ? 'none' : '';
  document.getElementById('layoutAvatarRow').style.display = fmt === 'custom' ? 'none' : '';
  document.getElementById('dramaFormatHint').textContent = DRAMA_FORMAT_HINT[fmt] || '';
  document.getElementById('dramaBoxOpts').style.display = fmt === 'box' || fmt === 'custom' ? '' : 'none';
  document.getElementById('dramaBoxStyleWrap').style.display = fmt === 'box' ? '' : 'none';
  document.getElementById('bubbleTplWrap').style.display = drama && fmt !== 'bubble' ? 'none' : '';   // 气泡模板只给气泡格式
  document.getElementById('customCssLabel').textContent = !drama ? '聊天窗口专属样式（进入该角色聊天时生效）'
    : fmt === 'box' ? '文本框样式（CSS，可选）' : fmt === 'custom' ? '整个剧情窗口的 CSS' : '剧情窗口专属样式（进入该角色剧情时生效）';
  var hint = document.getElementById('customCssHint');
  hint.style.display = drama && fmt !== 'bubble' ? '' : 'none';
  hint.textContent = fmt === 'box'
    ? '常用：#appChatRoom .chat-msg-bubble（每个文本框）、.chat-msg-row.ai / .chat-msg-row.user（角色 / 你的）、.chat-msg-avatar（头像）、.cr-narr（开场旁白）。只在这个角色的剧情窗口生效'
    : '常用：#appChatRoom（整个窗口）、#chatRoomContent（背景）、.settings-nav（顶栏）、.chat-msg-row.ai / .user .chat-msg-bubble（消息）、.chat-msg-avatar（头像）、.cr-narr（旁白）、.chat-room-bottom（输入栏）。只在这个角色的剧情窗口生效';
}
// 文本框风格：一排小卡片，每张画出那套的底色、字色和对话颜色
function renderDramaBoxStyles(cur) {
  var box = document.getElementById('dramaBoxStyleRow');
  if (!box || typeof DRAMA_BOX_STYLES === 'undefined') return;
  box.innerHTML = '';
  DRAMA_BOX_STYLES.forEach(function(st) {
    var c = document.createElement('div');
    c.className = 'drama-box-style' + (st.id === (cur || 'soft') ? ' selected' : '');
    c.dataset.v = st.id;
    c.innerHTML = '<div class="dbs-swatch"><i></i><span>“对话”</span></div><b></b>';
    c.querySelector('.dbs-swatch').style.background = st.sw[0];
    c.querySelector('i').style.background = st.sw[1];
    c.querySelector('span').style.color = st.sw[2];
    c.querySelector('b').textContent = st.name;
    c.addEventListener('click', function() {
      box.querySelectorAll('.drama-box-style').forEach(function(x) { x.classList.toggle('selected', x === c); });
      document.getElementById('dramaBoxStyleHint').textContent = st.desc;
      // 模板带着配好的头像位置，一起换上（之后还能在上面单独改）
      document.querySelectorAll('#dramaBoxLayoutRow .pf-radio-btn').forEach(function(x) { x.classList.toggle('selected', x.dataset.v === st.lay); });
    });
    box.appendChild(c);
  });
  var sel = DRAMA_BOX_STYLES.filter(function(s) { return s.id === (cur || 'soft'); })[0];
  document.getElementById('dramaBoxStyleHint').textContent = sel ? sel.desc : '';
}
document.querySelectorAll('#dramaBoxLayoutRow .pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#dramaBoxLayoutRow .pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b === btn); });
  });
});
document.querySelectorAll('#dramaFormatRow .pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#dramaFormatRow .pf-radio-btn').forEach(function(b) { b.classList.remove('selected'); });
    this.classList.add('selected');
    syncDramaFormatUi();
  });
});
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
  box.style.background = bg.image ? 'url(' + bg.image + ') center / cover no-repeat' : ((typeof tplBgColor === 'function' && tplBgColor(p)) || bg.color || DEFAULT_CHAT_BG.color);
  csLookPreviewStyle.textContent = (typeof lookCss === 'function') ? lookCss(p, '#csLookPreview') : '';
  renderBubbleTpls();   // 换了主题色、透明度，模板小卡片跟着变
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
  document.getElementById('charBio').value      = char.charBio       || '';
  document.getElementById('charBirth').value    = char.charBirth     || '';
  document.getElementById('userNickname').value = char.userNickname  || '';
  document.getElementById('charPersona').value  = char.charPersona   || '';
  setAvatarBox('charAvatarBox', char.charAvatar, char.charAvatarColor);
  if (typeof fillAssistantForm === 'function') fillAssistantForm(char);
  fillCircleForm(char);
  if (typeof fillLifeForm === 'function') fillLifeForm(char);   // 聊出来的设定、记着要关心的事（js/char/life.js）
  fillMemCfgForm(char.memCfg);
  setDiaryCfgForm(char.diaryCfg);

  csAccUid = findAccount(char.userAccountUid) ? char.userAccountUid : '';
  csImpressions = Object.assign({}, char.userImpressions || {});
  document.getElementById('charImpression').value = impressionFor(csImpressions, resolveCharAccount(char).uid);
  document.getElementById('csAccList').classList.remove('open');
  renderCsAccounts();

  // 导入角色卡带的世界书：先暂存，保存角色时才写入
  csPendingWb = char.pendingWb || null;
  csPendingArc = char.pendingArc || null;   // 从小手机备份导入时带的聊天记录：保存角色时存成档案

  csLookParts = lookPartsOf(char);
  csLookView = 'chat';
  setLookPartForm('chat');
  setAutoForm(char.auto);
  setChatCfgForm(char.chatCfg);
  // 世界书分「聊天窗口 / 剧情窗口」两栏各自关联（用户要的）；剧情还没单独设置过时先照聊天的勾
  var wbChat = { ids: (char.worldbookIds || []).slice(), folders: (char.worldbookFolders || []).slice() };
  csWbParts = { chat: wbChat, drama: char.dramaWb ? { ids: (char.dramaWb.ids || []).slice(), folders: (char.dramaWb.folders || []).slice() } : JSON.parse(JSON.stringify(wbChat)) };
  csWbView = 'chat';
  csWbPendingOn = true;
  renderCharWbLinks(wbChat.ids, wbChat.folders);
  renderMemSummaries(char);
  if (typeof renderArchiveList === 'function') renderArchiveList(char);
}

// 扩展页 — 记忆权限：开关、读取条数、可写入的类型、短期保留天数、动态是否记入
var DEFAULT_MEM_CFG = { on: true, read: true, topK: 6, write: true, types: { short: true, long: true, precious: true }, shortDays: 3, feed: true, milestone: true, budget: 6000 };   // 记忆最多占用（token）：一条记忆能放一整件事以后，从 2000 调大
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
  document.getElementById('memMilestone').checked = m.milestone;
  document.getElementById('memBudget').value = m.budget;
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
    feed:      document.getElementById('memFeed').checked,
    milestone: document.getElementById('memMilestone').checked,
    budget:    num('memBudget', 6000, 0, 100000)
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
  charList.forEach(function(c) { if (c.isGroup) return;   // 群聊不算
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
  charList.forEach(function(c) { if (c.isGroup) return;   // 群聊不算
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
    charBio:          document.getElementById('charBio').value.trim(),
    charBirth:        document.getElementById('charBirth').value || '',
    userNickname:     document.getElementById('userNickname').value.trim(),
    charPersona:      document.getElementById('charPersona').value,
    charAvatar:       old.builtinAssistant && typeof MIANIN_AVATAR !== 'undefined' ? MIANIN_AVATAR : (document.getElementById('charAvatarBox')._img || ''),
    userAccountUid:   csAccUid,
    userImpressions:  csImpressions,
    chatBg:           lc.chatBg,
    bubble:           lc.bubble,
    customCss:        lc.customCss,
    dramaLook:        csLookParts.drama,
    worldbookIds:     csWbPartsNow().chat.ids,
    worldbookFolders: csWbPartsNow().chat.folders,
    dramaWb:          csWbPartsNow().drama,
    auto:             readAutoForm(),
    chatCfg:          readChatCfgForm(),
    look:             lc.look,
    circle:           readCircleForm(),
    selfFacts:        typeof readLifeForm === 'function' ? readLifeForm() : old.selfFacts,
    memCfg:           readMemCfgForm(),
    diaryCfg:         readDiaryCfgForm(),
    assistant:        (typeof readAssistantForm === 'function') ? readAssistantForm(old) : old.assistant
  });
}

// 角色设置 — 关联世界书：按文件夹显示，可整个文件夹关联，也可展开后单独勾选条目
// csPendingWb：导入角色卡时暂存的世界书（保存角色时才真正写入）
var csPendingWb = null;
var csPendingArc = null;

// 两栏：csWbParts = { chat: { ids, folders }, drama: { ids, folders } }，表单里显示的是 csWbView 那一栏
var csWbParts = { chat: { ids: [], folders: [] }, drama: { ids: [], folders: [] } };
var csWbView = 'chat', csWbPendingOn = true;
function csWbPartsNow() {
  csWbParts[csWbView] = { ids: readCharWbLinks(), folders: readCharWbFolders() };
  return csWbParts;
}
function switchCsWbView(view) {
  if (view === csWbView) return;
  csWbPartsNow();
  var p = document.getElementById('wbPendingCb');
  if (p) csWbPendingOn = p.checked;
  csWbView = view;
  renderCharWbLinks(csWbParts[view].ids, csWbParts[view].folders);
}
function renderCharWbLinks(ids, folderIds) {
  var wrap = document.getElementById('wbContent');
  wrap.innerHTML = '';
  var groups = wbGroups();
  var tabs = document.createElement('div');
  tabs.className = 'pf-radio-row wb-view-row';
  [['chat', '聊天窗口'], ['drama', '剧情窗口']].forEach(function(t) {
    var b = document.createElement('button');
    b.className = 'pf-radio-btn' + (csWbView === t[0] ? ' selected' : '');
    b.textContent = t[1];
    b.addEventListener('click', function(e) { e.stopPropagation(); switchCsWbView(t[0]); });
    tabs.appendChild(b);
  });
  wrap.appendChild(tabs);
  var tip = document.createElement('div');
  tip.className = 'auto-hint wb-view-hint';
  tip.textContent = csWbView === 'chat' ? '在聊天窗口里用的世界书' : '在剧情窗口里用的世界书（和聊天窗口分开勾）';
  wrap.appendChild(tip);

  if (csPendingWb && csPendingWb.entries.length) {
    var pending = document.createElement('div');
    pending.className = 'wb-link-folder';
    pending.innerHTML = '<div class="wb-link-folder-head wb-link-pending"><label>' +
      '<input type="checkbox" id="wbPendingCb"' + (csWbPendingOn ? ' checked' : '') + '><span></span></label></div>';
    pending.querySelector('span').textContent = '（导入）' + csPendingWb.entries.length + ' 条，保存角色时' + (csPendingWb.entries.some(function(e) { return e.folderName; }) ? '按原来的分类放进文件夹并关联' : '创建文件夹');
    pending.querySelector('input').addEventListener('change', updateCharWbCount);
    wrap.appendChild(pending);
  } else if (!groups.length) {
    wrap.insertAdjacentHTML('beforeend', '<div class="wb-empty-hint">暂无关联世界书</div>');
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
  var p = document.getElementById('wbPendingCb'), add = p && p.checked ? 1 : 0;
  var now = readCharWbFolders().length + readCharWbLinks().length + add;
  var other = csWbParts[csWbView === 'chat' ? 'drama' : 'chat'];
  var on = other.ids.length + other.folders.length + add;
  document.getElementById('wbCount').textContent = csWbView === 'chat' ? '聊天 ' + now + ' · 剧情 ' + on : '聊天 ' + on + ' · 剧情 ' + now;
}

// 打开角色设置：idx = -1 为新建
// draft：新建时预填的数据（导入角色卡用）
// keepView：从聊天室打开时，本次对话期间保持上次退出时的页面和滚动位置
function openCharSetting(idx, draft, keepView) {
  editingCharIndex = idx;
  if (idx === -1) fillCharForm(draft || {});
  else fillCharForm(charList[idx]);
  document.getElementById('charDeleteBtn').style.display = (idx === -1 || (charList[idx] && charList[idx].builtinAssistant)) ? 'none' : '';   // MianIN 删不掉
  appCharSetting.classList.toggle('cs-assistant', !!(charList[idx] && charList[idx].builtinAssistant));   // MianIN 没有剧情窗口：美化、世界书不分聊天 / 剧情
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
  if (smooth === false) {
    // 直接定位（打开设置时用）：CSS 里写了平滑滚动，这里临时关掉，标签滑块也不播动画
    csPages.style.scrollBehavior = 'auto';
    csPages.scrollLeft = i * csPages.clientWidth;
    csPages.style.scrollBehavior = '';
    setCsTab(i, false);
    return;
  }
  csPages.scrollTo({ left: i * csPages.clientWidth, behavior: 'smooth' });
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

// 滑动保护：手指按在滑块、输入框或能横向滚动的区域上时，这一下不翻页
function csSwipeShouldLock(el) {
  for (; el && el !== csPages; el = el.parentElement) {
    if (el.matches('input, textarea, select, [contenteditable="true"], .no-page-swipe')) return true;
    if (el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}
csPages.addEventListener('touchstart', function(e) {
  if (csSwipeShouldLock(e.target)) csPages.classList.add('swipe-locked');
}, { passive: true, capture: true });
['touchend', 'touchcancel'].forEach(function(ev) {
  document.addEventListener(ev, function(e) {
    if (!e.touches.length) csPages.classList.remove('swipe-locked');
  }, { passive: true });
});

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
