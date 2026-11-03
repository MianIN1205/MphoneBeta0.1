// 眠花糖机 — 聊天室：返回、齿轮进角色设置、把角色的背景 / 气泡 / 专属 CSS 应用到聊天室

// 聊天对话界面 — 返回
backChatRoom.addEventListener('click', function() {
  closeCrPlusPanel();
  appChatRoom.classList.remove('active');
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
// 剧情窗口的文本框排版（文本框、自定义都用）：每一块顶上「头像 + 名字 + 时间」，下面正文像文档一样一行行；
// 同一个人连着发的几条合成一个大框（后面那几条不再显示头像和名字，接在框里的下一行，用户要的）。旁白不动
function dramaBoxCss(sel) {
  var row = sel + ':not(.cr-narr-row)';
  var cont = [sel + '.ai + .chat-msg-row.ai', sel + '.user + .chat-msg-row.user'];
  var hasNext = [sel + '.ai:has(+ .chat-msg-row.ai)', sel + '.user:has(+ .chat-msg-row.user)'];
  return row + ' { display: grid; grid-template-columns: 28px minmax(0, 1fr); grid-template-areas: "av head" "text text"; column-gap: 8px; row-gap: 6px; align-items: center; padding: 12px 14px; border-radius: 12px; }\n' +
    row + ' > .chat-msg-avatar { grid-area: av; width: 28px; height: 28px; min-width: 28px; }\n' +
    row + ' > .cr-msg-head { grid-area: head; display: flex; align-items: baseline; gap: 8px; min-width: 0; }\n' +
    row + ' > .chat-msg-bubble:not(.error) { grid-area: text; max-width: none; padding: 0; border-radius: 0; line-height: 1.8; text-align: left; background: transparent !important; box-shadow: none !important; border: none; }\n' +
    cont.join(', ') + ' { margin-top: -10px; padding-top: 2px; border-top-left-radius: 0; border-top-right-radius: 0; grid-template-areas: "text text"; }\n' +
    cont.map(function(s) { return s + ' > .chat-msg-avatar, ' + s + ' > .cr-msg-head'; }).join(', ') + ' { display: none; }\n' +
    hasNext.join(', ') + ' { border-bottom-left-radius: 0; border-bottom-right-radius: 0; padding-bottom: 4px; }\n';
}
function lookCss(part, scope) {
  var look = Object.assign({}, DEFAULT_LOOK, part.look || {});
  var sel0 = scope + ' .chat-msg-row';
  // 剧情窗口「自定义」：排版和文本框一样（头像 + 名字 + 时间、连着的合成一个框），颜色、框都不加，全靠用户自己的 CSS
  if (look.format === 'custom') return dramaBoxCss(sel0);
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
  // 文本框（剧情窗口）：像酒馆那样一整块带框的，底色用主题颜色；连着的合成一个框（框的上下边不画，连成一块）
  if (look.format === 'box') {
    var row = sel + ':not(.cr-narr-row)';
    css += dramaBoxCss(sel) +
      row + ' { border: 1px solid rgba(255,255,255,0.75); box-shadow: 0 2px 10px rgba(120,80,100,0.08); }\n' +
      row + '.ai { background: ' + hexToRgba(colors[0], op) + '; }\n' +
      row + '.user { background: ' + hexToRgba(colors[1], op) + '; }\n' +
      sel + '.ai + .chat-msg-row.ai, ' + sel + '.user + .chat-msg-row.user { border-top: none; }\n' +
      sel + '.ai:has(+ .chat-msg-row.ai), ' + sel + '.user:has(+ .chat-msg-row.user) { border-bottom: none; box-shadow: none; }\n' +
      sel + ' .cr-msg-head b { font-size: 13px; font-weight: 600; color: #5a4650; }\n' +
      sel + ' .cr-msg-head span { font-size: 11px; color: #a89aa0; }\n';
  }
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
