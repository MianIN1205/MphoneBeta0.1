// 眠花糖机 — 拼发给 AI 的内容：按回合裁剪、回复格式、{{char}} / {{user}}、token 估算、聊天剧情互通、现实感知、buildMsgs、消息转成给 AI 的文字

// 按回合切分记录：一个回合 = 用户的一条或多条消息 + 之后角色的回复（开头若是角色消息，归入第一回合）
function splitRounds(hist) {
  var rounds = [], cur = null;
  hist.forEach(function(m) {
    if (m.role === 'user' && (!cur || cur.hasReply)) {
      cur = []; cur.hasReply = false; rounds.push(cur);
    } else if (!cur) {
      cur = []; cur.hasReply = false; rounds.push(cur);
    }
    if (m.role !== 'user') cur.hasReply = true;
    cur.push(m);
  });
  return rounds;
}

// 角色名下面那行小字：角色在聊天回复里写 <签名>…</签名> 就更新，没写过时用默认的
var CHAT_SUB_DEFAULT = '嗯嗯你说我在听';
function paintChatSubTitle(char) {
  document.getElementById('chatRoomSubTitle').textContent = (char && char.headStatus) || CHAT_SUB_DEFAULT;
}

// 聊天回复的格式要求：语言 / 翻译 / 回复条数 / 状态栏（发消息和主动消息使用，动态不用）
function chatFormatRules(char) {
  var c = Object.assign({}, DEFAULT_CHAT_CFG, char.chatCfg || {});
  var look = Object.assign({}, DEFAULT_LOOK, char.look || {});
  var rules = [];
  // 线上聊天的说话方式（系统提示里关于动作、心理描写的要求只用在剧情空间）
  // 用户要的是日常微信 / 短信那种：断句、短、一条一两句，不长篇大论
  var wechat = '现在是线上聊天：像平时发微信、短信一样说话。一条消息就是一句短话（一般 5～16 个字，最多不超过 20 个字），口语、随意，可以是半句话，句尾不加句号；' +
    '一条消息里不要换行、不要空行，不要用一串逗号把几件事连成一个长句，想说的多就断开、分成几条发，绝不写成一大段。日常闲聊回得简短自然，聊到重要的事或者对方说了很多时，再多发几条。' +
    '比如：在呢|||刚下班|||你吃饭没';
  if (c.actionOn) {
    // 打开了「线上动作描写」：动作、神态、心理、环境都写进 *星号*，显示成气泡外的灰色小字；气泡里只放说出口的话
    rules.push(wechat + '动作、神态、心理和环境的描写都写在 *星号* 里（比如 *盯着屏幕笑了一下*、*窗外在下雨*），它会显示成气泡外的灰色小字；' +
      '每处只写一小句，不要写成长段，气泡里只放你说出口的话。系统提示词和预设里关于描写的要求，就照这个方式放进灰色小字里；关于篇幅、推进剧情的要求只适用于剧情空间。');
  } else {
    rules.push(wechat + '只写你发出去的聊天内容，不写动作、神态、心理和环境描写，也不要用 *星号* 或括号写旁白。' +
      '系统提示词和预设里关于篇幅、描写、推进剧情的要求只适用于剧情空间，这里不用照做。');
  }
  if (c.lang && !/^(中文|汉语|简体中文|chinese)$/i.test(c.lang)) {
    rules.push('请使用' + c.lang + '回复。');
    if (c.translate) rules.push('每条消息的外语正文后另起一行，以「〔译〕」开头给出中文翻译。');
  }
  if (c.replyMax > 1) {
    rules.push('像发微信一样，把这次回复拆成 ' + (c.replyMin === c.replyMax ? c.replyMax : c.replyMin + '~' + c.replyMax) +
               ' 条消息，每两条之间写 |||。');
  }
  // 帮忙记提醒 / 闹钟 / 日程（见 js/chat/calendar.js）
  if (typeof CAL_RULE === 'string') rules.push(CAL_RULE);
  if (c.recallOn) {
    rules.push('你也可以像微信一样撤回自己刚发的消息：偶尔说漏嘴、发错或者害羞的时候，把那一条单独写成 <撤回>这条消息的内容</撤回>，' +
               '它会先发出去，过两秒变成「撤回了一条消息」，对方不一定看得到。很少用，不要每次都撤回。');
  }
  // 角色可以发照片（文字图片或生图）：用户说频率别太高，最近发过就先不提
  if (!(typeof photoRecentlySent === 'function' && photoRecentlySent(chatHistories[char.id]))) {
    rules.push('很少发照片：只有真的特别想让对方看看你眼前的画面时（大概十几二十轮聊天才有一次，平时都不要发），才单独一行写 <照片>用一两句话描述照片里的画面（拍的是什么、在哪、光线）</照片>，对方会看到这张照片。');
  }
  if (c.patOn) {
    rules.push('你也可以像微信一样拍一拍用户：想拍的时候在全部消息最后另起一行写 <拍一拍/>（偶尔用，不要每次都拍）。用户拍你时，记录里会出现「（用户拍了拍你…）」。');
  }
  // 名字下面那行小字：状态变了才写，跟着这次回复一起带回来
  rules.push('如果你此刻的状态有变化（在做什么、心情），在全部消息最后另起一行写 <签名>不超过 12 个字</签名>，' +
             '它会显示在聊天界面你名字的下面，像微信状态一样（比如「在赶地铁」「有点困了」）。现在显示的是「' +
             (char.headStatus || CHAT_SUB_DEFAULT) + '」，没变就不用写。');
  // 状态栏：照「生成规则」写，小手机用正则认出来画成卡片（statusSpec，见 js/char/settings.js）
  if (look.statusOn) {
    var spec = statusSpec(look);
    if (spec) {
      // 和酒馆的正则状态栏一样：照「生成规则」写，格式、外层标签都照规则来；没写规则就照正则的格式
      rules.push('在全部消息之后另起一行，写出你此刻的状态栏（这段不会显示在聊天里，小手机会把它画成状态卡片）。' +
                 (spec.rules ? '格式、外层标签、每一项怎么写，都严格照下面的【状态栏规则】：\n【状态栏规则】\n' + fillMacros(spec.rules, char)
                             : '格式要能被这个正则完整匹配（照它的标签和顺序写，括号的地方填你此刻的内容）：' + spec.find));
    } else {
      // 最老的写法：模板里没有占位符，让 AI 照模板直接写整段 HTML
      rules.push('在全部消息之后，另起一行用 <status></status> 包住你当前的状态。状态按下面的 HTML 模板输出：' +
                 '保留模板里的标签和样式，只把内容换成你此刻的真实状态。\n' + fillMacros(statusTplOf(look), char));
    }
    // 接着上一次的状态写，数值不会忽高忽低
    var prev = lastStatusOf(chatHistories[char.id]);
    if (prev) rules.push('你上一次的状态是：' + prev + '\n这次在它的基础上按刚才发生的事自然变化，没变的项照抄，数值不要无故大起大落。');
  }
  return rules.length ? [{ role: 'system', content: '【回复格式】' + rules.join('\n') }] : [];
}

