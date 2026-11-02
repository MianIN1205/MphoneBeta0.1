# 眠花糖机（Mphone）

一个“小手机”风格的 AI 角色扮演网页（PWA），纯原生 HTML/CSS/JS，没有构建步骤。
英文名 Muse（标题和开屏写「眠花糖机 · Muse」；桌面图标下的名字仍是「眠花糖机」，因为 iPhone 改名要重新添加图标，会清数据）。
线上地址：https://mianin1205.github.io/MphoneBeta0.1/ （GitHub Pages，仓库 MianIN1205/MphoneBeta0.1，分支 main）

## 和用户合作的规矩
- 所有回复、总结、按钮都用中文。
- 每次提交 / 推送前都要先问，用户同意了才推。不要再提“局域网服务器”方案（用户已拒绝）。
- 不要擅自改用户已有的设计：空状态提示、占位图标、“开发中”这类文字都是故意留的；改界面文字、交互前先问。
- 已定的交互：输入框里的 ↵ 是换行，键盘回车只发送用户消息不叫 AI，❄️ 才请求回复（生成中变 ⏹）；表情键和加号键弹出同样高度的底部抽屉；MianIN 是内置默认角色兼系统助手。
- 界面动效要克制：淡入 + 轻微缩放，不要回弹、不要花哨。
- 本地备份放在 `F:\Ai资料\mhtj备份claude\`，文件夹名 `MMDDHHMMhtm<简短描述>`，例如 `10251216htm助手社交圈与通知`。

## 文件结构
- `index.html`：只有界面结构（各个 app-screen、弹窗）。
- `css/`：34 个样式文件，和 JS 一样分在 `core/ desk/ settings/ chat/ char/ prompt/` 里，每个文件第一行写了管什么。**`index.html` 里 `<link>` 的先后有影响**（同一个元素两条规则打架时后面的赢），2026-11-01 拆分时专门保持了原来的先后：比如 `core/dialogs.css`（通用弹窗）排在 `desk/desk-apps.css`、`desk/memory-lib.css` 后面，`char/settings.css` 排在 `chat/mine.css` 前面，`chat/contacts.css` 排在 `chat/list.css` 前面。新加规则时如果和别的文件里的规则作用在同一个元素上，要注意先后。
- `js/`：普通脚本（不是模块），按功能分在 6 个文件夹里：`core/` 公共、`desk/` 桌面、`settings/` 设置、`chat/` 聊天、`char/` 角色、`prompt/` 提示词。所有顶层名字都是全局共享的。
  - **加载顺序在 `js/core/boot.js` 的 `MPHONE_SCRIPTS` 里，和文件夹无关，顺序很重要**：后面的脚本会用到前面定义的东西，加载时（不在函数里）调用后面文件的函数会报错；要么用 `typeof` 判断，要么用 `onMphoneReady(fn)`（最后一个脚本加载完才执行）。2026-11-01 按功能拆分时保持了原来的加载顺序，所以同一个功能有时会分在两三个文件里（比如角色设置：`char/settings.js`、`char/settings-save.js`、`char/look.js`）。
  - 每个文件第一行写了它管什么，找东西先看第一行。
  - 新增 js/css 文件：加进 `MPHONE_SCRIPTS`（js）和 `sw.js` 的文件列表，并把 `sw.js` 里的 `CACHE` 版本号加一（现在是 `mphone-v26`）。
- `sw.js` / `manifest.webmanifest` / `icons/`：PWA 文件，要和其他文件一起提交。manifest 的 `orientation` 是 `portrait`：写成 `any` 时安卓桌面版会无视系统的方向锁定，躺着就转屏。
  - logo 是用户提供的图（粉色月牙 + 睡觉的小熊 + 蓝色小花），只有两张：`icons/icon.png` 是 App 图标（iPhone、安卓、通知、网页图标都用这一张，用户要求不分开做）：和开屏一样的粉蓝渐变底，logo 带白色边缘光和阴影，占 68%（安卓裁成圆也不会切到），manifest 里是 `any maskable`；`icons/logo.png` 是透明底加白色描边的 logo，小手机页面里（开屏）用。
  - 载入页在 `index.html` 开头（样式内联，小字随机；logo 沿轮廓发白光（用户要的是边缘发光，不是圆形光晕），不要做呼吸、缩放这类循环动画），`js/core/boot.js` 的 `hideBootSplash` 在脚本加载完后淡出。
- 文件都是 CRLF 换行。Git Bash 的 `sed -i` 会悄悄改成 LF，改文件请用 Edit 工具或 node 脚本。

## 主要模块（js/）
### core/ 公共
| 文件 | 内容 |
|---|---|
| boot | `mphoneStore`（IndexedDB 键值存储，键名都以 `mphone_` 开头）、载入页、脚本加载清单 `MPHONE_SCRIPTS` |
| utils | 公共工具：`openConfirm` 确认弹窗（全站共用）、`closeOnBackdrop` 点遮罩关闭、`bindPress` 点一下 / 长按、`downloadBlob` / `shareOrDownload` 保存文件、`zipReadEntry` / `readDocxText` 读 zip 和 docx、时间格式（`fmtMsgTime` / `fmtListTime` / `fmtAgo` / `durText`）、左滑操作 `bindSwipeActions`、`showToast(msg, type)`（半透明：success 绿、error 红、plain 白底深灰字） |
| api-errors | 接口报错记录（不记密钥），供 MianIN 答疑 |
| llm | `llmRequest` 统一调用各家模型（Claude 原生接口，其余走 OpenAI 兼容），以及工具调用循环 |
| mcp | MCP 客户端（Streamable HTTP） |
| image-picker / image-viewer | 通用图片选择弹窗、图片全屏查看 |
| errors | 报错分析：`ERROR_TABLE` 报错对照表（按状态码 / 原文关键词归类，每类写好原因和办法，按顺序取第一条对上的），`showErrNotice` 在聊天里加一行和拍一拍一样大的「⚠️ 回复失败：…」（只在界面上，不存记录），点开 `#errInfoOverlay` 看分析；下面两个各自折叠的：「原始报错」（简短，原来的样子）和「完整报错代码」（状态行、接口、错误本身、接口返回的完整原文，JSON 排版、等宽字体；`apiError` 把原文存在 `err.body`；连不上时是出错位置；只把密钥打码 `errRedact`，不截断；代码在小框里自己滚动，下面有「复制这段代码」；两段都展开时框会按剩余空间变矮，整个弹窗始终放得下）。「复制报错」两段一起复制。不在当前对话时改成红色提示。加载清单里排最后 |

