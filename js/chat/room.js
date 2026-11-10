// 眠花糖机 — 聊天室：返回、齿轮进角色设置、把角色的背景 / 气泡 / 专属 CSS 应用到聊天室

// 聊天对话界面 — 返回
backChatRoom.addEventListener('click', function() {
  closeCrPlusPanel();
  if (currentCrSubView === 'contacts' && typeof crDramaSeen === 'function') crDramaSeen(charList[openingChatCharIdx]);
  appChatRoom.classList.remove('active');
  msgBtnChat.classList.remove('has-new'); msgBtnContacts.classList.remove('has-new');
  applyChatRoomStyle(null);
  renderChatCharList();   // 刷新列表里的最后一条消息
});

// 聊天对话界面 — 设置按钮 → 角色设置界面
chatRoomSettingsBtn.addEventListener('click', function() {
  if (openingChatCharIdx === -1) return;
  openCharSetting(openingChatCharIdx, null, true);
});

// 把角色的聊天背景、气泡样式、专属 CSS 应用到聊天室；char 为 null 时清除
var crCharStyleEl = document.createElement('style');
crCharStyleEl.id = 'crCharStyle';
document.head.appendChild(crCharStyleEl);

function hexToRgba(hex, a) {
  var n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
}

// 气泡颜色 / 透明度 / 效果 / 显示格式 → CSS（scope：聊天室，或美化页里的小预览）
// 剧情窗口的文本框排版（文本框、自定义都用）：每一块顶上一块信息区（头像、名字、时间、楼层、字数、编辑按钮，render.js 的 addDramaHead），下面正文像文档一样；
// 头像位置三选一（look.boxLayout，用户要的）：居中 center / 左右 side（你在右、TA 在左）/ 左对齐 left。
// 同一个人连着发的几条合成一个大框（后面那几条不再显示信息区，接在框里的下一行，用户要的）。旁白不动
function dramaBoxCss(sel, look) {
  look = look || {};
  var lay = look.boxLayout || 'left';
  var row = sel + ':not(.cr-narr-row)';
  var cont = [sel + '.ai + .chat-msg-row.ai', sel + '.user + .chat-msg-row.user'];
  var hasNext = [sel + '.ai:has(+ .chat-msg-row.ai)', sel + '.user:has(+ .chat-msg-row.user)'];
  var css = row + ' { display: grid; grid-template-columns: 28px minmax(0, 1fr); grid-template-areas: "av head" "text text"; column-gap: 8px; row-gap: 8px; align-items: center; padding: 12px 14px; border-radius: 12px; }\n' +
    row + ' > .chat-msg-avatar { grid-area: av; width: 28px; height: 28px; min-width: 28px; }\n' +
    row + ' > .cr-msg-head { grid-area: head; display: flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; min-width: 0; }\n' +
    row + ' .cr-head-who { display: flex; align-items: baseline; gap: 8px; min-width: 0; }\n' +
    row + ' .cr-head-meta { display: flex; gap: 8px; font-size: 11px; opacity: 0.75; }\n' +
    row + ' .cr-head-date { display: none; }\n' +
    row + ' .cr-head-acts { display: flex; gap: 2px; margin-left: auto; }\n' +
    row + ' .cr-head-acts button { width: 26px; height: 26px; padding: 0; border: none; border-radius: 50%; background: transparent; color: inherit; opacity: 0.5; display: flex; align-items: center; justify-content: center; cursor: pointer; }\n' +
    row + ' .cr-head-acts button:active { opacity: 0.9; background: rgba(0,0,0,0.06); }\n' +
    row + ' .cr-head-acts svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }\n' +
    row + ' > .chat-msg-bubble:not(.error) { grid-area: text; max-width: none; padding: 0; border-radius: 0; line-height: 1.8; text-align: left; background: transparent !important; box-shadow: none !important; border: none; }\n';
  if (lay === 'side') {
    css += sel + '.user:not(.cr-narr-row) { grid-template-columns: minmax(0, 1fr) 28px; grid-template-areas: "head av" "text text"; }\n' +
      sel + '.user:not(.cr-narr-row) > .cr-msg-head { flex-direction: row-reverse; }\n' +
      sel + '.user:not(.cr-narr-row) .cr-head-who { flex-direction: row-reverse; }\n' +
      sel + '.user:not(.cr-narr-row) .cr-head-acts { margin-left: 0; margin-right: auto; }\n';
  } else if (lay === 'center') {
    css += row + ' { grid-template-columns: minmax(0, 1fr); grid-template-areas: "av" "head" "text"; }\n' +
      row + ' > .chat-msg-avatar { justify-self: center; width: 46px; height: 46px; min-width: 46px; }\n' +
      row + ' > .cr-msg-head { flex-direction: column; align-items: center; text-align: center; gap: 4px; }\n' +
      row + ' .cr-head-acts { margin-left: 0; }\n';
  }
  css += cont.join(', ') + ' { margin-top: -10px; padding-top: 2px; border-top-left-radius: 0; border-top-right-radius: 0; grid-template-areas: "text text"; }\n' +
    (lay === 'center' ? cont.join(', ') + ' { grid-template-areas: "text"; }\n' : '') +
    cont.map(function(s) { return s + ' > .chat-msg-avatar, ' + s + ' > .cr-msg-head'; }).join(', ') + ' { display: none; }\n' +
    hasNext.join(', ') + ' { border-bottom-left-radius: 0; border-bottom-right-radius: 0; padding-bottom: 4px; }\n';
  if (look.boxMeta === false) css += row + ' .cr-head-meta { display: none; }\n';
  if (look.boxActs === false) css += row + ' .cr-head-acts { display: none; }\n';
  return css;
}
// 文本框风格 = 默认模板（只在「文本框」格式里，look.boxStyle）：用户从试做的几套里挑了这四套留下，每套带一个配好的头像位置（lay，点模板时一起换，之后还能单独改）；
// 气泡样式不放这里（用户要放进气泡模式的预设）。每套：框的底色、边框、字色、名字颜色、对话（.cr-dq）颜色、信息区和正文之间的分隔线
var DRAMA_BOX_STYLES = [
  { id: 'soft', name: '柔和', lay: 'side', desc: '框的颜色跟着下面的「主题」，白色细边，你在右、TA 在左', sw: ['#F6DCE6', '#5a4650', '#b5577a'] },
  { id: 'glass', name: '毛玻璃', lay: 'side', desc: '半透明毛玻璃，透出背后的背景图，适合换了剧情背景图的时候', sw: ['rgba(255,255,255,0.55)', '#3d3340', '#c2577e'] },
  { id: 'paper', name: '书页', lay: 'left', desc: '米色纸张、宋体字、虚线分隔，像在读一本书', sw: ['#fbf6ec', '#4a3d33', '#a65a32'] },
  { id: 'night', name: '夜色', lay: 'center', desc: '深色半透明，浅色字，对话是暖暖的金色，头像在中间', sw: ['#25223a', '#ebe5f3', '#f0c987'] }
];
// 气泡模板（聊天窗口、剧情窗口的气泡格式，bubble.tpl）：换的是气泡的样子（形状、边框、质感），颜色还用「主题」里选的那一对和透明度（用户要的「气泡模式的预设」）
// chat: true 的只给聊天窗口（用户说这几种适合聊天窗口），drama: true 的只给剧情窗口；
// 仿siya 照用户给的截图仿的，聊天和剧情各一套、不一样（用户要的）：聊天 = 深紫大气泡、白色粗字、动作浅紫字留在气泡里；剧情 = 更宽的深紫渐变长框、叙述浅紫细字、对话白色粗字、行距大，像在读剧情。两套都不显示头像，顶栏输入栏深色
var BUBBLE_TPLS = [
  { id: 'plain', name: '默认', desc: '圆圆的气泡，靠头像那一角收尖一点' },
  { id: 'tail', name: '小尾巴', chat: true, desc: '方一点的气泡，朝头像那边伸出一个小尖角' },
  { id: 'jelly', name: '果冻', chat: true, desc: '胖胖的胶囊形，上面一层亮光，像果冻' },
  { id: 'line', name: '线框', chat: true, desc: '浅浅的底，主题色描一圈细边，清爽' },
  { id: 'glass', name: '毛玻璃', chat: true, desc: '半透明，透出背景图，带一点主题色' },
  { id: 'sticker', name: '贴纸', chat: true, desc: '一圈白边加投影，像贴在屏幕上的小贴纸' },
  { id: 'night', name: '夜色', chat: true, desc: '深色气泡、浅色字，晚上看不刺眼' },
  { id: 'siya', name: '仿siya', chat: true, desc: '深紫色的大气泡、白色粗字，动作描写是浅紫色、留在气泡里；TA 的一次回复是一整个大气泡（不拆成一句一条）；不显示头像，顶栏和输入栏变深色。颜色是固定的，不跟主题色，换个好看的背景图更像' },
  { id: 'siyad', name: '仿siya', drama: true, desc: '剧情版：更宽的深紫渐变长框，叙述是浅紫细字、对话是白色粗字，行距大，像在读剧情；你的是深灰紫框；不显示头像，顶栏和输入栏变深色。颜色固定，不跟主题色' }
];
// 聊天窗口用了仿siya：TA 的一次回复不拆成一句一条、动作描写留在气泡里（reply.js、render.js 用）
function charBigBubble(char) { return !!(char && char.bubble && char.bubble.tpl === 'siya'); }
function hexDarken(hex, k) {
  var n = parseInt(String(hex).slice(1), 16);
  var f = function(v) { return Math.max(0, Math.round(v * (1 - k))); };
  return 'rgb(' + f(n >> 16 & 255) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')';
}
// 仿siya 没换背景图时的底色：纯色灰（用户要的，不要渐变）；换了图就用图。返回空 = 这个窗口没用仿siya
var SIYA_BG = '#46444d';
function tplBgColor(part) {
  var t = part && part.bubble && part.bubble.tpl, look = (part && part.look) || {};
  return (t === 'siya' || t === 'siyad') && look.format !== 'box' && look.format !== 'custom' && look.format !== 'text' ? SIYA_BG : '';
}
// 仿siya 两套共用的界面（照用户给的截图）：背景图铺满整个聊天室（applyChatRoomStyle 把背景挪到 #appChatRoom 上），
// 顶栏不写字、透明、顶上一层往下渐淡的阴影；角色名（大白字）和签名（前面一个小面具）挪到输入栏上方左边，下面也一层渐淡阴影托着；
// 不显示头像；输入栏深色；手机状态栏白字。颜色都是 #appChatRoom 上的变量（--siya-ai 等），不写死：自己的 CSS 或小梦改这些变量就能换
var SIYA_MASK = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 14'%3E%3Cpath d='M2 3.5Q12-.5 22 3.5Q22.5 12 16 12Q13 12 12 9.2Q11 12 8 12Q1.5 12 2 3.5Z' fill='none' stroke='white' stroke-width='1.6' stroke-linejoin='round'/%3E%3Cellipse cx='7.6' cy='6.4' rx='2.4' ry='1.6' fill='none' stroke='white' stroke-width='1.3'/%3E%3Cellipse cx='16.4' cy='6.4' rx='2.4' ry='1.6' fill='none' stroke='white' stroke-width='1.3'/%3E%3C/svg%3E\") center / contain no-repeat";
function siyaChrome(sel, op) {
  var sc = sel.replace(/ \.chat-msg-row$/, ''), a = Math.max(0.9, op);
  var css = sc + ' { --siya-ai: rgba(76,58,148,' + a + '); --siya-user: rgba(72,66,88,' + a + '); --siya-ink: #fff; --siya-soft: #cfc3ee; --siya-bar: #26242e; --siya-field: #3e3b48; --siya-fade: rgba(10,8,18,0.5); }\n' +
    sel + ' .chat-msg-avatar { display: none; }\n' +
    sc + ' .cr-msg-stamp { color: rgba(255,255,255,0.7); text-shadow: 0 1px 2px rgba(0,0,0,0.3); }\n' +
    sc + ' .cr-msg-stamp.user { margin-right: 6px; } ' + sc + ' .cr-msg-stamp.ai { margin-left: 6px; }\n' +
    sc + ' .cr-time-sep { background: rgba(40,36,52,0.55); color: rgba(255,255,255,0.88); padding: 3px 12px; border-radius: 10px; }\n' +
    sc + ' .cr-action-note { color: #e6defa; text-shadow: 0 1px 2px rgba(0,0,0,0.35); }\n';
  if (sc !== '#appChatRoom') return css;   // 美化页的小卡片只要气泡那部分
  var on = '.phone:has(#appChatRoom.active):not(:has(.app-screen.active:not(#appChatRoom)))';
  return css +
    // 顶栏：不写字、透明，顶上渐淡的阴影；名字挪走以后它就不再是定位的参照
    sc + ' .settings-nav { position: static; background: linear-gradient(to bottom, var(--siya-fade), rgba(0,0,0,0)); border-bottom: none; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }\n' +
    sc + ' .settings-nav svg { stroke: #fff; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35)); }\n' +
    sc + ' .settings-nav .msg-toggle-wrap { background: rgba(255,255,255,0.18); }\n' +
    sc + ' .chat-room-head-av { display: none !important; }\n' +
    // 角色名和签名：输入栏上方左边（--cr-bottom-h 是输入栏现在的高度，抽屉打开、剧情多一排符号都会跟着变）
    sc + ' .chat-room-title-wrap { position: absolute; left: 22px; right: 22px; bottom: calc(var(--cr-bottom-h, 64px) + 12px); top: auto; transform: none; max-width: none; z-index: 6; pointer-events: none; }\n' +
    sc + ' .chat-room-title-text { align-items: flex-start; max-width: 100%; }\n' +
    sc + ' .chat-room-main-title { font-size: 24px; font-weight: 800; color: var(--siya-ink); letter-spacing: 2px; text-shadow: 0 2px 6px rgba(0,0,0,0.4); }\n' +
    sc + ' .chat-room-sub-title { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 13px; color: var(--siya-ink); opacity: 0.92; letter-spacing: 2px; text-shadow: 0 1px 4px rgba(0,0,0,0.45); }\n' +
    sc + ' .chat-room-sub-title::before { content: ""; flex: 0 0 auto; width: 20px; height: 12px; background: ' + SIYA_MASK + '; opacity: 0.85; }\n' +
    // 消息别被名字盖住；下面一层渐淡阴影托着名字
    sc + ' .chat-msg-list { padding-bottom: 84px; }\n' +
    sc + ' #chatRoomContent { background: transparent !important; box-shadow: inset 0 -130px 90px -60px var(--siya-fade); }\n' +
    // 输入栏：深色一条，输入框是深色圆角
    sc + ' .chat-room-bottom { background: var(--siya-bar); border-top: none; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }\n' +
    sc + ' .cr-input { background: var(--siya-field); color: #f2eef8; }\n' +
    sc + ' .cr-input::placeholder { color: rgba(242,238,248,0.5); }\n' +
    sc + ' .cr-icon-btn { background: rgba(255,255,255,0.1); color: #f2eef8; }\n' +
    sc + ' .cr-icon-btn svg { stroke: #f2eef8; }\n' +
    sc + ' .cr-symbol-bar button { background: rgba(255,255,255,0.1); color: #f2eef8; border-color: transparent; }\n' +
    sc + ' .cr-qb { background: rgba(20,18,28,0.35); }\n' +
    // 加号 / 表情抽屉也换成深色
    sc + ' .cr-plus-panel { background: var(--siya-bar); border-top-color: rgba(255,255,255,0.06); }\n' +
    sc + ' .cr-plus-box { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.1); box-shadow: none; }\n' +
    sc + ' .cr-plus-box svg { stroke: #e9e3f5; }\n' +
    sc + ' .cr-plus-label { color: rgba(242,238,248,0.8); }\n' +
    // 手机最上面的时间、信号、电量：白色（只在聊天室是最上面那一层时）
    on + ' .status-time { color: #fff; }\n' + on + ' .signal-bars span, ' + on + ' .battery-fill, ' + on + ' .battery-cap { background: #fff; }\n' + on + ' .battery-body { border-color: #fff; }\n';
}
function bubbleTplCss(sel, tpl, colors, op) {
  var T = ' .chat-msg-bubble:not(.error):not(.img-bubble):not(.sticker-bubble):not(.cr-narr):not(.cr-action-only)';
  var A = sel + '.ai' + T, U = sel + '.user' + T, both = A + ', ' + U;
  var ca = hexToRgba(colors[0], op), cu = hexToRgba(colors[1], op);
  if (tpl === 'tail') return both + ' { border-radius: 10px; position: relative; }\n' +
    A + ':not(.file-bubble)::before, ' + U + ':not(.file-bubble)::before { content: ""; position: absolute; bottom: 10px; width: 0; height: 0; border: 6px solid transparent; }\n' +
    A + ':not(.file-bubble)::before { left: -11px; border-right-color: ' + ca + '; }\n' +
    U + ':not(.file-bubble)::before { right: -11px; border-left-color: ' + cu + '; }\n';
  if (tpl === 'jelly') return both + ' { border-radius: 22px; padding: 10px 15px; }\n' +
    A + ' { background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%), ' + ca + '; box-shadow: inset 0 -2px 5px rgba(0,0,0,0.06), 0 3px 8px ' + hexToRgba(colors[0], 0.45) + '; }\n' +
    U + ' { background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%), ' + cu + '; box-shadow: inset 0 -2px 5px rgba(0,0,0,0.06), 0 3px 8px ' + hexToRgba(colors[1], 0.45) + '; }\n';
  if (tpl === 'line') return both + ' { border-radius: 16px; color: #4a3b42; }\n' +
    A + ' { background: rgba(255,255,255,' + Math.min(0.85, op) + '); border: 1.5px solid ' + hexDarken(colors[0], 0.22) + '; }\n' +
    U + ' { background: rgba(255,255,255,' + Math.min(0.85, op) + '); border: 1.5px solid ' + hexDarken(colors[1], 0.22) + '; }\n';
  if (tpl === 'glass') return both + ' { border: 1px solid rgba(255,255,255,0.7); -webkit-backdrop-filter: blur(10px) saturate(1.2); backdrop-filter: blur(10px) saturate(1.2); box-shadow: 0 4px 14px rgba(60,40,70,0.08); color: #3d3340; }\n' +
    A + ' { background: linear-gradient(' + hexToRgba(colors[0], 0.3) + ', ' + hexToRgba(colors[0], 0.3) + '), rgba(255,255,255,0.35); }\n' +
    U + ' { background: linear-gradient(' + hexToRgba(colors[1], 0.3) + ', ' + hexToRgba(colors[1], 0.3) + '), rgba(255,255,255,0.35); }\n';
  if (tpl === 'sticker') return both + ' { border-radius: 14px; border: 2.5px solid #fff; box-shadow: 0 2px 0 rgba(0,0,0,0.05), 0 4px 10px rgba(80,60,80,0.14); }\n';
  if (tpl === 'siya') return siyaChrome(sel, op) + both + ' { max-width: 84%; padding: 14px 18px; border-radius: 14px; color: var(--siya-ink); font-size: 15px; font-weight: 600; letter-spacing: 1.5px; line-height: 1.65; box-shadow: 0 4px 14px rgba(20,14,40,0.22); }\n' +
    A + ' { background: var(--siya-ai); border-bottom-left-radius: 4px; }\n' +
    U + ' { background: var(--siya-user); border-bottom-right-radius: 4px; }\n' +
    sel + ' .cr-act { color: var(--siya-soft); font-weight: 400; }\n';
  if (tpl === 'siyad') return siyaChrome(sel, op) + both + ' { max-width: 92%; padding: 18px 20px; border-radius: 18px; font-size: 15px; letter-spacing: 1.5px; line-height: 1.95; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 6px 20px rgba(20,14,40,0.28); }\n' +
    A + ' { background: linear-gradient(160deg, rgba(0,0,0,0.12), rgba(255,255,255,0.06)), var(--siya-ai); color: var(--siya-soft); font-weight: 400; border-top-left-radius: 4px; }\n' +
    U + ' { background: var(--siya-user); color: var(--siya-ink); font-weight: 500; max-width: 80%; border-top-right-radius: 4px; }\n' +
    sel + ' .cr-dq { color: var(--siya-ink); font-weight: 700; }\n' +
    sel + ' .cr-act { color: var(--siya-soft); opacity: 0.85; font-style: italic; }\n';
  if (tpl === 'night') return both + ' { color: #eee8f6; }\n' +
    A + ' { background: rgba(40,36,62,' + Math.max(0.75, op) + '); }\n' + U + ' { background: rgba(64,54,92,' + Math.max(0.75, op) + '); }\n';
  return '';
}
function dramaBoxStyleCss(sel, look, colors, op) {
  var row = sel + ':not(.cr-narr-row)', st = look.boxStyle || 'soft';
  var cont = sel + '.ai + .chat-msg-row.ai, ' + sel + '.user + .chat-msg-row.user';
  var hasNext = sel + '.ai:has(+ .chat-msg-row.ai), ' + sel + '.user:has(+ .chat-msg-row.user)';
  var text = row + ':not(' + sel.replace(/^.* /, '') + '.ai + .chat-msg-row.ai):not(' + sel.replace(/^.* /, '') + '.user + .chat-msg-row.user) > .chat-msg-bubble:not(.error)';
  function base(o) {
    return row + ' { color: ' + o.fg + '; }\n' +
      row + ' > .chat-msg-bubble:not(.error) { color: ' + o.fg + ' !important;' + (o.font ? ' font-family: ' + o.font + ';' : '') + (o.lh ? ' line-height: ' + o.lh + ';' : '') + ' }\n' +
      (o.line ? text + ' { border-top: ' + o.line + '; padding-top: 10px; }\n' : '') +
      row + ' .cr-head-name { font-size: 13px; font-weight: 600; color: ' + o.name + '; }\n' +
      row + ' .cr-head-time, ' + row + ' .cr-head-date { font-size: 11px; color: ' + o.sub + '; }\n' +
      row + ' .cr-head-meta { color: ' + o.sub + '; }\n' +
      row + ' .cr-dq { color: ' + o.dq + '; font-weight: 500; }\n' +
      cont + ' { border-top: none; }\n' + hasNext + ' { border-bottom: none; box-shadow: none; }\n';
  }
  if (st === 'glass') return base({ fg: '#3d3340', name: '#7a4a62', sub: 'rgba(61,51,64,0.55)', dq: '#c2577e', line: '1px solid rgba(255,255,255,0.75)' }) +
    row + ' { border: 1px solid rgba(255,255,255,0.6); -webkit-backdrop-filter: blur(12px) saturate(1.2); backdrop-filter: blur(12px) saturate(1.2); box-shadow: 0 4px 18px rgba(60,40,70,0.10); }\n' +
    row + '.ai { background: rgba(255,255,255,0.42); }\n' + row + '.user { background: rgba(255,240,246,0.48); }\n';
  if (st === 'paper') return base({ fg: '#4a3d33', name: '#7a5a3e', sub: '#a8957f', dq: '#a65a32', line: '1px dashed #dccbb2', font: '"Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", serif', lh: '1.95' }) +
    row + ' { border: 1px solid #e6d8c3; border-radius: 6px; box-shadow: 0 2px 8px rgba(120,90,60,0.08); }\n' +
    row + '.ai { background: #fbf6ec; }\n' + row + '.user { background: #f6eee3; }\n';
  if (st === 'night') return base({ fg: '#ebe5f3', name: '#f2d8a7', sub: 'rgba(235,229,243,0.55)', dq: '#f0c987', line: '1px solid rgba(255,255,255,0.12)' }) +
    row + ' { border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 4px 16px rgba(10,8,20,0.25); }\n' +
    row + '.ai { background: rgba(30,27,48,0.82); }\n' + row + '.user { background: rgba(54,46,74,0.82); }\n' +
    row + ' .cr-head-acts button:active { background: rgba(255,255,255,0.12); }\n';
  // 柔和（默认）：底色用主题颜色
  return base({ fg: '#4a3b42', name: '#5a4650', sub: '#a89aa0', dq: '#b5577a', line: '1px solid rgba(150,110,130,0.14)' }) +
    row + ' { border: 1px solid rgba(255,255,255,0.75); box-shadow: 0 2px 10px rgba(120,80,100,0.08); }\n' +
    row + '.ai { background: ' + hexToRgba(colors[0], op) + '; }\n' +
    row + '.user { background: ' + hexToRgba(colors[1], op) + '; }\n';
}
function lookCss(part, scope) {
  var look = Object.assign({}, DEFAULT_LOOK, part.look || {});
  var sel0 = scope + ' .chat-msg-row';
  // 剧情窗口「自定义」：排版和文本框一样（头像 + 名字 + 时间、连着的合成一个框），颜色、框都不加，全靠用户自己的 CSS
  if (look.format === 'custom') return dramaBoxCss(sel0, look);
  var b = part.bubble || DEFAULT_BUBBLE;
  var colors = BUBBLE_PRESETS[b.preset] || BUBBLE_PRESETS[0];
  var op = (b.opacity === undefined ? 85 : b.opacity) / 100;
  var effects = {
    'shadow-out': function()  { return '0 2px 8px rgba(0,0,0,0.14)'; },
    'shadow-in':  function()  { return 'inset 0 1px 5px rgba(0,0,0,0.14)'; },
    'glow':       function(c) { return '0 0 10px ' + hexToRgba(c === '#FFFFFF' ? '#E0C8D0' : c, 0.9); }
  };
  var fx = effects[b.effect];
  var sel = scope + ' .chat-msg-row';
  var css =
    sel + '.ai .chat-msg-bubble:not(.error) { background: ' + hexToRgba(colors[0], op) + ';' + (fx ? ' box-shadow: ' + fx(colors[0]) + ';' : '') + ' }\n' +
    sel + '.user .chat-msg-bubble:not(.error) { background: ' + hexToRgba(colors[1], op) + ';' + (fx ? ' box-shadow: ' + fx(colors[1]) + ';' : '') + ' }\n';
  if (!look.showAvatar) css += scope + ' .chat-msg-avatar { display: none; }\n';
  if (look.format !== 'box' && look.format !== 'text' && b.tpl && b.tpl !== 'plain') css += bubbleTplCss(sel, b.tpl, colors, op);
  // 文段：不要气泡，像小说一样整段排开；自己说的话用浅一点的颜色靠右
  if (look.format === 'text') {
    css += sel + ' .chat-msg-bubble:not(.error) { background: transparent !important; box-shadow: none !important; max-width: 100%; padding: 2px 2px; border-radius: 0; line-height: 1.8; }\n' +
           sel + ' .chat-msg-avatar { display: none; }\n' +
           sel + '.user .chat-msg-bubble:not(.error) { color: #8a6a76; text-align: right; }\n';
  }
  // 文本框（剧情窗口）：像酒馆那样一整块带框的；风格从 DRAMA_BOX_STYLES 里选（柔和的底色用主题颜色），连着的合成一个框（框的上下边不画，连成一块）
  if (look.format === 'box') css += dramaBoxCss(sel, look) + dramaBoxStyleCss(sel, look, colors, op);
  return css;
}
// 当前子视图（聊天 / 剧情）用的那套美化
// 聊天窗口、剧情窗口的美化各管各的（用户要的，不能互相影响）：
// 剧情窗口没单独设置过时，只借聊天窗口的背景和主题颜色，不带聊天窗口的 CSS、聊天专用的气泡模板和状态栏；
// 一个窗口存着另一个窗口专用的气泡模板（比如以前复制过去的）时，这个窗口按默认画
function viewLookPart(char, drama) {
  if (!char) return { chatBg: null, bubble: null, look: null, customCss: '' };
  var part = drama ? (char.dramaLook || { chatBg: char.chatBg, bubble: char.bubble, look: char.look, customCss: '', _borrowed: true })
                   : { chatBg: char.chatBg, bubble: char.bubble, look: char.look, customCss: char.customCss };
  var t = part.bubble && part.bubble.tpl, def = t && typeof BUBBLE_TPLS !== 'undefined' && BUBBLE_TPLS.filter(function(x) { return x.id === t; })[0];
  if (def && (drama ? def.chat : def.drama)) part = Object.assign({}, part, { bubble: Object.assign({}, part.bubble, { tpl: 'plain' }) });
  if (drama && part._borrowed) part = Object.assign({}, part, { look: Object.assign({}, part.look || {}, { format: 'bubble' }) });
  return part;
}
function roomLookPart(char) { return viewLookPart(char, currentCrSubView === 'contacts'); }