// 酒馆通用写法：{{char}} = 角色名，{{user}} = 用户名（本聊天所用账号的昵称）；也认旧写法 <BOT> / <USER>。
// {{// 注释}} 和 {{trim}} 直接去掉，{{newline}} 换成换行
function fillMacros(text, char) {
  if (!text) return text;
  char = char || {};
  var charName = char.charAlias || char.charName || '角色';
  var userName = (typeof resolveCharAccount === 'function' && resolveCharAccount(char).nickname) || '用户';
  return String(text)
    .replace(/\{\{\/\/[\s\S]*?\}\}/g, '')
    .replace(/\{\{\s*trim\s*\}\}/gi, '')
    .replace(/\{\{\s*newline\s*\}\}/gi, '\n')
    .replace(/\{\{\s*char\s*\}\}|<BOT>/gi, charName)
    .replace(/\{\{\s*user\s*\}\}|<USER>/gi, userName);
}

// 剧情回复的格式要求：最后写一句隐藏的前情。聊天窗口靠它知道剧情空间发生了什么，剧情太长时也用它代替省略的原文
function dramaFormatRules(char) {
  var illus = (typeof imgUse === 'function' && imgUse('drama') === 'gen')
    ? '再另起一行写 <配图>用一两句话描述这一幕的画面（人物外貌和动作、场景、光线、氛围），会照着它画一张配图</配图>，这一行也不会显示出来。' : '';
  return [{ role: 'system', content: '【回复格式】在回复的最后另起一行写 <前情>用一句话概括这一轮发生了什么（30 字以内，第三人称，写清楚谁做了什么）</前情>。这一行不会显示出来，只用来记住剧情。' + illus }];
}
// 一个回合的前情（剧情回复里藏着的那句话）
function roundRecap(r) {
  return r.filter(function(m) { return m.recap; }).map(function(m) { return m.recap; }).join('；');
}