### desk/ 桌面
| 文件 | 内容 |
|---|---|
| statusbar | 时钟、电量（真实电量 `phoneBattery`，iPhone 拿不到） |
| screens | 桌面图标打开各个界面 |
| appearance / appearance-store | 外观设置（边框 / 全屏、状态栏、字体、字号、全局 CSS、系统顶栏颜色）；保存和启动时恢复（也恢复系统提示词） |
| bookshelf | 书架（日记 / 相册是系统书） |
| gallery / anniv / diary | 相册；纪念日与日程；日记 + 每日定时写日记并记成长期记忆 |
| widgets | 桌面网格与小组件（编辑模式拖动） |
| places | 花房 / 星星瓶 / 灯塔 / 见面：用户想好的几个地方，暂时只有桌面图标和空白界面（灯塔没有 emoji，图标是画的小 SVG） |
| memory-open / memory-lib | 记忆库的打开、返回；记忆库界面、问 TA 记得什么、导出 Word |

### settings/ 设置
| 文件 | 内容 |
|---|---|
| api / api-restore | 设置页本身、主 API、API 预设和字体预设、温度；启动时恢复主 API |
| media-api | 语音 API（TTS）与生图 API |
| assist | 辅助功能：系统通知（小手机在后台时）、小手机里的消息横幅 `showInAppNotice`（在小手机里但没在看那个对话时，代替以前的绿色提示；点一下进对话，往上滑收起，滑掉后同一角色的这一轮回复不再弹）、后台保活 |
| data | 数据管理：占用圆环、导入备份；末尾还有一句启动时画聊天列表（保持原来的时机） |
| backup | 导出（分享 / 下载，安卓不认 .json 就用 .txt）、备份提醒（`mphone_backup_meta` 不进备份）、自动加密备份到 GitHub Gist（PBKDF2 + AES-GCM，gzip；令牌和密码在 localStorage 的 `mphoneCloudToken` / `mphoneCloudPass`，不进备份）。iPhone 删掉桌面图标会连数据一起清掉 |

