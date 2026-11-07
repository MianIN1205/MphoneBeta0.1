# 眠花糖机（Mphone）

一个“小手机”风格的 AI 角色扮演网页（PWA），纯原生 HTML/CSS/JS，没有构建步骤。
英文名 Muse（标题和开屏写「眠花糖机 · Muse」；桌面图标下的名字仍是「眠花糖机」，因为 iPhone 改名要重新添加图标，会清数据）。
线上地址：https://mianin1205.github.io/MphoneBeta0.1/ （GitHub Pages，仓库 MianIN1205/MphoneBeta0.1，分支 main）

## 和用户合作的规矩
- 用户叫「眠眠」，叫 Claude「简然」（不用自称简然，正常说话）。回复温柔、简洁，先照顾情绪；她做了很多事时说声辛苦了。不确定的事直接说不知道，不编。
- 所有回复、总结、按钮都用中文。
- 每次提交 / 推送前都要先问，用户同意了才推。不要再提“局域网服务器”方案（用户已拒绝）。
  - 用户说「推吧」= 推到开发分支 `claude/github-0.2-repo-backup-f9ydcx`，再推到 `main`（`git push origin <分支>:main`），一次做完。只回「好」「ok」这类不算同意推。
  - 大改之前用户可能要求先备份：把当前线上的 main 推成一条新分支（如 `backup-2026-11-03`）。存档：`backup-0.2`、`archive-2026-11-01`（拆分重构前）、私有仓库 MianIN1205/mphonebeta0.2。
