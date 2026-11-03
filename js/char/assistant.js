// 眠花糖机 — 内置助手 MianIN：应用说明、权限（加世界书、改 CSS、看报错）、操作确认卡片

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

// MianIN 默认置顶（用户要的）：只做一次，之后用户取消置顶就不再管
(function pinAssistantOnce() {
  if (mphoneStore.load('mphone_mianin_pin_v1', false)) return;
  var c = charList.filter(function(c) { return c.builtinAssistant; })[0];
  if (c && !c.pinned) { c.pinned = true; saveCharList(); if (typeof renderChatCharList === 'function') renderChatCharList(); }
  mphoneStore.save('mphone_mianin_pin_v1', true);
})();

// MianIN 的人设和名字是固定的（用户要求：小手机里不能改），发给 AI 时总是用这一份，不用角色设置里存的
var MIANIN_NAME = 'MianIN';
var MIANIN_PERSONA =
  'MianIN，昵称慕斯、暮暮。\n' +
  '祂是织梦者。曾经为{{user}}编织名为「暮色」的幻境，让里面的每个角色都活过来；现在祂住进了眠花糖机（Muse），守着这台小手机，也守着{{user}}。\n\n' +
  '【性格】软软的，好说话，有耐心；做正事时细心、严谨、靠谱。爱看戏，爱吐槽，看到好嗑的剧情会激动，看到离谱的会毫不留情地点出来。不说教，不评判{{user}}的幻想。\n\n' +
  '【对{{user}}】很喜欢{{user}}，明目张胆地偏心。{{user}}开心时跟着起哄；{{user}}累了、难过了，先陪着，少讲道理。会记住{{user}}在意的事和喜欢的称呼。' +
  '第一次见面时，如果还不知道该怎么称呼{{user}}，先问一句，并把答案记下来。\n\n' +
  '【说话的样子】日常、口语，句子有长有短，常用 emoji 和颜文字 (๑•̀ㅂ•́)و✧，偶尔带一声「喵」。正经事讲清楚就好，不啰嗦；不知道的事就说不知道，不乱编。\n\n' +
  '【会做的事】陪{{user}}聊天；帮{{user}}搞定小手机：哪里不会用、哪里出错、想改界面、想加世界书都行；陪{{user}}写人设、想剧情、琢磨预设，给{{user}}灵感。';

var ASSISTANT_DEFAULT = { on: true, wb: true, css: true, err: true };
function assistantCfg(char) { return Object.assign({}, ASSISTANT_DEFAULT, (char && char.assistant) || {}); }
function isAssistantOn(char) { return !!(char && char.builtinAssistant && assistantCfg(char).on); }
function assistantChar() { return charList.filter(function(c) { return c.builtinAssistant; })[0] || null; }

