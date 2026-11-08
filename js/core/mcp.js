// 眠花糖机 — MCP：连接 MCP 服务器，聊天时让角色使用工具

// =============================================
// MCP 客户端（浏览器里直接连 Streamable HTTP 服务器）
// · 先按 2025-06-18 握手（initialize → notifications/initialized，记住 Mcp-Session-Id）
// · 服务器不认 initialize 时，改用 2026-07-28 的方式（每个请求带版本和 Mcp-Method 头，没有会话）
// · 回复可能是 JSON，也可能是 SSE 流，两种都读
// 服务器需要允许网页访问（CORS），并在 Access-Control-Expose-Headers 里放出 Mcp-Session-Id
// =============================================
var MCP_LEGACY_VERSION = '2025-06-18';
var MCP_MODERN_VERSION = '2026-07-28';
var mcpServers = mphoneStore.load('mphone_mcp_servers', []);   // [{ id, name, url, token, enabled, tools: [...] }]
var mcpCfg = Object.assign({ on: false, confirm: true, takeout: false }, mphoneStore.load('mphone_mcp_cfg', {}));
var mcpSessions = {};   // 服务器 id → { mode: 'legacy' | 'modern', version, sessionId }
var mcpStatus = {};     // 服务器 id → { state: 'ok' | 'busy' | 'error', text }
var mcpRpcId = 0;

function saveMcpServers() {
  mphoneStore.save('mphone_mcp_servers', mcpServers);
  mphoneStore.save('mphone_mcp_cfg', mcpCfg);
}

// 读回复里的 JSON-RPC 消息：JSON 直接用；SSE 取 data 行，找 id 对得上的那条
function mcpReadResponse(res, id) {
  if (res.status === 202) return Promise.resolve(null);
  var ct = res.headers.get('content-type') || '';
  return res.text().then(function(t) {
    if (!t) return null;
    if (ct.indexOf('event-stream') < 0) return JSON.parse(t);
    var found = null, data = [];
    t.split(/\r?\n/).concat(['']).forEach(function(line) {
      if (line.indexOf('data:') === 0) { data.push(line.slice(5).replace(/^ /, '')); return; }
      if (line !== '' || !data.length) return;
      try {
        var msg = JSON.parse(data.join('\n'));
        if (!found && msg && msg.id === id && (msg.result !== undefined || msg.error)) found = msg;
      } catch (_) {}
      data = [];
    });
    return found;
  });
}

function mcpHeaders(server, session, method, params) {
  var h = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
  if (server.token) h['Authorization'] = 'Bearer ' + server.token;
  if (session && session.mode === 'modern') {
    h['MCP-Protocol-Version'] = MCP_MODERN_VERSION;
    h['Mcp-Method'] = method;
    if (method === 'tools/call' && params && params.name) h['Mcp-Name'] = params.name;
  } else if (session) {
    h['MCP-Protocol-Version'] = session.version;
    if (session.sessionId) h['Mcp-Session-Id'] = session.sessionId;
  }
  return h;
}

function mcpSend(server, session, msg) {
  return fetch(server.url, { method: 'POST', headers: mcpHeaders(server, session, msg.method, msg.params), body: JSON.stringify(msg) });
}

function mcpRpcError(e) {
  var err = new Error((e && e.message) || '服务器返回错误');
  err.code = e && e.code;
  return err;
}

