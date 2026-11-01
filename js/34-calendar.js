// 眠花糖机 — 日历：角色帮你记的提醒 / 闹钟 / 日程（自动记进桌面「纪念日」），一键推送到手机日历（日历文件 / Google 日历）

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
// 直接记进桌面「纪念日」（和这个角色有关），聊天里出现一张卡片，卡片上可以推送到手机日历
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
  '<日程 类型="提醒|闹钟|日程" 时间="YYYY-MM-DD HH:MM">要做的事（简短）</日程>，它会直接记进{{user}}小手机的日历，{{user}}还能一键推送到手机日历。' +
  '时间按{{user}}那边的时间写，没有具体几点就只写日期；类型三选一。不需要时不要写，也不要重复记已经记过的。';

function calWhenText(c) {
  var d = parseYmd(c.date);
  return deskDateText(d) + (c.time ? ' ' + c.time : '');
}
function calTextForAI(c) {
  return '[你帮{{user}}在小手机日历里记下了' + c.kind + '：' + c.date + (c.time ? ' ' + c.time : '') + ' ' + c.title + ']';
}

// 聊天里的卡片：🔔 简然帮你记下了提醒 / 11月2日 周一 08:00 起床 /［推送到手机日历］
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
  var btn = document.createElement('button');
  btn.className = 'cr-action-btn primary';
  btn.textContent = '📲 推送到手机日历';
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    // 桌面「纪念日」里还在就用那一条（可能改过），删掉了就用卡片上记的
    var a = annivs.filter(function(x) { return x.id === c.id; })[0];
    openCalPush(a || { kind: 'event', title: c.title, date: c.date, time: c.time, remind: c.kind, id: c.id });
  });
  card.appendChild(head);
  card.appendChild(body);
  card.appendChild(btn);
  card._msg = m;
  card._extras = [];
  list.appendChild(card);
  list.scrollTop = list.scrollHeight;
  return card;
}

// =============================================
// 日历文件（.ics）：iPhone、安卓的日历都认；带上提醒（提醒 / 闹钟准点，日程提前 15 分钟，全天的当天早上 9 点）
// =============================================
function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function icsUtc(d) {
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
}
function icsDay(d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }
// 开始 / 结束时间：有几点的按时间（日程 1 小时，提醒和闹钟 5 分钟）；没写几点的是全天
function calSpan(a) {
  var p = String(a.date).split('-').map(Number);
  if (a.time) {
    var t = a.time.split(':').map(Number);
    var start = new Date(p[0], p[1] - 1, p[2], t[0], t[1] || 0);
    var mins = (a.remind === '提醒' || a.remind === '闹钟') ? 5 : 60;
    return { allDay: false, start: start, end: new Date(start.getTime() + mins * 60000) };
  }
  var s = new Date(p[0], p[1] - 1, p[2]);
  return { allDay: true, start: s, end: new Date(p[0], p[1] - 1, p[2] + 1) };
}
function buildIcs(a) {
  var sp = calSpan(a), who = (a.charIds || []).map(annivCharName).filter(Boolean);
  var desc = '来自眠花糖机' + (who.length ? ' · 和 ' + who.join('、') : '');
  var trigger = sp.allDay ? 'PT9H' : (a.remind === '提醒' || a.remind === '闹钟') ? 'PT0S' : '-PT15M';
  var lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mphone//Mianhuatangji//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + (a.id || Date.now().toString(36)) + '@mphone',
    'DTSTAMP:' + icsUtc(new Date()),
    sp.allDay ? 'DTSTART;VALUE=DATE:' + icsDay(sp.start) : 'DTSTART:' + icsUtc(sp.start),
    sp.allDay ? 'DTEND;VALUE=DATE:' + icsDay(sp.end) : 'DTEND:' + icsUtc(sp.end),
    'SUMMARY:' + icsEsc((a.remind === '闹钟' ? '⏰ ' : a.remind === '提醒' ? '🔔 ' : '') + a.title),
    'DESCRIPTION:' + icsEsc(desc)
  ];
  if (a.yearly) lines.push('RRULE:FREQ=YEARLY');
  lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(a.title), 'TRIGGER:' + trigger, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
function googleCalUrl(a) {
  var sp = calSpan(a);
  var dates = sp.allDay ? icsDay(sp.start) + '/' + icsDay(sp.end) : icsUtc(sp.start) + '/' + icsUtc(sp.end);
  var q = 'action=TEMPLATE&text=' + encodeURIComponent((a.remind === '闹钟' ? '⏰ ' : a.remind === '提醒' ? '🔔 ' : '') + a.title) +
          '&dates=' + dates + '&details=' + encodeURIComponent('来自眠花糖机');
  if (a.yearly) q += '&recur=' + encodeURIComponent('RRULE:FREQ=YEARLY');
  return 'https://calendar.google.com/calendar/render?' + q;
}

// =============================================
// 推送弹窗：打开日历文件 / 分享日历文件 / Google 日历
// =============================================
var calPushOverlay = document.getElementById('calPushOverlay');
var calPushTarget = null;
// 文件名用英文：有的浏览器会把中文文件名丢掉，没了 .ics 安卓就不知道用日历打开
function calIcsFile(a) {
  var name = 'mphone-' + String(a.date || '').replace(/-/g, '') + (a.time ? '-' + a.time.replace(':', '') : '');
  return new File([buildIcs(a)], name + '.ics', { type: 'text/calendar' });
}
function openCalPush(a) {
  calPushTarget = a;
  var kind = a.remind || (a.kind === 'event' ? '日程' : '纪念日');
  document.getElementById('calPushInfo').textContent = (CAL_ICON[a.remind] || (a.kind === 'event' ? '🗓' : '💗')) + ' ' + a.title + '\n' +
    deskDateText(parseYmd(a.date)) + (a.time ? ' ' + a.time : '（全天）') + (a.yearly ? ' · 每年' : '') + ' · ' + kind;
  var canShare = false;
  try { canShare = !!(navigator.canShare && navigator.canShare({ files: [calIcsFile(a)] })); } catch (_) {}
  document.getElementById('calPushShare').style.display = canShare ? '' : 'none';
  calPushOverlay.classList.add('open');
}
function closeCalPush() { calPushOverlay.classList.remove('open'); }
document.getElementById('calPushFile').addEventListener('click', function() {
  if (!calPushTarget) return;
  var f = calIcsFile(calPushTarget), url = URL.createObjectURL(f);
  var link = document.createElement('a');
  link.href = url;
  link.download = f.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
  closeCalPush();
});
document.getElementById('calPushShare').addEventListener('click', function() {
  if (!calPushTarget) return;
  var f = calIcsFile(calPushTarget);
  closeCalPush();
  navigator.share({ files: [f], title: calPushTarget.title }).catch(function() {});
});
document.getElementById('calPushGoogle').addEventListener('click', function() {
  if (!calPushTarget) return;
  window.open(googleCalUrl(calPushTarget), '_blank');
  closeCalPush();
});
document.getElementById('calPushCancel').addEventListener('click', closeCalPush);
calPushOverlay.addEventListener('click', function(e) { if (e.target === calPushOverlay) closeCalPush(); });
