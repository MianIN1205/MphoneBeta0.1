// 眠花糖机 — MianIN 改样式的确认卡片里放一张缩小版的效果图（用户不要看代码、也不要跳过去来回看）：
// 用一个不跑脚本的小 iframe，带上小手机全部样式表，照真的结构摆一份聊天室（或桌面），套上新样式，缩小放进卡片

// 套用这个改动后，那个角色那个窗口的美化（和 runAction 的算法一样，只是不存）
function cssPreviewPart(a, c) {
  var drama = a.view === 'drama';
  var base = drama ? (c.dramaLook || { chatBg: c.chatBg, bubble: c.bubble, look: c.look, customCss: c.customCss || '' })
                   : { chatBg: c.chatBg, bubble: c.bubble, look: c.look, customCss: c.customCss || '' };
  var part = JSON.parse(JSON.stringify(base));
  part.customCss = a.mode === 'replace' ? String(a.css || '') : ((part.customCss ? part.customCss + '\n' : '') + String(a.css || ''));
  if (drama) part.look = Object.assign({}, part.look || {}, dramaLookPatch(a));
  return part;
}
// 拿那个角色最近的几条（太长的截短）；没有记录就用两句示意
function cssPreviewMsgs(c, drama) {
  var hist = (drama ? dramaHistories[c.id] : chatHistories[c.id]) || [];
  var msgs = hist.filter(function(m) { return !m.recalled && !m.pat && !m.action && !m.cal && (m.content || m.imgSrc || m.textImg); }).slice(-4)
    .map(function(m) { var x = JSON.parse(JSON.stringify(m)); x._floor = hist.indexOf(m) + 1; if (typeof x.content === 'string' && x.content.length > 90) x.content = x.content.slice(0, 90) + '…'; delete x.status; delete x.errs; delete x.think; delete x.alts; return x; });
  if (!msgs.length) {
    var t = Date.now();
    msgs = drama
      ? [{ role: 'user', narr: true, content: '黄昏的书房，窗外下着小雨。', time: t - 3000 }, { role: 'user', content: '你推开门，轻轻叫了一声。', time: t - 2000 },
         { role: 'user', content: '「在忙吗？」', time: t - 1900 }, { role: 'assistant', content: '祂抬起头，眼睛亮了一下：「你来啦。」', time: t - 1000 }]
      : [{ role: 'user', content: '今天下雨了', time: t - 2000 }, { role: 'assistant', content: '记得带伞呀', time: t - 1000 }];
  }
  return msgs;
}
function cssPreviewSheets() {
  return Array.prototype.map.call(document.querySelectorAll('link[rel="stylesheet"]'), function(l) { return '<link rel="stylesheet" href="' + l.href + '">'; }).join('');
}
// 聊天室：复制一份真的结构，把消息列表换成那个角色的几条
function cssPreviewRoomHtml(a, c) {
  var drama = a.view === 'drama', idx = charList.indexOf(c);
  var list = document.createElement('div');
  list.className = 'chat-msg-list';
  list.id = drama ? 'dramaMsgList' : 'chatMsgList';
  var empty = document.createElement('div');
  var keep = openingChatCharIdx;
  openingChatCharIdx = idx;   // 头像、名字、{{char}} 用那个角色的
  try { cssPreviewMsgs(c, drama).forEach(function(m) { renderHistMsg(m, list, empty); }); }
  finally { openingChatCharIdx = keep; }
  var room = appChatRoom.cloneNode(true);
  room.classList.add('active');
  room.classList.remove('cr-qb-on');
  room.removeAttribute('style');
  room.querySelectorAll('.cr-status-panel, .cr-plus-panel, .cr-select-bar, .cr-qb, #crQuickBar, .stk-suggest').forEach(function(el) { el.remove(); });
  room.querySelectorAll('.cr-view').forEach(function(v) { v.classList.toggle('active', (v.dataset.crview === 'contacts') === drama); });
  var bar = room.querySelector('.chat-room-bottom');
  if (bar) { bar.classList.toggle('drama-mode', drama); bar.classList.remove('panel-open'); }
  var title = room.querySelector('.chat-room-title-text');
  if (title && title.firstElementChild) title.firstElementChild.textContent = c.charAlias || c.charName || '';
  var old = room.querySelector(drama ? '#dramaMsgList' : '#chatMsgList');
  if (old) old.parentNode.replaceChild(list, old);
  var other = room.querySelector(drama ? '#chatMsgList' : '#dramaMsgList');
  if (other) other.innerHTML = '';
  var part = cssPreviewPart(a, c), bg = part.chatBg || DEFAULT_CHAT_BG;
  var content = room.querySelector('#chatRoomContent');
  if (content) content.style.background = bg.image ? 'url(' + bg.image + ') center / cover no-repeat' : (tplBgColor(part) || bg.color || '');
  return { html: room.outerHTML, css: lookCss(part, '#appChatRoom') + '\n' + (part.customCss || ''), global: globalCss };
}
// 全局样式：桌面（时钟、图标、程序坞）
function cssPreviewDeskHtml(a) {
  var phone = document.querySelector('.phone');
  var wrap = phone.cloneNode(false);
  ['.status-bar', '.wp-blur-layer', '.desktop', '.dock'].forEach(function(s) { var el = phone.querySelector(':scope > ' + s); if (el) wrap.appendChild(el.cloneNode(true)); });
  return { html: wrap.innerHTML, css: '', global: String(a.css || ''), phoneStyle: phone.getAttribute('style') || '', phoneClass: phone.className };
}
function cssMiniPreview(a) {
  var c = (!a.target || a.target === 'global') ? null : findCharByName(a.target);
  if (a.target && a.target !== 'global' && !c) return null;
  var p;
  try { p = c ? cssPreviewRoomHtml(a, c) : cssPreviewDeskHtml(a); } catch (e) { console.warn('[Mphone] 预览没画出来:', e); return null; }
  var W = 390, H = 560;
  var doc = '<!doctype html><html><head><meta charset="utf-8"><base href="' + location.href.replace(/"/g, '') + '">' + cssPreviewSheets() +
    '<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}' +
    '.phone{transform:none!important;width:' + W + 'px!important;height:' + H + 'px!important;max-width:none!important;border-radius:0!important;margin:0!important}' +
    '#appChatRoom{position:absolute!important;inset:0!important;transform:none!important;opacity:1!important;border-radius:0!important;transition:none!important}' +
    '*{animation:none!important;transition:none!important}</style>' +
    '<style>' + (p.global || '') + '</style><style>' + p.css + '</style></head><body>' +
    '<div class="' + (p.phoneClass ? p.phoneClass.replace(/"/g, '') : 'phone fullscreen') + '"' + (p.phoneStyle ? ' style="' + p.phoneStyle.replace(/"/g, '&quot;') + '"' : '') + '>' + p.html + '</div></body></html>';
  var box = document.createElement('div');
  box.className = 'cr-css-mini';
  var frame = document.createElement('iframe');
  frame.setAttribute('sandbox', '');   // 不跑脚本，只看样子
  frame.setAttribute('tabindex', '-1');
  frame.style.width = W + 'px';
  frame.style.height = H + 'px';
  frame.srcdoc = doc;
  box.appendChild(frame);
  // 按卡片的宽度缩小
  var fit = function() {
    var w = box.clientWidth || 220, k = w / W;
    frame.style.transform = 'scale(' + k + ')';
    box.style.height = Math.round(H * k) + 'px';
  };
  requestAnimationFrame(fit);
  setTimeout(fit, 300);
  return box;
}