// 粗略估算 token：中日韩等宽字符一个算一个，其余每 4 个字符算一个；图片 / 语音按 300 算
function estTokens(c) {
  if (Array.isArray(c)) return c.reduce(function(n, p) { return n + (p && p.type === 'text' ? estTokens(p.text) : 300); }, 0);
  var s = String(c || ''), wide = (s.match(/[⺀-鿿가-힯＀-￯]/g) || []).length;
  return Math.ceil(wide + (s.length - wide) / 4) + 4;
}
function msgTokens(m) { return estTokens(msgTextForAI(m)) + (m.imgSrc || m.voice ? 300 : 0); }

// 另一个窗口最近发生的事（聊天窗口带剧情空间的，剧情窗口带线上聊天的总结和最近记录），标明是在哪边发生的
// 剧情那边有前情的回合只带那句前情，没有的（旧记录）带原文
var CROSS_SCENE_MSGS = 12;
var CROSS_SCENE_ROUNDS = 12;
function crossSceneContext(idx, isDrama) {
  var char = charList[idx] || {};
  var other = isDrama ? getChatHistory(idx) : getDramaHistory(idx);
  var charName = char.charAlias || char.charName || '角色';
  var userName = resolveCharAccount(char).nickname || '用户';
  var lineOf = function(m) {
    var t = String(msgTextForAI(m)).replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (t.length > 150) t = t.slice(0, 150) + '…';
    return (m.role === 'user' ? userName : charName) + '：' + t;
  };
  var lines = [];
  if (isDrama) {
    other.filter(function(m) { return !m.action; }).slice(-CROSS_SCENE_MSGS).forEach(function(m) {
      var l = lineOf(m);
      if (l) lines.push(l);
    });
    var sums = ((char.memory || {}).summaries || []).map(function(s) { return s.text; });
    if (!sums.length && !lines.length) return '';
    return '【线上聊天的前情】以下是你们在线上聊天里的经过（那时你们隔着手机屏幕）：\n' +
      (sums.length ? sums.join('\n') + (lines.length ? '\n最近的聊天：\n' : '') : '') + lines.join('\n');
  }
  splitRounds(other.filter(function(m) { return !m.action; })).slice(-CROSS_SCENE_ROUNDS).forEach(function(r) {
    var rc = roundRecap(r);
    if (rc) { lines.push('· ' + rc); return; }
    r.forEach(function(m) { var l = lineOf(m); if (l) lines.push(l); });
  });
  if (!lines.length) return '';
  return '【剧情空间里最近发生的事】你记得这些，但那是在剧情空间里发生的；现在你们在线上聊天，仍然隔着屏幕：\n' + lines.join('\n');
}

