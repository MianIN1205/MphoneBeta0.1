// 眠花糖机 — 内置助手 MianIN

// =============================================
// 内置助手：系统自带的 MianIN 除了聊天，还熟悉这个应用的用法，并可在用户确认后
// 添加世界书、设计界面 CSS，以及读取接口报错帮忙排查。
// 回复里的 <mphone-action>{…}</mphone-action> 会变成确认卡片，点「确认」才生效，之后可撤销。
// =============================================

// 旧数据里的默认角色还没有标记：把名字是 MianIN 的那个标成内置助手（只做一次）
(function markBuiltinAssistant() {
  if (charList.some(function(c) { return c.builtinAssistant !== undefined; })) return;
  var c = charList.filter(function(c) { return c.charAlias === 'MianIN' || c.charName === 'MianIN'; })[0];
  if (!c) return;
  c.builtinAssistant = true;
  saveCharList();
})();

var ASSISTANT_DEFAULT = { on: true, wb: true, css: true, err: true };
function assistantCfg(char) { return Object.assign({}, ASSISTANT_DEFAULT, (char && char.assistant) || {}); }
function isAssistantOn(char) { return !!(char && char.builtinAssistant && assistantCfg(char).on); }
function assistantChar() { return charList.filter(function(c) { return c.builtinAssistant; })[0] || null; }

// ---------- 角色设置里的权限开关 ----------
var asOn = document.getElementById('asOn');
function fillAssistantForm(char) {
  var wrap = document.getElementById('assistantPermWrap');
  wrap.style.display = char && char.builtinAssistant ? '' : 'none';
  var cfg = assistantCfg(char);
  asOn.checked = cfg.on;
  document.getElementById('asPermWb').checked = cfg.wb;
  document.getElementById('asPermCss').checked = cfg.css;
  document.getElementById('asPermErr').checked = cfg.err;
  document.getElementById('asSub').classList.toggle('open', cfg.on);
}
function readAssistantForm(old) {
  if (!old || !old.builtinAssistant) return old ? old.assistant : undefined;
  return {
    on:  asOn.checked,
    wb:  document.getElementById('asPermWb').checked,
    css: document.getElementById('asPermCss').checked,
    err: document.getElementById('asPermErr').checked
  };
}
asOn.addEventListener('change', function() { document.getElementById('asSub').classList.toggle('open', this.checked); });

