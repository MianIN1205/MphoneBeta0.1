// 眠花糖机 — 群聊里的多人小互动（用户要的）：投票、抽奖、拼手气红包。加号抽屉里由你发起，角色偶尔也会发（回复里写标签，js/chat/group.js 的 groupCommitReply 认）。
// 消息上的 m.play：
//   投票 { kind: 'vote', q, opts: [..], votes: { 角色id 或 'user': 选项序号 }, voting（正在等大家投） }
//   抽奖 { kind: 'lottery', prize, who: [角色id 或 'user'], win, at（开奖动画从这时开始） }
//   红包 { kind: 'hb', total, count, wish, parts: [每份多少], grabs: [{ who, amt, at }]（at 在未来的是还没抢到，到点才显示） }
// 钱都走钱包（用户定的）：你发红包扣钱，抢到角色的红包进钱包；抽奖的奖品是文字，不扣钱。
// 你发起的：结果出来后群里自动接着聊几句（sendMsg）；角色发起的不再自动接，免得一直连锁下去

var GP_NAMES = { vote: '投票', lottery: '抽奖', hb: '红包' };
var GP_HB_MAX_AI = 200;   // 角色发的红包最多 200
function gpWho(id, g) {
  if (id === 'user') return '我';
  var c = charList[findCharIdx(id)];
  return c ? groupLabel(c) : '群友';
}
function gpGroupOf(m) { return charList.filter(function(c) { return c.isGroup && (chatHistories[c.id] || []).indexOf(m) >= 0; })[0] || null; }
function gpMoney(n) { return '¥' + fmtMoney(n); }

// ---------- 发给 AI、列表预览 ----------
function playTextForAI(m) {
  var p = m.play, g = gpGroupOf(m), who = function(id) { return id === 'user' ? '{{user}}' : gpWho(id, g); };
  var from = m.role === 'user' ? '{{user}}' : '';
  if (p.kind === 'vote') {
    var res = p.opts.map(function(o, i) {
      var vs = Object.keys(p.votes || {}).filter(function(k) { return p.votes[k] === i; }).map(who);
      return (i + 1) + '. ' + o + '（' + (vs.length ? vs.join('、') : '没人选') + '）';
    }).join('；');
    return '（' + from + '发起了投票「' + p.q + '」：' + res + '）';
  }
  if (p.kind === 'lottery') {
    var done = Date.now() > (p.at || 0) + 1800;
    return '（' + from + '发起了抽奖，奖品：' + p.prize + '；参加的有 ' + p.who.map(who).join('、') + (done ? '；抽中的是 ' + who(p.win) : '；还在抽') + '）';
  }
  if (p.kind === 'hb') {
    var got = (p.grabs || []).filter(function(x) { return x.at <= Date.now(); });
    var best = gpHbBest(p);
    return '（' + from + '发了一个拼手气红包「' + p.wish + '」，一共 ' + gpMoney(p.total) + '，分成 ' + p.count + ' 个；' +
      (got.length ? got.map(function(x) { return who(x.who) + ' 抢到 ' + gpMoney(x.amt) + (best === x && got.length > 1 ? '（手气最佳）' : ''); }).join('，') : '还没人抢') +
      (got.length >= p.count ? '，已经抢完了' : '') + '）';
  }
  return '';
}
function playPreview(m) { return '[' + GP_NAMES[m.play.kind] + '] ' + (m.play.q || m.play.prize || m.play.wish || ''); }

// ---------- 卡片 ----------
function appendPlayMsg(role, m, list, empty) {
  if (empty) empty.style.display = 'none';
  var row = document.createElement('div');
  row.className = 'chat-msg-row ' + (role === 'user' ? 'user' : 'ai');
  row.appendChild(createMsgAvatar(role));
  var bubble = document.createElement('div');
  bubble.className = 'chat-msg-bubble gp-bubble';
  row.appendChild(bubble);
  list.appendChild(row);
  m._bubble = bubble;
  gpPaint(m);
  crStick(list);
  return { row: row, bubble: bubble };
}
function gpPaint(m) {
  var b = m._bubble, p = m.play;
  if (!b) return;
  b.innerHTML = '';
  var card = document.createElement('div');
  card.className = 'gp-card gp-' + p.kind;
  b.appendChild(card);
  if (p.kind === 'vote') gpPaintVote(m, card);
  else if (p.kind === 'lottery') gpPaintLottery(m, card);
  else if (p.kind === 'hb') gpPaintHb(m, card);
}
function gpRepaint(m) { if (m._bubble && m._bubble.isConnected) gpPaint(m); }