// histOverride：指定使用的记录（自主活动 / 动态生成时用聊天记录），默认取当前子视图的记录
// =============================================
// 现实感知：现在几点（按角色所在时区，角色设置「聊天」页 → 时间与感知可以关）、隔了多久没说话；手机电量、纪念日和日程一直带着
// 只放进聊天窗口（以及用聊天记录的主动消息、动态、日记）；剧情空间有自己的时间线，不放
// =============================================
function zoneParts(t, tz) {
  try {
    var o = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, year: 'numeric', month: 'numeric', day: 'numeric',
      weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date(t)).forEach(function(p) { o[p.type] = p.value; });
    return { y: +o.year, m: +o.month, d: +o.day, w: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday), h: (+o.hour) % 24, min: +o.minute };
  } catch (_) {
    var d = new Date(t);
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), w: d.getDay(), h: d.getHours(), min: d.getMinutes() };
  }
}
function dayPart(h) { return h < 5 ? '凌晨' : h < 8 ? '早上' : h < 11 ? '上午' : h < 13 ? '中午' : h < 18 ? '下午' : h < 23 ? '晚上' : '深夜'; }
function zoneTimeText(t, tz) {
  var p = zoneParts(t, tz);
  return p.y + '年' + p.m + '月' + p.d + '日 ' + WEEKDAYS[p.w] + ' ' + dayPart(p.h) + ' ' + pad(p.h) + ':' + pad(p.min);
}
function charTimeZone(char) { return ((char && char.chatCfg) || {}).timeZone || ''; }
// 角色那边的「现在」（主动消息、动态、日记里用）
function charNowText(char) { return zoneTimeText(Date.now(), charTimeZone(char)); }
function zoneLabel(tz) {
  var o = document.querySelector('#timeZone option[value="' + tz + '"]');
  return o ? o.textContent : tz;
}
function realWorldContext(char, hist) {
  var c = Object.assign({}, DEFAULT_CHAT_CFG, char.chatCfg || {});
  var lines = [], now = Date.now();
  if (c.timeOn) {
    var mine = zoneTimeText(now), theirs = c.timeZone ? zoneTimeText(now, c.timeZone) : mine;
    lines.push(theirs !== mine ? '你所在的地方（' + zoneLabel(c.timeZone) + '）现在是 ' + theirs + '；{{user}}那边是 ' + mine + '。' : '现在是 ' + mine + '。');
    // 隔了多久没说话：你上一条消息之后，对方隔了多久才回；或者对方还没回，已经过去多久
    var ai = -1;
    for (var i = hist.length - 1; i >= 0; i--) {
      if (hist[i].role === 'assistant' && hist[i].time && !hist[i].action) { ai = i; break; }
    }
    if (ai >= 0) {
      var firstUser = null;
      for (var j = ai + 1; j < hist.length; j++) { if (hist[j].role === 'user' && hist[j].time) { firstUser = hist[j]; break; } }
      var gap = (firstUser ? firstUser.time : now) - hist[ai].time;
      if (firstUser && gap >= 30 * 60000) lines.push('你上一条消息发出后，{{user}}隔了 ' + durText(gap) + ' 才回你。');
      else if (!firstUser && gap >= 10 * 60000) lines.push('距离你上一条消息已经过去了 ' + durText(gap) + '。');
    }
  }
  if (typeof phoneBattery !== 'undefined' && phoneBattery.real) {
    var pct = Math.round(phoneBattery.level * 100);
    lines.push('{{user}}的手机电量 ' + pct + '%' + (phoneBattery.charging ? '，正在充电' : pct <= 20 ? '，快没电了' : '') + '。');
  }
  if (typeof calendarContextFor === 'function') {
    var cal = calendarContextFor(char);
    if (cal) lines.push(cal);
  }
  if (!lines.length) return '';
  return '【现在】' + lines.join('\n') + '\n这些是你此刻自然知道的现实情况，需要时自然地带进对话（比如很晚了劝对方早点睡、好久没聊有点想念），不用每次都提。';
}

// 眠花糖机固定的创作说明：每个角色都带，用户改不了。讲清楚这里是虚构的角色扮演，减少莫名其妙的拒绝和道歉
var MPHONE_FICTION_NOTE = '【眠花糖机】这里是{{user}}自己的小手机应用「眠花糖机」（Muse），里面的一切都是{{user}}和你一起进行的虚构角色扮演与创作。' +
  '请完全以角色的身份，按人设和剧情来回应：校园、恋爱、日常、冒险、悬疑、黑暗或沉重的题材都可以认真去写，不需要为虚构的情节道歉、说教或加免责声明，也不要跳出角色、用 AI 的口吻说话。' +
  '涉及亲密情节的角色都是成年人。真有不适合写的内容，就用角色自己的方式在剧情里自然地带过，不要中断扮演。';

