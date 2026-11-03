// 眠花糖机 — 查手机：加号抽屉「查手机」，看角色手机里的信息（和你的是真实聊天，和别人的由 AI 按人设写）、备忘录、浏览器（搜索记录、收藏）、购物（购物车、钱包、账单）。
// 每个 App 第一次打开时自动写一份存下来（mphone_peek），之后点右上 ↻ 才换新的。
// 角色设置「聊天」页开了「TA 会发现你查手机」时，翻得多了 TA 可能察觉，下次聊天回复时提起（关着就永远不会发现）；
// 开了「手机有密码」时先要解锁：密码和提示由 TA 按人设自己定，猜对一次就记住；改不改密码由 TA 在聊天里自己决定（回复里写 <改密码>，用户看不到）

var peekStore = mphoneStore.load('mphone_peek', {}) || {};   // { 角色id: { chats|notes|browser|shop: { at, data } } }
var PEEK_APPS = [
  { id: 'chats', name: '信息', icon: '💬' },
  { id: 'notes', name: '备忘录', icon: '📝' },
  { id: 'browser', name: '浏览器', icon: '🧭' },
  { id: 'shop', name: '购物', icon: '🛍️' },
  { id: 'photos', name: '相册', icon: '🖼️' }
];
var peekState = { idx: -1, app: '', tab: '', detail: null, loading: {}, seen: [], t0: 0, entry: '', wrong: 0 };
var appPeek = document.getElementById('appPeek');
function peekChar() { return charList[peekState.idx]; }
function peekBox(char) { var k = String(char.id); return peekStore[k] || (peekStore[k] = {}); }
function savePeek() { mphoneStore.save('mphone_peek', peekStore); }
function peekEsc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function peekMoney(n) {
  var v = Number(n);
  if (isNaN(v)) return peekEsc(n);
  return (v < 0 ? '-' : '') + '¥' + Math.abs(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// =============================================
// 请 AI 写：按人设、世界书、记忆和最近的聊天（charContextMsgs），只要 JSON
// =============================================
function peekAsk(app, char, old) {
  var name = char.charAlias || char.charName || '角色';
  var head = '【查手机】用户现在正在翻看你（' + name + '）的手机，现在是 ' + nowText(char) + '。请按你的人设、你的生活、你们最近的聊天，' +
    '写出你手机里的内容。要像真的手机里会有的东西：具体、生活化、有细节，和你的性格、身份、爱好、最近发生的事对得上；' +
    '可以有一些没跟用户说过的小秘密和小心思，但不能脱离人设。时间写成「14:05」「昨天 21:30」「10-28」这样。';
  var npcs = (char.feedNpcs || []).map(function(n) { return n && (n.name || n); }).filter(Boolean);
  var spec;
  if (app === 'chats') {
    var oldNames = old && old.chats ? old.chats.map(function(c) { return c.name; }) : [];
    spec = '现在写「信息」App 里你和别人的聊天（和用户的聊天不用写，那是真实记录）：4～7 个对话，对象是你生活里会有的人（家人、朋友、同事、同学……）' +
      (npcs.length ? '，你动态里出现过的人有：' + npcs.join('、') + '，可以用上' : '') +
      (oldNames.length ? '；你手机里之前就有这些联系人：' + oldNames.join('、') + '，大多数接着用，聊新的内容' : '') +
      '。每个对话 6～15 条消息，按时间先后排；消息像真聊天：短句、口语，可以有表情；可以聊到用户。' +
      '格式：{"chats":[{"name":"备注名","relation":"关系，比如 妈妈、大学室友","msgs":[{"me":false,"text":"对方发的","time":"昨天 21:30"},{"me":true,"text":"你发的","time":"昨天 21:31"}]}]}，me 为 true 是你发的。';
  } else if (app === 'notes') {
    spec = '现在写「备忘录」：4～8 条，待办、随手记、灵感、清单、给自己的话、和用户有关的小事等，有长有短，可以分行。' +
      '格式：{"notes":[{"title":"标题","date":"11-02","content":"正文"}]}';
  } else if (app === 'browser') {
    spec = '现在写「浏览器」：搜索记录 8～15 条（最近的在前，真实的搜索习惯：有正经的，也有暴露小心思的），收藏 4～8 个（文章、帖子、菜谱、攻略、网页等，content 写这个页面的主要内容 80～250 字）。' +
      '格式：{"searches":[{"q":"搜索词","time":"今天 01:20"}],"favs":[{"title":"网页标题","site":"网站名","time":"10-30","content":"页面内容"}]}';
  } else if (app === 'photos') {
    spec = '现在写「相册」：8～12 张照片（最近拍的在前），像真的手机相册：自拍、日常随手拍、吃的、风景、和朋友、截图、偷偷拍的用户（如果你们的关系会这样）等，按你的生活来。' +
      'desc 用一两句话描述照片里的画面（拍的是什么、在哪、光线、氛围），date 拍摄时间，album 所属相册（比如 自拍、日常、旅行、截图、和 TA），note 你给这张照片的小备注（可以空着）。' +
      '格式：{"photos":[{"desc":"","date":"11-02 18:40","album":"日常","note":""}]}';
  } else {
    spec = '现在写「购物」App：购物车 3～8 件（name 商品名，spec 规格，price 价格数字，note 你加购时的小心思，可以空着），钱包（balance 余额数字，cards 是 2～4 张银行卡或账户：name、amount 数字），' +
      '账单 8～15 条（最近的在前：title、time、amount 数字，支出写负数、收入写正数，note 可以空着）。金额要符合你的身份和收入。' +
      '格式：{"cart":[{"name":"","spec":"","price":0,"note":""}],"wallet":{"balance":0,"cards":[{"name":"","amount":0}]},"bills":[{"title":"","time":"","amount":-0,"note":""}]}';
  }
  return charContextMsgs(peekState.idx).concat([activityAsk(head + spec + '\n只输出 JSON 本身：不要代码块标记，不要解释，不要写 <记忆>、<status> 这些标签。')]);
}
function peekParse(text) {
  var t = String(text || '').replace(/<记忆[\s\S]*?<\/记忆>/g, '').replace(/<status>[\s\S]*?<\/status>/gi, '').replace(/```(?:json)?/gi, '');
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('没拿到内容，点 ↻ 再试一次');
  t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch (_) {}
  try { return JSON.parse(t.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')); } catch (e) { throw new Error('内容格式乱了，点 ↻ 再试一次'); }
}
// 一次请求最多等 PEEK_WAIT_MS：没回来就算失败（可以「再试一次」）；退出再进时，太久没回来的那次也不再挡着（用户遇到过卡在「正在打开」）
var PEEK_WAIT_MS = 90000;
function peekBusy(key) { var t = peekState.loading[key]; return !!t && Date.now() - t < PEEK_WAIT_MS; }
function peekCall(msgs, char) {
  return Promise.race([callApiOnce(msgs, char), new Promise(function(_, reject) {
    setTimeout(function() { reject(new Error('等太久没回应，点「再试一次」')); }, PEEK_WAIT_MS);
  })]);
}
function peekLoad(app) {
  var char = peekChar(), box = peekBox(char), key = String(char.id) + ':' + app;
  if (peekBusy(key)) return;
  var token = peekState.loading[key] = Date.now();
  var old = box[app] && box[app].data;
  renderPeek();
  peekCall(peekAsk(app, char, old), char).then(function(text) {
    var data = peekParse(text);
    box[app] = { at: Date.now(), data: data };
    delete box[app + 'Err'];
    savePeek();
  }, function(err) {
    if (peekState.loading[key] === token) box[app + 'Err'] = (err && err.message) || '没打开';
  }).then(function() {
    if (peekState.loading[key] === token) delete peekState.loading[key];
    if (peekChar() === char) renderPeek();
  });
}

// =============================================
// 界面：手机主屏（4 个 App）→ App 里的列表 → 点开看详情
// =============================================
function openPeek(idx) {
  var char = charList[idx];
  if (!char) return;
  peekState.idx = idx; peekState.app = ''; peekState.detail = null; peekState.tab = '';
  peekState.seen = []; peekState.t0 = Date.now(); peekState.entry = ''; peekState.wrong = 0;
  if (peekLocked(char) && !(peekBox(char).lock || {}).pass) peekMakeLock(char);
  renderPeek();
  appPeek.classList.add('active');
}
function peekGo(app) {
  peekState.app = app; peekState.detail = null;
  peekState.tab = app === 'browser' ? 'searches' : app === 'shop' ? 'cart' : '';
  peekSee({ chats: '「信息」里的聊天列表', notes: '备忘录', browser: '浏览器的搜索记录', shop: '购物车', photos: '相册' }[app]);
  var box = peekBox(peekChar());
  if (app && !box[app] && !box[app + 'Err']) peekLoad(app);   // 第一次打开自动写
  else renderPeek();
}
function peekBack() {
  if (peekState.detail) { peekState.detail = null; renderPeek(); }
  else if (peekState.app) { peekState.app = ''; renderPeek(); }
  else { appPeek.classList.remove('active'); peekMaybeCaught(); }
}

// =============================================
// 会不会被发现：这次翻了几样东西（打开的 App、栏目、点开的聊天 / 备忘录 / 收藏）、翻了多久。
// 4 样以下不会发现，再多每多一样多 15% 的可能，最多 75%；被发现就记下来，下次聊天回复时提起，提过就清掉
// =============================================
function peekSee(what) {
  if (what && peekState.seen.indexOf(what) < 0) peekState.seen.push(what);
}
function peekMaybeCaught() {
  var char = peekChar();
  if (!char) return;
  var cc = Object.assign({}, DEFAULT_CHAT_CFG, char.chatCfg || {});
  if (!cc.peekNotice) return;   // 关着：怎么翻都不会发现
  var score = peekState.seen.length + peekState.wrong + (Date.now() - peekState.t0 > 120000 ? 1 : 0);
  if (score < 4 || Math.random() >= Math.min(0.75, 0.15 * (score - 3))) return;
  var seen = peekState.seen.slice(0, 10);
  if (peekState.wrong) seen.unshift('试着解锁你的手机，输错了 ' + peekState.wrong + ' 次密码');
  peekBox(char).caught = { at: Date.now(), seen: seen };
  savePeek();
}
function peekCaughtPrompt(char) {
  var c = char && peekStore[String(char.id)] && peekStore[String(char.id)].caught;
  if (!c || Date.now() - c.at > 24 * 3600000) return '';
  var cc = Object.assign({}, DEFAULT_CHAT_CFG, char.chatCfg || {});
  if (!cc.peekNotice) return '';
  return '【你发现了】' + (typeof fmtAgo === 'function' ? fmtAgo(c.at) : '刚才') + '，用户偷偷翻了你的手机，你察觉到了（比如手机被动过、App 停在你没开过的页面）。' +
    'TA 看了：' + c.seen.join('、') + '。这次回复里自然地提起这件事，反应要符合你的性格和你们现在的关系（可能害羞、慌张、生气、委屈、调侃、假装不在意、反过来逗 TA……）；' +
    '被看到的内容里有你的小秘密、小心思的话，可以有相应的反应。' + (peekLockOn(char) ? '要不要改手机密码由你自己决定（也可以不改）。' : '') + '提这一次就够了，之后不用反复说。';
}
// 你的手机密码：TA 自己知道（聊天窗口每次都带上），用户问的时候看心情决定给不给
function peekLockPrompt(char) {
  if (!peekLockOn(char)) return '';
  var lk = peekStore[String(char.id)] && peekStore[String(char.id)].lock;
  if (!lk || !lk.pass) return '';
  return '【你的手机】你的手机锁屏密码是 ' + lk.pass + (lk.hint ? '（锁屏上的提示是「' + lk.hint + '」）' : '') + '。' +
    (lk.unlocked ? '用户已经知道这个密码了。' : '用户还不知道；TA 问你要的话，看心情和你们的关系决定给不给、怎么给（可以直接说、逗 TA、让 TA 猜）。') + '平时不用主动提。' +
    '如果你决定改密码（比如聊天里说好了要改、或者你自己想改），在回复最后另起一行写 <改密码 提示="新的锁屏提示">新的 4～6 位数字</改密码>，这一行用户看不到；不改就别写。';
}
// 回复里的 <改密码 提示="…">数字</改密码>：换成新密码（用户要重新猜），这一行从回复里拿掉
function peekTakeLockTag(char, text) {
  return String(text || '').replace(/<改密码([^>]*)>([\s\S]*?)(<\/改密码>|$)/g, function(_, attr, body) {
    var pass = String(body).replace(/\D/g, ''), hint = (String(attr).match(/提示\s*=\s*["“「]([^"”」]*)/) || [])[1];
    if (char && peekLockOn(char) && pass.length >= 4 && pass.length <= 6) {
      peekBox(char).lock = { pass: pass, hint: String(hint || '').slice(0, 16) };
      savePeek();
    }
    return '';
  });
}

// =============================================
// 锁屏：TA 按人设定 4～6 位数字密码和一句提示；输错 3 次出现「问问 TA」
// =============================================
function peekLockOn(char) { return !!(char && Object.assign({}, DEFAULT_CHAT_CFG, char.chatCfg || {}).peekLock); }
function peekLocked(char) {
  if (!peekLockOn(char)) return false;
  var lk = peekBox(char).lock;
  return !(lk && lk.unlocked && lk.pass);
}
function peekMakeLock(char) {
  var box = peekBox(char), key = String(char.id) + ':lock';
  if (peekBusy(key)) return;
  var token = peekState.loading[key] = Date.now();
  var idx = charList.indexOf(char);
  var msgs = charContextMsgs(idx).concat([activityAsk('【手机密码】给你自己的手机设一个锁屏密码：4～6 位数字，按你的人设来定（比如和用户有关的纪念日、你的生日、对你有意义的数字）；' +
    '再写一句很短的锁屏提示（10 个字以内，不能直接说出密码，像「是那天」「你应该知道」）。只输出 JSON：{"pass":"0520","hint":"是那天"}')]);
  peekCall(msgs, char).then(function(text) {
    var d = {};
    try { d = peekParse(text); } catch (_) {}
    var pass = String(d.pass || '').replace(/\D/g, '');
    if (pass.length < 4 || pass.length > 6) throw new Error('bad');
    box.lock = { pass: pass, hint: String(d.hint || '').slice(0, 16) };
  }).catch(function() {
    // 没写好就随便定一个（TA 也知道，聊天里能问到）
    box.lock = { pass: String(1000 + Math.floor(Math.random() * 9000)), hint: '猜猜看' };
  }).then(function() {
    savePeek();
    if (peekState.loading[key] === token) delete peekState.loading[key];
    if (peekChar() === char) renderPeek();
  });
}
function renderPeekLock(body, char) {
  var lk = peekBox(char).lock || {}, wrap = document.createElement('div');
  wrap.className = 'peek-lock';
  if (!lk.pass) { wrap.innerHTML = '<div class="peek-state">正在锁屏…</div>'; body.appendChild(wrap); return; }
  wrap.innerHTML = '<div class="peek-home-av"></div><div class="peek-lock-title">输入密码</div><div class="peek-lock-hint"></div>' +
    '<div class="peek-dots"></div><div class="peek-keys"></div><div class="peek-lock-ask"></div>';
  paintCharAvatar(wrap.querySelector('.peek-home-av'), char);
  wrap.querySelector('.peek-lock-hint').textContent = lk.hint ? '提示：' + lk.hint : '';
  var dots = wrap.querySelector('.peek-dots');
  for (var i = 0; i < lk.pass.length; i++) {
    var d = document.createElement('span');
    if (i < peekState.entry.length) d.className = 'on';
    dots.appendChild(d);
  }
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach(function(k) {
    var b = document.createElement('button');
    b.className = 'peek-key' + (k ? '' : ' blank') + (k === '⌫' ? ' del' : '');
    b.textContent = k;
    if (k) b.addEventListener('click', function() { peekKey(k); });
    wrap.querySelector('.peek-keys').appendChild(b);
  });
  if (peekState.wrong >= 3) {
    var ask = document.createElement('button');
    ask.className = 'peek-again';
    ask.textContent = '问问 TA';
    ask.addEventListener('click', function() {
      appPeek.classList.remove('active');
      peekMaybeCaught();
      var inp = document.getElementById('crInput');
      if (inp) inp.focus();
      showToast('去聊天里问问 TA 密码吧', 'plain');
    });
    var tip = document.createElement('div');
    tip.textContent = '输错 ' + peekState.wrong + ' 次了';
    wrap.querySelector('.peek-lock-ask').appendChild(tip);
    wrap.querySelector('.peek-lock-ask').appendChild(ask);
  }
  body.appendChild(wrap);
}
function peekKey(k) {
  var char = peekChar(), lk = peekBox(char).lock || {};
  if (!lk.pass) return;
  if (k === '⌫') { peekState.entry = peekState.entry.slice(0, -1); renderPeek(); return; }
  if (peekState.entry.length >= lk.pass.length) return;
  peekState.entry += k;
  if (peekState.entry.length < lk.pass.length) { renderPeek(); return; }
  if (peekState.entry === lk.pass) {
    lk.unlocked = true;
    savePeek();
    peekState.entry = '';
    renderPeek();
    return;
  }
  // 输错：点点抖一下再清空
  peekState.wrong++;
  renderPeek();
  var dots = document.querySelector('#peekBody .peek-dots');
  if (dots) dots.classList.add('wrong');
  setTimeout(function() { peekState.entry = ''; if (peekChar() === char) renderPeek(); }, 450);
}
function peekCaughtDone(char) {
  var box = char && peekStore[String(char.id)];
  if (box && box.caught) { delete box.caught; savePeek(); }
}
document.getElementById('peekBack').addEventListener('click', peekBack);
document.getElementById('peekRefresh').addEventListener('click', function() {
  if (!peekState.app) return;
  var box = peekBox(peekChar());
  delete box[peekState.app + 'Err'];
  peekState.detail = null;
  peekLoad(peekState.app);
});

function renderPeek() {
  var char = peekChar();
  if (!char) return;
  var name = char.charAlias || char.charName || '角色', app = peekState.app, box = peekBox(char);
  var title = document.getElementById('peekTitle'), body = document.getElementById('peekBody'), refresh = document.getElementById('peekRefresh');
  var appInfo = PEEK_APPS.filter(function(a) { return a.id === app; })[0];
  var loading = peekBusy(String(char.id) + ':' + app);
  refresh.style.visibility = app && !peekState.detail ? 'visible' : 'hidden';
  refresh.classList.toggle('spin', loading);
  body.innerHTML = '';
  body.scrollTop = 0;
  if (peekLocked(char)) { refresh.style.visibility = 'hidden'; title.textContent = name + '的手机'; renderPeekLock(body, char); return; }
  if (!app) {
    title.textContent = name + '的手机';
    var home = document.createElement('div');
    home.className = 'peek-home';
    home.innerHTML = '<div class="peek-home-av"></div><div class="peek-home-name"></div><div class="peek-home-tip">每个 App 第一次打开会自己加载，之后点右上角 ↻ 才换新的</div><div class="peek-apps"></div>';
    paintCharAvatar(home.querySelector('.peek-home-av'), char);
    home.querySelector('.peek-home-name').textContent = name;
    PEEK_APPS.forEach(function(a) {
      var b = document.createElement('button');
      b.className = 'peek-app';
      b.innerHTML = '<div class="peek-app-icon">' + a.icon + '</div><span>' + a.name + '</span>';
      b.addEventListener('click', function() { peekGo(a.id); });
      home.querySelector('.peek-apps').appendChild(b);
    });
    body.appendChild(home);
    return;
  }
  title.textContent = peekState.detail ? peekState.detail.title : appInfo.name;
  if (peekState.detail) { body.appendChild(peekState.detail.el()); return; }
  var slot = box[app], err = box[app + 'Err'];
  if (slot && slot.at) {
    var at = document.createElement('div');
    at.className = 'peek-at';
    at.textContent = (loading ? '正在换新的… · ' : '') + fmtMsgTime(slot.at) + ' 看到的';
    body.appendChild(at);
  }
  if (!slot) {
    var st = document.createElement('div');
    st.className = 'peek-state';
    if (loading) st.textContent = '正在打开…';
    else {
      st.textContent = err || '还没有内容';
      var again = document.createElement('button');
      again.className = 'peek-again';
      again.textContent = '再试一次';
      again.addEventListener('click', function() { delete box[app + 'Err']; peekLoad(app); });
      st.appendChild(document.createElement('br'));
      st.appendChild(again);
    }
    body.appendChild(st);
    return;
  }
  if (err && !loading) {
    var bad = document.createElement('div');
    bad.className = 'peek-err';
    bad.textContent = '刷新没成功：' + err;
    body.appendChild(bad);
  }
  var d = slot.data || {};
  if (app === 'chats') renderPeekChats(body, char, d);
  else if (app === 'notes') renderPeekNotes(body, d);
  else if (app === 'browser') renderPeekBrowser(body, d);
  else if (app === 'photos') renderPeekPhotos(body, char, d);
  else renderPeekShop(body, d);
}
function peekRow(html, onClick) {
  var r = document.createElement('div');
  r.className = 'peek-row' + (onClick ? ' tap' : '');
  r.innerHTML = html;
  if (onClick) r.addEventListener('click', onClick);
  return r;
}
function peekDetail(title, make) { peekState.detail = { title: title, el: make }; renderPeek(); }
function peekTabs(body, tabs) {
  var bar = document.createElement('div');
  bar.className = 'peek-tabs';
  tabs.forEach(function(t) {
    var b = document.createElement('button');
    b.className = 'peek-tab' + (peekState.tab === t[0] ? ' active' : '');
    b.textContent = t[1];
    b.addEventListener('click', function() {
      peekState.tab = t[0];
      peekSee({ searches: '浏览器的搜索记录', favs: '浏览器的收藏', cart: '购物车', wallet: '钱包余额', bills: '账单' }[t[0]]);
      renderPeek();
    });
    bar.appendChild(b);
  });
  body.appendChild(bar);
}
function peekEmpty(body, text) { var e = document.createElement('div'); e.className = 'peek-state'; e.textContent = text; body.appendChild(e); }

// 信息：第一个是和你的真实聊天（最近 40 条），后面是 TA 和别人的
function renderPeekChats(body, char, d) {
  var hist = getChatHistory(peekState.idx), acc = resolveCharAccount(char);
  var you = char.userNickname || acc.nickname || '你';
  var last = hist[hist.length - 1];
  var youRow = peekRow('<div class="peek-av you"></div><div class="peek-row-main"><div class="peek-row-top"><b></b><span class="peek-row-time"></span></div><div class="peek-row-sub"></div></div>', function() {
    peekSee('你们俩的聊天记录');
    peekDetail(you, function() {
      var wrap = document.createElement('div');
      wrap.className = 'peek-chat';
      hist.slice(-40).forEach(function(m) {
        if (m.pat || m.action || m.cal || m.narr) return;
        var t = m.recalled ? '撤回了一条消息' : (typeof msgPreviewText === 'function' ? msgPreviewText(m) : (m.content || ''));
        wrap.appendChild(peekBubble(m.role === 'assistant', t, m.time ? fmtMsgTime(m.time) : ''));
      });
      if (!wrap.children.length) peekEmpty(wrap, '还没有聊过天');
      return wrap;
    });
  });
  paintAvatar(youRow.querySelector('.peek-av'), acc && acc.avatar, '');
  youRow.querySelector('b').textContent = you;
  youRow.querySelector('.peek-row-time').textContent = last && last.time ? fmtListTime(last.time) : '';
  youRow.querySelector('.peek-row-sub').textContent = typeof msgPreviewText === 'function' ? msgPreviewText(last) : '';
  var pin = document.createElement('span'); pin.className = 'peek-pin'; pin.textContent = '置顶';
  youRow.querySelector('.peek-row-top').appendChild(pin);
  body.appendChild(youRow);
  (d.chats || []).forEach(function(c) {
    var msgs = Array.isArray(c.msgs) ? c.msgs : [], lm = msgs[msgs.length - 1] || {};
    var r = peekRow('<div class="peek-av">' + peekEsc(String(c.name || '?').slice(0, 1)) + '</div><div class="peek-row-main"><div class="peek-row-top"><b>' + peekEsc(c.name) +
      '</b>' + (c.relation ? '<span class="peek-rel">' + peekEsc(c.relation) + '</span>' : '') + '<span class="peek-row-time">' + peekEsc(lm.time || '') + '</span></div><div class="peek-row-sub">' + peekEsc(lm.text || '') + '</div></div>', function() {
      peekSee('和「' + (c.name || '某人') + '」的聊天');
      peekDetail(c.name || '聊天', function() {
        var wrap = document.createElement('div');
        wrap.className = 'peek-chat';
        msgs.forEach(function(m) { wrap.appendChild(peekBubble(!!m.me, m.text, m.time)); });
        return wrap;
      });
    });
    body.appendChild(r);
  });
}
function peekBubble(mine, text, time) {
  var r = document.createElement('div');
  r.className = 'peek-msg' + (mine ? ' me' : '');
  r.innerHTML = '<div class="peek-bubble"></div>' + (time ? '<div class="peek-msg-time"></div>' : '');
  r.firstChild.textContent = text || '';
  if (time) r.lastChild.textContent = time;
  return r;
}
function renderPeekNotes(body, d) {
  var notes = d.notes || [];
  if (!notes.length) return peekEmpty(body, '备忘录是空的');
  notes.forEach(function(n) {
    body.appendChild(peekRow('<div class="peek-row-main"><div class="peek-row-top"><b>' + peekEsc(n.title || '无标题') + '</b><span class="peek-row-time">' + peekEsc(n.date || '') +
      '</span></div><div class="peek-row-sub two">' + peekEsc(n.content || '') + '</div></div>', function() {
      peekSee('备忘录「' + (n.title || '无标题') + '」');
      peekDetail(n.title || '备忘录', function() {
        var el = document.createElement('div');
        el.className = 'peek-page';
        el.innerHTML = '<div class="peek-page-meta">' + peekEsc(n.date || '') + '</div><div class="peek-page-text">' + peekEsc(n.content || '') + '</div>';
        return el;
      });
    }));
  });
}
function renderPeekBrowser(body, d) {
  peekTabs(body, [['searches', '搜索记录'], ['favs', '收藏']]);
  if (peekState.tab === 'searches') {
    var ss = d.searches || [];
    if (!ss.length) return peekEmpty(body, '没有搜索记录');
    ss.forEach(function(s) {
      body.appendChild(peekRow('<div class="peek-ico">🔍</div><div class="peek-row-main"><div class="peek-row-top"><span class="peek-q">' + peekEsc(s.q) + '</span><span class="peek-row-time">' + peekEsc(s.time || '') + '</span></div></div>'));
    });
    return;
  }
  var fs = d.favs || [];
  if (!fs.length) return peekEmpty(body, '没有收藏');
  fs.forEach(function(f) {
    body.appendChild(peekRow('<div class="peek-ico">⭐</div><div class="peek-row-main"><div class="peek-row-top"><b>' + peekEsc(f.title) + '</b></div><div class="peek-row-sub">' +
      peekEsc([f.site, f.time].filter(Boolean).join(' · ')) + '</div></div>', function() {
      peekSee('收藏的「' + (f.title || '网页') + '」');
      peekDetail(f.site || '收藏', function() {
        var el = document.createElement('div');
        el.className = 'peek-page';
        el.innerHTML = '<div class="peek-page-title">' + peekEsc(f.title) + '</div><div class="peek-page-meta">' + peekEsc([f.site, f.time ? f.time + ' 收藏' : ''].filter(Boolean).join(' · ')) +
          '</div><div class="peek-page-text">' + peekEsc(f.content || '') + '</div>';
        return el;
      });
    }));
  });
}
// 相册：默认是文字图片（一段文字描述画面）；设置里相册选了生图，就一张张画出来存着（下次打开直接看）
function renderPeekPhotos(body, char, d) {
  var ps = d.photos || [];
  if (!ps.length) return peekEmpty(body, '相册是空的');
  var gen = typeof imgUse === 'function' && imgUse('album') === 'gen';
  var waiting = ps.filter(function(p) { return !p.img; }).length;
  if (gen && waiting) {
    var tip = document.createElement('div');
    tip.className = 'peek-at';
    tip.textContent = '正在把照片画出来，还剩 ' + waiting + ' 张…';
    body.appendChild(tip);
    peekGenPhotos(char, ps);
  }
  var grid = document.createElement('div');
  grid.className = 'peek-photos';
  ps.forEach(function(p) {
    var cell = document.createElement('div');
    cell.className = 'peek-photo';
    if (p.img) { var im = document.createElement('img'); im.src = p.img; im.alt = ''; cell.appendChild(im); }
    else cell.appendChild(peekTextImg(p.desc));
    var meta = document.createElement('div');
    meta.className = 'peek-photo-date';
    meta.textContent = p.date || '';
    cell.appendChild(meta);
    var open = function() {
      peekSee('相册里的「' + String(p.desc || '照片').slice(0, 12) + '」');
      peekDetail(p.album || '照片', function() {
        var el = document.createElement('div');
        el.className = 'peek-page';
        el.innerHTML = '<div class="peek-photo-big"></div><div class="peek-page-meta"></div><div class="peek-page-text"></div>';
        var big = el.querySelector('.peek-photo-big');
        if (p.img) { var bi = document.createElement('img'); bi.src = p.img; bi.alt = ''; big.appendChild(bi); bi.addEventListener('click', function() { openImgViewer(p.img, { source: '查手机 · 相册' }); }); }
        else big.appendChild(peekTextImg(p.desc));
        el.querySelector('.peek-page-meta').textContent = [p.date, p.album].filter(Boolean).join(' · ');
        el.querySelector('.peek-page-text').textContent = (p.note ? '「' + p.note + '」\n\n' : '') + (p.desc || '');
        return el;
      });
    };
    cell.addEventListener('click', open);
    grid.appendChild(cell);
  });
  body.appendChild(grid);
}
// 文字图片的方块（样子和动态里的文字图一样，点了由外面那层处理）
function peekTextImg(desc) {
  var el = document.createElement('div');
  el.className = 'feed-textimg';
  var sp = document.createElement('span');
  sp.textContent = desc || '';
  el.appendChild(sp);
  return el;
}
var peekPhotoBusy = {};
function peekGenPhotos(char, ps) {
  var key = String(char.id);
  if (peekPhotoBusy[key]) return;
  peekPhotoBusy[key] = true;
  var next = function() {
    var p = ps.filter(function(x) { return !x.img && !x.genFail; })[0];
    if (!p) { delete peekPhotoBusy[key]; return; }
    queueImageGen(p.desc || '').then(function(src) { p.img = src; }, function(err) { p.genFail = true; console.warn('[Mphone] 相册照片没画出来:', err); })
      .then(function() {
        savePeek();
        if (peekChar() === char && peekState.app === 'photos' && !peekState.detail && appPeek.classList.contains('active')) renderPeek();
        next();
      });
  };
  next();
}
function renderPeekShop(body, d) {
  peekTabs(body, [['cart', '购物车'], ['wallet', '钱包'], ['bills', '账单']]);
  if (peekState.tab === 'cart') {
    var cart = d.cart || [];
    if (!cart.length) return peekEmpty(body, '购物车是空的');
    var sum = 0;
    cart.forEach(function(it) {
      sum += Number(it.price) || 0;
      body.appendChild(peekRow('<div class="peek-ico">📦</div><div class="peek-row-main"><div class="peek-row-top"><b>' + peekEsc(it.name) + '</b><span class="peek-price">' + peekMoney(it.price) + '</span></div>' +
        (it.spec ? '<div class="peek-row-sub">' + peekEsc(it.spec) + '</div>' : '') + (it.note ? '<div class="peek-note">' + peekEsc(it.note) + '</div>' : '') + '</div>'));
    });
    var tot = document.createElement('div');
    tot.className = 'peek-total';
    tot.innerHTML = '合计 <b>' + peekMoney(sum) + '</b>';
    body.appendChild(tot);
    return;
  }
  if (peekState.tab === 'wallet') {
    var w = d.wallet || {};
    var card = document.createElement('div');
    card.className = 'peek-wallet';
    card.innerHTML = '<div class="peek-wallet-label">余额</div><div class="peek-wallet-num">' + peekMoney(w.balance || 0) + '</div>';
    body.appendChild(card);
    (w.cards || []).forEach(function(c) {
      body.appendChild(peekRow('<div class="peek-ico">💳</div><div class="peek-row-main"><div class="peek-row-top"><b>' + peekEsc(c.name) + '</b><span class="peek-price">' + peekMoney(c.amount) + '</span></div></div>'));
    });
    return;
  }
  var bills = d.bills || [];
  if (!bills.length) return peekEmpty(body, '没有账单');
  bills.forEach(function(b) {
    var v = Number(b.amount) || 0;
    body.appendChild(peekRow('<div class="peek-row-main"><div class="peek-row-top"><b>' + peekEsc(b.title) + '</b><span class="peek-price ' + (v > 0 ? 'in' : '') + '">' + (v > 0 ? '+' : '') + peekMoney(v) +
      '</span></div><div class="peek-row-sub">' + peekEsc([b.time, b.note].filter(Boolean).join(' · ')) + '</div></div>'));
  });
}
