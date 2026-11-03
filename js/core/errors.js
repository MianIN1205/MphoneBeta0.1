// 眠花糖机 — 报错分析：聊天里出错时显示一行小字（和拍一拍差不多大），点开看「出了什么问题、可能的原因、怎么办」

// =============================================
// 报错对照表：按顺序找第一条对得上的。test 拿到 { msg（小写的原文）, status（状态码，没有就是 0） }
// =============================================
var ERROR_TABLE = [
  { id: 'noapi', test: function(e) { return /请先在设置中填写 api|请先填写 api|请先选择模型/.test(e.msg); },
    title: '还没设置好 API',
    reasons: ['设置里的接口地址、密钥还没填，或者还没选模型', '填了但没点「当前应用」保存'],
    fixes: ['打开 设置 → 主API，填好接口地址和密钥，选好模型，点「当前应用」', '如果这个聊天在便捷拓展栏里单独选了模型预设，检查那套预设填全了没有'] },

  { id: 'empty', test: function(e) { return /未收到回复内容|empty response|no content/.test(e.msg); },
    title: '没收到回复内容',
    reasons: ['模型返回了空白：有的模型遇到它不想回答的内容会直接不说话', '回复被平台的安全过滤拦掉了，只剩一个空壳', '「最大输出长度」太小，或者会思考的模型把字数都用在了思考上', '中转站不稳定，只回了一个空包'],
    fixes: ['点 ❄️ 再试一次', '换个说法，或者在便捷拓展栏换个模型试试', '检查预设里有没有把输出长度限制得太小'] },

  { id: 'refusal', test: function(e) { return /拒绝回答|refus|safety|content.?filter|content_policy|blocked|prohibited|harm/.test(e.msg); },
    title: '被模型的安全规则拦下了',
    reasons: ['这一轮的内容（或者最近的聊天记录、人设、世界书里的某段）触发了模型的安全审查', '不同模型、不同中转站的尺度不一样'],
    fixes: ['换个说法再试', '换一个尺度更宽的模型', '检查人设、预设、世界书里有没有特别容易触发审查的内容'] },

  { id: 'context', test: function(e) { return /context|maximum.*tokens|too many tokens|token.?limit|max_tokens|prompt is too long|input is too long|reduce the length/.test(e.msg); },
    title: '聊天记录太长了',
    reasons: ['这次发过去的内容（人设 + 预设 + 世界书 + 记忆 + 聊天记录）超过了这个模型一次能读的长度', '最近发了很多图片，或者世界书、预设特别长'],
    fixes: ['角色设置 → 聊天 → 把「上下文上限」或「最大记忆范围」调小一点', '换一个能读更长内容的模型', '打开「自动总结」，让旧聊天变成简短的记忆'] },

  { id: 'auth', test: function(e) { return e.status === 401 || /invalid.*(api.?key|token)|incorrect api key|unauthori[sz]ed|authentication|api key not valid|无效的令牌|令牌/.test(e.msg); },
    title: '密钥不对',
    reasons: ['密钥填错了、少复制了几位，或者前后多了空格', '密钥已经过期、被删掉或者被禁用了', '密钥和接口地址不是同一家的（比如用 A 中转的密钥连 B 中转）'],
    fixes: ['回到 设置 → 主API，重新复制粘贴一次密钥，点「当前应用」', '去中转站或官网后台看看这个密钥还在不在'] },

  { id: 'money', test: function(e) { return e.status === 402 || /insufficient|quota|balance|credit|billing|余额|额度|欠费/.test(e.msg); },
    title: '余额或额度用完了',
    reasons: ['账户余额不够了', '这个密钥设了额度上限，已经用完', '免费额度用完了'],
    fixes: ['去中转站或官网后台充值，或者调高这个密钥的额度', '先换一个有余额的 API 预设用着'] },

  { id: 'forbidden', test: function(e) { return e.status === 403 || /forbidden|permission|not allowed|unsupported.?(country|region)|region|地区/.test(e.msg); },
    title: '没有权限，或者地区不支持',
    reasons: ['这个密钥没有用这个模型的权限', '服务商不支持你所在的地区（VPN 节点所在地也算）', '中转站把这个请求拦下了'],
    fixes: ['换一个模型试试', '换一个 VPN 节点', '问问中转站这个模型能不能用'] },

  { id: 'notfound', test: function(e) { return e.status === 404 || /not.?found|does not exist|no such model|model_not_found|unknown model|invalid model/.test(e.msg); },
    title: '地址或模型名不对',
    reasons: ['接口地址少了 /v1 之类的后缀，或者多写了一段', '模型名写错了，或者这个模型已经下线', '这个中转站没有这个模型'],
    fixes: ['设置 → 主API，对照中转站给的地址重新填一次（一般以 /v1 结尾）', '点刷新按钮重新拉一次模型列表，从列表里选'] },

  { id: 'toolarge', test: function(e) { return e.status === 413 || /too large|payload|entity too large|request size/.test(e.msg); },
    title: '发送的内容太大了',
    reasons: ['最近发的图片、语音太大，或者太多', '聊天记录特别长'],
    fixes: ['少发几张图，或者发小一点的图', '角色设置 → 聊天 → 把「上下文上限」调小一点', '设置里关掉「发送真实图片」，让图片只用文字说明'] },

  { id: 'ratelimit', test: function(e) { return e.status === 429 || /rate.?limit|too many requests|频繁|并发/.test(e.msg); },
    title: '请求太频繁了',
    reasons: ['短时间里请求次数太多（自动消息、动态、总结、日记也会占次数）', '这个密钥或中转站限制了每分钟的次数'],
    fixes: ['等一两分钟再点 ❄️', '暂时关掉一些角色的自主活动，减少后台请求', '换一个 API 预设分担一下'] },

  { id: 'timeout', test: function(e) { return e.status === 408 || e.status === 504 || e.status === 524 || /time.?out|timed out|超时/.test(e.msg); },
    title: '等太久，超时了',
    reasons: ['模型想得太久（长回复、会思考的模型更容易）', '中转站或网络太慢', '手机切到后台时连接被掐断了'],
    fixes: ['点 ❄️ 再试一次', '回复的时候先别切出去', '换一个快一点的模型或中转'] },

  { id: 'server', test: function(e) { return [500, 502, 503, 520, 521, 522, 529].indexOf(e.status) >= 0 || /bad gateway|service unavailable|internal server error|overloaded|server error|upstream/.test(e.msg); },
    title: '服务器那边出问题了',
    reasons: ['模型服务商或中转站暂时出故障了，或者太忙', '这不是你这边的问题'],
    fixes: ['过一会儿再点 ❄️', '先换一个 API 预设或模型用着', '一直这样的话，去中转站的公告或群里看看'] },

  { id: 'network', test: function(e) { return /failed to fetch|networkerror|network error|load failed|network request failed|连接失败|err_/.test(e.msg); },
    title: '连不上服务器',
    reasons: ['手机网络或 VPN 断了、正在切换', '接口地址写错了：少了 https://、多了空格、域名拼错', '中转站挂了，或者在你的网络环境下访问不了', '这个接口不允许网页直接访问（跨域限制）：别的 App 能用，不代表网页里能用', '手机切到后台时把连接断了'],
    fixes: ['检查网络和 VPN，换个节点试试', '设置 → 主API，点刷新按钮拉一次模型列表：拉不到就说明这个地址连不上', '核对接口地址，必要时换一个中转站'] },

  { id: 'format', test: function(e) { return /unexpected token|json|not valid|<!doctype|<html/.test(e.msg); },
    title: '返回的不是正常的数据',
    reasons: ['接口地址可能填成了网页地址，而不是 API 地址', '这个地址不是 OpenAI 兼容格式的接口', '中转站出错，返回了一个错误网页'],
    fixes: ['对照中转站的说明，重新填一次 API 地址（一般以 /v1 结尾）', '过一会儿再试'] },

  { id: 'badreq', test: function(e) { return e.status === 400 || /invalid|bad request|unsupported|not support/.test(e.msg); },
    title: '请求格式不被接受',
    reasons: ['这个模型不支持图片、语音或者工具（MCP），而这次发过去了', '某个参数这个模型不认（比如温度超出范围）', '中转站和这个模型的格式不兼容'],
    fixes: ['设置里关掉「发送真实图片」、语音发送改成「转成文字」再试', '暂时关掉 MCP 工具', '换一个模型试试'] },
];
var ERROR_FALLBACK = { id: 'other', title: '出了点问题',
  reasons: ['对照表里没有对上这种情况，可以看下面的原始报错'],
  fixes: ['点 ❄️ 再试一次', '把原始报错复制下来发给 Claude，帮你看看'] };