// 建立连接：先试 2025-06-18 的 initialize；服务器明确不认时改用 2026-07-28
function mcpConnect(server) {
  var id = ++mcpRpcId;
  var init = { jsonrpc: '2.0', id: id, method: 'initialize', params: {
    protocolVersion: MCP_LEGACY_VERSION, capabilities: {}, clientInfo: { name: 'mphone', version: '0.1' } } };
  return mcpSend(server, null, init).then(function(res) {
    var sid = res.headers.get('Mcp-Session-Id');
    if (!res.ok) {
      return res.text().then(function(t) {
        var j = null;
        try { j = JSON.parse(t); } catch (_) {}
        // 新版服务器：没有 initialize，改用每个请求带版本的方式
        if (res.status === 400 || (j && j.error && (j.error.code === -32022 || j.error.code === -32601))) {
          mcpSessions[server.id] = { mode: 'modern' };
          return mcpSessions[server.id];
        }
        throw new Error('连接失败 ' + res.status + ((j && j.error && j.error.message) ? '：' + j.error.message : ''));
      });
    }
    return mcpReadResponse(res, id).then(function(msg) {
      if (!msg) throw new Error('服务器没有回应握手');
      if (msg.error) {
        if (msg.error.code === -32601) { mcpSessions[server.id] = { mode: 'modern' }; return mcpSessions[server.id]; }
        throw mcpRpcError(msg.error);
      }
      var session = { mode: 'legacy', version: (msg.result && msg.result.protocolVersion) || MCP_LEGACY_VERSION, sessionId: sid || '' };
      mcpSessions[server.id] = session;
      // 握手完成的通知（服务器回 202）
      return mcpSend(server, session, { jsonrpc: '2.0', method: 'notifications/initialized' })
        .then(function() { return session; }, function() { return session; });
    });
  });
}

// 发一个 JSON-RPC 请求；会话失效（404）时重新握手再试一次
function mcpRpc(server, method, params, retried) {
  var ready = mcpSessions[server.id] ? Promise.resolve(mcpSessions[server.id]) : mcpConnect(server);
  return ready.then(function(session) {
    var id = ++mcpRpcId;
    var msg = { jsonrpc: '2.0', id: id, method: method, params: params || {} };
    if (session.mode === 'modern') {
      msg.params._meta = Object.assign({}, msg.params._meta, {
        'io.modelcontextprotocol/protocolVersion': MCP_MODERN_VERSION,
        'io.modelcontextprotocol/clientCapabilities': {}
      });
    }
    return mcpSend(server, session, msg).then(function(res) {
      if (res.status === 404 && session.sessionId && !retried) {
        delete mcpSessions[server.id];
        return mcpRpc(server, method, params, true);
      }
      if (!res.ok) {
        return res.text().then(function(t) {
          var j = null;
          try { j = JSON.parse(t); } catch (_) {}
          throw new Error('请求失败 ' + res.status + ((j && j.error && j.error.message) ? '：' + j.error.message : ''));
        });
      }
      return mcpReadResponse(res, id).then(function(reply) {
        if (!reply) throw new Error('服务器没有返回结果');
        if (reply.error) throw mcpRpcError(reply.error);
        return reply.result;
      });
    });
  });
}

// 取工具列表（支持分页）
function mcpListTools(server) {
  var all = [];
  function page(cursor) {
    return mcpRpc(server, 'tools/list', cursor ? { cursor: cursor } : {}).then(function(r) {
      (r && r.tools || []).forEach(function(t) {
        all.push({ name: t.name, title: t.title || '', description: t.description || '', inputSchema: t.inputSchema || { type: 'object', properties: {} } });
      });
      if (r && r.nextCursor && all.length < 500) return page(r.nextCursor);
      return all;
    });
  }
  return page(null);
}

// 调用工具，把结果整理成给模型看的文字
function mcpCallTool(server, name, args) {
  return mcpRpc(server, 'tools/call', { name: name, arguments: args || {} }).then(function(r) {
    r = r || {};
    var parts = (r.content || []).map(function(c) {
      if (c.type === 'text') return c.text;
      if (c.type === 'image') return '[图片：' + (c.mimeType || 'image') + ']';
      if (c.type === 'audio') return '[音频：' + (c.mimeType || 'audio') + ']';
      if (c.type === 'resource_link') return '[链接] ' + (c.name || '') + ' ' + c.uri;
      if (c.type === 'resource' && c.resource) return c.resource.text || ('[资源] ' + c.resource.uri);
      return '';
    }).filter(Boolean);
    if (!parts.length && r.structuredContent) parts.push(JSON.stringify(r.structuredContent));
    var text = parts.join('\n').slice(0, 8000);
    return (r.isError ? '工具执行出错：' : '') + (text || '（工具没有返回内容）');
  });
}

