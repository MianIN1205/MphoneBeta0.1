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
function roomLookPart(char) {
  if (currentCrSubView === 'contacts' && char.dramaLook) return char.dramaLook;
  return { chatBg: char.chatBg, bubble: char.bubble, look: char.look, customCss: char.customCss };
}

function applyChatRoomStyle(char) {
  var content = document.getElementById('chatRoomContent');
  content.style.background = '';
  appChatRoom.classList.remove('cr-no-avatar', 'cr-head-avatar', 'cr-head-left');
  if (!char) { crCharStyleEl.textContent = ''; return; }

  var part = roomLookPart(char);
  var look = Object.assign({}, DEFAULT_LOOK, part.look || {});
  if (!look.showAvatar) appChatRoom.classList.add('cr-no-avatar');
  if (look.headAvatar) appChatRoom.classList.add('cr-head-avatar');
  if (look.headAlign === 'left') appChatRoom.classList.add('cr-head-left');
  paintCharAvatar(document.getElementById('chatRoomHeadAv'), char);
  if (typeof paintChatSubTitle === 'function') paintChatSubTitle(char);

  var bg = part.chatBg || DEFAULT_CHAT_BG;
  if (bg.image) {
    content.style.background = 'url(' + bg.image + ') center / cover no-repeat';
  } else if (bg.color) {
    content.style.background = bg.color;
  }

  // 状态栏样式只属于聊天窗口
  var chatLook = Object.assign({}, DEFAULT_LOOK, char.look || {});
  crCharStyleEl.textContent = lookCss(part, '#appChatRoom') +
    (currentCrSubView === 'contacts' ? '' : (chatLook.statusCss || '')) + '\n' +
    (part.customCss || '');
  if (typeof renderQuickBar === 'function') renderQuickBar();
  if (typeof refreshStatusPanel === 'function') refreshStatusPanel();
}