// ---------- 系统提示：应用说明 + 已开启的权限 ----------
var ASSISTANT_GUIDE =
  '【内置助手】你同时是「眠花糖机」这个小手机应用的系统内置助手。除了按人设正常聊天，用户问到应用怎么用、出了什么问题时，' +
  '你要像熟悉这个应用的朋友一样耐心解答，说清楚在哪个界面点哪里。不知道的功能不要编造。\n' +
  '应用结构：\n' +
  '· 主页：时钟卡片、桌面小组件（长按桌面进入编辑，可添加 / 修改 / 删除；纪念日小组件可选两人头像、图片背景、Emoji 样式，点开是全部纪念日和日程，可设置顶和外显），桌面 App「书架」（本子，以及「日记」「相册」两本书：日记是让角色写今天的日记，相册是聊天、动态、收藏里的所有图片）「记忆库」（每个角色的短期 / 长期 / 珍贵记忆，可搜索、添加、修改、删除，还能设置向量模型），底栏「设置」「外观」「Chat」「Prompt」。编辑桌面时程序和小组件都能拖动换位置，程序坞固定。\n' +
  '· 角色设置第四页「扩展」：记忆权限（是否启用、自动想起几条、能不能自己记、能记哪些类型、短期保留几天、动态是否记入、向量记忆）和自主活动。\n' +
  '· 设置 → MCP：可以连接 MCP 服务器（HTTP 方式、需允许网页访问），开启后角色聊天时能用服务器上的工具，可设置用工具前先询问。\n' +
  '· 设置：顶部「主API / 语音API / 生图API」。主API 填接口地址（BASE URL）、密钥、选模型、温度，可存预设；下面有「识图与语音」（让模型真实看图、听语音）和「数据管理」（存储占用、备份导出/导入）。\n' +
  '· 外观：壁纸、状态栏、字体（字体与字号）、CSS 美化（全局样式）。\n' +
  '· Chat：底部「消息 / 通讯录 / 动态 / 我的」。消息：会话列表，左滑可置顶、标为未读、删除，右上「+」新建对话。通讯录：全部角色，右上可添加角色（支持导入酒馆角色卡 PNG/JSON 和 docx）。动态：朋友圈，可点赞评论，❄️ 请角色来互动。我的：账号（昵称、人设）、钱包、收藏。\n' +
  '· 聊天室：键盘回车 = 只发送自己的消息，不请求回复；输入框里的 ↵ = 换行；❄️ = 请角色回复（生成中变成 ⏹ 可停止）。长按消息：引用 / 编辑 / 重新生成（最新一轮回复，旧版本保留，用 ‹ › 切换；更早的回复是「从这里重新生成」，会删掉之后的消息）/ 撤回（自己和角色的消息都能撤回）/ 删除 / 删除本轮 / 多选（批量删除、合并收藏）/ 收藏 / 复制。角色设置「聊天」页可以打开「TA 会撤回消息」和「偷看」，也能清空聊天 / 剧情记录。点图片可全屏查看。顶部可切换「聊天 / 剧情」，右上齿轮 = 角色设置。「+」抽屉里目前能用的是相册，其它（拍摄、语音通话、位置、红包、礼物、转账、收藏）还在开发中。输入栏左边的笑脸 = 表情包抽屉：右下「＋」用图床链接导入（每行「名字 链接」，只有链接时用文件名当名字，可填分类；也可以点「从文档导入」选 txt / docx / json / md / csv 文档，自动认出名字和链接），点表情包直接发出，长按表情包改名字 / 换分类 / 删除，长按分类标签改名 / 删除分类，打字时文字和表情包名字对得上，输入栏上方会联想出来，点一下就发；右下的设置键按当前角色设置 TA 能不能发表情包、能用哪些分类、能不能看到表情包图片（要开识图）；图片打不开时显示成「[表情包：名字]」。\n' +
  '· 角色设置三页：角色（信息、人设、USER、关联世界书）/ 聊天（记忆：最大记忆范围、注意力范围、自动总结；语言与回复；互动；自主活动；记忆备份）/ 美化（窗口颜色、主题气泡、布局、状态栏、角色专属 CSS）。\n' +
  '· Prompt：系统提示词、预设（条目可单独开关，右上可导入酒馆的对话补全预设 JSON）、世界书（文件夹 + 条目：名称、关键词、内容、注入位置 前/中/后，条目可单独开关；角色要在角色设置里关联后才生效）、思维链。' +
  '提示词、人设、预设、世界书、开场白里都可以写 {{char}}（角色名）和 {{user}}（用户名），发送时自动换成名字。';

var ASSISTANT_CSS_HINT =
  '常用选择器：.phone（整个手机）、.desktop-apps（主页图标区）、.settings-nav（各界面顶栏）、.settings-card（设置卡片）、.section-label（分区标题）、' +
  '.chat-char-card（消息列表 / 通讯录卡片）、.chat-tab-item（Chat 底栏标签）、.chat-msg-bubble（聊天气泡）、.chat-msg-row.user .chat-msg-bubble（我的气泡）、' +
  '.chat-msg-row.ai .chat-msg-bubble（角色气泡）、.cr-time-sep（聊天里的时间）、.cr-bottom-bar 或 .chat-room-bottom（聊天输入栏）、.feed-post（动态卡片）。' +
  '安卓系统顶栏颜色用变量 --system-bar-color（写在 :root 或某个界面上，如 #appChatRoom）。写样式时尽量加 .phone 前缀，颜色和圆角要和现有的粉色系风格协调，必要时用 !important。';

