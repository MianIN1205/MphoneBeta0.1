// 眠花糖机 — 模型接口适配（各家大模型）

// =============================================
// 模型接口适配：所有发给大模型的请求都走 llmRequest()
// · Claude 官方地址（api.anthropic.com）→ Claude Messages API（x-api-key、system 单独放、最后一条必须是用户、不发 temperature）
// · 其他（GPT、Gemini、Grok、DeepSeek、通义、Kimi、各种中转）→ OpenAI 兼容格式，再按模型处理差异
// · 模型不支持的图片 / 音频换成文字；接口因为图片或音频报错时，去掉后自动重发一次并记住
// =============================================
var ANTHROPIC_VERSION = '2026-10-21';

function llmProvider(cfg) {
  return /(^|\/\/|\.)anthropic\.com/i.test(cfg.url || '') ? 'anthropic' : 'openai';
}
function llmModelName(cfg) { return String(cfg.model || '').toLowerCase(); }

// 能力判断：先按名字排除明确不支持的，其余先试，被拒后记住
var llmMediaBlock = mphoneStore.load('mphone_media_block', {});   // { 模型名: { image: true, audio: true } }
function llmCaps(cfg) {
  var m = llmModelName(cfg), anthropic = llmProvider(cfg) === 'anthropic';
  var noImage = /deepseek(?!.*vl)|o1-mini|o3-mini|qwq|(^|[-\/])r1\b|kimi-k2|-text-/.test(m);
  var noAudio = anthropic || /claude|deepseek|grok|(^|[-\/])o[1-4]\b|kimi|glm|llama|qwen(?!.*omni)|gpt-(4|5)(?!.*audio)|mistral(?!.*voxtral)/.test(m);
  var b = llmMediaBlock[cfg.model] || {};
  return { image: !noImage && !b.image, audio: !noAudio && !b.audio };
}
// 需要「系统提示合并成一条、用户和角色交替、最后一条是用户」的接口
function llmStrict(cfg) {
  return llmProvider(cfg) === 'anthropic' || /claude|deepseek-reasoner|deepseek-r1/.test(llmModelName(cfg));
}
// OpenAI 推理模型（o1/o3/o4、GPT-5）不接受自定义 temperature
function llmSendTemperature(cfg) {
  return llmProvider(cfg) !== 'anthropic' && !/(^|[-\/])(o[1-9]|gpt-5)/.test(llmModelName(cfg));
}

function partsText(content) {
  return Array.isArray(content)
    ? content.filter(function(p) { return p.type === 'text'; }).map(function(p) { return p.text; }).join('\n')
    : String(content || '');
}

// 整理消息：去空消息、换掉不支持的媒体、按接口要求合并
function llmPrepare(msgs, cfg, caps) {
  var out = [];
  JSON.parse(JSON.stringify(msgs)).forEach(function(m) {
    var c = m.content;
    if (Array.isArray(c)) {
      c = c.map(function(p) {
        if (p.type === 'image_url' && !caps.image) return { type: 'text', text: '[图片：当前模型看不到图片内容]' };
        if (p.type === 'input_audio' && !caps.audio) return null;   // 前面的文字部分已经写了「[语音消息]」或转写
        return p;
      }).filter(Boolean);
      if (c.every(function(p) { return p.type === 'text'; })) c = partsText(c);
    }
    if (Array.isArray(c) ? !c.length : !String(c || '').trim()) return;
    out.push({ role: m.role, content: c });
  });
  if (!llmStrict(cfg)) return { system: '', messages: out };

  // 严格模式：所有系统提示合成一条；连续同角色合并；第一条和最后一条都是用户
  var sys = [], rest = [];
  out.forEach(function(m) { if (m.role === 'system') sys.push(partsText(m.content)); else rest.push(m); });
  var merged = [];
  rest.forEach(function(m) {
    var last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      var a = Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }];
      var b = Array.isArray(m.content) ? m.content : [{ type: 'text', text: m.content }];
      last.content = a.concat(b);
      if (last.content.every(function(p) { return p.type === 'text'; })) last.content = partsText(last.content);
    } else merged.push(m);
  });
  if (!merged.length || merged[0].role !== 'user') merged.unshift({ role: 'user', content: '（开始）' });
  if (merged[merged.length - 1].role !== 'user') merged.push({ role: 'user', content: '（请继续）' });
  var system = sys.join('\n\n');
  if (llmProvider(cfg) === 'anthropic') return { system: system, messages: merged };
  return { system: '', messages: (system ? [{ role: 'system', content: system }] : []).concat(merged) };
}