function explainError(err) {
  var info = { msg: String((err && err.message) || err || '').toLowerCase(), status: (err && err.status) || 0 };
  for (var i = 0; i < ERROR_TABLE.length; i++) if (ERROR_TABLE[i].test(info)) return ERROR_TABLE[i];
  return ERROR_FALLBACK;
}

// =============================================
// 聊天里的一行小字：「⚠️ 回复失败：连不上服务器  查看原因」，点开是分析弹窗
// 不会发给 AI。报错条一直留在原处（切出去再回来、重开小手机都还在）：
// 挂在出错时最后一条消息上（m.errs，跟着记录存）；记录还空着时挂在这份记录上（只在这次打开期间）
// =============================================
var ERR_KEEP = 5;                  // 一条消息后面最多留几条报错
var errEmptyNotes = new WeakMap(); // 空记录 → 报错
// 报错存成普通对象（能存进记录）；只留分析和完整报错要用的，密钥打码
function errPack(err, ctx) {
  err = err || {}; ctx = ctx || {};
  var o = { message: errRedact(String(err.message || err || '')), time: Date.now() };
  if (err.status) o.status = err.status;
  if (err.statusText) o.statusText = String(err.statusText);
  if (err.name && err.name !== 'Error') o.name = String(err.name);
  try { if (err.url) { var eu = new URL(err.url); o.url = eu.origin + eu.pathname; } } catch (_) {}
  if (err.body != null && String(err.body).trim()) o.body = errRedact(String(err.body).slice(0, 20000));
  else if (err.stack) o.stack = String(err.stack).split('\n').slice(0, 10).join('\n');
  if (ctx.model) o.model = String(ctx.model);
  try { if (ctx.url) { var cu = new URL(ctx.url); o.ctxUrl = cu.origin + cu.pathname; } } catch (_) {}
  return o;
}
// 记下这次报错（不画），返回存好的那份
function errRemember(hist, err, ctx) {
  var p = errPack(err, ctx);
  if (!hist) return p;
  var m = hist[hist.length - 1];
  if (m) {
    m.errs = (m.errs || []).concat(p).slice(-ERR_KEEP);
    if (typeof saveHistories === 'function') saveHistories();
  } else {
    errEmptyNotes.set(hist, (errEmptyNotes.get(hist) || []).concat(p).slice(-ERR_KEEP));
  }
  return p;
}
function errNoticeEl(p) {
  var e = { message: p.message, status: p.status, statusText: p.statusText, name: p.name, url: p.url, body: p.body, stack: p.stack };
  var ex = explainError(e);
  var el = document.createElement('div');
  el.className = 'cr-recall-notice cr-err-notice';
  el.appendChild(document.createTextNode('⚠️ 回复失败：' + ex.title));
  var more = document.createElement('span');
  more.className = 'cr-recall-reedit';
  more.textContent = '查看原因';
  el.appendChild(more);
  var detail = { ex: ex, err: e, time: p.time, ctx: { model: p.model, url: p.ctxUrl } };
  el.addEventListener('click', function() { openErrInfo(detail); });
  return el;
}
// 重画列表时把存着的报错放回原处：after 是消息（null = 记录开头），row 是这条消息画出来的元素
function errRenderSaved(list, m, row, hist) {
  var arr = m ? m.errs : errEmptyNotes.get(hist);
  if (!arr || !arr.length) return;
  var els = arr.map(function(p) { var el = errNoticeEl(p); list.appendChild(el); return el; });
  if (row && row.nodeType === 1) row._errNotes = (row._errNotes || []).concat(els);
  if (!m && list._empty) list._empty.style.display = 'none';
}
function showErrNotice(err, list, empty, ctx, hist) {
  list = list || getActiveMsgListEl();
  if (empty) empty.style.display = 'none';
  hist = hist || list._hist || (typeof getActiveHistory === 'function' ? getActiveHistory(openingChatCharIdx) : null);
  var el = errNoticeEl(errRemember(hist, err, ctx));
  // 挂在最后一条消息上：删这条消息时报错条一起拿掉
  var rows = list.querySelectorAll('.chat-msg-row');
  var last = rows[rows.length - 1];
  if (last && hist && last._msg === hist[hist.length - 1]) last._errNotes = (last._errNotes || []).concat(el);
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
  return el;
}

