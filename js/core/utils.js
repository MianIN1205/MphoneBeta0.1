// 眠花糖机 — 公共工具：确认弹窗、点遮罩关闭、点一下 / 长按、保存文件、读 zip / docx、时间格式、左滑操作、Toast 提示

const WEEKDAYS = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
function pad(n) { return String(n).padStart(2, '0'); }

function genAccountUid() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// 「我的」账号列表（任意模块可读；修改只在「我的」界面进行）
function loadAccounts() {
  var accs = mphoneStore.load('mphone_mine_accounts_v1', []);
  return Array.isArray(accs) ? accs : [];
}

// 必填项未填写时的抖动提示
function shakeEl(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  el.addEventListener('animationend', function() { el.classList.remove('shake'); }, { once: true });
  if (el.focus) el.focus();
}

// =============================================
// 通用界面工具：确认弹窗、点遮罩关闭、点一下 / 长按
// =============================================
// 确认弹窗（全站共用）：「确认」后执行 onOk；点取消或弹窗外面就算了
var confirmOverlay = document.getElementById('confirmOverlay');
var confirmCallback = null;
// 通用确认框：标题里说的是删除 / 清空 / 移除 / 扔掉这类，按钮写「确认删除」、下面一行「删除后无法恢复」；别的事（种下、发送、恢复默认……）按钮写「确定」，不显示那行
function openConfirm(title, onOk) {
  title = title || '删除此条目？';
  var del = /删|清空|移除|扔掉|拿出来|不要了/.test(title);
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmDesc').style.display = del ? '' : 'none';
  document.getElementById('confirmOk').textContent = del ? '确认删除' : '确定';
  confirmCallback = onOk;
  confirmOverlay.classList.add('open');
}
function closeConfirm() { confirmOverlay.classList.remove('open'); confirmCallback = null; }
document.getElementById('confirmCancel').addEventListener('click', closeConfirm);
document.getElementById('confirmOk').addEventListener('click', function() {
  var fn = confirmCallback;
  closeConfirm();
  if (fn) fn();
});

// 点弹窗外面（遮罩本身）时关掉；onClose 不传就是去掉 open
function closeOnBackdrop(overlay, onClose) {
  overlay.addEventListener('click', function(e) {
    if (e.target !== overlay) return;
    if (onClose) onClose(); else overlay.classList.remove('open');
  });
}
closeOnBackdrop(confirmOverlay, closeConfirm);

// 点一下 / 长按（按住半秒），长按后松手不算点一下
function bindPress(el, onTap, onLong) {
  var timer = null, fired = false, sx = 0, sy = 0;
  el.addEventListener('pointerdown', function(e) {
    fired = false; sx = e.clientX; sy = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(function() {
      timer = null; fired = true;
      if (navigator.vibrate) navigator.vibrate(15);
      onLong();
    }, 500);
  });
  el.addEventListener('pointermove', function(e) {
    if (timer && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) { clearTimeout(timer); timer = null; }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(ev) {
    el.addEventListener(ev, function() { clearTimeout(timer); timer = null; });
  });
  el.addEventListener('click', function(e) {
    e.stopPropagation();
    if (fired) { fired = false; return; }
    onTap();
  });
  el.addEventListener('contextmenu', function(e) { e.preventDefault(); });
}

// =============================================
// 文件工具：保存 / 分享文件、读 zip 和 docx
// =============================================
// 下载文件
function downloadBlob(blob, name) {
  var url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
}
// 手机上走系统分享（可以存到「文件」），电脑上直接下载
function shareOrDownload(blob, name) {
  var file = new File([blob], name, { type: blob.type });
  var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file] }).catch(function() {});
  downloadBlob(blob, name);
  return Promise.resolve();
}