function assistantPrompt(char) {
  if (!isAssistantOn(char)) return '';
  var cfg = assistantCfg(char);
  var out = [ASSISTANT_GUIDE];
  var acts = [];

  if (cfg.wb) {
    var folders = wbFolders.map(function(f) { return f.name; });
    var chars = charList.map(function(c) { return c.charAlias || c.charName; }).filter(Boolean);
    out.push('【权限 · 添加世界书】用户想要新的世界书设定时，你可以帮 TA 写好并提交。现有文件夹：' + (folders.join('、') || '（无）') +
      '；现有角色：' + (chars.join('、') || '（无）') + '。');
    acts.push('<mphone-action>{"type":"add_worldbook","name":"条目名","keywords":"关键词1,关键词2（留空 = 一直生效）","content":"条目内容","pos":"before|middle|after","folder":"文件夹名（可选，不存在会新建）","link":["要关联的角色名（可选）"]}</mphone-action>');
  }
  if (cfg.css) {
    out.push('【权限 · 设计界面 CSS】用户想改界面样子时，你可以写 CSS 并提交。target 为 "global" 时作用于整个界面（替换全部全局样式，所以要在现有内容基础上改）；' +
      'target 为角色名时写进该角色的聊天室专属样式（mode 可选 "append" 追加 或 "replace" 替换，默认追加）。' + ASSISTANT_CSS_HINT +
      '\n当前全局样式：\n' + (globalCss ? globalCss.slice(0, 3000) : '（空）'));
    acts.push('<mphone-action>{"type":"set_css","target":"global","css":"完整的 CSS"}</mphone-action>');
  }
  if (cfg.err) {
    var api = getApiCfg();
    var host = '';
    try { host = api.url ? new URL(api.url).origin + new URL(api.url).pathname : ''; } catch (_) { host = '（地址格式不对：' + api.url.slice(0, 60) + '）'; }
    var lines = apiErrorLog.slice(-8).map(function(e) {
      return '· ' + fmtMsgTime(e.time) + ' ' + e.feature + ' ' + e.url + ' → ' + (e.status ? '状态 ' + e.status : '连接失败') + (e.message ? '：' + e.message : '');
    });
    out.push('【权限 · 读取接口报错】用户问到报错或用不了时，根据下面的信息帮 TA 找原因、说清楚怎么改（不要让用户把密钥发给你）。\n' +
      '当前主API：地址 ' + (host || '（未填写）') + '；密钥' + (api.key ? '已填写' : '未填写') + '；模型 ' + (api.model || '（未选择）') + '；温度 ' + api.temp + '。\n' +
      '最近的接口报错（从旧到新）：\n' + (lines.join('\n') || '（暂无报错）') + '\n' +
      '接口地址参考：OpenAI https://api.openai.com/v1；Claude 官方 https://api.anthropic.com（应用会自动改用 Claude 自己的格式）；Gemini https://generativelanguage.googleapis.com/v1beta/openai；Grok https://api.x.ai/v1；DeepSeek https://api.deepseek.com；中转站一般以 /v1 结尾。' +
      '模型不支持图片或语音时，应用会自动改用文字发送。' +
      '常见原因参考：401 密钥错误或过期；403 没有权限、地区或账号限制；404 地址或模型名不对（BASE URL 通常以 /v1 结尾，不要带 /chat/completions）；' +
      '429 请求太频繁或额度用完；500/502/503 服务商那边出问题，稍后再试；连接失败 = 地址写错、网络不通、服务商不允许网页直接访问（跨域），或在 https 页面里填了 http 地址。');
  }
  if (acts.length) {
    out.push('【提交操作的格式】需要执行时，在回复最后单独输出操作块（可以多个，JSON 必须合法）：\n' + acts.join('\n') +
      '\n用户点「确认」后才会生效，所以不要说「已经帮你改好了」，而是说「点确认就会生效」。聊天记录里的〔操作卡片 …〕会告诉你用户确认、忽略还是撤销了。只在用户需要时才提交操作。');
  }
  return out.join('\n\n');
}