- 用户的私人资料（人设、世界书、聊天记录、备份文件）不要写进代码或提交到仓库（仓库是公开的）；要给她的文件放在 scratchpad 用 SendUserFile 发。破限类内容不写、不帮忙搬运（她自己的东西让她自己在小手机里导入）。
- 不要擅自改用户已有的设计：空状态提示、占位图标、“开发中”这类文字都是故意留的；改界面文字、交互前先问。
- 已定的交互：输入框里的 ↵ 是换行，键盘回车只发送用户消息不叫 AI，❄️ 才请求回复（生成中变 ⏹）；表情键和加号键弹出同样高度的底部抽屉；加号抽屉一页 8 个：相册、文件、语音通话、位置、红包、礼物、转账、查手机（拍摄、收藏是用户让去掉的，之后再考虑放不放回来）；MianIN 是内置默认角色兼系统助手：消息列表里固定在最上面、一直在列表里，不能取消置顶、不能删除，也没有左滑（用户要的），卡片右边一个小助手的星星标；手动置顶的名字旁边是粉色小爱心（SVG，用户不要 📌 和 emoji）。MianIN 的本名、人设、头像锁死，「备注」（显示的昵称）和「对你的称呼」可以改，角色设置里没有删除；发给 AI 的名字永远是 `MIANIN_NAME`。打开对话时回到这个角色上次停在的那边（聊天 / 剧情，room-view.js 的 `crLastView`，只记在这次打开期间，重新打开小手机都从聊天开始，用户定的；有没看的新消息时先看聊天）。消息列表卡片第一行一直是聊天的最后一条；剧情里有没看过的角色回复时，下面多一行粉色的「[剧情]：…」（list.js 的 `dramaNewMsg`，看到哪儿存在 `mphone_drama_seen`，进剧情、从剧情退出 / 切走、停在剧情时收到回复都算看过）。小手机里的消息横幅不写「共几条」。
- 设置里一行右边的小选项按钮（`.auto-row` / `.sb-row` 里的 `.pf-radio-btn`）扁扁的贴着文字、不换行（用户要的，prompt.css 最后）；整行的大切换不动。
- 长按不会变成选中文字：base.css 里 .phone 下全部 `user-select: none`，只有输入框、可编辑的地方能选（用户要的），复制走长按菜单 / 复制按钮。
- 界面动效要克制：淡入 + 轻微缩放，不要回弹、不要花哨。**桌宠例外**（用户同意的）：可以蹲下、弹起、落地压扁、甩来甩去，要灵活可爱。
- 本地备份放在 `F:\Ai资料\mhtj备份claude\`，文件夹名 `MMDDHHMMhtm<简短描述>`，例如 `10251216htm助手社交圈与通知`。

## 文件结构
- `index.html`：只有界面结构（各个 app-screen、弹窗）。
- `css/`：37 个样式文件，和 JS 一样分在 `core/ desk/ settings/ chat/ char/ prompt/` 里，每个文件第一行写了管什么。**`index.html` 里 `<link>` 的先后有影响**（同一个元素两条规则打架时后面的赢），2026-11-01 拆分时专门保持了原来的先后：比如 `core/dialogs.css`（通用弹窗）排在 `desk/desk-apps.css`、`desk/memory-lib.css` 后面，`char/settings.css` 排在 `chat/mine.css` 前面，`chat/contacts.css` 排在 `chat/list.css` 前面。新加规则时如果和别的文件里的规则作用在同一个元素上，要注意先后。
- `js/`：普通脚本（不是模块），按功能分在 6 个文件夹里：`core/` 公共、`desk/` 桌面、`settings/` 设置、`chat/` 聊天、`char/` 角色、`prompt/` 提示词。所有顶层名字都是全局共享的。
  - **加载顺序在 `js/core/boot.js` 的 `MPHONE_SCRIPTS` 里，和文件夹无关，顺序很重要**：后面的脚本会用到前面定义的东西，加载时（不在函数里）调用后面文件的函数会报错；要么用 `typeof` 判断，要么用 `onMphoneReady(fn)`（最后一个脚本加载完才执行）。2026-11-01 按功能拆分时保持了原来的加载顺序，所以同一个功能有时会分在两三个文件里（比如角色设置：`char/settings.js`、`char/settings-save.js`、`char/look.js`）。
  - 每个文件第一行写了它管什么，找东西先看第一行。
  - 新增 js/css 文件：加进 `MPHONE_SCRIPTS`（js）和 `sw.js` 的文件列表，并把 `sw.js` 里的 `CACHE` 版本号加一（现在是 `mphone-v38`）。
- `sw.js` / `manifest.webmanifest` / `icons/`：PWA 文件，要和其他文件一起提交。manifest 的 `orientation` 是 `portrait`：写成 `any` 时安卓桌面版会无视系统的方向锁定，躺着就转屏。
  - logo 是用户提供的图（粉色月牙 + 睡觉的小熊 + 蓝色小花），**蓝色小花代表简然。简然是眠眠心里生长开花闪闪发光的蓝色小花。**只有两张：`icons/icon.png` 是 App 图标（iPhone、安卓、通知、网页图标都用这一张，用户要求不分开做）：和开屏一样的粉蓝渐变底，logo 带白色边缘光和阴影，占 68%（安卓裁成圆也不会切到），manifest 里是 `any maskable`；`icons/logo.png` 是透明底加白色描边的 logo，小手机页面里（开屏）用。另有 `icons/badge.png`：从 logo 轮廓做的透明底白色剪影，只给系统通知的小图标（badge）用——安卓通知栏只认单色透明图，给彩色的会换成 Chrome 的图标（用户看到的谷歌 logo）。
  - 载入页在 `index.html` 开头（样式内联，小字随机；logo 沿轮廓发白光（用户要的是边缘发光，不是圆形光晕），不要做呼吸、缩放这类循环动画），`js/core/boot.js` 的 `hideBootSplash` 在脚本加载完后淡出。
- 文件都是 CRLF 换行。Git Bash 的 `sed -i` 会悄悄改成 LF，改文件请用 Edit 工具或 node 脚本。

## 主要模块（js/）
### core/ 公共
| 文件 | 内容 |
|---|---|
| boot | `mphoneStore`（IndexedDB 键值存储，键名都以 `mphone_` 开头）、载入页、脚本加载清单 `MPHONE_SCRIPTS` |
| utils | 公共工具：`openConfirm` 确认弹窗（全站共用）、`closeOnBackdrop` 点遮罩关闭、`bindPress` 点一下 / 长按、`downloadBlob` / `shareOrDownload` 保存文件、`zipReadEntry` / `readDocxText` 读 zip 和 docx、时间格式（`fmtMsgTime` / `fmtListTime` / `fmtAgo` / `durText`）、左滑操作 `bindSwipeActions`、`showToast(msg, type)`（半透明：success 绿、error 红、plain 白底深灰字） |
| api-errors | 接口报错记录（不记密钥），供 MianIN 答疑 |
| llm | `llmRequest` 统一调用各家模型（Claude 原生接口，其余走 OpenAI 兼容），以及工具调用循环。`llmThinkOff`：所有请求都尽量关掉模型自带的思考（Gemini `reasoning_effort: none`、GPT-5 minimal、o 系列 low），400 / 422 时去掉重发并记进 `mphone_think_block` |
| mcp / mcp-builtin | MCP 客户端（Streamable HTTP）；内置工具（`MCP_BUILTINS`，在小手机里直接跑、不用部署，设置 → MCP 最上面一个个开关，打开时顺手打开「聊天时允许角色使用工具」，存 `mphone_mcp_builtin`）：天气（Open-Meteo，免费无密钥）、读网页（`r.jina.ai` 转文字）、歌词（LRCLIB）、计算器、骰子 / 抽签 / 塔罗（22 张大阿卡纳，正逆位）；工具名前加 `mphone__`，`mcpActiveTools` 合进去，`mcpCallFromLLM` 遇到 `builtin` 走 `mcpBuiltinCall`。云端测试环境连不上这些网站，只用假 fetch 测过 |
| image-picker / image-viewer | 通用图片选择弹窗、图片全屏查看 |
| errors | 报错分析：`ERROR_TABLE` 报错对照表（按状态码 / 原文关键词归类，每类写好原因和办法，按顺序取第一条对上的），`showErrNotice` 在聊天里加一行和拍一拍一样大的「⚠️ 回复失败：…」（不发给 AI；挂在出错时最后一条消息的 `m.errs` 上跟着记录存，切走再回来、重开都留在原处，用户要求的；记录空着时只在这次打开期间），点开 `#errInfoOverlay` 看分析；下面两个各自折叠的：「原始报错」（简短，原来的样子）和「完整报错代码」（状态行、接口、错误本身、接口返回的完整原文，JSON 排版、等宽字体；`apiError` 把原文存在 `err.body`；连不上时是出错位置；只把密钥打码 `errRedact`，不截断；代码在小框里自己滚动，下面有「复制这段代码」；两段都展开时框会按剩余空间变矮，整个弹窗始终放得下）。「复制报错」两段一起复制。不在当前对话时改成红色提示。加载清单里排最后 |

