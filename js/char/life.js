// 眠花糖机 — 让角色活起来、贴近用户的生活：
// · 待关心：用户说起之后要发生的事（考试、面试、看病……），角色记下来（<待关心 时间="…">），到时候自然地问问，问过写 <已关心>序号</已关心>（char.followUps）
// · TA 的今天：每个角色每天自己的几件小事，聊天、动态、日记、查手机都对得上（mphone_char_days，小手机开着时每天写一次）
// · 聊出来的设定：聊天里 TA 第一次说出关于自己的新细节就记下来（<补人设>），以后保持一致，角色设置里能看能改（char.selfFacts）
// · 防复读：把 TA 最近几条的开头列出来，要求换说法

function lifeDayKey(t) { var d = new Date(t || Date.now()); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function lifeHm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function lifeMd(t) { var d = new Date(t); return (d.getMonth() + 1) + '-' + d.getDate() + ' ' + lifeHm(t); }

// ---------- 回复里的标签：<待关心> <已关心> <补人设> ----------
function lifeParseTime(s) {
  s = String(s || '').trim().replace(/\//g, '-');
  var m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) { var t = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 20, m[5] ? +m[5] : 0).getTime(); if (!isNaN(t)) return t; }
  return Date.now() + 24 * 3600000;   // 没写清楚就当一天后
}
function lifeTakeTags(char, text) {
  if (!char) return text;
  var changed = false;
  text = String(text || '').replace(/<待关心([^>]*)>([\s\S]*?)(<\/待关心>|$)/g, function(_, attr, body) {
    var what = body.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (what) {
      var due = lifeParseTime((attr.match(/时间\s*=\s*["“「]([^"”」]+)/) || [])[1]);
      char.followUps = (char.followUps || []).filter(function(f) { return f.text !== what; }).concat({ id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text: what, due: due, at: Date.now() }).slice(-20);
      changed = true;
    }
    return '';
  });
  text = text.replace(/<已关心>([\s\S]*?)(<\/已关心>|$)/g, function(_, body) {
    var list = lifeFollowShown[char.id] || [];
    String(body).replace(/\d+/g, function(n) { var f = list[+n - 1]; if (f) f.done = Date.now(); changed = true; return n; });
    return '';
  });
  text = text.replace(/<补人设>([\s\S]*?)(<\/补人设>|$)/g, function(_, body) {
    var fact = body.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (fact && (char.selfFacts || []).indexOf(fact) < 0) { char.selfFacts = (char.selfFacts || []).concat(fact).slice(-60); changed = true; }
    return '';
  });
  if (changed) {
    // 问过超过 3 天的、做完的就不留了
    var now = Date.now();
    char.followUps = (char.followUps || []).filter(function(f) { return !f.done && now - f.due < 3 * 86400000; });
    saveCharList();
  }
  return text;
}
var LIFE_TAG_STRIP = /<(待关心|已关心|补人设)[\s\S]*?(<\/(待关心|已关心|补人设)>|$)/g;   // 边生成边出的预览里藏掉

// ---------- 给聊天的要求（chatFormatRules 里加） ----------
function lifeFormatRules(char) {
  var out = [];
  out.push('{{user}}说起之后要发生的事（考试、面试、看病、出远门、截稿、约会、重要的电话……）时，在全部消息最后另起一行写 <待关心 时间="YYYY-MM-DD HH:MM">到时候想问问的事，从你的角度写，比如：她下午考完四级了，问问感觉怎么样</待关心>，时间写那件事结束、适合问的时候（现在是 ' + charNowText(char) + '）。只记真的值得关心的事，不用每次都写。');
  out.push('聊天里你第一次说出关于自己的新细节（喜欢或讨厌的东西、习惯、过去的经历、家里的事……），而人设和下面「你补充过的自己」里都没有时，在全部消息最后另起一行写 <补人设>一句话写清这个细节</补人设>，以后一直和它保持一致。很少用，只记真正新的、具体的细节。');
  // 防复读：最近几条的开头
  var hist = chatHistories[char.id] || [], heads = [];
  for (var i = hist.length - 1; i >= 0 && heads.length < 8; i--) {
    var m = hist[i];
    if (m.role !== 'assistant' || m.recalled || m.pat || m.note || m.action || !m.content || m.sticker || m.textImg) continue;
    var h = String(m.content).replace(actionRe(), '').trim().slice(0, 6);
    if (h && heads.indexOf(h) < 0) heads.push(h);
  }
  if (heads.length >= 3) out.push('你最近几条是这样开头的：' + heads.map(function(h) { return '「' + h + '…」'; }).join('') + '。这次换个开头和说法，别重复自己的口头禅和句式；语音、表情包、照片、撤回这些偶尔用、换着用，不要总是同一种。');
  return out;
}