function gpPaintVote(m, card) {
  var p = m.play, g = gpGroupOf(m), total = Object.keys(p.votes || {}).length;
  card.innerHTML = '<div class="gp-head">📊 投票</div><div class="gp-q"></div><div class="gp-opts"></div><div class="gp-foot"></div>';
  card.querySelector('.gp-q').textContent = p.q;
  p.opts.forEach(function(o, i) {
    var vs = Object.keys(p.votes || {}).filter(function(k) { return p.votes[k] === i; });
    var el = document.createElement('div');
    el.className = 'gp-opt' + (p.votes && p.votes.user === i ? ' mine' : '');
    el.innerHTML = '<i style="width:' + (total ? Math.round(vs.length / total * 100) : 0) + '%"></i><span class="gp-opt-t"></span><b></b><div class="gp-opt-who"></div>';
    el.querySelector('.gp-opt-t').textContent = o;
    el.querySelector('b').textContent = vs.length ? vs.length + ' 票' : '';
    el.querySelector('.gp-opt-who').textContent = vs.map(function(id) { return gpWho(id, g); }).join('、');
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      p.votes = p.votes || {};
      if (p.votes.user === i) delete p.votes.user; else p.votes.user = i;
      saveHistories();
      gpPaint(m);
    });
    card.querySelector('.gp-opts').appendChild(el);
  });
  card.querySelector('.gp-foot').textContent = p.voting ? '大家正在投票…' : total + ' 人投了票 · 点选项投你的一票';
}

function gpPaintLottery(m, card) {
  var p = m.play, g = gpGroupOf(m);
  card.innerHTML = '<div class="gp-head">🎁 抽奖</div><div class="gp-prize"></div><div class="gp-who"></div><div class="gp-foot"></div>';
  card.querySelector('.gp-prize').textContent = p.prize;
  var chips = p.who.map(function(id) {
    var s = document.createElement('span');
    s.textContent = gpWho(id, g);
    card.querySelector('.gp-who').appendChild(s);
    return s;
  });
  var foot = card.querySelector('.gp-foot');
  var left = (p.at || 0) + 1600 - Date.now();
  var showWin = function() {
    chips.forEach(function(s, i) { s.classList.toggle('win', p.who[i] === p.win); });
    foot.textContent = '🎉 抽中了 ' + gpWho(p.win, g) + '！';
  };
  if (left <= 0) { showWin(); return; }
  // 开奖：名字轮着亮一圈，越来越慢，停在抽中的人
  foot.textContent = '抽奖中…';
  var k = 0, t0 = Date.now();
  (function spin() {
    if (!card.isConnected) return;
    chips.forEach(function(s, i) { s.classList.toggle('win', i === k % chips.length); });
    k++;
    var el = Date.now() - t0;
    if (el >= left) { showWin(); return; }
    setTimeout(spin, 70 + el / 8);
  })();
}