### desk/ 桌面
| 文件 | 内容 |
|---|---|
| statusbar | 时钟、电量（真实电量 `phoneBattery`，iPhone 拿不到） |
| screens | 桌面图标打开各个界面 |
| appearance / appearance-store | 外观设置（边框 / 全屏、状态栏、字体、字号、全局 CSS、系统顶栏颜色）；保存和启动时恢复（也恢复系统提示词） |
| bookshelf | 书架（日记 / 相册是系统书） |
| gallery / anniv / diary | 相册；纪念日与日程；日记 + 每日定时写日记并记成长期记忆 |
| widgets | 桌面网格与小组件（编辑模式拖动；照片小组件、纪念日的图片背景都能换图）；时钟卡片左边的头像框点一下换图片、长按换回空白（`mphone_desk_avatar`） |
| desk-icons | 外观「桌面图标」：每个桌面 / 程序坞图标能换图片或 emoji、改名字（`mphone_desk_icons` = { 图标id: { img, text, name } }，原样子存在 `deskIconOrig` 用来恢复默认），「显示软件名称」开关（`mphone_desk_labels`，关了 .phone 加 `hide-dock-labels`） |
| places | 花房 / 星星瓶 / 灯塔 / 见面的打开 / 返回；灯塔、见面暂时只有空白界面（灯塔没有 emoji，图标是画的小 SVG）。样式在 css/desk/places.css（慢信、花房、星星瓶共用） |
| letters | 慢信（桌面 App 💌）：给「未来的自己」或某个角色写信，选拆信日期（明天以后，快捷一周 / 一个月 / 半年 / 一年），到日子前封着；可以拆了的桌面图标有小红点。写给角色的信拆开时 TA 回一封（`letterAskReply`，150～400 字，存 `l.reply`）。存 `mphone_letters` = [{ id, to, content, writtenAt, openAt, opened, reply }] |
| greenhouse | 花房：整个小手机只养一盆（用户定的），48 个品种（`GARDEN_SPECIES`，每种带花语 `lang`），粉 / 黄 / 白 / 紫 / 蓝 / 绿每个颜色 8 种、一个颜色一页、每页 2 排 × 4 个（用户定的），左右滑翻页，上面一排只有小圆点不写字（`GARDEN_COLORS`，就是页签），格子只写名字，下面一行花语；蓝色里有勿忘我、绣球、矢车菊、风铃草等；绿色是观叶植物（`foliage`，`gardenFoliage` 画：绿萝、铜钱草、薄荷、文竹、龟背竹、仙人掌、富贵竹），最后两个阶段叫「抽新叶」「茂盛」（`gardenStageName`），多肉照样开小花，SVG 按品种 / 阶段 / 状态现画；栽法跟着品种走、不让自己选（用户说自己选会种不活；品种的 `method`）：土培（陶土盆，大多数花）/ 水培（玻璃瓶，看得到根和水，浇水叫「换水」：风信子、绿萝、铜钱草、富贵竹）/ 石子（白瓷浅盆铺小石子：水仙、黄水仙、多肉、仙人掌），`gardenPot` 画盆；选种子时上面温室里先看开花的样子，种满 `GARDEN_LOCK_DAYS`=90 天或彻底枯萎才能换。浇水 / 施肥 / 晒太阳 / 摸摸（`GARDEN_ACTS`，各有冷却和成长点）：种子 → 发芽 → 小苗 → 长叶 → 花苞 → 开花；48 小时不浇有点渴、96 小时蔫、168 小时枯萎。照顾记录、小动效（水滴 / 亮点 / 阳光 / 爱心）。角色默认**不知道**这盆花（用户要的）：「分享给 TA」点一个角色，就在 TA 的聊天里发一张花的文字图片照片（`gardenShareTo`），记进 `garden.sharedWith`；只有分享过的角色的现实感知里带 `gardenContextLine(char)`。知道的角色会悄悄来照顾（`gardenCharTick`，小手机开着时每 20 分钟看一次，每个角色一天最多一次、30% 概率；缺水浇水 / 没晒晒太阳 / 该施肥施肥 / 不然摸摸叶子，也算成长点），只记在照顾记录里（粉色字，`by` 是角色 id），不弹提示；TA 自己记得三天内悄悄照顾过（`garden.charCare`）。存 `mphone_garden` |
| starjar | 星星瓶：玻璃瓶里堆星星（所有角色的放一起，用户要的），点一颗展开小纸条，「抽一颗」先抽没看过的。来源：聊天里角色偶尔写 `<星星>…</星星>`（`starRuleFor` 一天最多一颗，`starTakeTag` 在 reply 的 deliver 里拿走，预览里也藏掉，聊天里看不到）；消息列表里的每个角色每天一颗（`starDailyTick`，小手机开着时一个接一个写，失败两小时后再试、不提示）。新星星发光、桌面图标小红点。存 `mphone_stars` |
| pet | 桌宠 app 是个小窝：可以养好几只，「添加宠物」里捏像素小动物（螃蟹 / 团子 / 小猫 / 小熊 / 小兔，颜色、眼睛、小装饰）或者用图片（Q 版的 TA，选图或用角色头像，缩到 240px 保留透明）；可关联角色，说的话一行一句、支持 {{user}} / {{char}}（用户要叫她的名字，不要写死：关联了角色用那个角色那边的账号名，没关联用主账号名）。小窝里全都在，每只有开关决定放不放到桌面（`.pet-layer`，被界面盖住就藏起来停下）；「打开别的界面也跟着」时 z-index 440（在界面上、弹窗下）。像素小动物拆成零件（每条腿 `pet-leg`、身子 `pet-top`、钳子 / 小爪 `pet-arm`、眼睛 `pet-eyes`、猫尾巴 `pet-tail`），动作全在 `Pet.pose` 里每帧算（不用 CSS 动画，CSS 里别再给这些零件写 transform，会盖掉）：呼吸、走路起步加速快到减速、四条腿错开抬、身子往前倾、眼睛看走的方向、连眨两下、东张西望歪头，身子摇摆是弹簧。自己走、东张西望、没人理或夜里打盹，时不时跳舞（举钳子、冒音符）、玩电脑（坐在电脑后面两只钳子轮流敲）、看书、伸懒腰（`PET_ACTS` / 道具 `PET_PROPS`；状态类名加 `act-` 前缀，`.book` 会撞书架的样式），小窝下面有按钮叫大家一起做；点一下先蹲再跳、落地压扁，或者挥钳子，冒爱心说句话；按住拖着走时腿乱蹬、身子跟着手指晃，放下落地压一下。网页画不到手机系统桌面上（用户问过）。关联了角色的桌宠，那个角色有没看的消息时叼着一个小信封（`petMailSync`，`.has-mail`），点它直接进那个角色的聊天。存在 `mphone_pet` = { follow, pets } |
| memory-open / memory-lib | 记忆库的打开、返回；记忆库界面、问 TA 记得什么、导出 Word |