// ---------- 现实感知里的两段：TA 的今天、记着要关心的事 ----------
var lifeFollowShown = {};   // 角色id → 这次列出来的待关心（<已关心>序号 对应这里）
function lifeContextLines(char) {
  var lines = [], now = Date.now();
  var day = lifeDays[char.id];
  if (day && day.date === lifeDayKey() && (day.items || []).length) {
    var hm = lifeHm(now), done = [], plan = [];
    day.items.forEach(function(it) { (String(it.time) <= hm ? done : plan).push(it.time + ' ' + it.text); });
    lines.push('【你的今天】这是你自己今天的生活。' + (done.length ? '到现在已经发生的：' + done.join('；') + '。' : '') + (plan.length ? '接下来打算：' + plan.join('；') + '。' : '') +
      '想起来可以自然地说说（顺口抱怨一句、分享一件小事），不用每次都提，也别抢{{user}}的话题；没发生的不要说成已经发生。');
  }
  var fs = (char.followUps || []).filter(function(f) { return !f.done && f.due - now < 3 * 86400000 && now - f.due < 3 * 86400000; });
  lifeFollowShown[char.id] = fs;
  if (fs.length) {
    lines.push('【记着要关心的事】' + fs.map(function(f, i) {
      return (i + 1) + '. ' + f.text + '（' + lifeMd(f.due) + (f.due <= now ? '，时间已经到了' : '，还没到') + '）';
    }).join('\n') + '\n时间到了的，找个自然的时机问问后来怎么样了（不用一次全问）；还没到的可以提前打个气。问过的，在全部消息最后另起一行写 <已关心>序号</已关心>。');
  }
  return lines;
}

// ---------- TA 的今天：每天写一次 ----------
var lifeDays = mphoneStore.load('mphone_char_days', {}) || {};
var lifeBusy = false, lifeRetry = {};
function lifeTick() {
  if (lifeBusy || !charList.length) return;
  var api = getApiCfg();
  if (!api.url || !api.key || !api.model) return;
  var today = lifeDayKey(), now = Date.now();
  var char = charList.filter(function(c) {
    if (!c.id || c.builtinAssistant || (lifeRetry[c.id] || 0) > now) return false;
    if (lifeDays[c.id] && lifeDays[c.id].date === today) return false;
    var last = typeof lastSessionMsg === 'function' ? lastSessionMsg(c) : null;
    return c.inChat && last && last.time && now - last.time < 7 * 86400000;   // 一周内聊过的才写，省请求
  })[0];
  if (!char) return;
  var idx = findCharIdx(char.id);
  if (idx < 0) return;
  lifeBusy = true;
  var msgs = charContextMsgs(idx).concat([activityAsk('【你的今天】今天是 ' + charNowText(char).replace(/\s*\d{1,2}:\d{2}.*$/, '') + '。按你的人设、身份、处境和最近的生活，安排你今天会发生的 4～6 件小事：具体、日常、带一点点情绪（比如早上咖啡洒在衬衫上、午饭吃到一家好吃的面、下午被夸了、晚上要加班），时间从早到晚分布，大多数和{{user}}无关，是你自己的生活。' +
    '只输出 JSON：{"items":[{"time":"08:20","text":"一句话"}]}，time 用 24 小时制。')]);
  callApiOnce(msgs, char).then(function(text) {
    var m = String(text).match(/\{[\s\S]*\}/), o = m ? JSON.parse(m[0]) : null;
    var items = (o && Array.isArray(o.items) ? o.items : []).map(function(it) {
      var t = String(it && it.time || '').match(/(\d{1,2}):(\d{2})/);
      return t && it.text ? { time: pad(+t[1]) + ':' + t[2], text: String(it.text).trim().slice(0, 60) } : null;
    }).filter(Boolean).sort(function(a, b) { return a.time < b.time ? -1 : 1; }).slice(0, 8);
    if (!items.length) throw new Error('空的');
    lifeDays[char.id] = { date: today, items: items };
    // 只留最近的，删掉的角色也清掉
    Object.keys(lifeDays).forEach(function(k) { if (findCharIdx(k) < 0) delete lifeDays[k]; });
    mphoneStore.save('mphone_char_days', lifeDays);
  }).catch(function() {
    lifeRetry[char.id] = Date.now() + 2 * 3600000;   // 失败了过两个小时再试，不弹提示
  }).then(function() {
    lifeBusy = false;
    setTimeout(lifeTick, 10000);
  });
}
onMphoneReady(function() {
  setTimeout(lifeTick, 45000);
  setInterval(lifeTick, 30 * 60000);
});

// ---------- 角色设置：聊出来的设定、记着要关心的事 ----------
function fillLifeForm(char) {
  var ta = document.getElementById('charSelfFacts');
  if (ta) ta.value = (char.selfFacts || []).join('\n');
  var box = document.getElementById('charFollowList');
  if (!box) return;
  box.innerHTML = '';
  var list = (char.followUps || []).filter(function(f) { return !f.done; });
  if (!list.length) { box.innerHTML = '<div class="auto-hint">还没有。你说起之后要发生的事（考试、面试、出门……），TA 会记在这里，到时候问问你</div>'; return; }
  list.forEach(function(f) {
    var row = document.createElement('div');
    row.className = 'life-follow-row';
    row.innerHTML = '<span class="life-follow-when"></span><span class="life-follow-text"></span><button class="life-follow-del" aria-label="删掉">×</button>';
    row.querySelector('.life-follow-when').textContent = lifeMd(f.due);
    row.querySelector('.life-follow-text').textContent = f.text;
    row.querySelector('.life-follow-del').addEventListener('click', function() {
      char.followUps = (char.followUps || []).filter(function(x) { return x !== f; });
      if (charList.indexOf(char) >= 0) saveCharList();
      row.remove();
    });
    box.appendChild(row);
  });
}
function readLifeForm() {
  var ta = document.getElementById('charSelfFacts');
  return ta ? ta.value.split('\n').map(function(s) { return s.trim(); }).filter(Boolean).slice(0, 60) : undefined;
}