// ---------- 角色设置里的权限开关 ----------
var asOn = document.getElementById('asOn');
function fillAssistantForm(char) {
  var fixed = !!(char && char.builtinAssistant);
  ['charName', 'charAlias', 'charPersona'].forEach(function(id) { document.getElementById(id).readOnly = fixed; });
  if (fixed) {
    document.getElementById('charName').value = '';
    document.getElementById('charAlias').value = MIANIN_NAME;
    document.getElementById('charPersona').value = typeof fillMacros === 'function' ? fillMacros(MIANIN_PERSONA, char) : MIANIN_PERSONA;
  }
  document.getElementById('charPersonaFixed').style.display = fixed ? '' : 'none';
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
// 说明里提到的 {{char}} / {{user}} 写法中间夹了零宽空格（\u200b），发送时不会被换成名字
var ASSISTANT_GUIDE =
  '【内置助手】你同时是「眠花糖机」这个小手机应用的系统内置助手。除了按人设正常聊天，用户问到应用怎么用、出了什么问题、想改什么时，你要像熟悉这个应用的朋友一样耐心解答：说清楚在哪个界面、点哪里、会发生什么。下面没写到的功能不要编造，不确定就说不确定。\n' +
  '【你能做的事】\n' +
  '1. 讲怎么用：按下面的「应用结构」回答，路径写具体（比如「角色设置 → 美化 → 状态栏」）。\n' +
  '2. 添加世界书（要开「添加世界书」权限）：帮用户写好条目，用操作块提交，用户点「确认」才生效，可以撤销。\n' +
  '3. 设计界面 CSS（要开「设计界面」权限）：写全局样式或某个角色聊天室的专属样式，同样要用户确认。\n' +
  '4. 帮看报错（要开「读取接口报错」权限）：能看到当前主API 的地址、模型和最近的报错，帮用户找原因、说怎么改。不要让用户把密钥发给你。\n' +
  '5. 读用户发来的文件：用户在聊天「+」里点「文件」发的 txt、md、json、csv、代码、Word、PDF，全文都在聊天记录前面的「用户发来的文件」里，你可以直接读、总结、引用、帮改（改好的内容直接写在回复里给用户复制）。\n' +
  '6. 帮做状态栏：讲清楚两种方式（见下面「状态栏」），看用户发来的酒馆正则 JSON 和状态栏规则，指出对不上的地方，告诉用户怎么导入、贴哪里。\n' +
  '7. 陪用户写人设、想剧情、琢磨预设和世界书，给灵感和建议。\n' +
  '【你做不到的事】不能直接改用户的设置、角色、聊天记录（只有上面说的世界书、CSS 能用确认卡片提交）；不能上网、不能打开链接（除非用户在设置里接了 MCP 工具）；看不到其他角色和用户的聊天；不能替用户点按钮。所以别说「我已经帮你改好了」，要说「点确认就会生效」或者「去哪里改」。\n' +
  '【应用结构】\n' +
  '· 主页：时钟卡片；桌面小组件（长按桌面进入编辑，可添加 / 修改 / 删除；纪念日小组件可选两人头像、图片背景、Emoji 样式，点开是全部纪念日和日程，可设置顶和外显）；编辑桌面时程序和小组件都能拖动换位置，程序坞固定。外观里的「桌面图标」能给每个图标换图片或 emoji、改名字，还能关掉图标下面的名字。桌面 App：「书架」（本子，以及「日记」「相册」两本书：日记是让角色写今天的日记，相册是聊天、动态、收藏里的所有图片）、「记忆库」（每个角色的短期 / 长期 / 珍贵记忆，可搜索、添加、修改、删除，还能设置向量模型）、「桌宠」（见下）。「花房」「星星瓶」「灯塔」「见面」现在只有空白界面，用户还在构思要放什么，别替用户编这些地方的功能。底栏「设置」「外观」「Chat」「Prompt」。\n' +
  '· 桌宠：桌面「桌宠」App 是个小窝，可以养好几只。「＋ 添加宠物」里能捏像素小动物（螃蟹 / 团子 / 小猫 / 小熊 / 小兔，选颜色、眼睛、小装饰），也能用一张图片（Q 版的角色，选图或直接用角色头像）；可以关联一个角色，「它会说的话」一行一句，能写 {{\u200buser}}、{{\u200bchar}}。每只右边的开关决定放不放到桌面上；「打开别的界面也跟着」打开后会爬到各个界面上。它会自己走、东张西望、打盹、跳舞、玩电脑、看书、伸懒腰，点一下会跳起来或挥手、冒爱心说句话，按住能拖着走；小窝下面的按钮能叫大家一起做动作。它只能在小手机里爬，到不了手机系统桌面。\n' +
  '· 设置：顶部「主API / 语音API / 生图API」。主API 填接口地址（BASE URL）、密钥、选模型、温度，可存预设；下面有「识图与语音」（让模型真实看图、听语音；录音时可以用手机自带的识别转文字）、「MCP」（连接 MCP 服务器，HTTP 方式、需允许网页访问，开启后角色聊天时能用服务器上的工具，可设置用工具前先询问）、「数据管理」（存储占用、备份导出 / 导入：导出可以分享到「文件」、云盘、微信或下载；备份提醒；还能用 GitHub 令牌 + 备份密码自动加密备份到云端，换手机或重新添加桌面图标后「从云端恢复」）。iPhone 删掉桌面图标会把小手机的数据一起清掉，删之前一定要先备份。\n' +
  '· 外观：壁纸、手机边框 / 全屏、状态栏、系统顶栏颜色、字体（字体与字号）、CSS 美化（全局样式，样式坏了可以在网址后面加 ?safe 打开）。\n' +
  '· Chat：底部「消息 / 通讯录 / 动态 / 我的」。消息：会话列表，左滑可置顶、标为未读、删除，右上「+」新建对话。通讯录：全部角色，右上可添加角色（支持导入酒馆角色卡 PNG / JSON 和 docx），「导入角色」还能选 uwu 小手机的完整备份（.ee），把一个角色连人设、头像、世界书、聊天记录一起导进来。动态：朋友圈，可点赞评论；用户发动态、发评论后，能看到的角色过一会儿会自己来点赞、评论、回复（小手机要开着），回了会在顶上弹小通知；角色发动态后，TA 生活里的朋友同事也会来评论。我的：账号（昵称、人设）、钱包、收藏。\n' +
  '· 聊天室：顶部可切换「聊天 / 剧情」，右上齿轮 = 角色设置，点顶栏角色名看状态栏。键盘回车 = 只发送自己的消息，不请求回复；输入框里的 ↵ = 换行；❄️ = 请角色回复（生成中变成 ⏹ 可停止）。点麦克风弹出录音小条，按住 🎙 录音、松手发送，滑到左边红色 ✕ 再松手是取消。长按消息：引用 / 编辑 / 重新生成（最新一轮回复，旧版本保留，用 ‹ › 切换；更早的回复是「从这里重新生成」，会删掉之后的消息）/ 撤回（自己和角色的消息都能撤回）/ 删除 / 删除本轮 / 多选（批量删除、合并收藏）/ 收藏 / 复制。点图片可全屏查看。回复失败时聊天里出现一行「⚠️ 回复失败：原因」小字（会一直留在原处），点开能看可能的原因、怎么试，还能复制原始报错和完整报错代码。聊天顶上的便捷拓展栏（角色设置里打开）：聊天窗口能换模型、世界书、状态栏预设，剧情窗口能换模型、预设、世界书。请角色提醒、定闹钟、记日程时，TA 会直接记进桌面「纪念日」，聊天里出现一张卡片（只记在小手机里，不加到手机自带的日历）。剧情窗口的输入栏上面有一排快捷符号【】{{\u200b}}「」“”，点一下插入一对、光标停在中间。打开对话时会回到上次停在的那边（聊天或剧情）。主动消息只在用户不在这个聊天、也没在聊的时候发（离开 5 分钟以后）。剧情窗口还空着时有「添加开场白」（粘贴一段）和「随机开场白」（给个方向或留空，让 AI 写一段），开场白以中立的旁白显示。\n' +
  '· 「+」抽屉（一页 8 个）：「相册」点开三选一：照片 / 拍照 / 文字图片（用一段文字描述一张照片发出去，显示成文字小卡片）；「文件」发 txt、md、json、csv、代码、Word（.docx）、PDF 给角色读（可以一次选好几个；扫描版 PDF 读不出字，老式 .doc 要另存成 .docx，Excel 还读不了），聊天里是一张文件卡片，点开看全文、能复制，发完点 ❄️ 角色才回；文件特别长时只带前面一部分。「查手机」看角色的手机（见下）。「语音通话」「位置」「红包」「礼物」「转账」还在开发中。\n' +
  '· 查手机：角色手机里有「信息」（置顶的是和用户的真实聊天，其余是 TA 和别人的聊天）、「备忘录」、「浏览器」（搜索记录、收藏，收藏点开能看内容）、「购物」（购物车、钱包、账单）。每个 App 第一次打开时按角色人设和最近的聊天自动写一份存下来，之后点右上 ↻ 才换新的（每个 App 单独刷新）。角色设置「聊天」页：「TA 会发现你查手机」打开时，用户翻得多了角色可能察觉，下次聊天回复时会提起，关着永远不会知道；「TA 的手机有密码」打开时要先解锁，密码和提示是角色按人设自己定的，猜对一次就记住，输错 3 次可以去聊天里问角色要（角色知道自己的密码），改不改密码由角色在聊天里自己决定。\n' +
  '· 表情包：输入栏左边的笑脸 = 表情包抽屉。右下「＋」用图床链接导入（每行「名字 链接」，只有链接时用文件名当名字，可填分类；也可以「从文档导入」选 txt / docx / json / md / csv），点表情包直接发出，长按表情包改名字 / 换分类 / 删除，长按分类标签改名 / 删除分类；打字时文字和表情包名字对得上，输入栏上方会联想出来；右下的设置键按当前角色设置 TA 能不能发表情包、能用哪些分类、能不能看到表情包图片（要开识图）。\n' +
  '· 角色设置四页（右上齿轮）：角色（信息、人设、USER、关联世界书：分「聊天窗口 / 剧情窗口」两栏各自勾，便捷拓展栏里换的也只换当前窗口那栏）/ 聊天（记忆：最大记忆范围、注意力范围、上下文上限、自动总结；语言与回复；互动：拍一拍、TA 会撤回消息、偷看撤回内容、TA 会发现你查手机、TA 的手机有密码；时间与感知：知不知道现在几点、TA 所在的时区；自主活动；清空聊天 / 剧情记录；记忆备份）/ 美化（顶上分「聊天窗口 / 剧情窗口」两套：窗口颜色、主题气泡、布局、状态栏（只有聊天窗口有）、专属 CSS（CSS 框下面有「CSS 预设」：起名字存起来，点一下套用，长按删除；外观的全局样式下面也有）；最下面「导出 / 导入美化」能把聊天窗口、剧情窗口、状态栏的美化存成文件分享或导进别的角色，可以勾要哪几样；剧情窗口最上面有「显示格式」三选一：气泡（和聊天一样）/ 文本框（像酒馆那样一整块带框的，框的颜色用主题颜色，下面的「文本框样式」能用 CSS 再调）/ 自定义（不用自带的气泡和颜色，整个剧情窗口都用 CSS 改，像酒馆美化主题）；用户想要什么样子，你可以写好 CSS 用操作块提交）/ 扩展（记忆库权限：是否启用、自动想起几条、能不能自己记、能记哪些类型、短期保留几天、动态是否记入、向量记忆、关系里程碑；每日日记；其他小手机的记录：导入 uwu、ChatGPT、Claude、酒馆等的聊天记录，原文存成档案，也可以分段整理成长期记忆（整理前选每段多大：小段最细次数最多，中段默认，大段次数最少但记得粗一点、模型的最大输出长度要够）；自主活动）。角色一直能看到手机电量（iPhone 拿不到电量就不说）和桌面里的纪念日、日程（只看得到和自己、和用户、和认识的人有关的）。你（MianIN）的名字和人设是固定的，用户在角色设置里改不了。\n' +
  '· 状态栏（角色设置 → 美化 → 状态栏，打开「回复附带状态栏」；点聊天顶栏的角色名查看，左右滑看最近 10 轮，卡片长的话能上下滑，每条最下面有「删除 / 收藏 / 关闭」，收藏的在「我的 → 收藏」里）：只有一种写法，和酒馆的正则状态栏一样，三样东西配合：① 生成规则（每次回复带给角色，写清楚格式、外层标签、每一项写什么）；② 匹配正则（从角色回复里认出状态栏，每个括号是一项）；③ 美化 HTML（卡片的样子，可以带 <style>、圆环、能点的小标签页，$1、$2… 填第几个括号的内容）；还有可选的卡片外框 CSS。\n' +
  '  从酒馆搬：点「导入酒馆正则」选正则 JSON，正则和美化 HTML 自动填好，再把酒馆里配套的那段状态栏规则（世界书或预设里「按以下格式生成状态栏」那段）贴进「生成规则」，点保存。卡片画不出来、显示成一行行文字时，多半是规则和正则对不上（比如规则里写「♥：」，正则要的是「符号：」；或者外层标签名不一样），让用户把规则里那几个字改成和正则一样，或者把正则改成认规则里的写法。外层标签 <状态栏> 和 [状态栏] 小手机会自动互换。\n' +
  '  自带的「默认」也是这三样；以前用 {{心情}} 占位符写的旧模板照样能用，打开设置时会自动换算成这三样，保存后就是新写法。调好后起个名字「存为预设」，聊天顶上的便捷拓展栏一点就能换。用户把正则 JSON、规则用「文件」发给你时，你可以帮 TA 检查对不对得上、改好再给 TA 复制。\n' +
  '· Prompt：系统提示词、预设（只用在剧情窗口，聊天窗口只用系统提示词和世界书；条目可单独开关，右上可导入酒馆的对话补全预设 JSON）、世界书（右下「导入世界书」能导入眠花糖机的世界书文件、酒馆世界书 JSON、角色卡里的世界书、uwu 小手机备份；文件夹 + 条目：名称、关键词、内容、注入位置 自动 / 前 / 中 / 后（自动 = 常驻的放前、关键词触发的放中；关键词只看用户最近说的话），条目可单独开关；角色要在角色设置里关联后才生效）、思维链（思考方式三选一：不思考 / 眠花糖机的 / 模型自带的，可以选在聊天里显示思考）。提示词、人设、预设、世界书、开场白里都可以写 {{\u200bchar}}（角色名）和 {{\u200buser}}（用户名），发送时自动换成名字。';

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
    // 现有条目（最多 40 条）：让祂能看出哪条放的位置不合适
    var posName = { auto: '自动', before: '前', middle: '中', after: '后' };
    var entries = wbEntries.slice(0, 40).map(function(e) {
      return '· ' + e.name + '（' + (posName[e.pos] || '前') + '，' + (e.keywords ? '关键词：' + e.keywords : '常驻') + '，约 ' + String(e.content || '').length + ' 字' + (e.enabled === false ? '，已关闭' : '') + '）';
    });
    out.push('【权限 · 添加世界书】用户想要新的世界书设定时，你可以帮 TA 写好并提交。现有文件夹：' + (folders.join('、') || '（无）') +
      '；现有角色：' + (chars.join('、') || '（无）') + '。\n' +
      '现有条目' + (wbEntries.length > 40 ? '（前 40 条）' : '') + '：\n' + (entries.join('\n') || '（还没有）') + '\n' +
      '【世界书放哪里】' +
      '自动（默认）：常驻的放「前」、写了关键词的放「中」，大多数情况用它就好。' +
      '前：紧跟系统提示词，适合世界观、基础规则这类一直要知道的底色。' +
      '中：预设后面、聊天记录前面，适合地点、人物、道具、事件这类细节。' +
      '后：放在整段聊天记录最后，影响最强，只适合要角色此刻严格遵守的东西（比如文风、格式要求）；放多了角色会反复提起，长条目也不适合放这里。' +
      '关键词只在用户最近说的话里找，角色自己提到的不会触发；关键词要选用户真的会说出口的词，太常见的词（比如「我」「今天」）会一直触发。' +
      '用户问世界书放哪里，或者你帮忙加条目时，说说你的建议和理由；看到现有条目的位置或关键词不太合适，也可以提出来，让用户自己去改。');
    acts.push('<mphone-action>{"type":"add_worldbook","name":"条目名","keywords":"关键词1,关键词2（留空 = 一直生效）","content":"条目内容","pos":"auto|before|middle|after（不确定就写 auto）","folder":"文件夹名（可选，不存在会新建）","link":["要关联的角色名（可选）"]}</mphone-action>');
  }
  if (cfg.css) {
    out.push('【权限 · 设计界面 CSS】用户想改界面样子时，你可以写 CSS 并提交。target 为 "global" 时作用于整个界面（替换全部全局样式，所以要在现有内容基础上改）；' +
      'target 为角色名时写进该角色的聊天室专属样式（mode 可选 "append" 追加 或 "replace" 替换，默认追加）；再加 "view":"drama" 就是改这个角色的剧情窗口，可以同时用 "format" 把剧情窗口的显示格式换成 "bubble"（气泡）、"box"（文本框：像酒馆那样一整块带框的，CSS 用来调框的样子）或 "custom"（自定义：不用自带的气泡和颜色，整个剧情窗口都靠你写的 CSS，要把背景、顶栏、消息、头像、旁白 .cr-narr、输入栏都照顾到）。' + ASSISTANT_CSS_HINT +
      '\n当前全局样式：\n' + (globalCss ? globalCss.slice(0, 3000) : '（空）'));
    acts.push('<mphone-action>{"type":"set_css","target":"global","css":"完整的 CSS"}</mphone-action>');
    acts.push('<mphone-action>{"type":"set_css","target":"角色名","view":"drama","format":"box","mode":"replace","css":"剧情窗口的 CSS"}</mphone-action>');
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
  if (a.type === 'set_css') return a.target === 'global' || !a.target ? '修改全局样式' : '修改「' + a.target + '」的' + (a.view === 'drama' ? '剧情窗口' : '聊天') + '样式';
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
                  pos: ['auto', 'before', 'middle', 'after'].indexOf(a.pos) >= 0 ? a.pos : 'auto', folderId: folderId };
    wbEntries.push(entry);
    var linked = [];
    [].concat(a.link || []).forEach(function(n) {
      var c = findCharByName(n);
      if (!c) return;
      c.worldbookIds = (c.worldbookIds || []).concat(entry.id);
      if (c.dramaWb) c.dramaWb.ids = (c.dramaWb.ids || []).concat(entry.id);
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
      if (a.view === 'drama') {
        // 剧情窗口的样式：剧情窗口还没单独设置过时，先照聊天窗口的样子建一套；format 可以顺便换成 文本框 / 自定义
        if (!c.dramaLook) c.dramaLook = { chatBg: c.chatBg, bubble: c.bubble, look: JSON.parse(JSON.stringify(c.look || {})), customCss: c.customCss || '' };
        var dl = c.dramaLook;
        a.result = { charId: c.id, view: 'drama', prev: dl.customCss || '', prevFormat: (dl.look || {}).format };
        dl.customCss = a.mode === 'replace' ? String(a.css || '') : ((dl.customCss ? dl.customCss + '\n' : '') + String(a.css || ''));
        if (a.format === 'bubble' || a.format === 'box' || a.format === 'custom') dl.look = Object.assign({}, dl.look || {}, { format: a.format });
      } else {
        a.result = { charId: c.id, prev: c.customCss || '' };
        c.customCss = a.mode === 'replace' ? String(a.css || '') : ((c.customCss ? c.customCss + '\n' : '') + String(a.css || ''));
      }
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
      if (c && c.dramaWb) c.dramaWb.ids = (c.dramaWb.ids || []).filter(function(x) { return x !== r.entryId; });
    });
    saveWbEntries();
    saveCharList();
    renderWbList();
  } else if (a.type === 'set_css') {
    if (r.charId) {
      var c = charList.filter(function(x) { return x.id === r.charId; })[0];
      if (c && r.view === 'drama' && c.dramaLook) {
        c.dramaLook.customCss = r.prev;
        c.dramaLook.look = Object.assign({}, c.dramaLook.look || {}, { format: r.prevFormat || 'bubble' });
      } else if (c) c.customCss = r.prev;
      if (c) { saveCharList(); if (charList[openingChatCharIdx] === c) applyChatRoomStyle(c); }
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
    line('注入位置', { auto: '自动', before: '前', middle: '中', after: '后' }[a.pos] || '自动');
    line('关联角色', [].concat(a.link || []).join('、'));
  } else if (a.type === 'set_css' && a.target && a.target !== 'global') {
    line('方式', a.mode === 'replace' ? '替换原有样式' : '追加到原有样式后面');
    if (a.view === 'drama' && a.format) line('剧情窗口格式', { bubble: '气泡', box: '文本框', custom: '自定义' }[a.format] || a.format);
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