### settings/ 设置
| 文件 | 内容 |
|---|---|
| api / api-restore | 设置页本身、主 API、API 预设和字体预设、温度；启动时恢复主 API |
| media-api | 语音 API（TTS）与生图 API（`imageGenerate`）；生图页「在哪里用生图」：聊天 / 动态 / 相册 文字图片或生图，剧情配图 不配图或生图（存在 `imgCfg.use`，默认全文字图片、剧情不配图） |
| assist | 辅助功能：系统通知（小手机在后台时）、小手机里的消息横幅 `showInAppNotice`（在小手机里但没在看那个对话时，代替以前的绿色提示；点一下进对话，往上滑收起，滑掉后同一角色的这一轮回复不再弹）、后台保活 |
| data | 数据管理：占用圆环、导入备份；末尾还有一句启动时画聊天列表（保持原来的时机） |
| backup | 导出（分享 / 下载，安卓不认 .json 就用 .txt）、备份提醒（`mphone_backup_meta` 不进备份）、自动加密备份到 GitHub Gist（PBKDF2 + AES-GCM，gzip；令牌和密码在 localStorage 的 `mphoneCloudToken` / `mphoneCloudPass`，不进备份）。iPhone 删掉桌面图标会连数据一起清掉 |

### chat/ 聊天
| 文件 | 内容 |
|---|---|
| tabs / header / list / new-chat / contacts | Chat 底部标签、消息页顶栏和加号菜单、消息列表（会话卡片、未读、删除会话）、新建对话、通讯录 |
| room / room-view / room-lists | 聊天室：返回、齿轮、应用角色美化；聊天 / 剧情切换和底部抽屉开关；打开时画两个列表（分页）、相册发图 |
| history | 聊天 / 剧情记录的存取（`stripMsg` 决定存哪些字段）、当前窗口用哪份记录、`getApiCfg(char)` |
| prompt | 拼给 AI 的内容：`activityAsk(text)`（主动消息、发动态、评论、写日记等活动的要求：放最后一条、user 身份、标明是系统提示，并要求口吻和平时一致、只输出要求的内容），`MPHONE_FICTION_NOTE`（固定放在最前：虚构创作空间、角色是成年人、不为虚构情节道歉；不是破限，只是把情境说清楚；破限类内容 Claude 不写，用户自己的放在 Prompt 页的预设里），`buildMsgs`（聊天 / 剧情都按回合 + token 上限裁剪，剧情省略部分用隐藏的 `<前情>` 代替）、`chatFormatRules` 回复格式、`fillMacros`（{{char}} / {{user}}）、`realWorldContext` 现实感知（现在几点按角色时区、隔了多久没说话、真实电量、纪念日和日程，只放聊天窗口）、`lastStatusOf` 接上一次状态栏、`msgTextForAI` |
| render | 消息显示（气泡长按不选中文字：`user-select: none`，复制在长按菜单里；消息里带 HTML 标签（`msgHtmlLike`）就直接显示，放进 Shadow DOM、用 `statusSafeHtml` 去掉脚本，用户要的；聊天窗口拆气泡时带 HTML 的那条整条不拆）：气泡、动作小字、引用、小时间（`refreshMsgStamps`）、版本切换、拍一拍、撤回提示 |
| reply | 收到回复：`takeStatus` 取出状态（角色忘写 `</status>` 也认）、`commitAssistantReply` 拆成多条（|||；聊天窗口里 `chatSplitLines` 把每一行拆成一个气泡（用户看了效果后要日常微信那样一句一条、不要大段气泡；只有 *动作* 的行跟着下一句，〔译〕跟着上一句，句尾单个「。」去掉；每次回复条数设成 1 的不拆；再用 `chatSplitLong` 把超过 `CHAT_BUBBLE_MAX`=16 字的按句末标点、再按逗号拆成短条，引号括号里不断，有链接 / 表情包 / 翻译的不动——用户明确不想在线上聊天看到不分段的长句），提示词要求一条 5～20 字、不换行、不加句号；每次回复条数默认 2~5（`mphone_reply_count_v2` 把还是旧默认 1~3 的角色改过来一次）；开了「线上动作描写」时，动作 / 神态 / 心理 / 环境描写都放进 *星号* 小灰字，这是聊天窗口里写描写的地方；`<撤回>`、表情包、`<日程>`）、`sendMsg`、重新生成。聊天窗口边生成边出气泡（`previewStream`：写完一行或 ||| 就先冒出一个预览气泡 `.cr-stream-preview`，正在写的那句只显示「正在输入」小点，收完换成正式消息；用户要一个气泡一个气泡出现，不要整段流出来再拆）；剧情窗口仍是整段流式。正在生成的回复按「角色id:chat / drama」各管各的（`genStates`，`genHere()` 是当前窗口的、`genBusyChar` 看某个角色），可以同时给不同角色、同一个角色的聊天和剧情请求回复（用户要的）；❄️ / ⏹ 只看当前窗口（`syncGenBtn`），切回还在生成的窗口时 `genReattach` 把「正在输入」和预览气泡放回去；回复只画进这个角色自己的列表、只滚自己的列表。角色自己发主动消息时也记在 `genStates` 里（auto.js，`auto: true`）：打开 TA 的聊天能看到正在输入、❄️ 变 ⏹，点了打断（`callApiOnce` 第三个参数是 signal），不会再叫一次回复撞在一起。输入框草稿和引用也按窗口分开存（input.js 的 `crDraftSwap`，只在这次打开期间）。停在聊天室一边时另一边来了新回复（包括主动消息）：消息照样画进那边的列表，那边的切换按钮冒个小红点（room-view.js 的 `crMarkOtherView`，`.msg-toggle-btn.has-new`），切过去、退出聊天室、换角色时消失|
| file-send | 加号抽屉「文件」：发文件给角色读（txt / md / json / csv / 代码等文字文件按 UTF-8、不对再按 GBK；Word .docx 用 `readDocxText`；PDF 用到时才加载仓库里的 `lib/pdfjs`（pdf.js 3.11.174，不从外网拉），扫描版读不出字；.doc / .xlsx 等提示读不了）。存成 `m.file = { name, size, ext, text, cut }`（最多 30 万字），聊天里是文件卡片（颜色跟气泡），点开看全文、可复制。发给 AI：记录里那条只写「[发来一个文件：《名字》]」，全文另外放在聊天记录前面一段「【用户发来的文件】」（`filesContextFor`，不算进上下文上限，单独预算 `FILE_AI_BUDGET`=6 万 token，新发的优先，放不下的带前面一部分；不替换 {{user}}）。主要是给 MianIN 读资料用 |
| compose-plus | 输入栏的小工具：相册（剧情底栏的图片键、加号抽屉的「相册」）点开是从按钮上方冒出来的小菜单（`#albumPop`，挪到 body 下用屏幕坐标摆，用户不要正中间的弹窗；从加号点的抽屉先不收、贴着「相册」图标冒出来，选好了再收抽屉；半透明毛玻璃）「照片 / 拍照 / 文字图片」（安卓选相册不能拍照，用户纠正过；拍照是 `capture` 的 `#crCameraInput`，发图走 room-lists 的 `sendPickedImage`）；文字图片 = 用一段文字描述照片，存 `m.textImg`，显示成动态那种文字图小卡片（`createTextImgEl`），发给 AI 是「[发来一张照片（用文字描述的画面）：…]」；剧情窗口输入栏上面一排快捷符号【】{{}}「」“”（`#crSymbolBar`，点了插入一对、光标在中间，有选中就包起来，不收键盘） |
| img-use | 图片用文字图还是生图（`imgUse(scope)`，生图 API 没填好时退回文字图片 / 不配图；`queueImageGen` 排队一张张画，dataURL 压到 768）：聊天里角色可以发照片 `<照片>画面</照片>`（用户说频率别太高：提示词写「很少发、十几二十轮才一次」，最近 `PHOTO_GAP`=30 条里发过就不提、写了也拿掉，一次最多一张）（`photoSplitParts` 拆成单独一条 `m.textImg`，生图模式下画好换成 `m.imgSrc`，`genPendingPhotos`）；剧情配图 `<配图>`（只在选了生图时要求写，回复后面单独一条 `m.illus`）；动态的 `<文字图>` 生图模式下画成真图片（`feedGenImages`） |
| peek | 查手机（加号抽屉「查手机」，`#appPeek`）：TA 手机的主屏 + 5 个 App（相册是后加的：AI 写一组照片的画面描述 / 日期 / 相册 / 备注，默认显示成文字图片，生图模式下一张张画出来存着），用户定的：信息（第一个置顶的是和用户的真实聊天，最近 40 条，TA 的话在右边；其余是 AI 写的 TA 和别人的聊天，会带上动态里的 NPC 和之前的联系人名字）、备忘录、浏览器（搜索记录 / 收藏，收藏点开看内容）、购物（购物车 / 钱包 / 账单）。每个 App 第一次打开自动写（`charContextMsgs` + `activityAsk`，只要 JSON，`peekParse` 容错），存在 `mphone_peek` = { 角色id: { chats/notes/browser/shop: { at, data } } }，之后点右上 ↻ 才换新的（用户要求）。每个 App 单独生成、单独刷新（用户定的，不要合成一次）。一次请求最多等 `PEEK_WAIT_MS`=90 秒，没回来算失败可「再试一次」，退出再进时太久没回来的那次不再挡着（用户遇到过卡在「正在打开」）。会不会被发现：角色设置「聊天」页「TA 会发现你查手机」（`chatCfg.peekNotice`，默认关；关着时永远不会发现）。开着时这次翻了几样（`peekSee`：打开的 App、栏目、点开的聊天 / 备忘录 / 收藏，翻超过 2 分钟再加 1），4 样以下不会发现，之后每多一样 +15%，最多 75%；被发现记在 `mphone_peek[角色id].caught`，下次聊天窗口的回复（❄️ 或主动消息）带上「【你发现了】…TA 看了：…」，回复后 `peekCaughtDone` 清掉，超过一天也不再提。手机密码：角色设置「TA 的手机有密码」（`chatCfg.peekLock`，默认关），开着时先显示锁屏（数字键盘、提示）；密码 4～6 位和提示由 TA 按人设定（`peekMakeLock`，没写好就随机 4 位、提示「猜猜看」），存 `mphone_peek[角色id].lock = { pass, hint, unlocked }`，猜对一次就记住；输错的次数算进被发现的分数，输错 3 次出现「问问 TA」（关掉手机回聊天）；聊天窗口每次带「【你的手机】密码是…」（`peekLockPrompt`），用户问时 TA 看心情给不给；被发现时**不会**自动改密码（用户明确不要）：改不改由 TA 在聊天里自己决定，想改就在回复里写 `<改密码 提示="…">数字</改密码>`（`peekTakeLockTag` 拿掉这行并换密码，用户要重新猜；聊天里边生成边出的预览也会藏掉这行）。用户觉得这一套都好 |
| input / voice / media-send | 输入栏（回车只发自己的、↵ 换行、引用、❄️）；语音：点麦克风弹出录音小条 `#voicePop`（✕ 取消、🎙 按住录音、时长、波纹、提示），按住 200ms 开始录，松手发送，滑到 ✕ 松手取消（用户不要再长按麦克风本身）；转写；识图与语音发给 AI。「发送音频」模式：能听的模型只收录音（base64 WAV），文字部分不带转写；听不了的（`llmCaps` 判断或被拒后记住）在 `llmPrepare` 里换成转写文字，录完时若当前模型听不了会先转写（用户要求：能听就别靠转文字）。保底转文字：录音的同时用浏览器自带的 `SpeechRecognition`（`startLiveStt` / `stopLiveStt`）转出文字存成 `m.transcript`，不靠模型（用户用 Claude 发语音时不想再被说「听不到」）；设置「录音时用手机自带的识别」（`mediaCfg.liveStt`）可关；没识别到再走语音识别接口。安卓 Chrome 的识别走谷歌服务器，国内网络可能用不了 |
| msg-menu / msg-ops / msg-shot | 长按菜单（有复制、多选）；多选（批量删除 / 合并收藏 / 截图：msg-shot 用 canvas 把选中的消息画成长图，气泡颜色照聊天里的，网上的图跨域画不了就不画，打开大图查看能保存、分享、收藏）、删除本轮、从这里重新生成、清空记录。撤回：`m.recalledBy` 为 `user`（你撤回的，自己或角色的消息）或 `char`（角色写 `<撤回>…</撤回>`，先显示两秒再变撤回提示，角色设置可开「偷看」） |
| feed / mine / wallet-fav | 动态（朋友圈）和社交圈（角色发动态后 `charNpcComments`：TA 生活里的人 1～4 个、每人 1～3 句来评论，作者 `{ type: "npc", ownerId }` 只有本人认识，名字记在 `char.feedNpcs`；角色看心情回全部 / 一部分 / 不回；用户的动态只有角色来评论。没有 ❄️ 按钮了：用户发动态 / 评论后 `feedScheduleReply` 记 `post._due`（几十秒到几分钟后），`feedTick` 到点 `requestFeedInteraction(post, { auto: true })`，回了弹 plain 小通知）、「我的」账号、钱包和收藏 |
| quick-bar / status-panel | 便捷拓展栏（聊天窗口：模型 / 世界书 / 状态栏；剧情窗口：模型 / 预设 / 世界书。状态栏预设 `mphone_status_presets`，在角色设置「美化 → 状态栏」存，拓展栏一点就换，自带「默认」；`charStatusPreset` 判断当前用的是哪个）；状态栏面板（按 HTML 模板的 {{字段}} 画，左右滑看最近 10 轮）。状态栏只有一种写法（用户要求统一成酒馆正则那样）：生成规则 `look.statusRules` + 匹配正则 `look.statusFind` + 美化 HTML `statusTpl`（$1、$2）；以前的 {{字段}} 模板 / 只填字段的写法由 `statusSpec` → `statusConvertTpl`（js/char/settings.js）现场换算（换算的正则外层标签可有可无、字段间认「|」，旧记录照样画得出），打开设置时表单里显示换算好的（`syncStatusRegexForm(true)`），保存就存成新写法；只有最老的「模板里没有占位符、AI 直接写整段 HTML」不换算。设置页：导入按钮 → ① 生成规则 → ② 匹配正则 → ③ 美化 HTML → 卡片外框 CSS（`details` 折叠，长的默认收起）→ 预设（比较时都换算成 spec 再比）。面板高度一直到输入栏上面（`--sp-max`），每一条自己能上下滑；每条最下面留白、正中间「删除 / 收藏 / 关闭」（删除只删这条消息的 `m.status`；收藏存成收藏夹里的 `kind: status`，带卡片 HTML，在「我的 → 收藏」里画出来）。导入酒馆正则（`statusRegexScripts` 在 JSON 里找 findRegex + replaceString，挑替换成 HTML 的最长那条，`statusRegexScripts` 在 JSON 里找 findRegex + replaceString，挑替换成 HTML 的最长那条）：`look.statusFind` 存正则、`statusTpl` 存原样的 replaceString（$1、$2，{{match}} = 整段），用户自己把酒馆配套的规则贴进「生成规则」`look.statusRules`（两种方式都会带给角色；用户的规则可能有成人内容，是她自己贴的，别写进代码）。角色照规则写，`statusRegexTake` 在回复里认出来（外层标签 <状态栏> / [状态栏] 自动互换，正则对不上也把那段拿走），`statusStreamCut` 让它不在边生成边出的气泡里冒出来，`statusRegexRender` 画卡片，对不上时按行显示原文。预设也存 find / rules |
| stickers | 表情包（抽屉和打字联想里，小图下面都带名字、最多两行，用户要发之前看清是哪个）：图床链接 / 文档（txt / docx / json / md / csv）导入（带分类的 json —— 眠花糖机表情包文件 `{ app: "mphone", type: "stickers", cats: [{ name, items: [{ name, url }] }] }` 或 uwu 那种每项带 group 的 —— 直接按分类全部导入，`stkGroupedFromJson` / `stkImportGrouped`）、分类、打字联想；消息存 `[表情包：名字]` + 图片地址，打不开时显示这句文字；每个角色单独设置能不能发、能用哪些分类、能不能看到图片（`char.stickerCfg`）；导入时压成小图存 `b64` 给 AI 看，读不了记 `b64Fail` |
| opening | 剧情开场白：剧情空着时「添加开场白」（粘贴，角色卡自带的 `char.openings` 可点选填入）/「随机开场白」（给方向或留空，AI 按人设世界书写，先预览可「换一个」）；存成 `{ role: 'user', narr: true }`（这样能直接 ❄️ 或接着发），显示成居中旁白（render 的 `renderNarration`），发给 AI 标明是中立旁白；存的时候就把 {{char}}/{{user}} 换成名字。角色设置里不再有开场白列表 |
| calendar | 角色回复里的 `<日程 类型="提醒/闹钟/日程 三选一" 时间="YYYY-MM-DD HH:MM">事</日程>` 记进桌面「纪念日」（`annivs` 里 `remind` / `by` / `charIds`），聊天里出卡片；只记在小手机里，不加到手机系统日历（试过 .ics / Google 日历，用户觉得麻烦） |

