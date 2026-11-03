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
function lookCss(part, scope) {
  var look = Object.assign({}, DEFAULT_LOOK, part.look || {});
  if (look.format === 'custom') return '';   // 剧情窗口「自定义」：全靠用户自己的 CSS
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
  // 文本框（剧情窗口）：像酒馆那样一整块带框的，颜色还是用主题颜色；旁白不动
  if (look.format === 'box') {
    var box = sel + ' .chat-msg-bubble:not(.error):not(.cr-narr)';
    css += sel + ':not(.cr-narr-row) { align-items: flex-start; }\n' +
           box + ' { flex: 1; min-width: 0; max-width: 100%; border-radius: 12px; padding: 10px 14px; line-height: 1.8; text-align: left;' +
           ' border: 1px solid rgba(255,255,255,0.75); box-shadow: 0 2px 10px rgba(120,80,100,0.08); }\n';
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