// =============================================
// 思维链（底层固定在代码里，Prompt 页只有开关）：
// · 思考方式「眠花糖机的」：每次正式回复前让模型在最开头用 <thinking></thinking> 写一小段中文思考（聊天、剧情各一套），
//   代替模型自带的思考；请求时同时尽量关掉模型自带的思考（js/core/llm.js 的 llmThinkOff）
// · 「不思考」：不加这段，模型自带的思考也尽量关掉 —— 回得快；「模型自带的」：不加这段，也不去关，模型有就用（见 js/prompt/cot.js）
// · 回复里的思考会被摘出来存在第一条消息的 m.think 上：不显示成气泡、不再发给模型；Prompt 页可以开「在聊天里显示思考」，
//   开了就在那次回复前面放一条很小的折叠条（js/chat/render.js 的 renderThinkBar）
// =============================================
var COT_CHAT = '【回复前先想一想】在回复最开头，用 <thinking></thinking> 写一小段思考（中文，几行就够，不要用你自带的英文思考），写完再写正式回复。思考内容{{user}}看不到。想这几件事：\n' +
  '- {{user}}这几条在说什么，此刻是什么情绪、想要什么\n' +
  '- {{user}}刚说过、回答过什么：别重复问，别装不知道；我上一轮说过什么：别重复\n' +
  '- 我（{{char}}）此刻在做什么、心情怎样，按人设会怎么回，语气和口头禅对不对\n' +
  '- 回几条、每条多短，要不要发表情包';
var COT_DRAMA = '【回复前先想一想】在回复最开头，用 <thinking></thinking> 写一段思考（中文，不要用你自带的英文思考），写完再写正式的剧情。思考内容{{user}}看不到。想这几件事：\n' +
  '- 现在的时间、地点、场景，在场的有谁、各自什么状态\n' +
  '- {{user}}刚做了什么、说了什么，背后可能是什么情绪\n' +
  '- {{char}}按人设和此刻的心情会怎么反应：说什么、做什么、心里想什么\n' +
  '- 这一轮怎么往下推进，哪些细节要和前文对上；不要替{{user}}决定行动和结果';
function cotRules(isDrama) {
  var on = typeof cotModeNow === 'function' && cotModeNow() === 'mine';
  return on ? [{ role: 'system', content: isDrama ? COT_DRAMA : COT_CHAT }] : [];
}
// 从回复里摘出思考：<thinking>…</thinking>、有的模型直接把自带思考写成 <think>…</think>；只有开头没有结尾的就把那个标签去掉
function takeThink(text) {
  var think = [];
  text = String(text || '').replace(/<(thinking|think)>([\s\S]*?)<\/\1>/gi, function(_, t, s) { if (s.trim()) think.push(s.trim()); return ''; });
  text = text.replace(/<\/?(thinking|think)>/gi, '');
  return { text: text.trim(), think: think.join('\n\n') };
}

// 小手机里的各种活动（主动发消息、发动态、评论、写日记……）的要求：放在最后一条、用「用户」身份、标明不是对方说的。
// 有的接口（比如 Claude）会把系统提示都挪到最前面，最后一条要是角色自己的聊天，它就会接着聊天，不去做这件事
function activityAsk(text) {
  return { role: 'user', content: '（这是小手机的系统提示，不是对方发来的消息）\n' + text +
    '\n还是你自己：口吻、用词和性格和平时聊天时一致，只是换了个场合；只输出要求的内容，不加解释、标题或多余的引号。' };
}

// 世界书的统一开头：角色只把它当背景，不要一遍遍念出来
var WB_WRAP = '【背景设定】下面是这个世界、地点、人物和事物的设定，是你心里清楚的背景知识，不是对话里正在发生的事。' +
  '只在剧情自然需要时体现出来；不要复述、不要逐条提起，同一个设定不要反复强调，也不要说出「设定」「世界书」这类词。';

