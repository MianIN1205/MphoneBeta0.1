// 眠花糖机 — 内置工具：直接在小手机里运行，不用另外部署 MCP 服务器；设置 → MCP 里一个开关就能用（mphone_mcp_builtin）
// 天气（Open-Meteo）、读网页（Jina Reader）、歌词（LRCLIB）这三个要联网、都是免费不用密钥的接口；计算器、骰子 / 抽签 / 塔罗在手机里算，不联网

var MCP_BUILTINS = [
  { id: 'weather', name: '天气', icon: '🌤', desc: '查任意城市现在的天气和未来几天（Open-Meteo，免费、不用密钥）', tools: [
    { name: 'weather', title: '查天气', description: '查询某个城市现在的天气和未来几天的预报（温度、天气、降水概率）',
      parameters: { type: 'object', properties: { city: { type: 'string', description: '城市名，比如 上海、杭州、东京' }, days: { type: 'integer', description: '预报几天，1～7，默认 3' } }, required: ['city'] } }
  ] },
  { id: 'web', name: '读网页', icon: '🔗', desc: '读链接里的内容，对方发来链接时可以点开看（通过 Jina Reader 转成文字，免费；有的网站读不了）', tools: [
    { name: 'read_url', title: '读网页', description: '读取一个网页链接里的正文内容（转成文字）。对方发来链接、想让你看看时用',
      parameters: { type: 'object', properties: { url: { type: 'string', description: '完整网址，http 或 https 开头' } }, required: ['url'] } }
  ] },
  { id: 'lyrics', name: '歌词', icon: '🎵', desc: '按歌名（和歌手）查歌词（LRCLIB，免费；冷门歌和一部分中文歌可能查不到）', tools: [
    { name: 'lyrics', title: '查歌词', description: '按歌名查一首歌的歌词，最好带上歌手名',
      parameters: { type: 'object', properties: { title: { type: 'string', description: '歌名' }, artist: { type: 'string', description: '歌手（可选）' } }, required: ['title'] } }
  ] },
  { id: 'calc', name: '计算器', icon: '🧮', desc: '算数：加减乘除、括号、乘方、百分比（在手机里算，不联网）', tools: [
    { name: 'calculate', title: '计算', description: '计算一个数学式子，支持 + - * / ( ) ^ 和百分号',
      parameters: { type: 'object', properties: { expression: { type: 'string', description: '式子，比如 (128+64)*0.85' } }, required: ['expression'] } }
  ] },
  { id: 'fun', name: '骰子 · 抽签 · 塔罗', icon: '🎲', desc: '掷骰子、从几个选项里抽一个、求签、抽塔罗牌（在手机里随机，不联网）', tools: [
    { name: 'roll_dice', title: '掷骰子', description: '掷骰子，可以指定几个、几面',
      parameters: { type: 'object', properties: { count: { type: 'integer', description: '几个骰子，默认 1' }, sides: { type: 'integer', description: '几面，默认 6' } } } },
    { name: 'draw_lots', title: '抽签', description: '从给的几个选项里随机抽一个；不给选项就求一支签（上上签到下签）',
      parameters: { type: 'object', properties: { options: { type: 'array', items: { type: 'string' }, description: '选项（可选）' } } } },
    { name: 'tarot', title: '抽塔罗牌', description: '抽塔罗牌（大阿卡纳 22 张，正位或逆位），可以带上想问的事',
      parameters: { type: 'object', properties: { count: { type: 'integer', description: '抽几张，1～3，默认 1；3 张是过去 / 现在 / 未来' }, question: { type: 'string', description: '想问的事（可选）' } } } }
  ] }
];
var mcpBuiltinOn = mphoneStore.load('mphone_mcp_builtin', {}) || {};
function saveMcpBuiltin() { mphoneStore.save('mphone_mcp_builtin', mcpBuiltinOn); }

// 打开了的内置工具（给 mcpActiveTools 用）：[{ pack, tool }]
function mcpBuiltinTools() {
  var out = [];
  MCP_BUILTINS.forEach(function(p) { if (mcpBuiltinOn[p.id]) p.tools.forEach(function(t) { out.push({ pack: p, tool: t }); }); });
  return out;
}