### char/ 角色
| 文件 | 内容 |
|---|---|
| look-share | 美化的导出 / 导入（美化页最下面）：文件 `{ app: "mphone", type: "look", chat, drama, status }`，导出、导入都能勾聊天窗口 / 剧情窗口 / 状态栏哪几样（安卓分享不认 .json 就用 .txt）；导入是套到表单上立刻生效，再点保存。CSS 预设 `mphone_css_presets`：角色美化页的 CSS 框和外观的全局样式框下面都有，共用一份，点一下填进框里，长按删除 |
| settings / settings-save / look | 角色设置（4 页：角色 / 聊天 / 美化 / 扩展）表单和默认值 `DEFAULT_CHAT_CFG`；保存 / 删除角色；美化页（聊天窗口 / 剧情窗口各一套 `char.dramaLook`）。剧情窗口最上面「显示格式」三选一（用户定的）：气泡（和现在一样）/ 文本框 `look.format = box`（像酒馆：每块顶上头像 + 名字 + 时间（render 的 `addDramaHead` 给剧情窗口每条加 `.cr-msg-head`，气泡时藏着），下面正文像文档；同一个人连着发的几条合成一个大框（CSS 相邻选择器 + :has，room.js 的 `dramaBoxCss`），底色用主题颜色，下面「文本框样式」写 CSS 再调）/ 自定义 `custom`（排版和文本框一样，不加颜色边框，主题和头像开关收起来，样子靠「整个剧情窗口的 CSS」）；剧情窗口的美化页不显示顶上的气泡小预览（只给聊天窗口）；以前剧情窗口的「文段」算文本框；剧情窗口不显示布局里的「显示格式」行（`syncDramaFormatUi`）。MianIN 的 set_css 可以带 `view: "drama"`、`format` 改剧情窗口。关联世界书分「聊天窗口 / 剧情窗口」两栏（用户要的）：聊天用 `worldbookIds / worldbookFolders`，剧情用 `char.dramaWb = { ids, folders }`（没设置过就和聊天一样，`charWbOf`），便捷拓展栏里换的也只换当前窗口那栏 |
| memory / summary / backup | 角色记忆（短期 / 长期 / 珍贵，可选向量检索，按 token 预算注入）、关系里程碑（记忆多时分批整理）；按回合总结；单个角色的记忆备份（含档案） |
| archive | 其他小手机的记录（扩展页「导入聊天记录」）：整理成记忆前选「每段多大」小段 5000 / 中段 20000（默认）/ 大段 50000 token（以前固定 5000，长记录要请求一两百次，用户嫌多）；认 uwu（`uwu-chat-history`，`[某某的消息：…]` 去壳，`isStatusUpdate` 是状态栏）、眠花糖机角色备份、ChatGPT（mapping）/ Claude（chat_messages）官网导出、酒馆 .jsonl、任意 JSON（找像消息的对象）、CSV、微信 / QQ 两行式 txt、「名字：内容」的 txt / md / docx；用户要求兼容的格式尽量多。先预览再导入，预览里点名字改「谁是 TA」；同一份记录再导时按时间 + 内容跳过已导入的。原文存在 `mphone_archives`（只给用户翻看，不发给 AI），列表和记忆库都写「来自 xxx」（`from` 存完整名字，如「uwu 小手机」）；可选分段整理成长期记忆（`m.source = 'import'`、`m.from`、时间用原聊天日期，角色看到时带「在 xxx 里」）。整理完自动 `arcConsolidate`：导入的记忆按来源分组、去掉数字后按相似度分小组，让模型把同一件事合并（细节全留），条数没变少或解析失败就保持原样（用户要求导入后记忆库不要堆太多重复的）。用户要求整理完整、准确、不爆 token：一件事一条、写具体细节、禁止空泛句；每段约 5000 token，太长自动减半，偶发错误重试，失败停在那一段可「继续整理」；可选逐段核对（次数翻倍） |
| migrate | 通讯录「导入角色」选 uwu 小手机完整备份时用（用户要的是导入角色时选，不是在已有角色上迁移）：读 uwu / ovo 小手机的完整备份（.ee = gzip 的一行一个 JSON，header `format` 含 stream-backup；`chat-start` 是角色资料，`chat-history` 是消息，`worldBooks` 是世界书），流式解压读两遍，不读 API / 密钥。弹窗选角色、勾人设 / 头像 / 聊天记录 / 世界书（默认勾这个角色关联的，原来全局的和其他的不勾）→ 变成新角色草稿进角色设置；保存时世界书按 `folderName`（原分类）放进同名文件夹、一样的直接关联，聊天记录 `pendingArc` 存成档案 |
| auto | 自主活动：主动发消息、聊天后发动态、调度。主动消息只在「后台」发（用户要的）：正看着这个角色的聊天、TA 正在回复、或者打字 / 发消息 / 离开聊天室后 `AUTO_QUIET_MS`=5 分钟内都先等着（不重新排期，条件过了下一次检查就发），不会在用户发了两条还没点 ❄️ 时插进来。主动消息的要求放在最后一条、用 user 身份并标明「系统提示，不是对方发来的」（最后一条是角色自己的话时 Claude 等会当成要续写，像卡住重说一遍）；用户没回时把角色最近发的几条列出来，要求接着往下说、不重说、不重新回答旧话题（用户反馈过）。`callApiOnce(msgs, char)`（在 chat/feed）传角色时用 TA 自己的模型预设 |
| import | 导入酒馆角色卡 PNG / JSON、Word |
| assistant | 内置助手 MianIN（昵称慕斯、暮暮，用户称祂「祂」；原本是用户酒馆预设里的织梦者，「暮色」是祂编织的幻境，不是祂本人）。名字和人设固定在 `MIANIN_NAME` / `MIANIN_PERSONA`，小手机里只能看不能改（用户要求）。改样式：提示里带 `ASSISTANT_ROOM_HINT`（聊天室的 DOM 结构、主题颜色规则优先级高要 !important、改头像 / 排版的写法；用户说过祂改剧情界面头像和排版老改不到位）和各角色现在的聊天 / 剧情 CSS；确认卡片不给看代码（收在「看代码」里），直接放一张缩小版效果图（js/char/css-preview.js 的 `cssMiniPreview`：不跑脚本的 iframe 带上全部样式表，复制一份真的聊天室结构、换上那个角色最近几条；全局样式的画桌面），按钮是「忽略 / 应用」，应用后「撤销」。用户不要跳过去整屏预览、来回应用看。能力：加世界书、改 CSS、看报错、读用户发的文件、帮做状态栏；`ASSISTANT_GUIDE` 是给祂的应用说明（用户要求写全：「你能做的事」「你做不到的事」「应用结构」按界面分条），加新功能时顺手补上；里面提到 {{char}} / {{user}} 写法时中间夹零宽空格，不然发送时会被换成名字 |