function gpHbBest(p) {
  var got = (p.grabs || []).filter(function(x) { return x.at <= Date.now(); }), best = null;
  if (got.length < p.count) return null;   // 抢完才有手气最佳
  got.forEach(function(x) { if (!best || x.amt > best.amt) best = x; });
  return best;
}
function gpPaintHb(m, card) {
  var p = m.play, g = gpGroupOf(m), now = Date.now();
  var got = (p.grabs || []).filter(function(x) { return x.at <= now; });
  var mine = got.filter(function(x) { return x.who === 'user'; })[0];
  var over = got.length >= p.count;
  card.innerHTML = '<div class="gp-hb-top"><div class="gp-hb-ic"></div><div><div class="gp-hb-wish"></div><div class="gp-hb-state"></div></div></div><div class="gp-hb-bottom">拼手气红包</div><div class="gp-hb-list"></div>';
  card.querySelector('.gp-hb-wish').textContent = p.wish;
  card.querySelector('.gp-hb-state').textContent = mine ? '你抢到了 ' + gpMoney(mine.amt) : over ? '已被抢完' : '还剩 ' + (p.count - got.length) + ' 个 · 点一下抢';
  card.classList.toggle('opened', !!mine || over);
  var best = gpHbBest(p);
  var listEl = card.querySelector('.gp-hb-list');
  got.forEach(function(x) {
    var r = document.createElement('div');
    r.innerHTML = '<span></span><b></b>';
    r.querySelector('span').textContent = gpWho(x.who, g) + (x === best && got.length > 1 ? ' 👑' : '');
    r.querySelector('b').textContent = gpMoney(x.amt);
    listEl.appendChild(r);
  });
  card.addEventListener('click', function(e) {
    e.stopPropagation();
    if (mine || over) return;
    // 你来抢：拿下一份还没人要的
    var taken = (p.grabs || []).length;
    if (taken >= p.count) { showToast('手慢了，红包派完了', 'plain'); return; }
    var amt = p.parts[taken];
    p.grabs.push({ who: 'user', amt: amt, at: Date.now() });
    walletAdd(amt, '抢红包 · ' + (m.role === 'user' ? '自己发的红包' : gpWho(m.speaker, g) + '的红包'));
    saveHistories();
    gpPaint(m);
    showToast('抢到 ' + gpMoney(amt) + '，放进钱包了', 'success');
  });
}