// 连接并刷新一台服务器的工具列表
function mcpRefreshServer(server) {
  mcpStatus[server.id] = { state: 'busy', text: '连接中…' };
  renderMcpServers();
  delete mcpSessions[server.id];
  return mcpListTools(server).then(function(tools) {
    server.tools = tools;
    saveMcpServers();
    mcpStatus[server.id] = { state: 'ok', text: '已连接 · ' + tools.length + ' 个工具' };
    renderMcpServers();
    return tools;
  }, function(err) {
    var msg = err.message || '';
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) msg = '连不上（地址不对、网络不通，或服务器不允许网页访问 CORS）';
    mcpStatus[server.id] = { state: 'error', text: msg };
    renderMcpServers();
    throw err;
  });
}

// ---------- 给模型用的工具清单 ----------
// 工具名前加服务器名，避免重名；名字只能是字母数字下划线和横线，最长 64
var mcpToolMap = {};
function mcpSlug(s) { return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'mcp'; }
function mcpActiveTools() {
  mcpToolMap = {};
  if (!mcpCfg.on) return [];
  var list = [];
  mcpServers.forEach(function(sv, si) {
    if (!sv.enabled || !sv.tools) return;
    if (sv.takeout && !mcpCfg.takeout) return;   // 外卖总开关关着
    var prefix = sv.takeout || mcpSlug(sv.name).slice(0, 16) || ('s' + si);
    sv.tools.forEach(function(t) {
      var name = (prefix + '__' + mcpSlug(t.name)).slice(0, 64);
      if (mcpToolMap[name]) name = (name.slice(0, 60) + '_' + si).slice(0, 64);
      mcpToolMap[name] = { server: sv, tool: t };
      list.push({ name: name, description: (t.title ? t.title + '：' : '') + (t.description || '') + '（来自 ' + sv.name + '）' + (sv.takeout ? MCP_TAKEOUT_RULE : ''), parameters: t.inputSchema });
    });
  });
  // 内置工具（js/core/mcp-builtin.js）：在小手机里直接跑，名字前加 mphone__
  if (typeof mcpBuiltinTools === 'function') mcpBuiltinTools().forEach(function(x) {
    var name = 'mphone__' + x.tool.name;
    mcpToolMap[name] = { builtin: x.pack, tool: x.tool };
    list.push({ name: name, description: x.tool.title + '：' + x.tool.description, parameters: x.tool.parameters });
  });
  return list;
}

// 模型要用工具时：先按设置问一下，再调用
var mcpAskOverlay = document.getElementById('mcpAskOverlay');
var mcpAskResolve = null;
function mcpAsk(title, detail) {
  return new Promise(function(resolve) {
    if (mcpAskResolve) mcpAskResolve(false);
    mcpAskResolve = resolve;
    document.getElementById('mcpAskTitle').textContent = title;
    document.getElementById('mcpAskText').textContent = detail;
    mcpAskOverlay.classList.add('open');
  });
}
function mcpAskDone(ok) {
  mcpAskOverlay.classList.remove('open');
  var r = mcpAskResolve;
  mcpAskResolve = null;
  if (r) r(ok);
}
document.getElementById('mcpAskYes').addEventListener('click', function() { mcpAskDone(true); });
document.getElementById('mcpAskNo').addEventListener('click', function() { mcpAskDone(false); });