function buildMsgs(idx, histOverride) {
  var char = charList[idx] || {};
  var sys  = (document.getElementById('systemPromptTA') ? document.getElementById('systemPromptTA').value.trim() : '');
  var extra = '';
  var fixed = char.builtinAssistant && typeof MIANIN_PERSONA !== 'undefined';   // MianIN：名字和人设固定（见 js/char/assistant.js）
  var persona = fixed ? MIANIN_PERSONA : char.charPersona;
  if (fixed) extra += '你的名字是：' + MIANIN_NAME + '。\n';
  else if (char.charAlias || char.charName) extra += '你的名字是：' + (char.charAlias || char.charName) + '。\n';
  if (persona)           extra += '你的人设：\n' + persona + '\n';
  // USER：本聊天选用的账号（人设跟着账号走）+ 角色对该账号的专属印象
  var acc = resolveCharAccount(char);
  if (acc.nickname)      extra += '用户的名字是：' + acc.nickname + '。\n';
  if (char.userNickname) extra += '你对用户的称呼是：' + char.userNickname + '。\n';
  if (acc.persona)       extra += '用户的人设：\n' + acc.persona + '\n';
  var impression = impressionFor(char.userImpressions, acc.uid);
  if (impression)        extra += '你对用户的特别印象 / 设定：\n' + impression + '\n';
  var sysContent = (MPHONE_FICTION_NOTE + (sys ? '\n\n' + sys : '') + (extra ? '\n\n---\n' + extra : '')).trim();
  var msgs = sysContent ? [{ role: 'system', content: sysContent }] : [];
  // 系统内置助手：应用说明 + 已开启的权限
  var assistantSys = (typeof assistantPrompt === 'function') ? assistantPrompt(char) : '';
  if (assistantSys) msgs.push({ role: 'system', content: assistantSys });
  // 社交圈：认识谁 + 能看到的最近动态
  var feedSys = (typeof feedContextFor === 'function') ? feedContextFor(char) : '';
  if (feedSys) msgs.push({ role: 'system', content: feedSys });

  var history = histOverride || getActiveHistory(idx);
  var fullHistory = history;   // 下面会裁剪 history；算「隔了多久」要用完整的记录
  var isDrama = history === getDramaHistory(idx);

  // 记录裁剪：聊天和剧情都按「最大记忆范围」（回合）和「上下文上限」（token）只带最近的部分；
  // 聊天另外带全部总结，剧情省略掉的回合用各回合的前情代替；再提醒 AI 重点关注注意力范围内的回合
  var attentionNote = null;
  var richFrom = Math.max(0, history.length - 20);   // 其他记录：最近 20 条附带真实媒体
  var isChatHist = history === getChatHistory(idx);
  if (isChatHist || isDrama) {
    var mem = char.memory || {};
    if (isChatHist && mem.summaries && mem.summaries.length) {
      msgs.push({ role: 'system', content: '【记忆总结】以下是你们之前的聊天经过：\n' +
        mem.summaries.map(function(s) { return s.text; }).join('\n') });
    }
    var cc = Object.assign({}, DEFAULT_CHAT_CFG, char.chatCfg || {});
    var allRounds = splitRounds(history);
    var rounds = allRounds.slice(-cc.maxMem);
    if (cc.ctxTokens > 0) {
      var total = 0;
      rounds.forEach(function(r) { r.forEach(function(m) { total += msgTokens(m); }); });
      while (rounds.length > 1 && total > cc.ctxTokens) {
        rounds[0].forEach(function(m) { total -= msgTokens(m); });
        rounds.shift();
      }
    }
    if (isDrama && rounds.length < allRounds.length) {
      var recaps = allRounds.slice(0, allRounds.length - rounds.length).map(roundRecap).filter(Boolean).slice(-40);
      if (recaps.length) {
        msgs.push({ role: 'system', content: '【更早的剧情】下面是更早的剧情经过（原文已省略，只留每一轮的前情）：\n' +
          recaps.map(function(r) { return '· ' + r; }).join('\n') });
      }
    }
    history = [].concat.apply([], rounds);
    // 注意力范围内的消息附带真实图片 / 语音，更早的只用文字说明（省流量和费用）
    richFrom = [].concat.apply([], rounds.slice(0, Math.max(0, rounds.length - cc.attention))).length;
    if (rounds.length > cc.attention) {
      attentionNote = { role: 'system', content: '【注意力】下面的记录中，请重点关注并回应最近 ' + cc.attention +
        ' 个回合的内容；更早的部分只作为背景参考，不必逐条回应。' };
    }
  }

  // 记忆库：珍贵的回忆 + 和最近对话相关的记忆 + 怎样记下新记忆（权限在角色设置「扩展」页）
  var memSys = (typeof memoryContextFor === 'function') ? memoryContextFor(char, history) : '';
  if (memSys) msgs.push({ role: 'system', content: memSys });

  // 世界书：按注入位置分组（前 = 紧跟系统提示，中 = 预设条目之后，后 = 聊天记录之后；自动见 wbResolvePos）
  // 同一个位置的合成一段「背景设定」，并说清楚这是心里知道的背景：不复述、不反复提、不说「设定」「世界书」
  var wbGroups = { before: [], middle: [], after: [] };
  getActiveWbEntries(char, history, isDrama).forEach(function(e) {
    var p = typeof wbResolvePos === 'function' ? wbResolvePos(e) : (e.pos || 'before');
    (wbGroups[p] || wbGroups.before).push('【' + e.name + '】\n' + e.content);
  });
  var wbByPos = {};
  Object.keys(wbGroups).forEach(function(p) {
    wbByPos[p] = wbGroups[p].length ? [{ role: 'system', content: WB_WRAP + '\n\n' + wbGroups[p].join('\n\n') }] : [];
  });
  msgs = msgs.concat(wbByPos.before);

  // 注入当前预设中已启用的提示词条目（按条目各自的 role 身份发送）。预设只给剧情窗口用（用户定的）：聊天窗口和各种活动只用世界书
  var curPreset = (typeof charPromptPreset === 'function') ? charPromptPreset(char) : (stPresets && stPresets[stActivePresetIdx]);
  var forDrama = (histOverride || getActiveHistory(idx)) === getDramaHistory(idx);
  if (forDrama && curPreset && Array.isArray(curPreset.entries)) {
    curPreset.entries.forEach(function(entry) {
      if (entry && entry.enabled && entry.content && entry.content.trim()) {
        var r = (entry.role === 'user' || entry.role === 'assistant') ? entry.role : 'system';
        msgs.push({ role: r, content: entry.content.trim() });
      }
    });
  }
  msgs = msgs.concat(wbByPos.middle);


  var rawHist = history.map(function(m, i) {
    return { role: m.role, content: msgContentForAI(m, i >= richFrom, char) };
  });
  // 聊天和剧情的记忆互通：带上另一边的前情（剧情窗口还带聊天的记忆总结），再说明现在在哪个空间
  var cross = crossSceneContext(idx, isDrama);
  if (cross) msgs.push({ role: 'system', content: cross });
  if (typeof scenePrompt === 'function') msgs.push({ role: 'system', content: scenePrompt(isDrama) });
  // 聊天窗口：现在几点、隔了多久、电量、纪念日和日程
  var realSys = isChatHist ? realWorldContext(char, fullHistory) : '';
  if (realSys) msgs.push({ role: 'system', content: realSys });
  // 聊天窗口：TA 刚发现用户翻了自己的手机（查手机，见 js/chat/peek.js）
  var peekSys = (isChatHist && typeof peekCaughtPrompt === 'function') ? [peekLockPrompt(char), peekCaughtPrompt(char)].filter(Boolean).join('\n') : '';
  if (peekSys) msgs.push({ role: 'system', content: peekSys });
  // 聊天窗口：这个角色能用的表情包名字（表情包抽屉的设置里按角色打开）
  var stkSys = (isChatHist && typeof stickerPrompt === 'function') ? stickerPrompt(char) : '';
  if (stkSys) msgs.push({ role: 'system', content: stkSys });
  if (attentionNote) msgs.push(attentionNote);
  // 提示词、人设、预设、世界书里的 {{char}} / {{user}} 换成名字（聊天记录本身不动）
  var fill = function(m) { return typeof m.content === 'string' ? { role: m.role, content: fillMacros(m.content, char) } : m; };
  // 用户发来的文件：全文单独一段放在聊天记录前面（不替换 {{user}} 这些，原样给）
  var fileSys = (typeof filesContextFor === 'function') ? filesContextFor(history) : null;
  return msgs.map(fill).concat(fileSys ? [fileSys] : [], rawHist, wbByPos.after.map(fill));
}

