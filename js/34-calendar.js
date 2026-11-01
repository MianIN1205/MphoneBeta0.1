// 眠花糖机 — 日历：角色帮你记的提醒 / 闹钟 / 日程，只记在小手机里（桌面「纪念日」），像 TA 帮你写的小备忘录

// =============================================
// 时间：角色写的「2026-11-02 08:00」「11月2日 08:00」「2026-11-02」都认；没写年份时取今年，已经过去就算明年
// =============================================
function parseCalTime(s) {
  s = String(s || '').trim();
  var m = s.match(/(?:(\d{4})\s*[-/.年]\s*)?(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?(?:\s*(\d{1,2})\s*[:：点时]\s*(\d{1,2})?)?/);
  if (!m) return null;
  var now = new Date(), y = m[1] ? +m[1] : now.getFullYear(), mo = +m[2], d = +m[3];
  var h = m[4] !== undefined ? +m[4] : null, mi = m[5] !== undefined ? +m[5] : 0;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || (h !== null && (h > 23 || mi > 59))) return null;
  if (!m[1] && new Date(y, mo - 1, d, 23, 59) < now) y++;
  return { date: y + '-' + pad(mo) + '-' + pad(d), time: h === null ? '' : pad(h) + ':' + pad(mi) };
}

// =============================================
// 角色回复里的 <日程 类型="提醒|闹钟|日程" 时间="2026-11-02 08:00">起床</日程>：
// 直接记进桌面「纪念日」（和这个角色有关），聊天里出现一张卡片；不加到手机系统的日历
// =============================================
var CAL_TAG_RE = /<(日程|提醒|闹钟)((?:\s+[^>]*)?)>([\s\S]*?)<\/\1>/g;
function calAttr(attrs, name) {
  var m = String(attrs || '').match(new RegExp(name + '\\s*=\\s*["“\'「]([^"”\'」]*)["”\'」]'));
  return m ? m[1].trim() : '';
}
function addCharEvent(char, item) {
  // 重新生成时可能再记一次：同一个角色、同一件事、同一时间只记一条
  var same = annivs.filter(function(a) { return a.by === char.id && a.title === item.title && a.date === item.date && (a.time || '') === item.time; })[0];
  if (same) return same;
  var a = { id: 'an' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: 'event', title: item.title,
            date: item.date, time: item.time, yearly: false, pin: false, show: false, charIds: [char.id], remind: item.kind, by: char.id };
  annivs.push(a);
  saveAnnivs();
  if (document.getElementById('appAnniv').classList.contains('active')) renderAnnivs();
  return a;
}
// 取出标记、记下日程；返回去掉标记后的文字，记下的放进 out（{ id, kind, title, date, time }）
function extractCalTags(char, raw, out) {
  return String(raw || '').replace(CAL_TAG_RE, function(all, tag, attrs, text) {
    var title = text.replace(/\s+/g, ' ').trim().slice(0, 24);
    var kind = calAttr(attrs, '类型') || tag;
    if (!CAL_ICON[kind]) kind = '日程';
    var when = parseCalTime(calAttr(attrs, '时间'));
    if (!title || !when) return '';
    var a = addCharEvent(char, { kind: kind, title: title, date: when.date, time: when.time });
    out.push({ id: a.id, kind: kind, title: title, date: when.date, time: when.time });
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
}
// 告诉角色可以这样帮忙记（聊天窗口的回复格式里）
var CAL_RULE = '如果{{user}}请你提醒 TA 某件事、帮 TA 定闹钟或者记日程，或者你们约好了某个时间要一起做的事，可以在全部消息最后另起一行写 ' +
  '<日程 类型="提醒|闹钟|日程" 时间="YYYY-MM-DD HH:MM">要做的事（简短）</日程>，它会记进{{user}}小手机里的日历，你之后也会看到。' +
  '时间按{{user}}那边的时间写，没有具体几点就只写日期；类型三选一。不需要时不要写，也不要重复记已经记过的。';

function calWhenText(c) {
  var d = parseYmd(c.date);
  return deskDateText(d) + (c.time ? ' ' + c.time : '');
}
function calTextForAI(c) {
  return '[你帮{{user}}在小手机日历里记下了' + c.kind + '：' + c.date + (c.time ? ' ' + c.time : '') + ' ' + c.title + ']';
}

// 聊天里的卡片：🔔 简然帮你记下了提醒 / 11月2日 08:00 起床
function renderCalCard(m, list, empty) {
  list = list || getActiveMsgListEl();
  if (empty) empty.style.display = 'none';
  var c = m.cal, char = charList[openingChatCharIdx] || {};
  var card = document.createElement('div');
  card.className = 'cr-cal-card';
  var head = document.createElement('div');
  head.className = 'cr-cal-head';
  head.textContent = (CAL_ICON[c.kind] || '🗓') + ' ' + (char.charAlias || char.charName || 'TA') + ' 帮你记下了' + c.kind;
  var body = document.createElement('div');
  body.className = 'cr-cal-body';
  body.textContent = calWhenText(c) + '  ' + c.title;
  card.appendChild(head);
  card.appendChild(body);
  card._msg = m;
  card._extras = [];
  list.appendChild(card);
  list.scrollTop = list.scrollHeight;
  return card;
}