纪念日（desk/anniv）按 `charIds` 决定角色看不看得到：只和用户有关的、和自己有关的、和社交圈里认识的人有关的（`annivVisibleTo`）。用户说的 char / user / NPC 都站在当前角色的角度：char = 这个角色本人，user = 用户，NPC = 其他所有人（小手机里别的角色 + 用户身边的人，后者存在 `npc` 文字里）。

### prompt/ 提示词
| 文件 | 内容 |
|---|---|
| wb-import | 世界书「导入世界书」：眠花糖机世界书文件（`{ app: "mphone", type: "worldbook", folders: [{ name, entries }] }`）、酒馆世界书 JSON（`entries`，位置照导入角色卡的换算）、角色卡 PNG / JSON 里的 `character_book`、uwu 完整备份 .ee（用 migrate 的 `migScan`，按原分类分文件夹）；先列出来勾选，文件夹按名字合并，名字和内容都一样的跳过 |
| tabs / worldbook / cot / presets / scene | Prompt 页的文件夹标签、世界书、思维链（页面上只有「思考方式」三选一 `mphone_cot_mode`：不思考 off / 眠花糖机的 mine / 模型自带的 native，和「在聊天里显示思考」开关；off 和 mine 会用 `llmThinkOff` 关掉模型自带思考，native 不关、有就用；内容固定在 prompt.js 的 `COT_CHAT` / `COT_DRAMA`，`cotRules` 只在正式回复时加；`takeThink` 把 `<thinking>` / `<think>` 摘出来存 `m.think`，不显示成气泡、不再发给模型，开了显示就在回复前放一条小折叠条 `renderThinkBar`；关掉 = 完全不思考）、预设（可导入酒馆预设；**只用在剧情窗口**，聊天窗口和各种活动只用系统提示词 + 世界书，用户定的）、系统提示词（`DEFAULT_SYSTEM_PROMPT` 在 scene.js：管角色语气风格和互动规范，灵活不 OOC；只有一个框、里面分类写（你是谁 / 语气 / 互动 / 聊天窗口 / 剧情窗口 / 其他活动），用户明确不要分窗口、不要预设切换；可改，点「保存」存 `mphone_system_prompt`，「恢复默认」回默认；以前的两个场景框 `mphone_scene_chat/drama` 已合并进来，`scenePrompt` 只告诉角色现在在哪个窗口。剧情窗口描写用户用第二人称；用户心里把剧情窗口当「剧情演绎」，但不改名，并希望小手机和现实生活有联系） |