// ---------- 拼手气：二倍均值法，每份至少 1 分 ----------
function gpSplit(total, n) {
  var left = Math.round(total * 100), out = [];
  for (var i = 0; i < n - 1; i++) {
    var max = Math.max(1, Math.floor(left / (n - i) * 2) - 1);
    var a = Math.max(1, Math.min(left - (n - i - 1), 1 + Math.floor(Math.random() * max)));
    out.push(a); left -= a;
  }
  out.push(left);
  return bbShuffleSafe(out).map(function(c) { return c / 100; });
}
function bbShuffleSafe(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
// 角色们来抢：每人 80% 会抢、1～6 秒陆续抢到；limit 是最多几个人（角色发的给你留一个）
function gpPlanGrabs(g, p, exceptId, limit) {
  var t = Date.now();
  var pool = groupMembers(g).filter(function(c) { return c.id !== exceptId; });
  var who = bbShuffleSafe(pool.filter(function() { return Math.random() < 0.8; }));
  if (!who.length && pool.length) who = [pool[Math.floor(Math.random() * pool.length)]];   // 至少有一个人来抢
  who = who.slice(0, limit);
  p.grabs = p.grabs || [];
  who.forEach(function(c, i) {
    var idx = p.grabs.length;
    if (idx >= p.count) return;
    t += 600 + Math.random() * 1500;
    p.grabs.push({ who: c.id, amt: p.parts[idx], at: Math.round(t) });
  });
  return t;
}

// ---------- 加入群聊记录 ----------
function gpCurGroup() { var g = charList[openingChatCharIdx]; return g && g.isGroup ? g : null; }
function gpPush(g, m) {
  var hist = chatHistories[g.id] = chatHistories[g.id] || [];
  hist.push(m);
  var showing = appChatRoom.classList.contains('active') && charList[openingChatCharIdx] === g && currentCrSubView !== 'contacts';
  if (showing) renderHistMsg(m, document.getElementById('chatMsgList'), document.getElementById('chatRoomEmpty'));
  saveHistories();
  renderChatCharList();
}
// 你发起的玩法有了结果：群里接着聊几句（正看着这个群、没在生成时）
function gpReact(g) {
  if (!(appChatRoom.classList.contains('active') && charList[openingChatCharIdx] === g && currentCrSubView !== 'contacts')) return;
  if (genBusyChar(g)) return;
  sendMsg('', true);
}
// 到点的抢红包、开奖：重画一下
function gpTimers(g, m) {
  var p = m.play;
  if (p.kind === 'hb') (p.grabs || []).forEach(function(x) { var d = x.at - Date.now(); if (d > 0) setTimeout(function() { gpRepaint(m); renderChatCharList(); }, d + 30); });
}

// 投票：一次请求让群里每个人投（发起人也投），理由作为大家的消息发出来
function gpVoteRound(g, m) {
  var p = m.play, cfg = getApiCfg(g);
  if (!cfg.url || !cfg.key || !cfg.model) { p.voting = false; gpRepaint(m); return; }
  p.voting = true; gpRepaint(m);
  var names = groupMembers(g).map(groupLabel);
  var ask = activityAsk('群里刚发起了投票「' + p.q + '」，选项：' + p.opts.map(function(o, i) { return (i + 1) + '. ' + o; }).join('  ') +
    '。请群里每个角色（' + names.join('、') + '）按自己的性格和想法投一票，每人一行：名字：选项序号｜一句很短的口语（为什么这么选，可以带点情绪、互相拆台），不想说就只写序号。只输出这几行。');
  cfg.cot = 'off';
  var hist = chatHistories[g.id] || [];
  llmRequest(buildGroupMsgs(g, hist.slice(0, hist.indexOf(m) + 1)).concat([ask]), { stream: false, cfg: cfg }).then(function(text) {
    var byName = {};
    groupMembers(g).forEach(function(c) { [c.charAlias, c.charName, groupLabel(c)].forEach(function(n) { if (n) byName[String(n).trim()] = c.id; }); });
    var said = [];
    String(text || '').split('\n').forEach(function(line) {
      var mm = line.match(/^\s*@?([^：:\n]{1,20}?)\s*[：:]\s*(\d+)\s*[｜|]?\s*(.*)$/);
      if (!mm || !byName[mm[1].trim()]) return;
      var idx = parseInt(mm[2], 10) - 1;
      if (idx < 0 || idx >= p.opts.length) return;
      p.votes = p.votes || {};
      p.votes[byName[mm[1].trim()]] = idx;
      if (mm[3].trim()) said.push({ id: byName[mm[1].trim()], t: mm[3].trim() });
    });
    p.voting = false;
    gpRepaint(m);
    var now = Date.now();
    said.forEach(function(s, i) { gpPush(g, { role: 'assistant', content: s.t, speaker: s.id, time: now + i }); });
    saveHistories();
  }).catch(function() { p.voting = false; gpRepaint(m); saveHistories(); });
}

// ---------- 加号抽屉：你发起 ----------
function gpOpenVote() {
  var g = gpCurGroup(); if (!g) return;
  var ov = groupModal('<div class="mine-acc-title">发起投票</div>' +
    '<input class="pet-edit-input" maxlength="40" placeholder="投什么？比如：周末去哪玩" data-f="q">' +
    '<div class="gp-opt-inputs"></div><button class="bb-edit-add" data-act="add">+ 加一个选项</button>' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-act="cancel">取消</button><button class="mine-acc-btn mine-acc-btn-add" data-act="ok">发起</button></div>');
  var box = ov.querySelector('.gp-opt-inputs');
  var addOpt = function() {
    if (box.children.length >= 6) return;
    var i = document.createElement('input');
    i.className = 'pet-edit-input'; i.maxLength = 20; i.placeholder = '选项 ' + (box.children.length + 1);
    box.appendChild(i);
  };
  addOpt(); addOpt();
  ov.querySelector('[data-act="add"]').addEventListener('click', addOpt);
  ov.querySelector('[data-act="cancel"]').addEventListener('click', function() { ov.remove(); });
  ov.querySelector('[data-act="ok"]').addEventListener('click', function() {
    var q = ov.querySelector('[data-f="q"]').value.trim();
    var opts = Array.prototype.map.call(box.children, function(i) { return i.value.trim(); }).filter(Boolean);
    if (!q) { shakeEl(ov.querySelector('[data-f="q"]')); return; }
    if (opts.length < 2) { shakeEl(box); showToast('至少两个选项', 'error'); return; }
    ov.remove(); closeCrPlusPanel();
    var m = { role: 'user', content: '[投票] ' + q, play: { kind: 'vote', q: q, opts: opts, votes: {} }, time: Date.now() };
    gpPush(g, m);
    gpVoteRound(g, m);
  });
}
function gpOpenLottery() {
  var g = gpCurGroup(); if (!g) return;
  var picked = ['user'].concat(g.members || []);
  var ov = groupModal('<div class="mine-acc-title">发起抽奖</div>' +
    '<input class="pet-edit-input" maxlength="30" placeholder="奖品，比如：请喝奶茶一杯" data-f="prize">' +
    '<div class="grp-label">谁参加</div><div class="feed-visible-list grp-chips"></div>' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-act="cancel">取消</button><button class="mine-acc-btn mine-acc-btn-add" data-act="ok">开抽</button></div>');
  var chips = ov.querySelector('.grp-chips');
  ['user'].concat(g.members || []).forEach(function(id) {
    var s = document.createElement('span');
    s.className = 'feed-visible-chip on';
    s.textContent = gpWho(id, g);
    s.addEventListener('click', function() {
      var k = picked.indexOf(id);
      if (k >= 0) picked.splice(k, 1); else picked.push(id);
      s.classList.toggle('on', k < 0);
    });
    chips.appendChild(s);
  });
  ov.querySelector('[data-act="cancel"]').addEventListener('click', function() { ov.remove(); });
  ov.querySelector('[data-act="ok"]').addEventListener('click', function() {
    var prize = ov.querySelector('[data-f="prize"]').value.trim();
    if (!prize) { shakeEl(ov.querySelector('[data-f="prize"]')); return; }
    if (picked.length < 2) { shakeEl(chips); showToast('至少两个人参加', 'error'); return; }
    ov.remove(); closeCrPlusPanel();
    var m = { role: 'user', content: '[抽奖] ' + prize, play: { kind: 'lottery', prize: prize, who: picked.slice(), win: picked[Math.floor(Math.random() * picked.length)], at: Date.now() }, time: Date.now() };
    gpPush(g, m);
    setTimeout(function() { gpReact(g); }, 2000);
  });
}
function gpOpenHb() {
  var g = gpCurGroup(); if (!g) return;
  var n = groupMembers(g).length;
  var ov = groupModal('<div class="mine-acc-title">发拼手气红包</div>' +
    '<div class="auto-row"><span class="auto-row-label">总金额（元）</span><input class="pet-edit-input" type="number" min="0.01" step="0.01" data-f="total" style="flex:1.2;"></div>' +
    '<div class="auto-row"><span class="auto-row-label">红包个数</span><input class="pet-edit-input" type="number" min="1" max="' + (n + 1) + '" step="1" data-f="count" style="flex:1.2;"></div>' +
    '<input class="pet-edit-input" maxlength="20" placeholder="恭喜发财，大吉大利" data-f="wish">' +
    '<div class="auto-hint gp-hb-bal"></div>' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close" data-act="cancel">取消</button><button class="mine-acc-btn mine-acc-btn-add gp-hb-send" data-act="ok">塞钱进红包</button></div>');
  ov.querySelector('[data-f="count"]').value = n;
  ov.querySelector('.gp-hb-bal').textContent = '钱包余额 ' + gpMoney(getWallet(getMainAccount().uid).balance) + '，群里有 ' + n + ' 个角色';
  ov.querySelector('[data-act="cancel"]').addEventListener('click', function() { ov.remove(); });
  ov.querySelector('[data-act="ok"]').addEventListener('click', function() {
    var total = Math.round(parseFloat(ov.querySelector('[data-f="total"]').value) * 100) / 100;
    var count = parseInt(ov.querySelector('[data-f="count"]').value, 10);
    if (!(count >= 1 && count <= n + 1)) { shakeEl(ov.querySelector('[data-f="count"]')); showToast('个数写 1～' + (n + 1), 'error'); return; }
    if (!(total >= count * 0.01)) { shakeEl(ov.querySelector('[data-f="total"]')); showToast('每个红包至少 0.01 元', 'error'); return; }
    if (total > getWallet(getMainAccount().uid).balance) { showToast('钱包余额不够啦', 'error'); return; }
    ov.remove(); closeCrPlusPanel();
    walletAdd(-total, '群红包 · ' + (g.charName || '群聊'));
    var p = { kind: 'hb', total: total, count: count, wish: ov.querySelector('[data-f="wish"]').value.trim() || '恭喜发财，大吉大利', parts: gpSplit(total, count), grabs: [] };
    var m = { role: 'user', content: '[红包] ' + p.wish, play: p, time: Date.now() };
    var end = gpPlanGrabs(g, p, null, count);
    gpPush(g, m);
    gpTimers(g, m);
    if (p.grabs.length) setTimeout(function() { gpReact(g); }, end - Date.now() + 800);
  });
}

// ---------- 角色发起：回复里的标签（groupCommitReply 先换成占位，这里变成卡片） ----------
var GP_TAG_RE = /<(投票|红包|抽奖)([^>]*)>([\s\S]*?)<\/\1>/g;
function gpFromTag(kind, attrs, body, g, speakerId) {
  var attr = function(n) { var mm = String(attrs).match(new RegExp(n + '\\s*=\\s*["“「]([^"”」]*)')); return mm ? mm[1].trim() : ''; };
  body = String(body || '').replace(/\s+/g, ' ').trim();
  if (kind === '投票') {
    var opts = body.split(/[｜|/、]/).map(function(s) { return s.trim(); }).filter(Boolean).slice(0, 6);
    var q = attr('题目') || attr('问题');
    if (!q || opts.length < 2) return null;
    return { kind: 'vote', q: q.slice(0, 40), opts: opts, votes: {} };
  }
  if (kind === '抽奖') {
    if (!body) return null;
    var who = ['user'].concat((g.members || []).filter(function(id) { return id !== speakerId; }));
    return { kind: 'lottery', prize: body.slice(0, 30), who: who, win: who[Math.floor(Math.random() * who.length)], at: Date.now() };
  }
  var total = Math.min(GP_HB_MAX_AI, Math.max(0.01, Math.round(parseFloat(attr('金额')) * 100) / 100 || 8.88));
  var count = Math.max(1, Math.min((g.members || []).length, parseInt(attr('个数'), 10) || (g.members || []).length));
  if (total < count * 0.01) total = count * 0.01;
  return { kind: 'hb', total: total, count: count, wish: (body || '恭喜发财，大吉大利').slice(0, 20), parts: gpSplit(total, count), grabs: [] };
}
// 消息进了记录以后：角色发的投票大家来投、红包大家来抢（给你留一个）
function gpAfterAdd(g, m) {
  var p = m.play;
  if (p.kind === 'vote') setTimeout(function() { gpVoteRound(g, m); }, 600);
  else if (p.kind === 'hb') { gpPlanGrabs(g, p, m.speaker, Math.max(0, p.count - 1)); saveHistories(); gpTimers(g, m); }
}
function gpTagRule() {
  return '偶尔（很少，真的有需要或者心情特别好的时候）群里有人可以发起小互动，写在这个人那一行里：发投票 <投票 题目="周末去哪玩">海边｜爬山｜在家躺着</投票>；' +
    '发拼手气红包 <红包 金额="66" 个数="3">祝福语</红包>（金额 1～' + GP_HB_MAX_AI + '，个数不超过群里人数）；发抽奖 <抽奖>奖品</抽奖>。不要每次都发。';
}

// 打开聊天室时：群里不显示查手机、一起看，换成投票、抽奖（css/chat/group.css 按 #appChatRoom.is-group 切）