// 密钥打码（不截断：完整报错要整段显示）
function errRedact(text) {
  return String(text || '').replace(/(sk|key|pk)-[A-Za-z0-9_\-]{6,}/gi, '$1-***').replace(/Bearer\s+\S+/gi, 'Bearer ***')
    .replace(/([?&](?:key|api_key|apikey|token|access_token)=)[^&\s"]+/gi, '$1***');
}
var errInfoOverlay = document.getElementById('errInfoOverlay');
var errInfoText = '', errInfoCode = '';
function openErrInfo(d) {
  var fill = function(id, arr) {
    var ul = document.getElementById(id);
    ul.innerHTML = '';
    arr.forEach(function(t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
  };
  document.getElementById('errInfoTitle').textContent = d.ex.title;
  fill('errInfoReasons', d.ex.reasons);
  fill('errInfoFixes', d.ex.fixes);
  // 原始报错：时间、状态码、模型、接口（只留域名），原文里的密钥打码
  var host = '';
  try { host = d.ctx.url ? new URL(d.ctx.url).host : ''; } catch (_) {}
  var raw = String((d.err && d.err.message) || d.err || '');
  errInfoText = [
    '时间：' + fmtMsgTime(d.time),
    '分类：' + d.ex.title,
    d.err && d.err.status ? '状态码：' + d.err.status : '',
    d.ctx.model ? '模型：' + d.ctx.model : '',
    host ? '接口：' + host : '',
    '原文：' + (typeof redactSecret === 'function' ? redactSecret(raw) : raw)
  ].filter(Boolean).join('\n');
  document.getElementById('errInfoRaw').textContent = errInfoText;
  document.getElementById('errInfoRawWrap').classList.remove('open');
  // 完整报错代码（单独折叠）：状态行、接口、错误本身、接口返回的原文（JSON 排好版）；连不上时是出错的位置。只把密钥打码，不截断
  errInfoCode = errFullCode(d);
  document.getElementById('errInfoCode').textContent = errInfoCode;
  document.getElementById('errInfoCodeWrap').classList.remove('open');
  errInfoOverlay.classList.add('open');
}
function errFullCode(d) {
  var e = d.err || {}, where = '';
  try { var u = new URL(e.url || d.ctx.url || ''); where = u.origin + u.pathname; } catch (_) {}
  var lines = [];
  if (e.status) lines.push('HTTP ' + e.status + (e.statusText ? ' ' + e.statusText : ''));
  if (where) lines.push(where);
  lines.push((e.name || 'Error') + ': ' + String(e.message || d.err || ''));
  if (e.body != null && String(e.body).trim()) {
    var body = String(e.body);
    try { body = JSON.stringify(JSON.parse(body), null, 2); } catch (_) {}
    lines.push('', body.length > 20000 ? body.slice(0, 20000) + '\n…（太长，后面省略）' : body);
  } else if (e.stack) {
    lines.push('', String(e.stack).split('\n').slice(0, 10).join('\n'));
  }
  return errRedact(lines.join('\n'));
}
document.getElementById('errInfoRawToggle').addEventListener('click', function() {
  document.getElementById('errInfoRawWrap').classList.toggle('open');
});
document.getElementById('errInfoCodeCopy').addEventListener('click', function() {
  if (!navigator.clipboard) { showToast('✗ 这里不能复制', 'error'); return; }
  navigator.clipboard.writeText(errInfoCode).then(function() { showToast('✓ 已复制', 'success'); }, function() { showToast('✗ 复制失败', 'error'); });
});
document.getElementById('errInfoCodeToggle').addEventListener('click', function() {
  document.getElementById('errInfoCodeWrap').classList.toggle('open');
});
document.getElementById('errInfoCopy').addEventListener('click', function() {
  if (!navigator.clipboard) { showToast('✗ 这里不能复制', 'error'); return; }
  navigator.clipboard.writeText(errInfoText + (errInfoCode ? '\n\n—— 完整报错代码 ——\n' + errInfoCode : '')).then(function() { showToast('✓ 已复制', 'success'); }, function() { showToast('✗ 复制失败', 'error'); });
});
document.getElementById('errInfoClose').addEventListener('click', function() { errInfoOverlay.classList.remove('open'); });
closeOnBackdrop(errInfoOverlay);