// 发给 AI / 用于总结的消息文字：撤回的只告诉它「撤回了一条消息」，引用的附上引用内容
function msgTextForAI(m) {
  if (m.recalled) {
    if (m.role !== 'assistant') return '[用户撤回了一条消息]';
    if (m.recalledBy === 'user') return '[你的这条消息被用户撤回了，原本是：' + (m.recalledText || '') + ']';
    return '<撤回>' + (m.recalledText || '') + '</撤回>';
  }
  if (m.pat) return patTextForAI(m);
  if (m.narr) return '【旁白 · 剧情开场】（这是中立的旁白，交代场景，不是用户说的话）\n' + (m.content || '');
  if (m.action && typeof actionTextForAI === 'function') return actionTextForAI(m.action);
  if (m.cal && typeof calTextForAI === 'function') return calTextForAI(m.cal);
  var c = (m.file && typeof fileTextForAI === 'function') ? fileTextForAI(m)
        : m.textImg ? (m.illus ? '（这一幕的配图）' : m.role === 'assistant' ? '[你发了一张照片：' + m.textImg + ']' : '[发来一张照片（用文字描述的画面）：' + m.textImg + ']')
        : m.voice ? ('[语音消息]' + (m.transcript ? '：' + m.transcript : '')) : (m.content || (m.imgSrc ? '[图片消息]' : ''));
  if (m.quote) c = '「引用 ' + m.quote.author + '：' + m.quote.text + '」\n' + c;
  return c;
}