// 读取 zip 里第一个符合条件的文件（docx 导入、NovelAI 生图结果共用）
function zipReadEntry(buf, match) {
  var v = new DataView(buf), u8 = new Uint8Array(buf);
  var eocd = -1;
  for (var i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return Promise.reject(new Error('不是有效的压缩文件'));
  var count = v.getUint16(eocd + 10, true), cd = v.getUint32(eocd + 16, true);
  var entry = null;
  for (var n = 0; n < count; n++) {
    if (v.getUint32(cd, true) !== 0x02014b50) break;
    var nl = v.getUint16(cd + 28, true), el = v.getUint16(cd + 30, true), cl = v.getUint16(cd + 32, true);
    var fname = new TextDecoder().decode(u8.subarray(cd + 46, cd + 46 + nl));
    if (match(fname)) {
      entry = { method: v.getUint16(cd + 10, true), csize: v.getUint32(cd + 20, true), off: v.getUint32(cd + 42, true) };
      break;
    }
    cd += 46 + nl + el + cl;
  }
  if (!entry) return Promise.reject(new Error('压缩文件里没有需要的内容'));
  var lo = entry.off;
  var start = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true);
  var comp = u8.subarray(start, start + entry.csize);
  if (entry.method === 0) return Promise.resolve(comp);
  if (entry.method !== 8 || !window.DecompressionStream) return Promise.reject(new Error('浏览器不支持解压'));
  var stream = new Blob([comp]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).arrayBuffer().then(function(b) { return new Uint8Array(b); });
}

// docx 的正文文字。opts.links：挂在文字上的超链接也把地址读出来（导入表情包用）
function readDocxText(buf, opts) {
  var links = opts && opts.links, rels = {};
  var relsDone = !links ? Promise.resolve() : zipReadEntry(buf, function(n) { return n === 'word/_rels/document.xml.rels'; }).then(function(b) {
    new TextDecoder().decode(b).replace(/<Relationship\b[^>]*>/g, function(tag) {
      var id = (tag.match(/\bId="([^"]+)"/) || [])[1], t = (tag.match(/\bTarget="([^"]+)"/) || [])[1];
      if (id && t && /^https?:/i.test(t)) rels[id] = t.replace(/&amp;/g, '&');
      return '';
    });
  }, function() {});
  return relsDone.then(function() {
    return zipReadEntry(buf, function(name) { return name === 'word/document.xml'; });
  }).then(function(bytes) {
    var xml = new TextDecoder().decode(bytes);
    if (links) {
      xml = xml.replace(/<w:hyperlink\b[^>]*r:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/g, function(all, id, inner) {
        var url = rels[id];
        return url && inner.replace(/<[^>]+>/g, '').indexOf(url) < 0 ? inner + '<w:t> ' + url + ' </w:t>' : inner;
      });
    }
    var text = xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '');
    var ta = document.createElement('textarea');
    ta.innerHTML = text;   // 解码 &amp; 等实体
    text = ta.value.replace(/\n{3,}/g, '\n\n');
    // 老式 Word 的超链接是「HYPERLINK "地址"」域代码
    return links ? text.replace(/\bHYPERLINK\s+"?([^"\s]+)"?/g, ' $1 ') : text;
  });
}

// ---------- 时间显示 ----------
// 两个时间戳相差几个自然日（按本地日期算）
function daysAgo(t) {
  var a = new Date(t), b = new Date();
  a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}