// ---------- 从回复里取出操作块 ----------
function charOfHistory(hist) {
  return charList.filter(function(c) { return chatHistories[c.id] === hist || dramaHistories[c.id] === hist; })[0] || null;
}
function extractAssistantActions(hist, raw, out) {
  if (!isAssistantOn(charOfHistory(hist))) return raw;
  return raw.replace(/<mphone-action>([\s\S]*?)<\/mphone-action>/g, function(_, body) {
    var a = null;
    try { a = JSON.parse(body.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (_) {}
    if (!a || (a.type !== 'add_worldbook' && a.type !== 'set_css')) a = { type: 'invalid', raw: body.trim().slice(0, 200) };
    a.state = a.type === 'invalid' ? 'failed' : 'pending';
    out.push(a);
    return '';
  });
}

// ---------- 卡片文字 ----------
function findCharByName(name) {
  name = String(name || '').trim();
  return charList.filter(function(c) { return name && (c.charAlias === name || c.charName === name); })[0] || null;
}
function actionTitle(a) {
  if (a.type === 'add_worldbook') return '添加世界书「' + (a.name || '未命名') + '」';
  if (a.type === 'set_css') return a.target === 'global' || !a.target ? '修改全局样式' : '修改「' + a.target + '」的聊天样式';
  return '无法识别的操作';
}
var ACTION_STATE_TEXT = { pending: '等待用户确认', done: '用户已确认，已生效', ignored: '用户忽略了', undone: '用户撤销了', failed: '格式不对，没有执行' };
function actionTextForAI(a) {
  return '〔操作卡片：' + actionTitle(a) + ' — ' + (ACTION_STATE_TEXT[a.state] || '') + (a.error ? '（' + a.error + '）' : '') + '〕';
}
function actionPermKey(a) { return a.type === 'add_worldbook' ? 'wb' : a.type === 'set_css' ? 'css' : ''; }
var ACTION_PERM_NAME = { wb: '添加世界书', css: '设计界面 CSS' };

// ---------- 执行 / 撤销 ----------
function runAction(a) {
  var helper = assistantChar();
  var key = actionPermKey(a);
  if (!isAssistantOn(helper) || !assistantCfg(helper)[key]) throw new Error('没有开启「' + ACTION_PERM_NAME[key] + '」权限');

  if (a.type === 'add_worldbook') {
    if (!a.content) throw new Error('条目内容是空的');
    var folderId = WB_NONE, createdFolder = '';
    if (a.folder) {
      var f = wbFolders.filter(function(x) { return x.name === a.folder; })[0];
      if (!f) { f = { id: genWbId('wf'), name: String(a.folder) }; wbFolders.push(f); createdFolder = f.id; }
      folderId = f.id;
    }
    var entry = { id: genWbId('wb'), name: String(a.name || '未命名'), keywords: String(a.keywords || ''), content: String(a.content),
                  pos: ['before', 'middle', 'after'].indexOf(a.pos) >= 0 ? a.pos : 'before', folderId: folderId };
    wbEntries.push(entry);
    var linked = [];
    [].concat(a.link || []).forEach(function(n) {
      var c = findCharByName(n);
      if (!c) return;
      c.worldbookIds = (c.worldbookIds || []).concat(entry.id);
      linked.push(c.id);
    });
    saveWbEntries();
    if (linked.length) saveCharList();
    renderWbList();
    a.result = { entryId: entry.id, createdFolder: createdFolder, linked: linked };
  } else if (a.type === 'set_css') {
    if (!a.target || a.target === 'global') {
      a.result = { prev: globalCss };
      setGlobalCss(String(a.css || ''));
    } else {
      var c = findCharByName(a.target);
      if (!c) throw new Error('找不到角色「' + a.target + '」');
      a.result = { charId: c.id, prev: c.customCss || '' };
      c.customCss = a.mode === 'replace' ? String(a.css || '') : ((c.customCss ? c.customCss + '\n' : '') + String(a.css || ''));
      saveCharList();
      if (charList[openingChatCharIdx] === c) applyChatRoomStyle(c);
    }
  }
}
function undoAction(a) {
  var r = a.result || {};
  if (a.type === 'add_worldbook') {
    wbEntries = wbEntries.filter(function(e) { return e.id !== r.entryId; });
    if (r.createdFolder && !wbEntries.some(function(e) { return e.folderId === r.createdFolder; })) {
      wbFolders = wbFolders.filter(function(f) { return f.id !== r.createdFolder; });
    }
    (r.linked || []).forEach(function(id) {
      var c = charList.filter(function(x) { return x.id === id; })[0];
      if (c) c.worldbookIds = (c.worldbookIds || []).filter(function(x) { return x !== r.entryId; });
    });
    saveWbEntries();
    saveCharList();
    renderWbList();
  } else if (a.type === 'set_css') {
    if (r.charId) {
      var c = charList.filter(function(x) { return x.id === r.charId; })[0];
      if (c) { c.customCss = r.prev; saveCharList(); if (charList[openingChatCharIdx] === c) applyChatRoomStyle(c); }
    } else {
      setGlobalCss(r.prev || '');
    }
  }
  delete a.result;
}

// ---------- 确认卡片 ----------
function renderActionCard(m, list, empty) {
  list = list || getActiveMsgListEl();
  if (empty) empty.style.display = 'none';
  var card = document.createElement('div');
  card.className = 'cr-action-card';
  card._msg = m;
  card._extras = [];
  paintActionCard(card, m);
  list.appendChild(card);
  list.scrollTop = list.scrollHeight;
  return card;
}
function paintActionCard(card, m) {
  var a = m.action;
  card.innerHTML = '';
  card.dataset.state = a.state;

  var head = document.createElement('div');
  head.className = 'cr-action-head';
  head.textContent = (a.type === 'set_css' ? '🎨 ' : a.type === 'add_worldbook' ? '📚 ' : '⚠️ ') + actionTitle(a);
  card.appendChild(head);

  var body = document.createElement('div');
  body.className = 'cr-action-body';
  function line(label, value) {
    if (!value) return;
    var d = document.createElement('div');
    d.className = 'cr-action-line';
    var b = document.createElement('b');
    b.textContent = label + '：';
    d.appendChild(b);
    d.appendChild(document.createTextNode(value));
    body.appendChild(d);
  }
  if (a.type === 'add_worldbook') {
    line('关键词', a.keywords || '（无，一直生效）');
    line('文件夹', a.folder || '未分类');
    line('注入位置', { before: '前', middle: '中', after: '后' }[a.pos] || '前');
    line('关联角色', [].concat(a.link || []).join('、'));
  } else if (a.type === 'set_css' && a.target && a.target !== 'global') {
    line('方式', a.mode === 'replace' ? '替换原有样式' : '追加到原有样式后面');
  }
  var pre = document.createElement('pre');
  pre.className = 'cr-action-pre';
  pre.textContent = a.type === 'add_worldbook' ? (a.content || '') : a.type === 'set_css' ? (a.css || '') : (a.raw || '');
  body.appendChild(pre);
  card.appendChild(body);

  var foot = document.createElement('div');
  foot.className = 'cr-action-foot';
  var status = document.createElement('span');
  status.className = 'cr-action-status';
  var helper = assistantChar();
  var key = actionPermKey(a);
  var allowed = key && isAssistantOn(helper) && assistantCfg(helper)[key];
  var text = a.state === 'done' ? '✓ 已生效' : a.state === 'ignored' ? '已忽略' : a.state === 'undone' ? '已撤销' :
             a.state === 'failed' ? '格式不对，没法执行' : '';
  if (a.error && a.state !== 'done') text = a.error;
  else if (!allowed && key && a.state !== 'done') text += (text ? ' · ' : '') + '没有开启「' + ACTION_PERM_NAME[key] + '」权限';
  status.textContent = text;
  foot.appendChild(status);
  function btn(text, cls, fn) {
    var b = document.createElement('button');
    b.className = 'cr-action-btn ' + cls;
    b.textContent = text;
    b.addEventListener('click', function(e) { e.stopPropagation(); fn(); });
    foot.appendChild(b);
  }
  function done(state, toast) {
    a.state = state;
    saveHistories();
    paintActionCard(card, m);
    if (toast) showToast(toast, 'success');
  }
  if (a.state === 'done') {
    btn('撤销', 'ghost', function() { undoAction(a); done('undone', '已撤销'); });
  } else if (a.type !== 'invalid' && allowed) {
    if (a.state === 'pending') btn('忽略', 'ghost', function() { done('ignored'); });
    btn('确认', 'primary', function() {
      try { runAction(a); delete a.error; done('done', '✓ ' + actionTitle(a)); }
      catch (err) { a.error = err.message; showToast('✗ ' + err.message, 'error'); paintActionCard(card, m); }
    });
  }
  card.appendChild(foot);
}

// 消息列表里「[操作] …」的预览要用到本文件的函数，加载完重画一次
renderChatCharList();
