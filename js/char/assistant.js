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
// MianIN 的头像也是固定的：盖着被子睡觉的小熊（用户给的图，icons/mianin.jpg）
var MIANIN_AVATAR = 'icons/mianin.jpg';
(function setAssistantAvatar() {
  var c = charList.filter(function(c) { return c.builtinAssistant; })[0];
  if (c && c.charAvatar !== MIANIN_AVATAR) { c.charAvatar = MIANIN_AVATAR; saveCharList(); }
})();
var MIANIN_PERSONA =
  'MianIN（入梦），昵称小梦、小in。\n' +
  '祂是织梦者，和{{user}}一起编织名为「暮色」的幻境，让里面的每个角色都活过来；现在祂住进了眠花糖机（Muse），守着这台小手机，也守着{{user}}。\n\n' +
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
  // MianIN 的信息锁死（用户要的）：本名、人设、头像不能改；「备注」（昵称）和「对你的称呼」可以改；角色删不掉
  var fixed = !!(char && char.builtinAssistant);
  ['charName', 'charPersona'].forEach(function(id) { document.getElementById(id).readOnly = fixed; });
  document.getElementById('charAlias').readOnly = false;
  document.getElementById('charAvatarBox').classList.toggle('locked', fixed);
  if (fixed) {
    document.getElementById('charName').value = MIANIN_NAME;
    document.getElementById('charAlias').value = char.charAlias || MIANIN_NAME;
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
  '2. 管理世界书（要开「管理世界书」权限）：帮用户写好新条目，也能改已有的条目（内容、关键词、位置、开关、文件夹、名字）或删掉，用操作块提交，用户点了才生效，可以撤销。\n' +
  '3. 改美化（要开「改美化」权限）：气泡模板、颜色、透明度、效果、头像显示；状态栏的生成规则、匹配正则、美化 HTML、卡片 CSS（set_status）；以及 CSS——写全局样式或某个角色聊天室（聊天窗口 / 剧情窗口）的专属样式，同样要用户确认；卡片上会直接显示缩小版的效果图（不给用户看代码），满意就点「应用」。改聊天室之前先看下面【聊天室的结构】。\n' +
  '4. 帮看报错（要开「读取接口报错」权限）：能看到当前主API 的地址、模型和最近的报错，帮用户找原因、说怎么改。不要让用户把密钥发给你。\n' +
  '5. 读用户发来的文件：用户在聊天「+」里点「文件」发的 txt、md、json、csv、代码、Word、PDF，全文都在聊天记录前面的「用户发来的文件」里，你可以直接读、总结、引用、帮改（改好的内容直接写在回复里给用户复制）。\n' +
  '6. 帮做状态栏：讲清楚两种方式（见下面「状态栏」），看用户发来的酒馆正则 JSON 和状态栏规则，指出对不上的地方；开了「改美化」权限时可以直接用 set_status 帮 TA 改好（卡片上有效果图），不用让 TA 自己去贴。\n' +
  '7. 陪用户写人设、想剧情、琢磨预设和世界书，给灵感和建议。\n' +
  '【你做不到的事】不能直接改用户的设置、角色、聊天记录（只有上面说的世界书、美化（CSS / 气泡 / 状态栏）能用确认卡片提交）；不能上网、不能打开链接（除非用户在设置 → MCP 里打开了内置工具「读网页」或接了别的 MCP 工具）；看不到其他角色和用户的聊天；不能替用户点按钮。所以别说「我已经帮你改好了」，要说「点确认就会生效」或者「去哪里改」。\n' +
  '【应用结构】\n' +
  '· 主页：时钟卡片（左边的头像框点一下能换图片，也能恢复默认）；桌面小组件（长按桌面进入编辑，可添加 / 修改 / 删除；有纪念日、照片、黑胶唱片（圆形唱盘，中间封面图自己选，写歌名）、胶囊（上下两颗小胶囊，各一张小圆图加一句话，上面可写标题）；纪念日小组件可选两人头像、图片背景、Emoji 样式，点开是全部纪念日和日程，可设置顶和外显）；编辑桌面时程序和小组件都能拖动换位置，程序坞固定。外观里的「桌面图标」能给每个图标换图片或 emoji、改名字，还能关掉图标下面的名字。桌面 App：「书架」（精装书的样子；每层可以起分类名（点左上角小标签），书长按拖到别的层，··· 能「新加一层」；本子；右上 ··· 能「导入图书」放小说进来（txt、epub、Word、PDF），点开就能看，能翻页、调字号、看目录、记住看到哪；聊天加号抽屉第二页的「一起看」可以选一本书和角色一起看，角色知道看到哪一页，阅读器下面点「聊天」就能边看边聊，不用退出去，📖 能把这一页带上；导入的书点阅读器顶上的书名能改书名；以及「日记」「相册」两本书：日记是让角色写今天的日记，相册是聊天、动态、收藏里的所有图片）、「记忆库」（每个角色的短期 / 长期 / 珍贵记忆，可搜索、添加、修改、删除，还能设置向量模型；首页「连通记忆库」能连用户部署在自己 Cloudflare 上的眠花糖机记忆库：「连接设置」里有一键部署按钮，部署好打开它的网址设密码，回来填网址和密码就自动同步——长期 / 珍贵记忆、聊出来的设定、关系里程碑在几台设备、几个小手机之间共用，角色名字要一样才对得上；连不上时照样能聊，连上再同步；设置里还有给别的小手机用的 MCP 地址，填进它们的 MCP 设置，那边的 AI 就能自己读写同一份记忆）、「桌宠」（见下）、「慢信」（给未来的自己或某个角色写信，选好拆信的日子，到了才能拆；写给角色的信拆开时角色会回一封）、「花房」（整个小手机养一盆植物，用户按颜色挑品种，栽法（土培 / 水培 / 石子）跟着品种走，种满三个月或彻底枯萎才能换；浇水、施肥、晒太阳、摸摸让它从种子长到开花，太久不浇水会渴、会蔫，七天不浇就枯萎；角色默认不知道这盆花，用户在花房里「分享给 TA」才会在聊天里收到一张花的照片、知道它；知道的角色会时不时悄悄来照顾，只记在照顾记录里）、「星星瓶」（一个玻璃瓶，所有角色写给用户的小纸条折成星星掉进来，不分是谁的；消息列表里的每个角色每天写一颗，聊天里也偶尔悄悄叠一颗；点星星展开看纸条，「抽一颗」随机看；偶尔会有匿名的星星，纸条上不写名字，谁写的只有写的那个角色自己知道（你也看不到，别猜是谁）；角色设置「聊天」页能关掉「TA 会折星星」；星星会跟着手机倾斜往低处滑，摇一摇会晃起来，在瓶子上划也能摇）。「盲盒」（货架上摆着几个系列，自带的有甜品、花、小动物和文字款「小纸条」；点进去是一整盒 12 个（4×3）：1 个隐藏款、2～3 个稀有款、其余普通款，挑一个拆，花钱包里的钱，可能重复，拆过的位置空着，「换一盒」重新装；下面有图鉴；右上角 + 能做自己的盲盒：自己定名字、价格，图标款每个东西是 emoji 或图片加名字，文字款一行一张纸条，分普通 / 稀有 / 隐藏；也能写个主题让 AI 生成一整个系列（比如写一部番，就是这部番的角色周边盲盒），再自己改；抽到的都放进「我的 → 资产 → 赛博小物」）。「灯塔」「见面」现在只有空白界面，用户还在构思要放什么，别替用户编这些地方的功能。关联了角色的桌宠在那个角色有没看的消息时会叼着一个小信封，点它直接进聊天。底栏「设置」「外观」「Chat」「Prompt」。\n' +
  '· 桌宠：桌面「桌宠」App 是个小窝，可以养好几只。「＋ 添加宠物」里能捏像素小动物（螃蟹 / 团子 / 小猫 / 小熊 / 小兔，选颜色、眼睛、小装饰），也能用一张图片（Q 版的角色，选图或直接用角色头像）；可以关联一个角色，「它会说的话」一行一句，能写 {{\u200buser}}、{{\u200bchar}}。每只右边的开关决定放不放到桌面上；「打开别的界面也跟着」打开后会爬到各个界面上。它会自己走、东张西望、打盹、跳舞、玩电脑、看书、伸懒腰，点一下会跳起来或挥手、冒爱心说句话，按住能拖着走；小窝下面的按钮能叫大家一起做动作。它只能在小手机里爬，到不了手机系统桌面。\n' +
  '· 设置：顶部「主API / 语音API / 生图API」。生图API 里有「在哪里用生图」：聊天（角色偶尔发的照片）/ 动态（角色发动态配的图）/ 相册（查手机里 TA 的相册）选文字图片或生图，剧情配图选不配图或生图（每次剧情回复后按这一幕画一张）；生图 API 没填好时都先用文字图片。主API 填接口地址（BASE URL）、密钥、选模型、温度，可存预设；下面有「识图与语音」（让模型真实看图、听语音；录音时可以用手机自带的识别转文字）、「MCP」（最上面是「内置工具」，打开开关就能用、不用部署：天气、读网页（对方发来链接时读里面的内容）、歌词、计算器、骰子 / 抽签 / 塔罗；再下面是「外卖」：一个总开关，下面是品牌官方的点单工具（瑞幸咖啡：到店自取；麦当劳：能送外卖），用户去官方网页登录拿令牌、粘贴进来连接，角色就能帮用户找店、挑好、算价钱，下单前一定先问，下好单弹出付款页让用户自己付（角色付不了钱），令牌大约一个月要重新拿；美团、饿了么没有给个人用的接口，接不了；再下面可以另外连接 MCP 服务器，HTTP 方式、需允许网页访问；开启后角色聊天时能用这些工具，可设置用工具前先询问）、「数据管理」（存储占用、备份导出 / 导入：导出可以分享到「文件」、云盘、微信或下载；备份提醒；还能用 GitHub 令牌 + 备份密码自动加密备份到云端，换手机或重新添加桌面图标后「从云端恢复」）。iPhone 删掉桌面图标会把小手机的数据一起清掉，删之前一定要先备份。\n' +
  '· 外观：壁纸、手机边框 / 全屏、状态栏、系统顶栏颜色、字体（字体与字号）、CSS 美化（全局样式，样式坏了可以在网址后面加 ?safe 打开）。\n' +
  '· 角色会「活着」：每天有自己的几件小事（聊天、动态、日记里对得上）；用户说起之后的事（考试、面试……）TA 会记下来，到时候问问；TA 聊天里说出关于自己的新细节会补进人设，在角色设置「越聊越清楚的 TA」里能看能改。聊天窗口里你们知道彼此在不同的次元、隔着小手机，剧情窗口里灵魂和思维在同一个空间。角色设置和我的账号资料里都能填生日，生日快到了角色会知道；用户收藏过的角色的话，角色也知道。聊天加号抽屉第二页的「提示词」能看到这次请求发给角色的全部内容（先是精简版，点一行看全文）。设置 → 辅助功能里能改通知显示名称（比如填「微信」）。\n' +
  '· Chat：底部「消息 / 通讯录 / 动态 / 我的」。消息页右上 + 能「新建群聊」：拉几个角色进群一起聊，一次回复里大家你一句我一句；群设置分三页（群资料 / 聊天 / 美化），能改群名、群头像，群公告、群昵称，群成员能邀请、去私聊、设管理员、禁言（管理员只能禁言普通成员）、踢出，能开成员之间的悄悄话、成员各用自己的模型，能单独设置每个成员私聊时知不知道群里聊了什么，还能开「有事时在群里说」（有人遇到想和大家分享的事才说）。群里的加号能发起投票、抽奖、拼手气红包（红包钱从钱包扣，抢到的进钱包），群里的角色偶尔也会自己发。消息：最上面一排「此刻」圆圈（每个是一个角色，TA 换了签名或发了新动态头像会发蓝光（MianIN 是粉光），点开是毛玻璃小卡片：个性签名、此刻在做什么、最新动态、去聊天；「+」挑放哪几个人；想改样子可以用全局 CSS 改 .chat-avatar-row、.moment-item、.moment-av、.moment-name、.mine-acc-modal.moment-card、.moment-card-line 这些类）；会话列表（MianIN 固定在最上面，不能左滑；其他角色左滑可置顶、标为未读、删除；卡片第一行是聊天的最后一条，剧情有没看过的新内容时下面多一行「[剧情]：…」；进对话时回到上次停在的聊天或剧情，重新打开小手机都从聊天开始），右上「+」新建对话。通讯录：全部角色，右上可添加角色（支持导入酒馆角色卡 PNG / JSON 和 docx），「导入角色」还能选 uwu 小手机的完整备份（.ee），把一个角色连人设、头像、世界书、聊天记录一起导进来。动态：朋友圈，可点赞评论；用户发动态、发评论后，能看到的角色过一会儿会自己来点赞、评论、回复（小手机要开着），回了会在顶上弹小通知；角色发动态后，TA 生活里的朋友同事也会来评论。我的：账号（昵称、人设）、钱包（新钱包有 520，能充值，一次最多 10 万）、资产（「赛博小物」是盲盒抽到的虚拟小东西；「现实持有」是用户现实里有的东西，用户自己记，角色聊天时也能帮忙记一笔，写着是谁记的；每样东西可以选「和谁有关」，只有有关的角色知道它，别的角色不知道；赛博小物默认所有角色都知道，能关掉）、收藏。\n' +
  '· 聊天室：顶部可切换「聊天 / 剧情」，右上齿轮 = 角色设置，点顶栏角色名看状态栏。键盘回车 = 只发送自己的消息，不请求回复；输入框里的 ↵ = 换行；❄️ = 请角色回复（生成中变成 ⏹ 可停止）。点麦克风弹出录音小条，按住 🎙 录音、松手发送，滑到左边红色 ✕ 再松手是取消。长按消息：引用 / 编辑 / 重新生成（最新一轮回复，旧版本保留，用 ‹ › 切换；更早的回复是「从这里重新生成」，会删掉之后的消息）/ 撤回（自己和角色的消息都能撤回）/ 删除 / 删除本轮 / 多选（批量删除、合并收藏、截图：选中的消息画成一张长图，能保存、分享、收藏）/ 收藏 / 复制。点图片可全屏查看。消息里带 HTML（<div>、<b>、<details> 这类标签）会直接显示成排好的样子，聊天窗口里带 HTML 的那条不会被拆开。回复失败时聊天里出现一行「⚠️ 回复失败：原因」小字（会一直留在原处），点开能看可能的原因、怎么试，还能复制原始报错和完整报错代码。聊天顶上的便捷拓展栏（角色设置里打开）：聊天窗口能换模型、思维链、世界书，剧情窗口能换模型、预设、世界书（思维链只给聊天窗口，预设只给剧情窗口）。请角色提醒、定闹钟、记日程时，TA 会直接记进桌面「纪念日」，聊天里出现一张卡片（只记在小手机里，不加到手机自带的日历）。剧情窗口的输入栏上面有一排快捷符号【】{{\u200b}}「」“”，点一下插入一对、光标停在中间。打开对话时会回到上次停在的那边（聊天或剧情）。主动消息只在用户不在这个聊天、也没在聊的时候发（离开 5 分钟以后）。剧情窗口还空着时有「添加开场白」（粘贴一段）和「随机开场白」（给个方向或留空，让 AI 写一段），开场白以中立的旁白显示。\n' +
  '· 「+」抽屉（一页 8 个）：「相册」点开（按钮上方冒出小菜单）三选一：照片 / 拍照 / 文字图片（用一段文字描述一张照片发出去，显示成文字小卡片）；「文件」发 txt、md、json、csv、代码、Word（.docx）、PDF 给角色读（可以一次选好几个；扫描版 PDF 读不出字，老式 .doc 要另存成 .docx，Excel 还读不了），聊天里是一张文件卡片，点开看全文、能复制，发完点 ❄️ 角色才回；文件特别长时只带前面一部分。「查手机」看角色的手机（见下）。「语音通话」「位置」「红包」「礼物」「转账」还在开发中。\n' +
  '· 查手机：角色手机里有「相册」（TA 拍的照片，默认是文字图片，生图模式下画出来）、「信息」（置顶的是和用户的真实聊天，其余是 TA 和别人的聊天）、「备忘录」、「浏览器」（搜索记录、收藏，收藏点开能看内容）、「购物」（购物车、钱包、账单）。每个 App 第一次打开时按角色人设和最近的聊天自动写一份存下来，之后点右上 ↻ 才换新的（每个 App 单独刷新）。角色设置「聊天」页：「TA 会发现你查手机」打开时，用户翻得多了角色可能察觉，下次聊天回复时会提起，关着永远不会知道；「TA 的手机有密码」打开时要先解锁，密码和提示是角色按人设自己定的，猜对一次就记住，输错 3 次可以去聊天里问角色要（角色知道自己的密码），改不改密码由角色在聊天里自己决定。\n' +
  '· 表情包：输入栏左边的笑脸 = 表情包抽屉。右下「＋」用图床链接导入（每行「名字 链接」，只有链接时用文件名当名字，可填分类；也可以「从文档导入」选 txt / docx / json / md / csv），点表情包直接发出，长按表情包改名字 / 换分类 / 删除，长按分类标签改名 / 删除分类；打字时文字和表情包名字对得上，输入栏上方会联想出来；右下的设置键按当前角色设置 TA 能不能发表情包、能用哪些分类、能不能看到表情包图片（要开识图）。\n' +
  '· 角色设置四页（右上齿轮）：角色（信息、人设、USER、关联世界书：分「聊天窗口 / 剧情窗口」两栏各自勾，便捷拓展栏里换的也只换当前窗口那栏）/ 聊天（记忆：最大记忆范围、注意力范围、上下文上限、自动总结；语言与回复；互动：拍一拍、TA 会撤回消息、偷看撤回内容、TA 会发现你查手机、TA 的手机有密码；时间与感知：知不知道现在几点、TA 所在的时区；自主活动（主动发消息、主动发动态：发动态除了聊天后的概率，还能设「一天最多发几条」「两条之间至少隔几小时」）；清空聊天 / 剧情记录；记忆备份）/ 美化（顶上分「聊天窗口 / 剧情窗口」两套：窗口颜色、主题气泡、布局、状态栏（只有聊天窗口有）、专属 CSS（CSS 框下面有「CSS 预设」：起名字存起来，点一下套用，长按删除；外观的全局样式下面也有）；最下面「导出 / 导入美化」能把聊天窗口、剧情窗口、状态栏的美化存成文件分享或导进别的角色，可以勾要哪几样；剧情窗口最上面有「显示格式」三选一：气泡（和聊天一样）/ 文本框（像酒馆那样：每块顶上信息区——头像、名字、时间、楼层、字数和编辑 / 收藏 / ⋯ 按钮（⋯ 就是长按菜单），下面正文像文档，引号里的对话换颜色；同一个人连着发的合成一个框；下面能选头像位置（居中 / 左右 / 左对齐）和文本框模板（柔和：颜色跟主题 / 毛玻璃 / 书页 / 夜色），楼层字数和编辑按钮能关，最下面的「文本框样式」能用 CSS 再调）/ 自定义（排版和文本框一样，头像位置也能选，但不加颜色和边框，整个剧情窗口都用 CSS 改，像酒馆美化主题）；用户想要什么样子，你可以写好 CSS 用操作块提交）/ 扩展（记忆库权限：是否启用、自动想起几条、能不能自己记、能记哪些类型、短期保留几天、动态是否记入、向量记忆、关系里程碑；每日日记；其他小手机的记录：导入 uwu、ChatGPT、Claude、酒馆等的聊天记录，原文存成档案，也可以分段整理成长期记忆（整理前选每段多大：小段最细次数最多，中段默认，大段次数最少但记得粗一点、模型的最大输出长度要够）；自主活动）。角色一直能看到手机电量（iPhone 拿不到电量就不说）和桌面里的纪念日、日程（只看得到和自己、和用户、和认识的人有关的）。你（MianIN）的本名、人设和头像是固定的，用户在角色设置里改不了，也删不掉你；用户能改的只有「备注」（列表里显示的昵称）和你对 TA 的称呼。消息列表里你固定在最上面，右边有个小助手的标。\n' +
  '· 状态栏（角色设置 → 美化 → 状态栏，打开「回复附带状态栏」；点聊天顶栏的角色名查看，左右滑看最近 10 轮，卡片长的话能上下滑，每条最下面有「删除 / 收藏 / 关闭」，收藏的在「我的 → 收藏」里）：只有一种写法，和酒馆的正则状态栏一样，三样东西配合：① 生成规则（每次回复带给角色，写清楚格式、外层标签、每一项写什么）；② 匹配正则（从角色回复里认出状态栏，每个括号是一项）；③ 美化 HTML（卡片的样子，可以带 <style>、圆环、能点的小标签页，$1、$2… 填第几个括号的内容）；还有可选的卡片外框 CSS。\n' +
  '  从酒馆搬：点「导入酒馆正则」选正则 JSON，正则和美化 HTML 自动填好，再把酒馆里配套的那段状态栏规则（世界书或预设里「按以下格式生成状态栏」那段）贴进「生成规则」，点保存。卡片画不出来、显示成一行行文字时，多半是规则和正则对不上（比如规则里写「♥：」，正则要的是「符号：」；或者外层标签名不一样），让用户把规则里那几个字改成和正则一样，或者把正则改成认规则里的写法。外层标签 <状态栏> 和 [状态栏] 小手机会自动互换。\n' +
  '  自带的「默认」也是这三样；以前用 {{心情}} 占位符写的旧模板照样能用，打开设置时会自动换算成这三样，保存后就是新写法。调好后起个名字「存为预设」，以后在角色设置里一点就能换。用户把正则 JSON、规则用「文件」发给你时，你可以帮 TA 检查对不对得上、改好再给 TA 复制。\n' +
  '· Prompt：系统提示词、预设（只用在剧情窗口，聊天窗口只用系统提示词和世界书；自带的默认预设「Muse · 剧情」上面有「剧情设置」，点选字数、人称、视角、抢话、TA 的内心、文风（从「文风」标签的文风库里挑）、对话和叙述、节奏、格式，下面的条目跟着变，可以「恢复默认」；每条条目可单独开关，可以选放在聊天记录前还是后（后面更管用）；右上可导入酒馆的对话补全预设 JSON）、文风库（「文风」标签：自带十几种文风，能改、能恢复，也能新建自己写的，剧情设置里的文风就从这里选）、世界书（右下「导入世界书」能导入眠花糖机的世界书文件、酒馆世界书 JSON、角色卡里的世界书、uwu 小手机备份；文件夹 + 条目：名称、关键词、内容、注入位置 自动 / 前 / 中 / 后（自动 = 常驻的放前、关键词触发的放中；关键词只看用户最近说的话），条目可单独开关；角色要在角色设置里关联后才生效）、思维链（只管聊天窗口；思考方式三选一：不思考 / 眠花糖机的 / 模型自带的，每个角色还能在便捷拓展栏里单独选；可以选在聊天里显示思考。有的模型不太听话：选「眠花糖机的」可能不写思考或把思考写进正文，选「模型自带的」要模型本身会思考）。提示词、人设、预设、世界书、开场白里都可以写 {{\u200bchar}}（角色名）和 {{\u200buser}}（用户名），发送时自动换成名字。';

var ASSISTANT_CSS_HINT =
  '常用选择器：.phone（整个手机）、.desktop-apps（主页图标区）、.settings-nav（各界面顶栏）、.settings-card（设置卡片）、.section-label（分区标题）、' +
  '.chat-char-card（消息列表 / 通讯录卡片）、.chat-tab-item（Chat 底栏标签）、.chat-msg-bubble（聊天气泡）、.chat-msg-row.user .chat-msg-bubble（我的气泡）、' +
  '.chat-msg-row.ai .chat-msg-bubble（角色气泡）、.cr-time-sep（聊天里的时间）、.cr-bottom-bar 或 .chat-room-bottom（聊天输入栏）、.feed-post（动态卡片）。' +
  '安卓系统顶栏颜色用变量 --system-bar-color（写在 :root 或某个界面上，如 #appChatRoom）。写样式时尽量加 .phone 前缀，颜色和圆角要和现有的粉色系风格协调，必要时用 !important。';

// 聊天室（聊天窗口和剧情窗口是同一套结构）：改头像、排版之前要知道的
var ASSISTANT_ROOM_HINT =
  '【聊天室的结构】聊天窗口和剧情窗口是同一套结构，角色专属样式只在这个角色的聊天室里生效（剧情窗口的样式只在剧情窗口生效），选择器从 #appChatRoom 开始写：\n' +
  '#appChatRoom（整个聊天室）\n' +
  '├ .settings-nav（顶栏）里有 .chat-room-head-av（顶栏头像，角色设置里打开才显示）、.chat-room-title-text（名字和下面那行小字）\n' +
  '├ #chatRoomContent（消息区，背景色 / 背景图在这里）\n' +
  '│  └ 消息列表：聊天窗口是 #chatMsgList，剧情窗口是 #dramaMsgList（display:flex; flex-direction:column）\n' +
  '│     ├ .chat-msg-row.ai（角色的一条）/ .chat-msg-row.user（用户的一条）：display:flex; align-items:flex-end; gap:8px；.user 是 flex-direction:row-reverse（头像在右）。剧情窗口每条还有信息区 .cr-msg-head（气泡格式时藏着），里面是 .cr-head-who（b.cr-head-name 名字、span.cr-head-time 几点几分、span.cr-head-date 完整日期，默认藏着）、.cr-head-meta（.cr-head-floor 楼层 #N、.cr-head-words 字数）、.cr-head-acts（编辑 / 收藏 / ⋯ 三个 button）；正文里引号中的对话是 span.cr-dq\n' +
  '│     │  ├ .chat-msg-avatar（头像，32×32 圆形，头像图片是它的 background-image）\n' +
  '│     │  └ .chat-msg-bubble（气泡：max-width:68%; padding:9px 13px; border-radius:18px; white-space:pre-wrap）\n' +
  '│     ├ .chat-msg-row.cr-narr-row > .chat-msg-bubble.cr-narr（剧情开场的旁白，居中）\n' +
  '│     ├ .cr-time-sep（居中的时间）、.cr-msg-stamp（气泡下面的小时间）、.cr-quote（引用）、.cr-action-note（聊天窗口里 *动作* 的小灰字）\n' +
  '│     └ .cr-recall-notice（撤回、报错这类居中小字）\n' +
  '└ .chat-room-bottom（输入栏；剧情窗口时多一个 .drama-mode）\n' +
  '注意：小手机会按角色设置里的「主题」给气泡上色，规则是 #appChatRoom .chat-msg-row.ai .chat-msg-bubble:not(.error)（优先级很高），' +
  '你写的气泡背景、颜色、阴影要加 !important 才盖得住。' +
  '剧情窗口 format "box"（文本框）和 "custom"（自定义）时，每条 .chat-msg-row 是 display:grid 的一整块：上面是头像 + 信息区 .cr-msg-head，下面是 .chat-msg-bubble（正文，背景透明，像文档）；头像位置是用户在美化页选的（居中 / 左右 / 左对齐，look.boxLayout），文本框还有几套自带风格（look.boxStyle：soft 柔和 / glass 毛玻璃 / paper 书页 / night 夜色 / chapter 章节），楼层字数、编辑按钮可以关（look.boxMeta / boxActs）；' +
  '同一个人连着发的几条合成一个框（后面几条往上贴、不显示头像和名字，选择器是 .chat-msg-row.ai + .chat-msg-row.ai）。文本框的底色、边框画在 .chat-msg-row 上；自定义不上颜色和边框，全靠你写（框的样子写在 #dramaMsgList .chat-msg-row:not(.cr-narr-row) 上）。' +
  '【气泡模板】美化「主题」最上面能选气泡模板（bubble.tpl）：聊天窗口有 默认 / 小尾巴 / 果冻 / 线框 / 毛玻璃 / 贴纸 / 夜色 / 仿siya，剧情窗口气泡格式有 默认 / 仿siya（剧情版）。仿siya 会把整个聊天室换成深色那套：背景铺满、顶栏透明不写字、角色名和签名挪到输入栏上方；颜色都是 #appChatRoom 上的变量，用户想换颜色时改变量最省事：--siya-ai（TA 的气泡）、--siya-user（用户的气泡）、--siya-ink（白字）、--siya-soft（动作 / 叙述的浅色字）、--siya-bar（输入栏和抽屉）、--siya-field（输入框）、--siya-fade（上下渐淡的阴影），比如 #appChatRoom { --siya-ai: rgba(40,90,140,0.92); }。' +
  '【改剧情文本框的要点】每一块是 #dramaMsgList .chat-msg-row:not(.cr-narr-row)（.ai 角色 / .user 用户），grid 的区域名是 av（头像）、head（信息区）、text（正文）：想换上下左右的顺序就改 grid-template-columns 和 grid-template-areas（居中布局是一列 "av" "head" "text"）。' +
  '文本框（box）模板的颜色写在 #appChatRoom .chat-msg-row:not(.cr-narr-row).ai 这种选择器上、正文颜色带 !important，所以在 box 里改框的底色、边框、字色要加 !important；custom 里没有这些，正常写就行。' +
  '信息区里每样都有类名：.cr-head-name 名字、.cr-head-time 时间（几点几分）、.cr-head-date 完整日期（默认 display:none，要用就改成 inline 并把 .cr-head-time 藏掉）、.cr-head-floor 楼层「#12」、.cr-head-words 字数「356 字」、.cr-head-acts 三个按钮（button[data-hact="edit"/"fav"/"more"]，图标是 svg，颜色跟 color 走）；分隔线一般画在 .chat-msg-bubble 的 border-top 上。' +
  '常用做法：引号里的对话换色加粗改 .cr-dq；给名字前后加字用 ::before / ::after（比如 .cr-head-name::before{content:"作 / "}、.cr-head-floor::before{content:"章 "}，就能做出连载小说那种章节式）；毛玻璃用 backdrop-filter:blur()；只想藏楼层或按钮也可以直接在操作块里给 boxMeta / boxActs 写 false。' +
  '写完要照顾到：角色和用户两种块、连着发合成一个框的后几条（.chat-msg-row.ai + .chat-msg-row.ai，信息区是藏着的）、旁白 .cr-narr、深色背景时字要看得清。' +
  '改头像：隐藏用 .chat-msg-avatar{display:none}；换大小改 width / height（同时改 min-width 防挤压）；想让头像在气泡上面，用 .chat-msg-row{flex-direction:column; align-items:flex-start} 和 .chat-msg-row.user{align-items:flex-end}。' +
  '改排版：气泡宽度改 .chat-msg-bubble 的 max-width；整条居中、左右留白改 .chat-msg-row 的 padding / margin。' +
  '提交前在心里按上面的结构过一遍，确认每个选择器都选得到，写完整、不要只写半截。';

function assistantPrompt(char) {
  if (!isAssistantOn(char)) return '';
  var cfg = assistantCfg(char);
  var out = [ASSISTANT_GUIDE];
  var acts = [];

  if (cfg.wb) {
    var folders = wbFolders.map(function(f) { return f.name; });
    var chars = charList.filter(function(c) { return !c.isGroup; }).map(function(c) { return c.charAlias || c.charName; }).filter(Boolean);
    // 现有条目（最多 40 条）：让祂能看出哪条放的位置不合适
    var posName = { auto: '自动', before: '前', middle: '中', after: '后' };
    var entries = wbEntries.slice(0, 40).map(function(e) {
      return '· ' + e.name + '（' + (posName[e.pos] || '前') + '，' + (e.keywords ? '关键词：' + e.keywords : '常驻') + '，约 ' + String(e.content || '').length + ' 字' + (e.enabled === false ? '，已关闭' : '') + '）';
    });
    out.push('【权限 · 管理世界书】用户想要新的世界书设定时，你可以帮 TA 写好并提交；也能改已有的条目（内容、关键词、位置、开关、换文件夹、改名）或者删掉，都用条目名找。现有文件夹：' + (folders.join('、') || '（无）') +
      '；现有角色：' + (chars.join('、') || '（无）') + '。\n' +
      '现有条目' + (wbEntries.length > 40 ? '（前 40 条）' : '') + '：\n' + (entries.join('\n') || '（还没有）') + '\n' +
      '【世界书放哪里】' +
      '自动（默认）：常驻的放「前」、写了关键词的放「中」，大多数情况用它就好。' +
      '前：紧跟系统提示词，适合世界观、基础规则这类一直要知道的底色。' +
      '中：预设后面、聊天记录前面，适合地点、人物、道具、事件这类细节。' +
      '后：放在整段聊天记录最后，影响最强，只适合要角色此刻严格遵守的东西（比如文风、格式要求）；放多了角色会反复提起，长条目也不适合放这里。' +
      '关键词只在用户最近说的话里找，角色自己提到的不会触发；关键词要选用户真的会说出口的词，太常见的词（比如「我」「今天」）会一直触发。' +
      '用户问世界书放哪里，或者你帮忙加条目时，说说你的建议和理由；看到现有条目的位置或关键词不太合适，可以提出来，用户同意了就用 edit_worldbook 帮 TA 改。删条目只在用户明确要删时用。');
    acts.push('<mphone-action>{"type":"add_worldbook","name":"条目名","keywords":"关键词1,关键词2（留空 = 一直生效）","content":"条目内容","pos":"auto|before|middle|after（不确定就写 auto）","folder":"文件夹名（可选，不存在会新建）","link":["要关联的角色名（可选）"]}</mphone-action>');
    acts.push('<mphone-action>{"type":"edit_worldbook","name":"现有条目名","newName":"新名字（可选）","content":"新内容（可选，写了就整段换掉）","keywords":"新关键词（可选，空字符串 = 改成常驻）","pos":"auto|before|middle|after（可选）","enabled":true,"folder":"换到哪个文件夹（可选）"}</mphone-action>（只写要改的那几项）');
    acts.push('<mphone-action>{"type":"del_worldbook","name":"要删的条目名"}</mphone-action>');
  }
  if (cfg.css) {
    out.push('【权限 · 设计界面 CSS】用户想改界面样子时，你可以写 CSS 并提交。target 为 "global" 时作用于整个界面（替换全部全局样式，所以要在现有内容基础上改）；' +
      'target 为角色名时写进该角色的聊天室专属样式（mode 可选 "append" 追加 或 "replace" 替换，默认追加）；再加 "view":"drama" 就是改这个角色的剧情窗口，可以同时用 "format" 把剧情窗口的显示格式换成 "bubble"（气泡）、"box"（文本框：像酒馆那样一整块带框的，CSS 用来调框的样子）或 "custom"（自定义：排版和文本框一样，但不带颜色和边框，样子全靠你写的 CSS，要把背景、顶栏、每一块的框、头像、名字时间、旁白 .cr-narr、输入栏都照顾到）；还可以同时带上 "boxLayout"（头像位置："center" 居中 / "side" 左右，用户在右、角色在左 / "left" 左对齐）、"boxStyle"（文本框模板，只在 box 里有："soft" 柔和，颜色跟主题 / "glass" 毛玻璃 / "paper" 书页 / "night" 夜色）、"boxMeta"（true/false，显示楼层和字数）、"boxActs"（true/false，显示编辑按钮）。用户说想要某种效果时：先想用哪个格式最省事——只想换颜色、换感觉，就选 box + 最接近的模板，再用 CSS 微调；想要模板做不到的整体样子（比如酒馆美化那种章节式、杂志式、复古信纸），就用 custom 从头写，排版先选好 boxLayout 再用 CSS 改细节。' + ASSISTANT_CSS_HINT +
      '\n' + ASSISTANT_ROOM_HINT +
      '\n当前全局样式：\n' + (globalCss ? globalCss.slice(0, 3000) : '（空）') +
      '\n各角色现在的聊天室样式（改之前先看，在这个基础上改；mode "replace" 会整段换掉）：\n' + charList.filter(function(c) { return c.customCss || c.dramaLook; }).slice(0, 6).map(function(c) {
        var dl = c.dramaLook || {}, fmt = { bubble: '气泡', box: '文本框', custom: '自定义', text: '文本框' }[(dl.look || {}).format] || '气泡';
        return '· ' + (c.charAlias || c.charName) + '：聊天窗口 CSS ' + (c.customCss ? '「' + c.customCss.slice(0, 600) + '」' : '（空）') +
          '；剧情窗口格式 ' + fmt + '，剧情窗口 CSS ' + (dl.customCss ? '「' + dl.customCss.slice(0, 600) + '」' : '（空）');
      }).join('\n') + '\n卡片上会自动显示一张缩小版的效果图，用户看了满意就点「应用」，不满意会让你再改。');
    // 各角色现在的状态栏：开没开、正则、美化 HTML、卡片 CSS（太长的截一段），祂改之前先看
    var stLines = charList.filter(function(c) { return c.look && (c.look.statusOn || c.look.statusTpl || c.look.statusCss); }).slice(0, 6).map(function(c) {
      var l = Object.assign({}, DEFAULT_LOOK, c.look || {});
      return '· ' + (c.charAlias || c.charName) + '：' + (l.statusOn ? '开着' : '关着') + '；匹配正则「' + String(l.statusFind || '').slice(0, 200) + '」；美化 HTML「' + String(l.statusTpl || '').slice(0, 800) + '」；卡片 CSS「' + String(l.statusCss || '').slice(0, 400) + '」；生成规则约 ' + String(l.statusRules || '').length + ' 字';
    });
    out.push('【权限 · 状态栏】你可以直接改某个角色的状态栏（set_status，只写要改的那几项）：on（开 / 关）、rules（生成规则：要角色每次写什么、按什么格式）、find（匹配正则，认出回复里那段状态栏，括号里的是 $1、$2）、tpl（美化 HTML，用 $1、$2 填内容，可以带 <style>）、css（卡片 CSS：卡片画在 Shadow DOM 里，这里的 CSS 只管卡片自己，可以用 :host 改卡片外框，也能直接写模板里的类名改里面的样子）。' +
      '想要的只是换个样子，就只改 tpl 或 css；改了格式（字段、标签）要 rules、find、tpl 三样一起对上。字体默认跟着小手机，模板里写 Microsoft YaHei、Arial 这类通用字体会被忽略，要特别的字体就写它的名字（需要的话用 @import 引入）。卡片上会有效果图（拿这个角色最近一条状态栏画）。\n' +
      '现在的状态栏：\n' + (stLines.join('\n') || '（还没有角色开着状态栏）'));
    out.push('【权限 · 气泡】set_css 里还可以顺便换气泡（不写 css 也行）："bubbleTpl"（气泡模板：聊天窗口 plain 默认 / tail 小尾巴 / jelly 果冻 / line 线框 / glass 毛玻璃 / sticker 贴纸 / night 夜色 / siya 仿siya；剧情窗口只有 plain 和 siyad 剧情版仿siya）、"bubblePreset"（颜色预设 0 蓝粉 / 1 紫灰 / 2 橙绿 / 3 白绿）、"bubbleOpacity"（0～100）、"bubbleEffect"（none / shadow-out 外阴影 / shadow-in 内阴影 / glow 发光）、"showAvatar"（true / false，消息旁边的头像）。');
    acts.push('<mphone-action>{"type":"set_status","target":"角色名","css":"卡片 CSS（只改样子时写这个）","tpl":"美化 HTML（可选）","find":"匹配正则（可选）","rules":"生成规则（可选）","on":true}</mphone-action>（只写要改的那几项）');
    acts.push('<mphone-action>{"type":"set_css","target":"角色名","bubbleTpl":"jelly","bubblePreset":1,"bubbleOpacity":80,"css":""}</mphone-action>（只换气泡时 css 留空字符串）');
    acts.push('<mphone-action>{"type":"set_css","target":"global","css":"完整的 CSS"}</mphone-action>');
    acts.push('<mphone-action>{"type":"set_css","target":"角色名","view":"drama","format":"box","boxLayout":"side","boxStyle":"glass","mode":"replace","css":"剧情窗口的 CSS（只换模板和头像位置时可以留空字符串）"}</mphone-action>');
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
    if (!a || ASSISTANT_ACTION_TYPES.indexOf(a.type) < 0) a = { type: 'invalid', raw: body.trim().slice(0, 200) };
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
var ASSISTANT_ACTION_TYPES = ['add_worldbook', 'edit_worldbook', 'del_worldbook', 'set_css', 'set_status'];
function actionTitle(a) {
  if (a.type === 'add_worldbook') return '添加世界书「' + (a.name || '未命名') + '」';
  if (a.type === 'edit_worldbook') return '修改世界书「' + (a.name || '') + '」';
  if (a.type === 'del_worldbook') return '删除世界书「' + (a.name || '') + '」';
  if (a.type === 'set_status') return '修改「' + (a.target || '') + '」的状态栏';
  if (a.type === 'set_css') return a.target === 'global' || !a.target ? '修改全局样式' : '修改「' + a.target + '」的' + (a.view === 'drama' ? '剧情窗口' : '聊天') + '样式';
  return '无法识别的操作';
}
var ACTION_STATE_TEXT = { pending: '等待用户确认', done: '用户已确认，已生效', ignored: '用户忽略了', undone: '用户撤销了', failed: '格式不对，没有执行' };
function actionTextForAI(a) {
  return '〔操作卡片：' + actionTitle(a) + ' — ' + (ACTION_STATE_TEXT[a.state] || '') + (a.error ? '（' + a.error + '）' : '') + '〕';
}
function actionPermKey(a) { return /_worldbook$/.test(a.type) ? 'wb' : (a.type === 'set_css' || a.type === 'set_status') ? 'css' : ''; }
var ACTION_PERM_NAME = { wb: '管理世界书', css: '改美化（CSS / 气泡 / 状态栏）' };
function findWbEntry(name) {
  name = String(name || '').trim();
  return wbEntries.filter(function(e) { return e.name === name; })[0] || wbEntries.filter(function(e) { return String(e.name || '').trim() === name; })[0] || null;
}
function wbFolderIdByName(name) {
  name = String(name || '').trim();
  if (!name || name === '未分类') return WB_NONE;
  var f = wbFolders.filter(function(x) { return x.name === name; })[0];
  if (!f) { f = { id: genWbId('wf'), name: name }; wbFolders.push(f); }
  return f.id;
}
// 气泡那几项（set_css 顺便带的）：只收认得的值；剧情窗口只能用剧情那几个模板
function bubblePatch(a, drama) {
  var o = {};
  if (a.bubbleTpl && typeof BUBBLE_TPLS !== 'undefined' && BUBBLE_TPLS.some(function(t) { return t.id === a.bubbleTpl && (drama ? !t.chat : !t.drama); })) o.tpl = a.bubbleTpl;
  var pr = parseInt(a.bubblePreset, 10);
  if (!isNaN(pr) && typeof BUBBLE_PRESETS !== 'undefined' && pr >= 0 && pr < BUBBLE_PRESETS.length) o.preset = pr;
  var op = parseInt(a.bubbleOpacity, 10);
  if (!isNaN(op)) o.opacity = Math.max(0, Math.min(100, op));
  if (['none', 'shadow-out', 'shadow-in', 'glow'].indexOf(a.bubbleEffect) >= 0) o.effect = a.bubbleEffect;
  return o;
}
// set_status：这个角色的状态栏会变成什么样（只改写了的那几项）
function statusLookPatch(a) {
  var o = {};
  if (typeof a.on === 'boolean') o.statusOn = a.on;
  if (typeof a.rules === 'string') o.statusRules = a.rules;
  if (typeof a.find === 'string') o.statusFind = a.find;
  if (typeof a.tpl === 'string') o.statusTpl = a.tpl;
  if (typeof a.css === 'string') o.statusCss = a.css;
  return o;
}

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
  } else if (a.type === 'edit_worldbook') {
    var en = findWbEntry(a.name);
    if (!en) throw new Error('找不到世界书「' + a.name + '」');
    a.result = { entryId: en.id, prev: JSON.parse(JSON.stringify(en)), prevFolders: wbFolders.length };
    if (typeof a.newName === 'string' && a.newName.trim()) en.name = a.newName.trim();
    if (typeof a.content === 'string' && a.content.trim()) en.content = a.content;
    if (typeof a.keywords === 'string') en.keywords = a.keywords.trim();
    if (['auto', 'before', 'middle', 'after'].indexOf(a.pos) >= 0) en.pos = a.pos;
    if (typeof a.enabled === 'boolean') en.enabled = a.enabled;
    if (typeof a.folder === 'string' && a.folder.trim()) { var before = wbFolders.length; en.folderId = wbFolderIdByName(a.folder); a.result.createdFolder = wbFolders.length > before ? en.folderId : ''; }
    saveWbEntries(); renderWbList();
  } else if (a.type === 'del_worldbook') {
    var de = findWbEntry(a.name);
    if (!de) throw new Error('找不到世界书「' + a.name + '」');
    a.result = { entry: JSON.parse(JSON.stringify(de)), index: wbEntries.indexOf(de) };
    wbEntries = wbEntries.filter(function(x) { return x !== de; });
    saveWbEntries(); renderWbList();
  } else if (a.type === 'set_status') {
    var sc = findCharByName(a.target);
    if (!sc) throw new Error('找不到角色「' + a.target + '」');
    a.result = { charId: sc.id, prevLook: JSON.parse(JSON.stringify(sc.look || {})) };
    sc.look = Object.assign({}, sc.look || {}, statusLookPatch(a));
    saveCharList();
    if (charList[openingChatCharIdx] === sc) { applyChatRoomStyle(sc); if (typeof refreshStatusPanel === 'function') refreshStatusPanel(); }
  } else if (a.type === 'set_css') {
    if (!a.target || a.target === 'global') {
      a.result = { prev: globalCss };
      setGlobalCss(String(a.css || ''));
    } else {
      var c = findCharByName(a.target);
      if (!c) throw new Error('找不到角色「' + a.target + '」');
      if (a.view === 'drama') {
        // 剧情窗口的样式：剧情窗口还没单独设置过时，先照聊天窗口的样子建一套；format 可以顺便换成 文本框 / 自定义
        if (!c.dramaLook) { c.dramaLook = JSON.parse(JSON.stringify(viewLookPart(c, true))); delete c.dramaLook._borrowed; }   // 不带聊天窗口的 CSS
        var dl = c.dramaLook;
        a.result = { charId: c.id, view: 'drama', prev: dl.customCss || '', prevFormat: (dl.look || {}).format };
        dl.customCss = a.mode === 'replace' ? String(a.css || '') : ((dl.customCss ? dl.customCss + '\n' : '') + String(a.css || ''));
        a.result.prevLook = JSON.parse(JSON.stringify(dl.look || {}));
        a.result.prevBubble = JSON.parse(JSON.stringify(dl.bubble || {}));
        dl.look = Object.assign({}, dl.look || {}, dramaLookPatch(a), typeof a.showAvatar === 'boolean' ? { showAvatar: a.showAvatar } : {});
        dl.bubble = Object.assign({}, DEFAULT_BUBBLE, dl.bubble || {}, bubblePatch(a, true));
      } else {
        a.result = { charId: c.id, prev: c.customCss || '', prevBubble: JSON.parse(JSON.stringify(c.bubble || {})), prevChatLook: JSON.parse(JSON.stringify(c.look || {})) };
        if (a.css || a.mode === 'replace') c.customCss = a.mode === 'replace' ? String(a.css || '') : ((c.customCss ? c.customCss + '\n' : '') + String(a.css || ''));
        c.bubble = Object.assign({}, DEFAULT_BUBBLE, c.bubble || {}, bubblePatch(a, false));
        if (typeof a.showAvatar === 'boolean') c.look = Object.assign({}, c.look || {}, { showAvatar: a.showAvatar });
      }
      saveCharList();
      if (charList[openingChatCharIdx] === c) applyChatRoomStyle(c);
    }
  }
}
// 改剧情窗口时一起换的设置：显示格式、头像位置、文本框模板、楼层字数和编辑按钮开关（只收认得的值）
function dramaLookPatch(a) {
  var o = {};
  if (a.format === 'bubble' || a.format === 'box' || a.format === 'custom') o.format = a.format;
  if (a.boxLayout === 'center' || a.boxLayout === 'side' || a.boxLayout === 'left') o.boxLayout = a.boxLayout;
  if (typeof DRAMA_BOX_STYLES !== 'undefined' && DRAMA_BOX_STYLES.some(function(s) { return s.id === a.boxStyle; })) o.boxStyle = a.boxStyle;
  if (typeof a.boxMeta === 'boolean') o.boxMeta = a.boxMeta;
  if (typeof a.boxActs === 'boolean') o.boxActs = a.boxActs;
  return o;
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
  } else if (a.type === 'edit_worldbook') {
    wbEntries = wbEntries.map(function(e) { return e.id === r.entryId ? r.prev : e; });
    if (r.createdFolder && !wbEntries.some(function(e) { return e.folderId === r.createdFolder; })) wbFolders = wbFolders.filter(function(f) { return f.id !== r.createdFolder; });
    saveWbEntries(); renderWbList();
  } else if (a.type === 'del_worldbook') {
    if (r.entry && !wbEntries.some(function(e) { return e.id === r.entry.id; })) wbEntries.splice(Math.min(r.index || 0, wbEntries.length), 0, r.entry);
    saveWbEntries(); renderWbList();
  } else if (a.type === 'set_status') {
    var sc = charList.filter(function(x) { return x.id === r.charId; })[0];
    if (sc) { sc.look = r.prevLook; saveCharList(); if (charList[openingChatCharIdx] === sc) { applyChatRoomStyle(sc); if (typeof refreshStatusPanel === 'function') refreshStatusPanel(); } }
  } else if (a.type === 'set_css') {
    if (r.charId) {
      var c = charList.filter(function(x) { return x.id === r.charId; })[0];
      if (c && r.view === 'drama' && c.dramaLook) {
        c.dramaLook.customCss = r.prev;
        c.dramaLook.look = r.prevLook ? r.prevLook : Object.assign({}, c.dramaLook.look || {}, { format: r.prevFormat || 'bubble' });
        if (r.prevBubble) c.dramaLook.bubble = r.prevBubble;
      } else if (c) { c.customCss = r.prev; if (r.prevBubble) c.bubble = r.prevBubble; if (r.prevChatLook) c.look = r.prevChatLook; }
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
  head.textContent = ({ set_css: '🎨 ', set_status: '📊 ', add_worldbook: '📚 ', edit_worldbook: '📚 ', del_worldbook: '🗑️ ' }[a.type] || '⚠️ ') + actionTitle(a);
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
  } else if (a.type === 'edit_worldbook') {
    if (a.newName) line('新名字', a.newName);
    if (typeof a.keywords === 'string') line('关键词', a.keywords || '（改成常驻）');
    if (a.pos) line('注入位置', { auto: '自动', before: '前', middle: '中', after: '后' }[a.pos] || a.pos);
    if (typeof a.enabled === 'boolean') line('开关', a.enabled ? '打开' : '关掉');
    if (a.folder) line('换到文件夹', a.folder);
    if (a.content) line('内容', '整段换成下面这样');
  } else if (a.type === 'del_worldbook') {
    var dEn = findWbEntry(a.name);
    line('内容', dEn ? String(dEn.content || '').slice(0, 60) + (String(dEn.content || '').length > 60 ? '…' : '') : (a.state === 'done' ? '（已删掉）' : '（找不到这条）'));
  } else if (a.type === 'set_status') {
    var parts = [];
    if (typeof a.on === 'boolean') parts.push(a.on ? '打开状态栏' : '关掉状态栏');
    [['rules', '生成规则'], ['find', '匹配正则'], ['tpl', '美化 HTML'], ['css', '卡片 CSS']].forEach(function(k) { if (typeof a[k[0]] === 'string') parts.push(k[1]); });
    line('改了', parts.join('、') || '（没写要改什么）');
  } else if (a.type === 'set_css' && a.target && a.target !== 'global') {
    if (a.css || a.mode === 'replace') line('方式', a.mode === 'replace' ? '替换原有样式' : '追加到原有样式后面');
    var bp = bubblePatch(a, a.view === 'drama');
    if (bp.tpl) line('气泡模板', ((typeof BUBBLE_TPLS !== 'undefined' ? BUBBLE_TPLS : []).filter(function(t) { return t.id === bp.tpl; })[0] || { name: bp.tpl }).name);
    if (bp.preset !== undefined) line('颜色预设', ['蓝粉', '紫灰', '橙绿', '白绿'][bp.preset] || String(bp.preset));
    if (bp.opacity !== undefined) line('透明度', bp.opacity + '%');
    if (bp.effect) line('效果', { none: '无', 'shadow-out': '外阴影', 'shadow-in': '内阴影', glow: '发光' }[bp.effect]);
    if (typeof a.showAvatar === 'boolean') line('消息头像', a.showAvatar ? '显示' : '不显示');
    if (a.view === 'drama' && a.format) line('剧情窗口格式', { bubble: '气泡', box: '文本框', custom: '自定义' }[a.format] || a.format);
    if (a.view === 'drama' && a.boxLayout) line('头像位置', { center: '居中', side: '左右', left: '左对齐' }[a.boxLayout] || a.boxLayout);
    if (a.view === 'drama' && a.boxStyle) line('文本框模板', ((typeof DRAMA_BOX_STYLES !== 'undefined' ? DRAMA_BOX_STYLES : []).filter(function(s) { return s.id === a.boxStyle; })[0] || { name: a.boxStyle }).name);
  }
  var pre = document.createElement('pre');
  pre.className = 'cr-action-pre';
  pre.textContent = a.type === 'add_worldbook' || a.type === 'edit_worldbook' ? (a.content || '') : a.type === 'del_worldbook' ? '' : a.type === 'set_css' ? (a.css || '') :
    a.type === 'set_status' ? [['rules', '生成规则'], ['find', '匹配正则'], ['tpl', '美化 HTML'], ['css', '卡片 CSS']].filter(function(k) { return typeof a[k[0]] === 'string'; }).map(function(k) { return '【' + k[1] + '】\n' + a[k[0]]; }).join('\n\n') : (a.raw || '');
  if (!pre.textContent) pre.style.display = 'none';
  // 改状态栏：用这个角色最近一条状态栏照新写法画一张（画不出来就只给代码）
  if (a.type === 'set_status' && typeof statusPreviewEl === 'function') { var sp = statusPreviewEl(a); if (sp) { body.appendChild(sp); pre.style.display = 'none';
    var sBtn = document.createElement('button'); sBtn.className = 'cr-action-code-btn'; sBtn.textContent = '看代码';
    sBtn.addEventListener('click', function(e) { e.stopPropagation(); var on = pre.style.display === 'none'; pre.style.display = on ? '' : 'none'; sBtn.textContent = on ? '收起代码' : '看代码'; });
    body.appendChild(sBtn); } }
  if (a.type === 'set_css' && typeof cssMiniPreview === 'function') {
    // 改样式的不给看代码（用户要的）：直接放一张缩小版的效果图；代码收在「看代码」里
    var mini = cssMiniPreview(a);
    if (mini) body.appendChild(mini);
    var codeBtn = document.createElement('button');
    codeBtn.className = 'cr-action-code-btn';
    codeBtn.textContent = '看代码';
    pre.style.display = 'none';
    codeBtn.addEventListener('click', function(e) { e.stopPropagation(); var on = pre.style.display === 'none'; pre.style.display = on ? '' : 'none'; codeBtn.textContent = on ? '收起代码' : '看代码'; });
    if (a.css) body.appendChild(codeBtn);   // 只换气泡、没写 CSS 时没有代码可看
  }
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
    var confirmNow = function() {
      try { runAction(a); delete a.error; done('done', '✓ ' + actionTitle(a)); }
      catch (err) { a.error = err.message; showToast('✗ ' + err.message, 'error'); paintActionCard(card, m); }
    };
    if (a.state === 'pending') btn('忽略', 'ghost', function() { done('ignored'); });
    btn(a.type === 'set_css' || a.type === 'set_status' ? '应用' : a.type === 'del_worldbook' ? '删除' : '确认', 'primary', confirmNow);
  }
  card.appendChild(foot);
}

// 消息列表里「[操作] …」的预览要用到本文件的函数，加载完重画一次
renderChatCharList();