// 发给 AI 的消息内容。rich = 是否附带真实媒体（只对注意力范围内的用户消息）：
// 图片 → 识图格式的真实图片；语音 →「发送音频」模式下附带录音（发送前转成 WAV），否则用转写文字
function msgContentForAI(m, rich, char) {
  var text = msgTextForAI(m);
  if (!rich || m.role !== 'user' || m.recalled) return text;
  // 表情包：角色打开了「能看到表情包图片」时，带上导入时存好的小图（见 js/chat/stickers.js）
  if (m.sticker && mediaCfg.vision && typeof stickerImageForAI === 'function') {
    var stk = stickerImageForAI(m, char);
    if (stk) return [{ type: 'text', text: text }, { type: 'image_url', image_url: { url: stk } }];
  }
  // 图片前面带一句文字：有些接口（如部分 Gemini 中转）不接受只有图片、没有文字的消息
  if (m.imgSrc && mediaCfg.vision) {
    var parts = [{ type: 'text', text: (m.quote ? '「引用 ' + m.quote.author + '：' + m.quote.text + '」\n' : '') + '（我发了一张图片）' }];
    parts.push({ type: 'image_url', image_url: { url: m.imgSrc } });
    return parts;
  }
  // 「发送音频」模式，或「转成文字」但还没转出文字（比如接口不支持语音识别）时，直接把录音发过去：
  // 文字部分不带转写，让能听的模型自己听；转写放在音频块上，模型听不了时（js/core/llm.js 的 llmPrepare）换成转写文字
  if (m.voice && (mediaCfg.voiceMode === 'audio' || !m.transcript)) {
    var head = msgTextForAI(Object.assign({}, m, { transcript: '' }));
    return [{ type: 'text', text: head }, { type: 'input_audio', _voiceSrc: m.voice.src, _transcript: m.transcript || '' }];
  }
  return text;
}

// 记录里最近一次的状态栏内容（去掉 HTML，太长截断）
function lastStatusOf(hist) {
  for (var i = (hist || []).length - 1; i >= 0; i--) {
    var s = hist[i].status;
    if (s) {
      s = String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return s.length > 400 ? s.slice(0, 400) + '…' : s;
    }
  }
  return '';
}
