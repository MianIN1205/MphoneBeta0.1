// 眠花糖机 — 聊天窗口状态栏面板：点角色名展开，按模板画出状态

// =============================================
// 状态栏面板：点顶栏的角色名展开 / 收起，面板没有底色，不挡聊天界面
// 一次只显示一条状态（默认最新），左右滑动看最近 10 轮的历史
// AI 只输出字段内容，按角色设置里的 HTML 模板画出来；没有模板时显示成一张线条本卡片
// =============================================
var crStatusPanel = document.getElementById('crStatusPanel');
var STATUS_HISTORY = 10;

// 去掉脚本、内嵌页面和事件属性，只留标签和样式
function statusSafeHtml(html) {
  var doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
  doc.body.querySelectorAll('script,iframe,frame,object,embed,link,meta,base,form').forEach(function(el) { el.remove(); });
  doc.body.querySelectorAll('*').forEach(function(el) {
    Array.from(el.attributes).forEach(function(a) {
      if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    });
  });
  return doc.body.innerHTML;
}
// ---------- 酒馆正则状态栏（角色设置里「导入酒馆正则」）----------
// findRegex 可能是「/…/flags」或者光秃秃的正则
function statusRegexOf(find) {
  find = String(find || '').trim();
  if (!find) return null;
  var m = find.match(/^\/([\s\S]+)\/([a-z]*)$/);
  try { return m ? new RegExp(m[1], m[2].replace(/g/g, '')) : new RegExp(find); } catch (e) { return null; }
}
// 先照原样匹配；对不上再把状态栏里「一项写成了两行」的接回一行再试（角色这样写时正则对不上，退回横线纸，用户遇到过时好时坏）。
// 不能用「让 . 跨行」的 s 标记重试：用户那种二十个 (.*?) 的正则对不上时，s 标记会让手机算好几秒到几十秒，整个小手机卡住（用户遇到过：点状态栏卡住、等回复时点了没反应过一会儿突然跳界面）
function statusRegexMatch(find, t) {
  var re = statusRegexOf(find), m = re && t.match(re);
  if (!m && re) { var t2 = statusJoinWrapped(find, t); if (t2 !== t) { m = t2.match(re); if (m) t = t2; } }
  return { re: re, m: m, t: t };
}
// 只动状态栏那一段：不像「名字：」开头的行，接到上一行后面
function statusJoinWrapped(find, t) {
  var tag = statusRegexTag(find);
  if (!tag) return t;
  var open = tag.square ? '[' + tag.name + ']' : '<' + tag.name + '>', close = tag.square ? '[/' + tag.name + ']' : '</' + tag.name + '>';
  var a = t.indexOf(open);
  if (a < 0) return t;
  var b = t.indexOf(close, a), end = b < 0 ? t.length : b;
  var lines = t.slice(a + open.length, end).split('\n'), out = [];
  lines.forEach(function(l) {
    if (out.length > 1 && l.trim() && !/^\s*([^\s:：]{1,8}[:：]|[\[<]|[♥❤])/.test(l)) out[out.length - 1] += ' ' + l.trim();
    else out.push(l);
  });
  return t.slice(0, a + open.length) + out.join('\n') + t.slice(end);
}
// 状态栏外面那层标签的名字（[状态栏]、<StatusBlock> 这种），角色写成另一种括号时换成正则要的那种
function statusRegexTag(find) {
  var s = String(find || '').replace(/^\//, '').replace(/^\^/, '');
  // 外层标签可有可无的写法：(?:<状态栏>|\[状态栏\])?（小手机换算出来的）
  var opt = s.match(/^\(\?:<([^>|]+)>\|/);
  if (opt) return { name: opt[1], square: false };
  // 两种括号都认的写法：[\[<]状态栏[\]>]
  var both = s.match(/^\[\\\[<\]([^\[\]\\]+)\[\\\]>\]/);
  if (both) return { name: both[1], square: true };
  var m = s.match(/^\\\[([^\\\[\]]+)\\\]/) || s.match(/^<([^>\s\\]+)>/);
  return m ? { name: m[1], square: s.charAt(0) === '\\' } : null;
}
function statusRegexNorm(find, text) {
  var t = String(text || ''), tag = statusRegexTag(find);
  if (!tag) return t;
  var n = tag.name;
  return tag.square ? t.split('<' + n + '>').join('[' + n + ']').split('</' + n + '>').join('[/' + n + ']')
                    : t.split('[' + n + ']').join('<' + n + '>').split('[/' + n + ']').join('</' + n + '>');
}
// 从回复里取出状态栏：正则对上的那段；对不上时把外层标签包住的那段拿走（不让它出现在聊天里）
function statusRegexTake(spec, raw) {
  var t = statusRegexNorm(spec.find, raw), rm = statusRegexMatch(spec.find, t), re = rm.re, m = rm.m;
  t = rm.t;
  if (!m) {
    var tag = statusRegexTag(spec.find);
    if (tag) {
      var q = tag.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      m = t.match(new RegExp(tag.square ? '\\[' + q + '\\][\\s\\S]*?(\\[\\/' + q + '\\]|$)' : '<' + q + '>[\\s\\S]*?(<\\/' + q + '>|$)'));
    }
  }
  if (!m) return { text: raw, status: '' };
  return { text: t.replace(m[0], '').replace(/\s+$/, ''), status: m[0].trim() };
}
// 套进 HTML：和酒馆一样，$1、$2… 是第几个括号，{{match}} 是整段
function statusRegexRender(spec, s) {
  var t = statusRegexNorm(spec.find, s), rm = statusRegexMatch(spec.find, t), re = rm.re, m = rm.m;
  if (!m) return null;
  return m[0].replace(re, String(spec.tpl || '').replace(/\{\{\s*match\s*\}\}/gi, '$$&'));
}
// 边生成边出气泡时，状态栏那段不要冒出来：从它开头的地方截掉
function statusStreamCut(char, text) {
  var look = Object.assign({}, DEFAULT_LOOK, (char && char.look) || {});
  var spec = look.statusOn ? statusSpec(look) : null;
  if (!spec) return text;
  var tag = statusRegexTag(spec.find), cut = text.length;
  (tag ? ['[' + tag.name + ']', '<' + tag.name + '>'] : []).forEach(function(o) { var i = text.indexOf(o); if (i >= 0 && i < cut) cut = i; });
  return text.slice(0, cut);
}

// 以前 AI 直接写的整段 HTML（开头就是标签）；字段内容里夹着的标签不算，填模板时会被转义
function statusIsHtml(s) { return /^\s*<[a-z!]/i.test(s); }
// 「心情：… | 位置：…」这种纯文字的状态：每个字段一行
function statusTextHtml(s) {
  return s.split('|').map(function(x) { return x.trim(); }).filter(Boolean).map(function(x) {
    var d = document.createElement('div');
    d.textContent = x;
    return d.outerHTML;
  }).join('');
}

// AI 输出的「心情：… | 好感度：68」拆成字段；没写字段名的，按模板里字段的顺序依次填
function parseStatusFields(s, fields) {
  var vals = {}, loose = [];
  String(s || '').split(/\s*[|｜\n]\s*/).forEach(function(p) {
    p = p.trim();
    if (!p) return;
    var kv = p.match(/^([^:：]{1,12})[:：]\s*([\s\S]*)$/);
    if (kv) vals[kv[1].trim()] = kv[2].trim(); else loose.push(p);
  });
  (fields || []).forEach(function(f) { if (vals[f] === undefined && loose.length) vals[f] = loose.shift(); });
  return vals;
}
function statusEsc(s) {
  return String(s).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
// 把字段内容填进模板；写在 style 里的占位符（比如进度条宽度）只取数字，免得把样式写坏
function fillStatusTpl(tpl, vals, char) {
  var val = function(n) { var v = vals[String(n).trim()]; return v === undefined ? '' : v; };
  var out = fillMacros(tpl, char).replace(/style\s*=\s*"([^"]*)"/gi, function(all, css) {
    return 'style="' + css.replace(STATUS_FIELD_RE, function(m, n) {
      var num = String(val(n)).match(/-?\d+(\.\d+)?/);
      return num ? num[0] : '0';
    }) + '"';
  });
  return out.replace(STATUS_FIELD_RE, function(m, n) { return statusEsc(val(n)); });
}

function statusPanelOpen() { return crStatusPanel.classList.contains('open'); }

// 状态栏的字体：默认跟着小手机（外观里设的字体），用户要的。模板（尤其酒馆来的）常写「Microsoft YaHei, Segoe UI, Arial」这类电脑上的通用字体，
// 手机上没有就退回系统字、和小手机不一样：这种只写了通用字体的 font-family 当没写；写了特别的字体（自己引入的手写体之类）就照它的
var STATUS_GENERIC_FONTS = /^(microsoft yahei( ui)?|微软雅黑|microsoft jhenghei|pingfang( sc| tc| hk)?|hiragino sans( gb)?|heiti( sc| tc)?|黑体|simhei|simsun|宋体|nsimsun|noto sans( sc| cjk sc| cjk)?|source han sans( sc| cn)?|思源黑体|segoe ui|arial|helvetica( neue)?|sans-serif|system-ui|-apple-system|blinkmacsystemfont|roboto|tahoma|verdana|ui-sans-serif|inherit|initial|unset|\s*)$/i;
function statusFontFollow(html) {
  return String(html || '').replace(/font-family\s*:\s*([^;}"<]*(?:"[^"]*"[^;}"<]*)*)(;?)/gi, function(all, list) {
    var fonts = list.replace(/!important/i, '').split(',').map(function(f) { return f.trim().replace(/^['"]|['"]$/g, '').trim(); }).filter(Boolean);
    return fonts.length && fonts.every(function(f) { return STATUS_GENERIC_FONTS.test(f); }) ? '' : all;
  });
}
// 小梦改状态栏的确认卡片上的效果图：拿这个角色最近一条状态栏，照改完的写法画一张（和面板里一样放进 Shadow DOM）；没有状态栏就不画
function statusPreviewEl(a) {
  var char = typeof findCharByName === 'function' ? findCharByName(a.target) : null;
  if (!char) return null;
  var hist = chatHistories[char.id] || [], last = null;
  for (var i = hist.length - 1; i >= 0; i--) if (hist[i] && hist[i].status) { last = hist[i]; break; }
  if (!last) return null;
  var look = Object.assign({}, DEFAULT_LOOK, char.look || {}, typeof statusLookPatch === 'function' ? statusLookPatch(a) : {});
  var spec = statusSpec(look), rx = spec ? statusRegexRender(spec, last.status) : null, body, lined = false;
  if (rx) body = statusSafeHtml(fillMacros(rx, char));
  else if (statusIsHtml(last.status)) body = statusSafeHtml(fillMacros(last.status, char));
  else { body = statusTextHtml(fillMacros(last.status, char).replace(/\n+/g, '|')); lined = true; }
  var wrap = document.createElement('div');
  wrap.className = 'cr-action-status-preview';
  var card = document.createElement('div');
  card.className = 'cr-status-card' + (lined ? ' cr-status-lined' : '');
  card.attachShadow({ mode: 'open' }).innerHTML = statusFontFollow('<style>:host{display:block}' + (look.statusCss || '') + '</style>' + body);
  wrap.appendChild(card);
  return wrap;
}
function renderStatusPanel() {
  var char = charList[openingChatCharIdx];
  crStatusPanel.innerHTML = '';
  if (!char) return;
  var look = Object.assign({}, DEFAULT_LOOK, char.look || {});
  // 从旧到新排成一行，打开时停在最新一条；往右滑看更早的
  var all = getChatHistory(openingChatCharIdx).filter(function(m) { return m.status && !m.recalled; }).slice(-STATUS_HISTORY);
  if (!all.length) {
    var empty = document.createElement('div');
    empty.className = 'cr-sp-empty';
    empty.textContent = look.statusOn ? '还没有状态，等角色下一次回复吧' : '还没有状态栏，可以在角色设置 →「美化」→「状态栏」里开启';
    crStatusPanel.appendChild(empty);
    return;
  }
  var spec = statusSpec(look);
  var track = document.createElement('div');
  track.className = 'cr-sp-track';
  all.forEach(function(m) {
    var item = document.createElement('div');
    item.className = 'cr-sp-item';
    var time = document.createElement('div');
    time.className = 'cr-sp-time';
    time.textContent = m.time ? fmtMsgTime(m.time) : '';
    // 卡片内容放进 Shadow DOM：模板自带的 <style> 只管自己，不影响聊天界面
    // 正则认得出就套进美化 HTML；以前 AI 直接写的整段 HTML 照原样显示；都不是就按行显示成线条本卡片
    var body, lined = false, rx = spec ? statusRegexRender(spec, m.status) : null;
    if (rx) body = statusSafeHtml(fillMacros(rx, char));
    else if (statusIsHtml(m.status)) body = statusSafeHtml(fillMacros(m.status, char));
    else { body = statusTextHtml(fillMacros(m.status, char).replace(/\n+/g, '|')); lined = true; }
    var card = document.createElement('div');
    card.className = 'cr-status-card' + (lined ? ' cr-status-lined' : '');
    var root = card.attachShadow({ mode: 'open' });
    var cardHtml = statusFontFollow('<style>:host{display:block}' + (look.statusCss || '') + '</style>' + body);
    root.innerHTML = cardHtml;
    item.appendChild(time);
    // 卡片放在自己的框里上下滑；下面的 删除 / 收藏 / 关闭 固定不动（用户要的：状态栏太长时也看得到按钮）
    var scroll = document.createElement('div');
    scroll.className = 'cr-sp-scroll';
    scroll.appendChild(card);
    item.appendChild(scroll);
    var acts = document.createElement('div');
    acts.className = 'cr-sp-acts';
    [['del', '删除'], ['fav', '收藏'], ['close', '关闭']].forEach(function(a) {
      var b = document.createElement('button');
      b.className = 'cr-sp-act';
      b.textContent = a[1];
      b.addEventListener('click', function(e) {
        e.stopPropagation();
        if (a[0] === 'close') { closeStatusPanel(); return; }
        if (a[0] === 'fav') {
          if (typeof addFav === 'function') addFav({ kind: 'status', html: cardHtml, lined: lined, text: '', images: [], source: '状态栏',
            author: char.charAlias || char.charName || '', time: m.time || Date.now(), refId: 'status:' + char.id + ':' + (m.time || '') });
          return;
        }
        openConfirm('删除这一条状态？（聊天消息还在，只删状态栏）', function() {
          delete m.status;
          saveHistories();
          renderStatusPanel();
        });
      });
      acts.appendChild(b);
    });
    item.appendChild(acts);
    track.appendChild(item);
  });
  crStatusPanel.appendChild(track);
  // 第几条 / 共几条（只有一条时不显示）
  var count = document.createElement('div');
  count.className = 'cr-sp-count';
  if (all.length > 1) crStatusPanel.appendChild(count);
  var syncCount = function() {
    var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    count.textContent = (i + 1) + ' / ' + all.length;
  };
  track.addEventListener('scroll', syncCount, { passive: true });
  // 保底：手指横着划（或者电脑上拖）但浏览器没自己滚的时候（卡片里的模板自己拦了手势之类），按方向翻到上一条 / 下一条
  var sx = 0, sy = 0, sl = 0, down = false;
  track.addEventListener('pointerdown', function(e) { down = true; sx = e.clientX; sy = e.clientY; sl = track.scrollLeft; });
  track.addEventListener('pointerup', function(e) {
    if (!down) return;
    down = false;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5 || Math.abs(track.scrollLeft - sl) > 8) return;   // 不是横划，或者浏览器已经滚过了
    var w = Math.max(1, track.clientWidth), i = Math.round(track.scrollLeft / w) + (dx < 0 ? 1 : -1);
    track.scrollTo({ left: Math.max(0, Math.min(all.length - 1, i)) * w, behavior: 'smooth' });
  });
  track.addEventListener('pointercancel', function() { down = false; });
  track.scrollLeft = track.scrollWidth;
  syncCount();
}

function openStatusPanel() {
  // 面板从顶栏（开了便捷拓展栏就从拓展栏）下沿开始
  var under = appChatRoom.classList.contains('cr-qb-on') ? document.getElementById('crQuickBar') : appChatRoom.querySelector('.settings-nav');
  var roomTop = appChatRoom.getBoundingClientRect().top, top = under.getBoundingClientRect().bottom - roomTop;
  crStatusPanel.style.top = top + 'px';
  // 高度一直到输入栏上面（卡片长的话在面板里上下滑）
  var barTop = crBottomBar ? crBottomBar.getBoundingClientRect().top - roomTop : appChatRoom.clientHeight;
  var maxH = Math.max(160, barTop - top - 4);
  crStatusPanel.style.maxHeight = maxH + 'px';
  crStatusPanel.style.setProperty('--sp-max', maxH + 'px');   // 每一条在这个高度里自己上下滑
  crStatusPanel.classList.add('open');
  var mask = document.getElementById('crSpMask');
  if (mask) { mask.style.top = top + 'px'; mask.classList.add('open'); }   // 后面模糊、点不到
  renderStatusPanel();
  crStatusPanel.scrollTop = 0;
}
function closeStatusPanel() {
  crStatusPanel.classList.remove('open');
  var mask = document.getElementById('crSpMask');
  if (mask) mask.classList.remove('open');
}
// 新回复到达、角色设置改动后：面板开着就刷新
function refreshStatusPanel() {
  if (!statusPanelOpen()) return;
  if (!appChatRoom.classList.contains('active') || !charList[openingChatCharIdx]) closeStatusPanel();
  else renderStatusPanel();
}

document.querySelector('#appChatRoom .chat-room-title-text').addEventListener('click', function(e) {
  e.stopPropagation();
  if (statusPanelOpen()) closeStatusPanel(); else openStatusPanel();
});
crStatusPanel.addEventListener('click', function(e) { e.stopPropagation(); });
document.addEventListener('click', function() { if (statusPanelOpen()) closeStatusPanel(); });
new MutationObserver(function() {
  if (!appChatRoom.classList.contains('active')) closeStatusPanel();
}).observe(appChatRoom, { attributes: true, attributeFilter: ['class'] });