### chat/ 聊天
| 文件 | 内容 |
|---|---|
| tabs / header / list / new-chat / contacts | Chat 底部标签、消息页顶栏和加号菜单、消息列表（会话卡片、未读、删除会话）、新建对话、通讯录 |
| room / room-view / room-lists | 聊天室：返回、齿轮、应用角色美化；聊天 / 剧情切换和底部抽屉开关；打开时画两个列表（分页）、相册发图 |
| history | 聊天 / 剧情记录的存取（`stripMsg` 决定存哪些字段）、当前窗口用哪份记录、`getApiCfg(char)` |
| prompt | 拼给 AI 的内容：`MPHONE_FICTION_NOTE`（固定放在最前：虚构创作空间、角色是成年人、不为虚构情节道歉；不是破限，只是把情境说清楚；破限类内容 Claude 不写，用户自己的放在 Prompt 页的预设里），`buildMsgs`（聊天 / 剧情都按回合 + token 上限裁剪，剧情省略部分用隐藏的 `<前情>` 代替）、`chatFormatRules` 回复格式、`fillMacros`（{{char}} / {{user}}）、`realWorldContext` 现实感知（现在几点按角色时区、隔了多久没说话、真实电量、纪念日和日程，只放聊天窗口）、`lastStatusOf` 接上一次状态栏、`msgTextForAI` |
| render | 消息显示：气泡、动作小字、引用、小时间（`refreshMsgStamps`）、版本切换、拍一拍、撤回提示 |
| reply | 收到回复：`takeStatus` 取出状态（角色忘写 `</status>` 也认）、`commitAssistantReply` 拆成多条（|||；聊天窗口里 `chatSplitLines` 把每一行拆成一个气泡（用户看了效果后要日常微信那样一句一条、不要大段气泡；只有 *动作* 的行跟着下一句，〔译〕跟着上一句，句尾单个「。」去掉；每次回复条数设成 1 的不拆），提示词要求一条 5～20 字、不换行、不加句号；每次回复条数默认 2~5（`mphone_reply_count_v2` 把还是旧默认 1~3 的角色改过来一次）；开了「线上动作描写」时，动作 / 神态 / 心理 / 环境描写都放进 *星号* 小灰字，这是聊天窗口里写描写的地方；`<撤回>`、表情包、`<日程>`）、`sendMsg`、重新生成 |
| input / voice / media-send | 输入栏（回车只发自己的、↵ 换行、引用、❄️）；语音：点麦克风弹出录音小条 `#voicePop`（✕ 取消、🎙 按住录音、时长、波纹、提示），按住 200ms 开始录，松手发送，滑到 ✕ 松手取消（用户不要再长按麦克风本身）；转写；识图与语音发给 AI。「发送音频」模式：能听的模型只收录音（base64 WAV），文字部分不带转写；听不了的（`llmCaps` 判断或被拒后记住）在 `llmPrepare` 里换成转写文字，录完时若当前模型听不了会先转写（用户要求：能听就别靠转文字） |
| msg-menu / msg-ops | 长按菜单；多选（批量删除 / 合并收藏）、删除本轮、从这里重新生成、清空记录。撤回：`m.recalledBy` 为 `user`（你撤回的，自己或角色的消息）或 `char`（角色写 `<撤回>…</撤回>`，先显示两秒再变撤回提示，角色设置可开「偷看」） |
| feed / mine / wallet-fav | 动态（朋友圈）和社交圈、「我的」账号、钱包和收藏 |
| quick-bar / status-panel | 便捷拓展栏（本窗口用的模型预设 / 预设 / 世界书）；状态栏面板（按 HTML 模板的 {{字段}} 画，左右滑看最近 10 轮） |
| stickers | 表情包：图床链接 / 文档（txt / docx / json / md / csv）导入、分类、打字联想；消息存 `[表情包：名字]` + 图片地址，打不开时显示这句文字；每个角色单独设置能不能发、能用哪些分类、能不能看到图片（`char.stickerCfg`）；导入时压成小图存 `b64` 给 AI 看，读不了记 `b64Fail` |
| opening | 剧情开场白：剧情空着时「添加开场白」（粘贴，角色卡自带的 `char.openings` 可点选填入）/「随机开场白」（给方向或留空，AI 按人设世界书写，先预览可「换一个」）；存成 `{ role: 'user', narr: true }`（这样能直接 ❄️ 或接着发），显示成居中旁白（render 的 `renderNarration`），发给 AI 标明是中立旁白；存的时候就把 {{char}}/{{user}} 换成名字。角色设置里不再有开场白列表 |
| calendar | 角色回复里的 `<日程 类型="提醒/闹钟/日程 三选一" 时间="YYYY-MM-DD HH:MM">事</日程>` 记进桌面「纪念日」（`annivs` 里 `remind` / `by` / `charIds`），聊天里出卡片；只记在小手机里，不加到手机系统日历（试过 .ics / Google 日历，用户觉得麻烦） |