// Claude 的内容格式：图片用 base64 块
function toAnthropicContent(content) {
  if (!Array.isArray(content)) return content;
  return content.map(function(p) {
    if (p.type === 'image_url') {
      var url = (p.image_url && p.image_url.url) || '';
      var m = url.match(/^data:([^;,]+);base64,(.*)$/);
      return m ? { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }
               : { type: 'image', source: { type: 'url', url: url } };
    }
    if (p.type === 'input_audio') return { type: 'text', text: '[语音：当前模型听不到音频]' };
    return { type: 'text', text: p.text || '' };
  });
}

function llmBuild(prepared, cfg, opts) {
  var base = cfg.url.replace(/\/+$/, '');
  if (llmProvider(cfg) === 'anthropic') {
    if (!/\/v1$/.test(base)) base += '/v1';
    var headers = {
      'Content-Type': 'application/json',
      'x-api-key': cfg.key,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    var body = {
      model: cfg.model,
      max_tokens: opts.maxTokens || 16000,
      messages: prepared.messages.map(function(m) { return { role: m.role, content: toAnthropicContent(m.content) }; }),
      stream: !!opts.stream
    };
    if (prepared.system) body.system = prepared.system;
    // 较新的 Claude 模型：安全策略拒绝时由服务器自动换模型接着回答
    if (/^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/.test(cfg.model)) {
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      body.fallbacks = 'default';
    }
    return { url: base + '/messages', init: { method: 'POST', headers: headers, body: JSON.stringify(body), signal: opts.signal } };
  }
  var obody = { model: cfg.model, messages: prepared.messages, stream: !!opts.stream };
  var temp = opts.temperature !== undefined ? opts.temperature : cfg.temp;
  if (llmSendTemperature(cfg) && typeof temp === 'number' && !isNaN(temp)) obody.temperature = temp;
  return { url: base + '/chat/completions', init: {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
    body: JSON.stringify(obody), signal: opts.signal
  } };
}

// 从完整（非流式）回复里取文字
function llmTextFromJson(j, provider) {
  if (provider === 'anthropic') {
    var t = (j.content || []).filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('');
    if (!t && j.stop_reason === 'refusal') throw new Error('模型按安全策略拒绝回答了这个请求');
    return t;
  }
  var c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  return Array.isArray(c) ? partsText(c) : String(c || '');
}

// 读回复：流式逐段回调 onText(目前为止的全文)；接口没按流式返回时也能读
function llmRead(res, provider, onText) {
  var ct = res.headers.get('content-type') || '';
  if (!res.body || (ct.indexOf('event-stream') < 0 && ct.indexOf('json') >= 0)) {
    return res.json().then(function(j) {
      if (j && j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      var t = llmTextFromJson(j, provider);
      if (onText && t) onText(t);
      return t;
    });
  }
  var reader = res.body.getReader(), decoder = new TextDecoder('utf-8'), buf = '', text = '', refused = false;
  function handle(line) {
    line = line.trim();
    if (line.indexOf('data:') !== 0) return;
    var data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    var j;
    try { j = JSON.parse(data); } catch (_) { return; }
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    var piece = '';
    if (provider === 'anthropic') {
      if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') piece = j.delta.text || '';
      if (j.type === 'message_delta' && j.delta && j.delta.stop_reason === 'refusal') refused = true;
    } else {
      var d = j.choices && j.choices[0] && j.choices[0].delta;
      piece = (d && typeof d.content === 'string') ? d.content : '';
    }
    if (piece) { text += piece; if (onText) onText(text); }
  }
  function pump() {
    return reader.read().then(function(r) {
      if (r.done) {
        if (buf) handle(buf);
        if (!text && refused) throw new Error('模型按安全策略拒绝回答了这个请求');
        return text;
      }
      buf += decoder.decode(r.value, { stream: true });
      var lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach(handle);
      return pump();
    });
  }
  return pump();
}

function msgsHavePart(msgs, type) {
  return msgs.some(function(m) { return Array.isArray(m.content) && m.content.some(function(p) { return p.type === type; }); });
}

// =============================================
// 工具调用（MCP）：opts.tools = [{ name, description, parameters }]，opts.callTool(name, args) → Promise<文字结果>
// 带工具时不边写边显示：先让模型决定要不要用工具，用完把结果交回去，最多 5 轮，最后的回答一次性给出
// 模型或接口不支持工具时，自动改成普通回复并记住
// =============================================
var llmToolBlock = mphoneStore.load('mphone_tool_block', {});   // { 模型名: true }
var LLM_TOOL_ROUNDS = 5;

function llmToolChat(msgs, opts) {
  var cfg = opts.cfg || getApiCfg(), provider = llmProvider(cfg);
  var prepared = llmPrepare(msgs, cfg, llmCaps(cfg));
  var status = opts.onStatus || function() {};
  return resolveMediaParts(prepared.messages).then(function() {
    var base = llmBuild(prepared, cfg, { stream: false, signal: opts.signal, temperature: opts.temperature, maxTokens: opts.maxTokens });
    var body = JSON.parse(base.init.body);
    if (provider === 'anthropic') {
      body.tools = opts.tools.map(function(t) { return { name: t.name, description: t.description || '', input_schema: t.parameters || { type: 'object', properties: {} } }; });
    } else {
      body.tools = opts.tools.map(function(t) { return { type: 'function', function: { name: t.name, description: t.description || '', parameters: t.parameters || { type: 'object', properties: {} } } }; });
    }
    var round = 0;
    function send() {
      if (opts.signal && opts.signal.aborted) return Promise.reject(new DOMException('aborted', 'AbortError'));
      return fetch(base.url, Object.assign({}, base.init, { body: JSON.stringify(body) })).then(function(res) {
        if (!res.ok) return apiError(res);
        return res.json();
      }).then(function(j) {
        if (j && j.error) throw new Error(j.error.message || JSON.stringify(j.error));
        var calls = [];
        if (provider === 'anthropic') {
          (j.content || []).forEach(function(b) { if (b.type === 'tool_use') calls.push({ id: b.id, name: b.name, args: b.input || {} }); });
          if (!calls.length || round >= LLM_TOOL_ROUNDS) return llmTextFromJson(j, provider);
          body.messages.push({ role: 'assistant', content: j.content });   // 原样交回（含思考块）
        } else {
          var m = (j.choices && j.choices[0] && j.choices[0].message) || {};
          (m.tool_calls || []).forEach(function(c) {
            var args = {};
            try { args = JSON.parse((c.function && c.function.arguments) || '{}'); } catch (_) {}
            calls.push({ id: c.id, name: c.function && c.function.name, args: args });
          });
          if (!calls.length || round >= LLM_TOOL_ROUNDS) return llmTextFromJson(j, provider);
          body.messages.push({ role: 'assistant', content: m.content || '', tool_calls: m.tool_calls });
        }
        round++;
        // 依次执行工具，把结果交回模型
        var results = [];
        return calls.reduce(function(p, c) {
          return p.then(function() {
            status('🔧 正在使用工具：' + (opts.toolLabel ? opts.toolLabel(c.name) : c.name));
            return Promise.resolve(opts.callTool(c.name, c.args)).catch(function(e) { return '工具调用失败：' + e.message; })
              .then(function(r) { results.push({ call: c, text: String(r == null ? '' : r) }); });
          });
        }, Promise.resolve()).then(function() {
          if (provider === 'anthropic') {
            body.messages.push({ role: 'user', content: results.map(function(r) { return { type: 'tool_result', tool_use_id: r.call.id, content: r.text || '（无内容）' }; }) });
          } else {
            results.forEach(function(r) { body.messages.push({ role: 'tool', tool_call_id: r.call.id, content: r.text || '（无内容）' }); });
          }
          status('💭 正在整理回答…');
          return send();
        });
      });
    }
    return send();
  }).then(function(text) {
    if (opts.onText && text) opts.onText(text);
    return text;
  });
}

// opts: { cfg（不传 = 全局 API 设置）, stream, signal, onText(全文), temperature, keepMedia（测试用：不替换媒体）, maxTokens, tools, callTool, onStatus }
function llmRequest(msgs, opts) {
  opts = opts || {};
  var cfg = opts.cfg || getApiCfg();
  if (!cfg.url || !cfg.key || !cfg.model) return Promise.reject(new Error('请先在设置中填写 API 地址、密钥并选择模型'));
  // 带工具（MCP）：走工具循环；模型不支持工具时改成普通回复并记住
  if (opts.tools && opts.tools.length && opts.callTool && !llmToolBlock[cfg.model]) {
    var plain = Object.assign({}, opts, { tools: null });
    return llmToolChat(msgs, opts).catch(function(err) {
      if (err && err.name === 'AbortError') throw err;
      var em = String(err && err.message);
      // 图片 / 音频的问题交给普通请求去处理（会自动改用文字）
      if (!/tool|function/i.test(em)) {
        if (/image|audio|vision|multimodal|input_audio|image_url|图片|音频/i.test(em)) return llmRequest(msgs, plain);
        throw err;
      }
      llmToolBlock[cfg.model] = true;
      mphoneStore.save('mphone_tool_block', llmToolBlock);
      showToast('这个模型不支持工具调用，已改成普通回复', 'error');
      return llmRequest(msgs, plain);
    });
  }
  var provider = llmProvider(cfg);
  function attempt(caps) {
    var prepared = llmPrepare(msgs, cfg, caps);
    return resolveMediaParts(prepared.messages).then(function() {
      var req = llmBuild(prepared, cfg, opts);
      return fetch(req.url, req.init);
    }).then(function(res) {
      if (!res.ok) return apiError(res);
      return llmRead(res, provider, opts.onText);
    });
  }
  var caps = opts.keepMedia ? { image: true, audio: true } : llmCaps(cfg);
  return attempt(caps).catch(function(err) {
    if (opts.keepMedia || (err && err.name === 'AbortError')) throw err;
    var hasImg = caps.image && msgsHavePart(msgs, 'image_url');
    var hasAud = caps.audio && msgsHavePart(msgs, 'input_audio');
    var msg = String((err && err.message) || '');
    if (!(hasImg || hasAud) || !/image|audio|vision|multimodal|modalit|media|input_audio|image_url|content|unsupported|not support|invalid|图片|音频/i.test(msg)) throw err;
    // 不支持图片 / 音频：去掉后重发一次，并记住这个模型
    var aud = hasAud && (/audio|音频/i.test(msg) || !/image|vision|图片/i.test(msg));
    var img = hasImg && (/image|vision|图片/i.test(msg) || !/audio|音频/i.test(msg));
    var b = llmMediaBlock[cfg.model] = Object.assign({}, llmMediaBlock[cfg.model]);
    if (aud) b.audio = true;
    if (img) b.image = true;
    mphoneStore.save('mphone_media_block', llmMediaBlock);
    showToast('这个模型不支持' + (img && aud ? '图片和音频' : img ? '图片' : '音频') + '，已改用文字发送', 'error');
    return attempt({ image: caps.image && !img, audio: caps.audio && !aud });
  });
}

// 模型列表：Claude 官方用自己的请求头，其余是 OpenAI 兼容的 /models
function llmListModels(url, key) {
  var cfg = { url: url, key: key };
  var base = url.replace(/\/+$/, '');
  var init;
  if (llmProvider(cfg) === 'anthropic') {
    if (!/\/v1$/.test(base)) base += '/v1';
    init = { headers: { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' } };
    base += '/models?limit=100';
  } else {
    init = { headers: { 'Authorization': 'Bearer ' + key } };
    base += '/models';
  }
  return fetch(base, init).then(function(r) {
    if (!r.ok) return apiError(r);
    return r.json();
  }).then(function(d) {
    // 大多数接口返回 { data: [{ id }] }；也兼容 { models: [{ name }] } 和纯数组
    var list = (d && (d.data || d.models)) || (Array.isArray(d) ? d : []);
    return list.map(function(m) { return typeof m === 'string' ? m : (m.id || m.name || ''); })
      .map(function(id) { return String(id).replace(/^models\//, ''); }).filter(Boolean).sort();
  });
}