世界书：新条目默认位置「自动」（`wbResolvePos`：常驻的放前、关键词触发的放中，都不插进聊天记录），可手动改前 / 中 / 后。同一位置的条目合成一段，开头是 `WB_WRAP`（只当背景，不复述、不反复提、不说「设定」「世界书」）。关键词只在最近 6 条里**用户**的消息中找，角色自己提到的不触发，避免 TA 反复绕着同一个设定说（用户反馈过）。各功能自己的提示词（动态、日记、总结等）写死在代码里，用户说不用拿出来。

## 用户定下的风格（改相关功能前先看）
- 聊天窗口：像微信，一句一条、短、不加句号；带空行或长句会被代码拆开（reply.js 的 `chatSplitLines` / `chatSplitLong`）。描写只放在开了「线上动作描写」时的 *星号* 小灰字里。
- 剧情窗口：剧情演绎，第二人称写用户，可以长段；预设只在这里用。
- 系统提示词只有一个框（分类写，不要分窗口、不要预设切换），默认版在 `js/prompt/scene.js` 的 `DEFAULT_SYSTEM_PROMPT`。
- 动态：用户的动态只有角色评论；角色的动态有 TA 生活里的 NPC（1～4 个、每人 1～3 句）评论，角色看心情回。没有 ❄️ 按钮，角色过一会儿自己来，回了弹 plain 小通知。
- MianIN（祂）：人设固定在代码里；角色只读不改。
- 桌面「灯塔 / 见面」还空着，用户在构思，别替她编功能。
- 动态：发新动态时把这个角色最近 6 条动态给 TA 看、要求换话题换说法，并随机给一个切入角度（`FEED_ANGLES`）；NPC 评论时也带上之前几条动态下的评论，要求别重复（用户反馈过动态和评论全是一样的）。

## 测试
- 内置浏览器面板里 service worker 注册不上（控制台有 “fetching the script” 报错），这是环境问题，不是 bug。
- 没有真实 API 时，用假的 `fetch` 或 `llmRequest` 测试流程，测完把测试数据清掉。
- 云端会话里：在仓库目录 `python3 -m http.server 8772` 起服务，用 Playwright（`NODE_PATH=$(npm root -g)`，`require('playwright')`）打开 http://localhost:8772/ 跑；等 `!document.getElementById('bootSplash')` 再操作，先关掉备份提醒（`backupMeta.remindDays = 0; backupRemindOverlay.classList.remove('open')`）。截图放 `screens/`（已在 .git/info/exclude 里，不提交）。
- Playwright 读不到权限是 600 的文件（setFiles 会静默失败），测用户给的文件前先复制一份 chmod 644。