### char/ 角色
| 文件 | 内容 |
|---|---|
| settings / settings-save / look | 角色设置（4 页：角色 / 聊天 / 美化 / 扩展）表单和默认值 `DEFAULT_CHAT_CFG`；保存 / 删除角色；美化页 |
| memory / summary / backup | 角色记忆（短期 / 长期 / 珍贵，可选向量检索，按 token 预算注入）、关系里程碑（记忆多时分批整理）；按回合总结；单个角色的记忆备份（含档案） |
| archive | 其他小手机的记录（扩展页「导入聊天记录」）：认 uwu（`uwu-chat-history`，`[某某的消息：…]` 去壳，`isStatusUpdate` 是状态栏）、眠花糖机角色备份、ChatGPT（mapping）/ Claude（chat_messages）官网导出、酒馆 .jsonl、任意 JSON（找像消息的对象）、CSV、微信 / QQ 两行式 txt、「名字：内容」的 txt / md / docx；用户要求兼容的格式尽量多。先预览再导入，预览里点名字改「谁是 TA」；同一份记录再导时按时间 + 内容跳过已导入的。原文存在 `mphone_archives`（只给用户翻看，不发给 AI），列表和记忆库都写「来自 xxx」（`from` 存完整名字，如「uwu 小手机」）；可选分段整理成长期记忆（`m.source = 'import'`、`m.from`、时间用原聊天日期，角色看到时带「在 xxx 里」）。整理完自动 `arcConsolidate`：导入的记忆按来源分组、去掉数字后按相似度分小组，让模型把同一件事合并（细节全留），条数没变少或解析失败就保持原样（用户要求导入后记忆库不要堆太多重复的）。用户要求整理完整、准确、不爆 token：一件事一条、写具体细节、禁止空泛句；每段约 5000 token，太长自动减半，偶发错误重试，失败停在那一段可「继续整理」；可选逐段核对（次数翻倍） |
| migrate | 「从小手机备份迁移」（扩展页）：读 uwu / ovo 小手机的完整备份（.ee = gzip 的一行一个 JSON，header `format` 含 stream-backup；`chat-start` 是角色资料，`chat-history` 是消息，`worldBooks` 是世界书），流式解压读两遍，不读 API / 密钥。迁到当前角色：人设、头像替换；勾选的世界书按原分类建文件夹、内容一样的不重复建、逐条关联；聊天记录存成档案（和导入聊天记录同一套，导过的跳过）。默认勾这个角色关联的世界书，原来全局的和其他的不勾 |
| auto | 自主活动：主动发消息、聊天后发动态、调度。主动消息的要求放在最后一条、用 user 身份并标明「系统提示，不是对方发来的」（最后一条是角色自己的话时 Claude 等会当成要续写，像卡住重说一遍）；用户没回时把角色最近发的几条列出来，要求接着往下说、不重说、不重新回答旧话题（用户反馈过）。`callApiOnce(msgs, char)`（在 chat/feed）传角色时用 TA 自己的模型预设 |
| import | 导入酒馆角色卡 PNG / JSON、Word |
| assistant | 内置助手 MianIN（昵称慕斯、暮暮，用户称祂「祂」；原本是用户酒馆预设里的织梦者，「暮色」是祂编织的幻境，不是祂本人）。名字和人设固定在 `MIANIN_NAME` / `MIANIN_PERSONA`，小手机里只能看不能改（用户要求）。能力：加世界书、改 CSS、看报错；`ASSISTANT_GUIDE` 是给祂的应用说明，加新功能时顺手补一句 |

纪念日（desk/anniv）按 `charIds` 决定角色看不看得到：只和用户有关的、和自己有关的、和社交圈里认识的人有关的（`annivVisibleTo`）。用户说的 char / user / NPC 都站在当前角色的角度：char = 这个角色本人，user = 用户，NPC = 其他所有人（小手机里别的角色 + 用户身边的人，后者存在 `npc` 文字里）。

### prompt/ 提示词
| 文件 | 内容 |
|---|---|
| tabs / worldbook / cot / presets / scene | Prompt 页的文件夹标签、世界书、思维链、预设（可导入酒馆预设）、场景说明（聊天 = 隔着屏幕，剧情 = 剧情空间；用户心里把剧情窗口当「剧情演绎」，但不改名，并希望小手机和现实生活有联系） |

世界书：新条目默认位置「自动」（`wbResolvePos`：常驻的放前、关键词触发的放中，都不插进聊天记录），可手动改前 / 中 / 后。同一位置的条目合成一段，开头是 `WB_WRAP`（只当背景，不复述、不反复提、不说「设定」「世界书」）。关键词只在最近 6 条里**用户**的消息中找，角色自己提到的不触发，避免 TA 反复绕着同一个设定说（用户反馈过）。各功能自己的提示词（动态、日记、总结等）写死在代码里，用户说不用拿出来。

## 测试
- 内置浏览器面板里 service worker 注册不上（控制台有 “fetching the script” 报错），这是环境问题，不是 bug。
- 没有真实 API 时，用假的 `fetch` 或 `llmRequest` 测试流程，测完把测试数据清掉。