// ---------- 联网的小工具 ----------
function mbFetch(url) {
  var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 20000) : 0;
  return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function(r) {
    clearTimeout(timer);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r;
  }, function(err) {
    clearTimeout(timer);
    throw new Error(err && err.name === 'AbortError' ? '等太久没回应' : '连不上（可能是网络不通）');
  });
}
function mbJson(url) { return mbFetch(url).then(function(r) { return r.json(); }); }
var MB_WMO = { 0: '晴', 1: '大致晴朗', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '小毛毛雨', 53: '毛毛雨', 55: '较大的毛毛雨', 56: '冻毛毛雨', 57: '冻毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒', 80: '阵雨', 81: '较强的阵雨', 82: '强阵雨', 85: '阵雪', 86: '强阵雪', 95: '雷阵雨', 96: '雷阵雨伴冰雹', 99: '强雷阵雨伴冰雹' };
function mbWeather(a) {
  var city = String(a.city || '').trim(), days = Math.min(7, Math.max(1, parseInt(a.days, 10) || 3));
  if (!city) return Promise.resolve('没说是哪个城市');
  function geo(name) { return mbJson('https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&format=json&name=' + encodeURIComponent(name)).then(function(g) { return g && g.results && g.results[0]; }); }
  return geo(city).then(function(p) {
    var short = city.replace(/(市|区|县|省)$/, '');
    return p || (short !== city && short.length >= 2 ? geo(short) : null);
  }).then(function(p) {
    if (!p) return '没找到「' + city + '」这个地方';
    var place = [p.name, p.admin1 !== p.name ? p.admin1 : '', p.country].filter(Boolean).join('，');
    return mbJson('https://api.open-meteo.com/v1/forecast?latitude=' + p.latitude + '&longitude=' + p.longitude +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=' + days).then(function(w) {
      var c = w.current || {}, d = w.daily || {};
      var lines = [place + ' 现在（当地 ' + String(c.time || '').replace('T', ' ') + '）：' + (MB_WMO[c.weather_code] || '天气代码 ' + c.weather_code) + '，' + c.temperature_2m + '°C（体感 ' + c.apparent_temperature + '°C），湿度 ' + c.relative_humidity_2m + '%，风速 ' + c.wind_speed_10m + ' km/h'];
      (d.time || []).forEach(function(t, i) {
        var pp = d.precipitation_probability_max && d.precipitation_probability_max[i];
        lines.push(t + '：' + (MB_WMO[d.weather_code[i]] || '') + '，' + d.temperature_2m_min[i] + '～' + d.temperature_2m_max[i] + '°C' + (pp != null ? '，降水概率 ' + pp + '%' : ''));
      });
      return lines.join('\n');
    });
  });
}
function mbReadUrl(a) {
  var u = String(a.url || '').trim();
  if (!/^https?:\/\//i.test(u)) return Promise.resolve('这不是一个网址：' + u);
  return mbFetch('https://r.jina.ai/' + u).then(function(r) { return r.text(); }).then(function(t) {
    t = String(t || '').trim();
    if (!t) return '这个网页没读出内容';
    return t.length > 8000 ? t.slice(0, 8000) + '\n…（太长了，后面省略）' : t;
  });
}
function mbLyrics(a) {
  var title = String(a.title || '').trim(), artist = String(a.artist || '').trim();
  if (!title) return Promise.resolve('没说是哪首歌');
  return mbJson('https://lrclib.net/api/search?track_name=' + encodeURIComponent(title) + (artist ? '&artist_name=' + encodeURIComponent(artist) : '')).then(function(list) {
    var hit = (list || []).filter(function(x) { return x && x.plainLyrics; })[0];
    if (!hit) return '没查到《' + title + '》' + (artist ? '（' + artist + '）' : '') + '的歌词';
    var text = String(hit.plainLyrics).trim();
    return '《' + hit.trackName + '》' + (hit.artistName ? ' — ' + hit.artistName : '') + '\n' + (text.length > 4000 ? text.slice(0, 4000) + '\n…' : text);
  });
}

// ---------- 不联网的小工具 ----------
function mbRand(n) {   // 0 ～ n-1
  if (window.crypto && crypto.getRandomValues) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
  return Math.floor(Math.random() * n);
}
function mbCalc(a) {
  var e = String(a.expression || '').replace(/[×＊]/g, '*').replace(/[÷／]/g, '/').replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[＋]/g, '+').replace(/[－—]/g, '-').replace(/\s+/g, '');
  if (!e || !/^[0-9+\-*/().^%]+$/.test(e)) return Promise.resolve('只能算数字和 + - * / ( ) ^ %：' + a.expression);
  try {
    var js = e.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)').replace(/\^/g, '**');
    var r = Function('"use strict";return (' + js + ');')();
    if (typeof r !== 'number' || !isFinite(r)) return Promise.resolve('算不出来：' + a.expression);
    return Promise.resolve(a.expression + ' = ' + Number(r.toPrecision(12)));
  } catch (_) { return Promise.resolve('式子写得不对：' + a.expression); }
}
function mbDice(a) {
  var n = Math.min(20, Math.max(1, parseInt(a.count, 10) || 1)), s = Math.min(1000, Math.max(2, parseInt(a.sides, 10) || 6)), rs = [];
  for (var i = 0; i < n; i++) rs.push(mbRand(s) + 1);
  return Promise.resolve('掷了 ' + n + ' 个 ' + s + ' 面骰子：' + rs.join('、') + (n > 1 ? '（合计 ' + rs.reduce(function(x, y) { return x + y; }, 0) + '）' : ''));
}
var MB_LOTS = ['上上签', '上签', '上签', '中签', '中签', '中签', '中下签', '下签'];
function mbLots(a) {
  var opts = (Array.isArray(a.options) ? a.options : []).map(function(x) { return String(x).trim(); }).filter(Boolean);
  if (opts.length) return Promise.resolve('从「' + opts.join('」「') + '」里抽到了：' + opts[mbRand(opts.length)]);
  return Promise.resolve('求了一支签：' + MB_LOTS[mbRand(MB_LOTS.length)]);
}
var MB_TAROT = [
  ['愚者', '新的开始、自由、冒险', '鲁莽、犹豫不决'], ['魔术师', '创造力、行动、自信', '欺骗、能力没用对地方'], ['女祭司', '直觉、秘密、内在的智慧', '忽视直觉、只看表面'],
  ['皇后', '丰盛、温柔、滋养', '依赖、停滞'], ['皇帝', '稳定、掌控、责任', '固执、控制欲'], ['教皇', '传统、指引、信念', '打破常规、质疑'],
  ['恋人', '爱、选择、和谐', '分歧、诱惑'], ['战车', '意志、前进、胜利', '失控、迷失方向'], ['力量', '勇气、温柔的力量、耐心', '自我怀疑、软弱'],
  ['隐士', '独处、内省、寻找答案', '孤立、逃避'], ['命运之轮', '转机、好运、循环', '不顺、抗拒变化'], ['正义', '公平、真相、因果', '不公、逃避责任'],
  ['倒吊人', '换个角度、等待、放下', '拖延、白白牺牲'], ['死神', '结束与新生、转变', '抗拒改变、停滞'], ['节制', '平衡、调和、耐心', '失衡、过度'],
  ['恶魔', '束缚、欲望、执念', '挣脱、觉醒'], ['高塔', '突变、打破、觉醒', '躲过风波、害怕改变'], ['星星', '希望、治愈、灵感', '失望、信心不足'],
  ['月亮', '不安、幻象、潜意识', '迷雾散去、真相浮现'], ['太阳', '快乐、成功、温暖', '短暂的低落、过度乐观'], ['审判', '重生、召唤、反思', '自我怀疑、不肯面对'],
  ['世界', '圆满、完成、旅程的终点', '还差一步、未完成']
];
function mbTarot(a) {
  var n = Math.min(3, Math.max(1, parseInt(a.count, 10) || 1)), pool = MB_TAROT.slice(), pos = n === 3 ? ['过去', '现在', '未来'] : [], out = [];
  for (var i = 0; i < n; i++) {
    var c = pool.splice(mbRand(pool.length), 1)[0], up = mbRand(2) === 0;
    out.push((pos[i] ? pos[i] + '：' : '') + c[0] + (up ? '（正位）' : '（逆位）') + '——' + (up ? c[1] : c[2]));
  }
  return Promise.resolve((a.question ? '问的是：' + a.question + '\n' : '') + '抽到了：\n' + out.join('\n'));
}
var MB_RUN = { weather: mbWeather, read_url: mbReadUrl, lyrics: mbLyrics, calculate: mbCalc, roll_dice: mbDice, draw_lots: mbLots, tarot: mbTarot };
function mcpBuiltinCall(name, args) {
  var fn = MB_RUN[name];
  if (!fn) return Promise.resolve('没有这个工具：' + name);
  return Promise.resolve().then(function() { return fn(args || {}); }).then(String, function(err) {
    return '工具执行出错：' + ((err && err.message) || '不知道为什么') + '。请不用这个工具，直接回答。';
  });
}