function applyChatRoomStyle(char) {
  var content = document.getElementById('chatRoomContent');
  content.style.background = '';
  appChatRoom.classList.remove('cr-no-avatar', 'cr-head-avatar', 'cr-head-left');
  appChatRoom.style.background = '';
  if (!char) { crCharStyleEl.textContent = ''; return; }

  var part = roomLookPart(char);
  var look = Object.assign({}, DEFAULT_LOOK, part.look || {});
  if (!look.showAvatar) appChatRoom.classList.add('cr-no-avatar');
  if (look.headAvatar) appChatRoom.classList.add('cr-head-avatar');
  if (look.headAlign === 'left') appChatRoom.classList.add('cr-head-left');
  paintCharAvatar(document.getElementById('chatRoomHeadAv'), char);
  // 有状态栏时顶上名字右边一个很小的朝下箭头：让人知道点名字能看状态栏（用户要的，自然一点的提示）
  appChatRoom.classList.toggle('cr-has-status', !!(Object.assign({}, DEFAULT_LOOK, char.look || {}).statusOn && (chatHistories[char.id] || []).some(function(m) { return m.status; })));
  if (typeof paintChatSubTitle === 'function') paintChatSubTitle(char);

  var bg = part.chatBg || DEFAULT_CHAT_BG;
  var bgCss = bg.image ? 'url(' + bg.image + ') center / cover no-repeat' : (tplBgColor(part) || bg.color || '');
  // 仿siya：背景铺满整个聊天室（顶栏透明，背景要一直到最上面）
  if (tplBgColor(part)) appChatRoom.style.background = bgCss;
  else if (bgCss) content.style.background = bgCss;

  // 状态栏样式只属于聊天窗口
  var chatLook = Object.assign({}, DEFAULT_LOOK, char.look || {});
  crCharStyleEl.textContent = lookCss(part, '#appChatRoom') +
    (currentCrSubView === 'contacts' ? '' : (chatLook.statusCss || '')) + '\n' +
    (part.customCss || '');
  if (typeof renderQuickBar === 'function') renderQuickBar();
  if (typeof refreshStatusPanel === 'function') refreshStatusPanel();
}

// 输入栏现在多高（抽屉打开、剧情窗口多一排符号都会变）：仿siya 把角色名摆在它上方要用
(function() {
  var bar = document.getElementById('crBottomBar');
  if (!bar || typeof ResizeObserver === 'undefined') return;
  // 从输入栏顶上到聊天室底边的距离（输入栏 + 下面打开的抽屉）
  var measure = function() {
    var top = 0, el = bar;
    while (el && el !== appChatRoom) { top += el.offsetTop; el = el.offsetParent; }
    appChatRoom.style.setProperty('--cr-bottom-h', Math.max(0, appChatRoom.offsetHeight - top) + 'px');
  };
  var ro = new ResizeObserver(measure);
  [bar, document.getElementById('crPlusPanel'), document.getElementById('crEmojiPanel')].forEach(function(el) { if (el) ro.observe(el); });
})();