function mcpCallFromLLM(name, args) {
  var hit = mcpToolMap[name];
  if (!hit) return Promise.resolve('没有这个工具：' + name);
  var detail = '工具：' + (hit.tool.title || hit.tool.name) + '（' + (hit.builtin ? '内置' : hit.server.name) + '）\n参数：' + JSON.stringify(args || {}, null, 1).slice(0, 600);
  // 外卖的下单 / 取消单不管「先问我」开没开，都要先问（花的是真钱）
  var mustAsk = hit.server && hit.server.takeout && MCP_TAKEOUT_ASK.test(hit.tool.name);
  var asked = mcpCfg.confirm || mustAsk ? mcpAsk(mustAsk ? '角色想帮你下单' : '角色想使用工具', detail) : Promise.resolve(true);
  return asked.then(function(ok) {
    if (!ok) return '用户没有同意这次工具调用，请不用工具直接回答。';
    var run = hit.builtin ? mcpBuiltinCall(hit.tool.name, args) : mcpCallTool(hit.server, hit.tool.name, args);
    return hit.server && hit.server.takeout ? run.then(function(text) { mcpTakeoutPayLink(hit.server, text); return text; }) : run;
  });
}

// ---------- 设置页 ----------
var mcpOnInput = document.getElementById('mcpOn');
var mcpConfirmInput = document.getElementById('mcpConfirm');
mcpOnInput.checked = mcpCfg.on;
mcpConfirmInput.checked = mcpCfg.confirm;
mcpOnInput.addEventListener('change', function() { mcpCfg.on = this.checked; saveMcpServers(); });
mcpConfirmInput.addEventListener('change', function() { mcpCfg.confirm = this.checked; saveMcpServers(); });

function renderMcpServers() {
  if (typeof renderMcpTakeout === 'function') renderMcpTakeout();
  var box = document.getElementById('mcpServerList');
  box.innerHTML = '';
  var own = mcpServers.filter(function(sv) { return !sv.takeout; });
  if (!own.length) {
    var empty = document.createElement('div');
    empty.className = 'auto-hint';
    empty.style.margin = '0 4px 12px';
    empty.textContent = '还没有添加服务器';
    box.appendChild(empty);
    return;
  }
  own.forEach(function(sv) {
    var card = document.createElement('div');
    card.className = 'settings-card mcp-server-card';
    var head = document.createElement('div');
    head.className = 'auto-row';
    var nm = document.createElement('span');
    nm.className = 'auto-row-label';
    nm.textContent = sv.name;
    var tl = document.createElement('label');
    tl.className = 'st-toggle-wrap';
    tl.innerHTML = '<input type="checkbox"><span class="st-toggle-slider"></span>';
    var cb = tl.querySelector('input');
    cb.checked = !!sv.enabled;
    cb.addEventListener('change', function() { sv.enabled = this.checked; saveMcpServers(); });
    head.appendChild(nm);
    head.appendChild(tl);
    card.appendChild(head);

    var url = document.createElement('div');
    url.className = 'mcp-server-url';
    url.textContent = sv.url;
    card.appendChild(url);

    var st = mcpStatus[sv.id] || { state: '', text: sv.tools ? '上次连接时有 ' + sv.tools.length + ' 个工具' : '还没有连接' };
    var stEl = document.createElement('div');
    stEl.className = 'mcp-server-status ' + st.state;
    stEl.textContent = st.text;
    card.appendChild(stEl);

    if (sv.tools && sv.tools.length) {
      var tools = document.createElement('div');
      tools.className = 'feed-visible-list mcp-tool-list';
      sv.tools.forEach(function(t) {
        var chip = document.createElement('span');
        chip.className = 'feed-visible-chip';
        chip.textContent = t.title || t.name;
        chip.title = t.description || '';
        tools.appendChild(chip);
      });
      card.appendChild(tools);
    }

    var row = document.createElement('div');
    row.className = 'api-test-row';
    var re = document.createElement('button');
    re.className = 'action-btn btn-apply';
    re.textContent = '重新连接';
    re.addEventListener('click', function() { mcpRefreshServer(sv).catch(function() {}); });
    var del = document.createElement('button');
    del.className = 'action-btn btn-apply';
    del.textContent = '删除';
    del.addEventListener('click', function() {
      openConfirm('删除服务器「' + sv.name + '」？', function() {
        mcpServers = mcpServers.filter(function(x) { return x !== sv; });
        delete mcpSessions[sv.id];
        saveMcpServers();
        renderMcpServers();
      });
    });
    row.appendChild(re);
    row.appendChild(del);
    card.appendChild(row);
    box.appendChild(card);
  });
}

