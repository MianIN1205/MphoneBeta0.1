// 眠花糖机 — MCP 工具（连接 MCP 服务器，聊天时让角色使用工具）

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
var mcpCfg = Object.assign({ on: false, confirm: true }, mphoneStore.load('mphone_mcp_cfg', {}));
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
    var prefix = mcpSlug(sv.name).slice(0, 16) || ('s' + si);
    sv.tools.forEach(function(t) {
      var name = (prefix + '__' + mcpSlug(t.name)).slice(0, 64);
      if (mcpToolMap[name]) name = (name.slice(0, 60) + '_' + si).slice(0, 64);
      mcpToolMap[name] = { server: sv, tool: t };
      list.push({ name: name, description: (t.title ? t.title + '：' : '') + (t.description || '') + '（来自 ' + sv.name + '）', parameters: t.inputSchema });
    });
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
  var detail = '工具：' + (hit.tool.title || hit.tool.name) + '（' + hit.server.name + '）\n参数：' + JSON.stringify(args || {}, null, 1).slice(0, 600);
  var asked = mcpCfg.confirm ? mcpAsk('角色想使用工具', detail) : Promise.resolve(true);
  return asked.then(function(ok) {
    if (!ok) return '用户没有同意这次工具调用，请不用工具直接回答。';
    return mcpCallTool(hit.server, hit.tool.name, args);
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
  var box = document.getElementById('mcpServerList');
  box.innerHTML = '';
  if (!mcpServers.length) {
    var empty = document.createElement('div');
    empty.className = 'auto-hint';
    empty.style.margin = '0 4px 12px';
    empty.textContent = '还没有添加服务器';
    box.appendChild(empty);
    return;
  }
  mcpServers.forEach(function(sv) {
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
      openPfEntryDel('删除服务器「' + sv.name + '」？', function() {
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