// 聊天里居中显示的时间：今天 14:32 / 昨天 14:32 / 星期三 14:32 / 10月3日 14:32 / 2025年10月3日 14:32
function fmtMsgTime(t) {
  var d = new Date(t), hm = pad(d.getHours()) + ':' + pad(d.getMinutes()), n = daysAgo(t);
  if (n === 0) return hm;
  if (n === 1) return '昨天 ' + hm;
  if (n > 1 && n < 7) return WEEKDAYS[d.getDay()] + ' ' + hm;
  var md = (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  return d.getFullYear() === new Date().getFullYear() ? md : d.getFullYear() + '年' + md;
}
// 会话列表右上角的时间：14:32 / 昨天 / 星期三 / 10/3 / 2025/10/3
function fmtListTime(t) {
  var d = new Date(t), n = daysAgo(t);
  if (n === 0) return pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (n === 1) return '昨天';
  if (n > 1 && n < 7) return WEEKDAYS[d.getDay()];
  var md = (d.getMonth() + 1) + '/' + d.getDate();
  return d.getFullYear() === new Date().getFullYear() ? md : d.getFullYear() + '/' + md;
}
// 多久以前：刚刚 / 5 分钟前 / 3 小时前 / 2 天前
function fmtAgo(t) {
  if (!t) return '';
  var m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + ' 分钟前';
  if (m < 1440) return Math.floor(m / 60) + ' 小时前';
  return Math.floor(m / 1440) + ' 天前';
}
// 一段时长：25 分钟 / 3 小时 / 2 天
function durText(ms) {
  var m = Math.round(ms / 60000);
  if (m < 60) return m + ' 分钟';
  var h = Math.round(m / 60);
  return h < 48 ? h + ' 小时' : Math.round(h / 24) + ' 天';
}


// ---------- 通用左滑操作 ----------
// row 是 position:relative 的容器，front 是可点击的内容，acts 是右侧按钮组（宽 width）。
// 内容不移动，按钮从右边滑进来盖住右侧；同一时间只展开一行。
var _openSwipeRow = null;
function closeSwipeRow(row) {
  if (!row) return;
  row._setSwipe(0);
  row.classList.remove('open');
  if (_openSwipeRow === row) _openSwipeRow = null;
}
function bindSwipeActions(row, front, acts, width) {
  var startX = 0, startY = 0, base = 0, dx = 0, dragging = false, decided = false;
  row._setSwipe = function(x) {
    acts.style.transform = 'translateX(' + (width + x) + 'px)';
    front.style.paddingRight = (-x > 14 ? -x : 14) + 'px';
  };
  front.addEventListener('pointerdown', function(e) {
    startX = e.clientX; startY = e.clientY;
    base = row.classList.contains('open') ? -width : 0;
    dx = 0; dragging = true; decided = false;
    acts.style.transition = front.style.transition = 'none';
  });
  front.addEventListener('pointermove', function(e) {
    if (!dragging) return;
    var mx = e.clientX - startX, my = e.clientY - startY;
    if (!decided) {
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      decided = true;
      // 竖向滑动交给列表滚动
      if (Math.abs(my) > Math.abs(mx)) { dragging = false; acts.style.transition = front.style.transition = ''; return; }
      try { front.setPointerCapture(e.pointerId); } catch (_) {}
      if (_openSwipeRow && _openSwipeRow !== row) closeSwipeRow(_openSwipeRow);
    }
    dx = mx;
    row._setSwipe(Math.max(-width, Math.min(0, base + dx)));
  });
  function end() {
    if (!dragging) return;
    dragging = false;
    acts.style.transition = front.style.transition = '';
    if (!decided) return;
    // 刚滑动过，接下来的点击不算「打开」
    row._justSwiped = true;
    setTimeout(function() { row._justSwiped = false; }, 350);
    if (base + dx < -width / 2) {
      row._setSwipe(-width);
      row.classList.add('open');
      _openSwipeRow = row;
    } else {
      closeSwipeRow(row);
    }
  }
  front.addEventListener('pointerup', end);
  front.addEventListener('pointercancel', end);
}
// 点击正在滑开（或刚滑过）的行：只收起，不触发打开
document.addEventListener('click', function(e) {
  var row = e.target.closest && e.target.closest('.swipe-row');
  if (!row || e.target.closest('.swipe-acts')) return;
  if (row._justSwiped || row.classList.contains('open')) {
    e.stopPropagation(); e.preventDefault();
    closeSwipeRow(row);
  }
}, true);
document.addEventListener('pointerdown', function(e) {
  if (_openSwipeRow && !_openSwipeRow.contains(e.target)) closeSwipeRow(_openSwipeRow);
});

// Toast 提示（屏幕偏上方小弹窗）
function showToast(msg, type) {
  var toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = [
    'position:fixed',
    'top:60px',
    'left:50%',
    'transform:translateX(-50%)',
    // 半透明 + 毛玻璃：后面的内容隐约透出来，字还看得清；type 为 'plain' 时是白色底、深灰字（新动态这类普通消息）
    'background:' + (type === 'success' ? 'rgba(56,168,90,0.72)' : type === 'plain' ? 'rgba(255,255,255,0.72)' : 'rgba(210,60,60,0.72)'),
    'backdrop-filter:blur(10px)',
    '-webkit-backdrop-filter:blur(10px)',
    'color:' + (type === 'plain' ? '#5a4a52' : '#fff'),
    'padding:7px 20px',
    'border-radius:20px',
    'font-size:13px',
    'font-weight:600',
    'font-family:system-ui,-apple-system,sans-serif',
    'letter-spacing:0.3px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.16)',
    'z-index:99999',
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 0.2s ease',
    'white-space:nowrap'
  ].join(';');
  document.body.appendChild(toast);
  requestAnimationFrame(function() {
    requestAnimationFrame(function() { toast.style.opacity = '1'; });
  });
  setTimeout(function() {
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
  }, 1700);
}
