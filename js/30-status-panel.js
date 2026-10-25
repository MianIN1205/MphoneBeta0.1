// 眠花糖机 — 聊天窗口状态栏面板

// =============================================
// 状态栏面板：点顶栏的角色名展开 / 收起，面板没有底色，不挡聊天界面
// 一次只显示一条状态（默认最新），左右滑动看最近 10 轮的历史
// 带 HTML 的按 HTML 渲染（AI 按角色设置里的 HTML 模板输出）；只有文字的显示成一张线条本卡片
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
function statusIsHtml(s) { return /<[a-z][^>]*>/i.test(s); }
// 「心情：… | 位置：…」这种纯文字的状态：每个字段一行
function statusTextHtml(s) {
  return s.split('|').map(function(x) { return x.trim(); }).filter(Boolean).map(function(x) {
    var d = document.createElement('div');
    d.textContent = x;
    return d.outerHTML;
  }).join('');
}

function statusPanelOpen() { return crStatusPanel.classList.contains('open'); }

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
  var track = document.createElement('div');
  track.className = 'cr-sp-track';
  all.forEach(function(m) {
    var item = document.createElement('div');
    item.className = 'cr-sp-item';
    var time = document.createElement('div');
    time.className = 'cr-sp-time';
    time.textContent = m.time ? fmtMsgTime(m.time) : '';
    // 卡片内容放进 Shadow DOM：模板自带的 <style> 只管自己，不影响聊天界面
    var s = fillMacros(m.status, char);
    var html = statusIsHtml(s);
    var card = document.createElement('div');
    card.className = 'cr-status-card' + (html ? '' : ' cr-status-lined');
    var root = card.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>:host{display:block}' + (look.statusCss || '') + '</style>' +
      (html ? statusSafeHtml(s) : statusTextHtml(s));
    item.appendChild(time);
    item.appendChild(card);
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
  track.scrollLeft = track.scrollWidth;
  syncCount();
}

function openStatusPanel() {
  // 面板从顶栏（开了便捷拓展栏就从拓展栏）下沿开始
  var under = appChatRoom.classList.contains('cr-qb-on') ? document.getElementById('crQuickBar') : appChatRoom.querySelector('.settings-nav');
  crStatusPanel.style.top = (under.getBoundingClientRect().bottom - appChatRoom.getBoundingClientRect().top) + 'px';
  crStatusPanel.classList.add('open');
  renderStatusPanel();
  crStatusPanel.scrollTop = 0;
}
function closeStatusPanel() { crStatusPanel.classList.remove('open'); }
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