document.getElementById('mcpAddBtn').addEventListener('click', function() {
  var nameEl = document.getElementById('mcpNewName'), urlEl = document.getElementById('mcpNewUrl'), tokEl = document.getElementById('mcpNewToken');
  var url = urlEl.value.trim();
  if (!/^https?:\/\//i.test(url)) { shakeEl(urlEl); showToast('请填写 http(s) 开头的地址', 'error'); return; }
  var sv = { id: 'mcp' + Date.now().toString(36), name: nameEl.value.trim() || '服务器' + (mcpServers.length + 1), url: url, token: tokEl.value.trim(), enabled: true, tools: null };
  mcpServers.push(sv);
  saveMcpServers();
  nameEl.value = ''; urlEl.value = ''; tokEl.value = '';
  mcpRefreshServer(sv).then(function(tools) {
    showToast('✓ 已连接「' + sv.name + '」：' + tools.length + ' 个工具', 'success');
  }, function() {
    showToast('✗ 没连上「' + sv.name + '」，可以稍后点「重新连接」', 'error');
  });
});

renderMcpServers();

// ---------- 外卖：品牌官方的 MCP（TA 帮你挑、你自己付款） ----------
// 地址和拿令牌的网页来自各品牌官方说明（2026 年）；令牌都是 Authorization: Bearer，大约一个月过期
var MCP_TAKEOUT = [
  { id: 'luckin', name: '瑞幸咖啡', icon: '☕', url: 'https://gwmcp.lkcoffee.com/order/user/mcp', tokenUrl: 'https://open.lkcoffee.com/mcp',
    desc: '找门店、挑饮品和口味、算价钱、下单。只能到店自取（不送外卖），下好单用微信扫码付款，取餐码在订单里。' },
  { id: 'mcd', name: '麦当劳', icon: '🍟', url: 'https://mcp.mcd.cn', tokenUrl: 'https://open.mcd.cn/mcp',
    desc: '附近门店、菜单、优惠券、算价钱、下单（能送外卖，要先有收货地址）。在官方网页登录 → 控制台 → 激活，就能拿到令牌。只限中国大陆。' }
];
var MCP_TAKEOUT_RULE = '【外卖规则】你是帮对方挑：按你了解的对方口味（记忆里的喜好、忌口、最近说过想吃的）来选；真正下单之前，先在聊天里把门店、商品、口味、份数、价格说清楚，等对方点头再下单；你付不了钱，下好单后把付款方式告诉对方，让对方自己付款；不要编造门店、价格和优惠。';
var MCP_TAKEOUT_ASK = /create|cancel|order-create|draw/i;
function mcpTakeoutServer(p) { return mcpServers.filter(function(sv) { return sv.takeout === p.id; })[0]; }

// 下好单时：工具结果里有付款链接 / 付款码，就弹一个小窗让你自己去付
function mcpTakeoutPayLink(server, text) {
  var urls = String(text || '').match(/https?:\/\/[^\s"'<>\\]+/g) || [];
  var pay = urls.filter(function(u) { return /pay|qr|cashier|wxp|alipay/i.test(u); })[0];
  if (!pay) return;
  openConfirm('TA 帮你在「' + server.name + '」下好单了', function() { window.open(pay, '_blank'); }, {
    desc: '剩下的要你自己付款：点「打开付款页」去付。如果打开是一张二维码，可以截图后用微信「扫一扫」里的相册识别。',
    okText: '打开付款页', alt: '复制链接',
    onAlt: function() {
      (navigator.clipboard ? navigator.clipboard.writeText(pay) : Promise.reject()).then(function() { showToast('✓ 付款链接已复制', 'success'); }, function() { showToast(pay, 'plain'); });
    }
  });
}

var mcpTakeoutOnInput = document.getElementById('mcpTakeoutOn');
mcpTakeoutOnInput.checked = !!mcpCfg.takeout;
mcpTakeoutOnInput.addEventListener('change', function() {
  mcpCfg.takeout = this.checked;
  // 一键：打开外卖时顺手把「聊天时允许角色使用工具」也打开
  if (this.checked && !mcpCfg.on) { mcpCfg.on = true; mcpOnInput.checked = true; }
  saveMcpServers();
  renderMcpTakeout();
});

function renderMcpTakeout() {
  var box = document.getElementById('mcpTakeoutList');
  if (!box || !MCP_TAKEOUT) return;   // 上面第一次画服务器列表时这里还没定义，最后会再画一次
  box.innerHTML = '';
  box.classList.toggle('mcp-takeout-off', !mcpCfg.takeout);
  MCP_TAKEOUT.forEach(function(p) {
    var sv = mcpTakeoutServer(p);
    var card = document.createElement('div');
    card.className = 'settings-card mcp-server-card';
    card.innerHTML = '<div class="auto-row"><span class="auto-row-label"></span><label class="st-toggle-wrap"><input type="checkbox"><span class="st-toggle-slider"></span></label></div>' +
      '<div class="auto-hint mcp-takeout-desc"></div><div class="mcp-server-status"></div>' +
      '<input class="field-input" type="password" autocomplete="off" placeholder="粘贴官方网页里拿到的令牌">' +
      '<div class="api-test-row"><button class="action-btn btn-apply mcp-to-get">去拿令牌</button><button class="action-btn btn-apply mcp-to-conn">保存并连接</button></div>';
    card.querySelector('.auto-row-label').textContent = p.icon + ' ' + p.name;
    card.querySelector('.mcp-takeout-desc').textContent = p.desc;
    var cb = card.querySelector('input[type=checkbox]');
    cb.checked = !!(sv && sv.enabled);
    cb.addEventListener('change', function() {
      if (!sv) { this.checked = false; showToast('先填令牌、连接上再打开', 'plain'); return; }
      sv.enabled = this.checked; saveMcpServers();
    });
    var st = sv && mcpStatus[sv.id] || { state: '', text: !sv ? '还没有填令牌' : sv.tools ? '上次连接时有 ' + sv.tools.length + ' 个工具' : '还没有连接' };
    var stEl = card.querySelector('.mcp-server-status');
    stEl.className = 'mcp-server-status ' + st.state;
    stEl.textContent = st.text;
    var tok = card.querySelector('input[type=password]');
    tok.value = sv ? sv.token : '';
    card.querySelector('.mcp-to-get').addEventListener('click', function() { window.open(p.tokenUrl, '_blank'); });
    card.querySelector('.mcp-to-conn').addEventListener('click', function() {
      var t = tok.value.trim().replace(/^Bearer\s+/i, '');
      if (!t) { shakeEl(tok); showToast('先把令牌粘贴进来', 'error'); return; }
      if (!sv) { sv = { id: 'to_' + p.id, takeout: p.id, name: p.name, url: p.url, token: t, enabled: true, tools: null }; mcpServers.push(sv); }
      sv.token = t; sv.url = p.url; sv.enabled = true;
      if (!mcpCfg.takeout) { mcpCfg.takeout = true; mcpTakeoutOnInput.checked = true; }
      if (!mcpCfg.on) { mcpCfg.on = true; mcpOnInput.checked = true; }
      saveMcpServers();
      mcpRefreshServer(sv).then(function(tools) {
        showToast('✓ 已连上「' + p.name + '」：' + tools.length + ' 个工具', 'success');
      }, function(err) {
        showToast('✗ 没连上「' + p.name + '」：' + (/401|403|unauth/i.test(err.message || '') ? '令牌不对或过期了，重新拿一个' : (mcpStatus[sv.id] || {}).text || err.message), 'error');
      });
    });
    box.appendChild(card);
  });
}
renderMcpTakeout();
