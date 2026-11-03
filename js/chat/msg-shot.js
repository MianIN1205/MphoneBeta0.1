// 眠花糖机 — 多选后「截图」：把选中的消息画成一张长图（气泡颜色照聊天里的），打开大图查看，可以保存、分享、收藏

var SHOT_W = 390, SHOT_S = 3;   // 画布按 390 宽排版，乘 3 倍清晰度
var SHOT_FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

// 图片：data: 的直接用；网上的试着跨域加载，加载不了（或者会弄脏画布）就不画图、写成文字
function shotLoadImg(src) {
  return new Promise(function(resolve) {
    if (!src) { resolve(null); return; }
    var im = new Image();
    if (!/^data:/.test(src)) im.crossOrigin = 'anonymous';
    im.onload = function() { resolve(im); };
    im.onerror = function() { resolve(null); };
    im.src = src;
    setTimeout(function() { resolve(null); }, 6000);
  });
}
function shotWrap(ctx, text, maxW) {
  var lines = [];
  String(text || '').split('\n').forEach(function(para) {
    var line = '';
    Array.from(para).forEach(function(ch) {
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; }
      else line += ch;
    });
    lines.push(line);
  });
  return lines;
}
function shotRound(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// 一条消息画成什么：{ kind: 'bubble' | 'center', mine, text, img, imgSrc, color, fg }
function shotItemOf(el, char) {
  var m = el._msg, bubble = el.querySelector('.chat-msg-bubble');
  var cs = bubble ? getComputedStyle(bubble) : null;
  var bg = cs && cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : (m.role === 'user' ? 'rgba(238,186,202,0.95)' : 'rgba(186,206,222,0.95)');
  var fg = cs ? cs.color : '#333';
  var fill = function(t) { return m.role === 'assistant' ? fillMacros(t, char) : t; };
  if (m.recalled) return { kind: 'center', text: (m.recalledBy === 'user' || m.role === 'user') ? '撤回了一条消息' : '对方撤回了一条消息' };
  if (m.pat) return { kind: 'center', text: el.textContent.trim() || '拍了拍' };
  if (m.narr) return { kind: 'center', text: fill(m.content || ''), narr: true };
  if (m.action || m.cal) return { kind: 'center', text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) };
  var it = { kind: 'bubble', mine: m.role === 'user', color: bg, fg: fg };
  if (m.imgSrc) { it.imgSrc = m.imgSrc; it.alt = '[图片]'; }
  else if (m.sticker) { it.imgSrc = (typeof m.sticker === 'object' ? m.sticker.url : '') || (el.querySelector('img') || {}).src; it.alt = '[表情包] ' + ((m.sticker && m.sticker.name) || ''); it.sticker = true; }
  else if (m.textImg) { it.textImg = m.textImg; }
  else if (m.file) it.text = '📄 ' + (m.file.name || '文件');
  else if (m.voice) it.text = '🎤 语音' + (m.transcript ? '：' + m.transcript : '');
  else it.text = fill(String(m.content || '').replace(/\*([^*\n]+)\*/g, '（$1）'));
  if (m.quote) it.quote = '「' + m.quote.author + '：' + m.quote.text + '」';
  return it;
}
function makeMsgShot(els, char, title) {
  var items = els.map(function(el) { return shotItemOf(el, char); });
  var acc = resolveCharAccount(char) || {};
  return Promise.all([shotLoadImg(char.charAvatar), shotLoadImg(acc.avatar)].concat(items.map(function(it) { return shotLoadImg(it.imgSrc); }))).then(function(imgs) {
    var avC = imgs[0], avU = imgs[1];
    items.forEach(function(it, i) { it.img = imgs[i + 2]; });
    var c = document.createElement('canvas'), ctx = c.getContext('2d');
    var S = SHOT_S, W = SHOT_W, pad = 14, av = 34, gap = 8, fs = 15, lh = 22, bp = 10;
    var maxBW = Math.round((W - pad * 2 - av - gap) * 0.78);
    ctx.font = fs + 'px ' + SHOT_FONT;
    // 先排版算高度
    var y = 56;
    items.forEach(function(it) {
      if (it.kind === 'center') {
        ctx.font = (it.narr ? 14 : 12) + 'px ' + SHOT_FONT;
        it.lines = shotWrap(ctx, it.text, W - pad * 2 - (it.narr ? 40 : 60));
        it.h = it.lines.length * (it.narr ? 21 : 18) + (it.narr ? 20 : 6);
      } else if (it.img && !it.sticker) {
        var k = Math.min(1, 170 / it.img.width, 220 / it.img.height);
        it.iw = Math.round(it.img.width * k); it.ih = Math.round(it.img.height * k); it.h = Math.max(av, it.ih);
      } else if (it.img && it.sticker) { it.iw = it.ih = 96; it.h = 96; }
      else if (it.textImg) { it.iw = it.ih = 132; it.h = 132; }
      else {
        ctx.font = fs + 'px ' + SHOT_FONT;
        it.lines = shotWrap(ctx, it.text || it.alt || '', maxBW - bp * 2 - 2);
        it.bw = Math.min(maxBW, Math.max.apply(null, it.lines.map(function(l) { return ctx.measureText(l).width; })) + bp * 2 + 2);
        it.h = Math.max(av, it.lines.length * lh + bp * 2 - 4);
      }
      if (it.quote) { ctx.font = '12px ' + SHOT_FONT; it.qlines = shotWrap(ctx, it.quote, maxBW - 16).slice(0, 2); it.h += it.qlines.length * 17 + 10; }
      it.y = y;
      y += it.h + 14;
    });
    var H = y + 34;
    c.width = W * S; c.height = H * S;
    ctx.scale(S, S);
    // 背景、标题
    var look = (typeof roomLookPart === 'function') ? roomLookPart(char) : {};
    var bgc = (look.chatBg && look.chatBg.color) || '#FFF0F5';
    ctx.fillStyle = bgc; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#5a4650'; ctx.font = '600 16px ' + SHOT_FONT; ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, 30);
    ctx.textAlign = 'left';
    var drawAv = function(img, x, top, mine) {
      ctx.save(); ctx.beginPath(); ctx.arc(x + av / 2, top + av / 2, av / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
      if (img) ctx.drawImage(img, x, top, av, av); else { ctx.fillStyle = mine ? '#f3c6d3' : '#c9d9e8'; ctx.fillRect(x, top, av, av); }
      ctx.restore();
    };
    items.forEach(function(it) {
      var top = it.y;
      if (it.kind === 'center') {
        ctx.font = (it.narr ? 14 : 12) + 'px ' + SHOT_FONT; ctx.textAlign = 'center';
        if (it.narr) { shotRound(ctx, pad + 10, top, W - pad * 2 - 20, it.h, 12); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill(); }
        ctx.fillStyle = it.narr ? '#6a5560' : '#a89aa0';
        it.lines.forEach(function(l, i) { ctx.fillText(l, W / 2, top + (it.narr ? 24 : 13) + i * (it.narr ? 21 : 18)); });
        ctx.textAlign = 'left';
        return;
      }
      var mine = it.mine, avX = mine ? W - pad - av : pad;
      drawAv(mine ? avU : avC, avX, top, mine);
      var cy = top;
      if (it.qlines) {   // 引用小字
        ctx.font = '12px ' + SHOT_FONT; ctx.fillStyle = '#9a8a90';
        it.qlines.forEach(function(l, i) {
          var tw = ctx.measureText(l).width;
          ctx.fillText(l, mine ? W - pad - av - gap - tw : pad + av + gap, cy + 12 + i * 17);
        });
        cy += it.qlines.length * 17 + 10;
      }
      if (it.img || it.textImg) {
        var iw = it.iw, ih = it.ih, ix = mine ? W - pad - av - gap - iw : pad + av + gap;
        ctx.save(); shotRound(ctx, ix, cy, iw, ih, 10); ctx.clip();
        if (it.img) ctx.drawImage(it.img, ix, cy, iw, ih);
        else {
          var g = ctx.createLinearGradient(ix, cy, ix + iw, cy + ih); g.addColorStop(0, '#fde7ea'); g.addColorStop(1, '#f3e6f5');
          ctx.fillStyle = g; ctx.fillRect(ix, cy, iw, ih);
          ctx.fillStyle = '#7a5a66'; ctx.font = '12px ' + SHOT_FONT; ctx.textAlign = 'center';
          shotWrap(ctx, it.textImg, iw - 16).slice(0, 6).forEach(function(l, i, arr) { ctx.fillText(l, ix + iw / 2, cy + ih / 2 - (arr.length - 1) * 9 + i * 18 + 4); });
          ctx.textAlign = 'left';
        }
        ctx.restore();
        return;
      }
      var bw = it.bw, bh = it.lines.length * lh + bp * 2 - 4, bx = mine ? W - pad - av - gap - bw : pad + av + gap;
      shotRound(ctx, bx, cy, bw, bh, 14); ctx.fillStyle = it.color; ctx.fill();
      ctx.fillStyle = it.fg || '#333'; ctx.font = fs + 'px ' + SHOT_FONT;
      it.lines.forEach(function(l, i) { ctx.fillText(l, bx + bp + 1, cy + bp + 13 + i * lh); });
    });
    ctx.fillStyle = '#c0aab4'; ctx.font = '11px ' + SHOT_FONT; ctx.textAlign = 'center';
    ctx.fillText('眠花糖机 · Muse', W / 2, H - 14);
    return c.toDataURL('image/png');
  });
}
document.getElementById('crSelShot').addEventListener('click', function() {
  if (!msgSel || !msgSel.picked.length) return;
  var char = charList[openingChatCharIdx] || {};
  var drama = msgSel.listId === 'dramaMsgList';
  var els = selectableEls(msgSel.list).filter(function(el) { return msgSel.picked.indexOf(el) >= 0; });
  var title = (char.charAlias || char.charName || '角色') + (drama ? ' · 剧情' : ' · 聊天');
  showToast('正在生成截图…', 'plain');
  makeMsgShot(els, char, title).then(function(url) {
    exitMsgSelect();
    if (typeof openImgViewer === 'function') openImgViewer(url, { source: '与 ' + title.replace(' · ', ' 的'), author: '聊天截图' });
  }).catch(function(err) {
    console.warn('[Mphone] 截图失败:', err);
    showToast('✗ 截图没生成出来', 'error');
  });
});