// ---------- 设置页：内置工具一个一个开关 ----------
function renderMcpBuiltins() {
  var box = document.getElementById('mcpBuiltinList');
  if (!box) return;
  box.innerHTML = '';
  MCP_BUILTINS.forEach(function(p) {
    var card = document.createElement('div');
    card.className = 'settings-card mcp-server-card';
    card.innerHTML = '<div class="auto-row"><span class="auto-row-label"></span><label class="st-toggle-wrap"><input type="checkbox"><span class="st-toggle-slider"></span></label></div><div class="auto-hint"></div>';
    card.querySelector('.auto-row-label').textContent = p.icon + ' ' + p.name;
    card.querySelector('.auto-hint').textContent = p.desc;
    var cb = card.querySelector('input');
    cb.checked = !!mcpBuiltinOn[p.id];
    cb.addEventListener('change', function() {
      if (this.checked) mcpBuiltinOn[p.id] = true; else delete mcpBuiltinOn[p.id];
      saveMcpBuiltin();
      // 一键：打开内置工具时顺手把「聊天时允许角色使用工具」也打开
      if (this.checked && !mcpCfg.on) { mcpCfg.on = true; mcpOnInput.checked = true; saveMcpServers(); }
      if (this.checked) showToast('✓ 已打开「' + p.name + '」，角色聊天时可以用了', 'success');
    });
    box.appendChild(card);
  });
}
renderMcpBuiltins();
