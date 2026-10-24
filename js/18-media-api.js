// 眠花糖机 — 设置 — 语音 API（TTS）与生图 API

// =============================================
// 设置 — 语音 API（TTS）与生图 API
// ttsSynthesize(text, voiceId) / imageGenerate(prompt) 供以后的语音气泡、拍摄等功能调用
// =============================================
var TTS_DEFAULTS = {
  openai:     { url: 'https://api.openai.com/v1',  model: 'tts-1',                  voice: 'alloy' },
  minimax:    { url: 'https://api.minimaxi.com',   model: 'speech-02-hd',           voice: 'female-shaonv' },
  elevenlabs: { url: 'https://api.elevenlabs.io',  model: 'eleven_multilingual_v2', voice: '' }
};
var ttsCfg = Object.assign({ provider: 'openai', url: '', key: '', groupId: '', model: '', voice: '', speed: 1 },
                           mphoneStore.load('mphone_tts_cfg', {}));

function setRadio(rowId, attr, value) {
  document.querySelectorAll('#' + rowId + ' .pf-radio-btn').forEach(function(b) {
    b.classList.toggle('selected', b.dataset[attr] === value);
  });
}

// ---------- 语音 ----------
function fillTtsForm() {
  var d = TTS_DEFAULTS[ttsCfg.provider] || TTS_DEFAULTS.openai;
  setRadio('ttsProviderRow', 'provider', ttsCfg.provider);
  document.querySelector('[data-spanel="voice-api"]').classList.toggle('tts-is-minimax', ttsCfg.provider === 'minimax');
  var $ = function(id) { return document.getElementById(id); };
  $('ttsUrl').value = ttsCfg.url;        $('ttsUrl').placeholder = d.url;
  $('ttsKey').value = ttsCfg.key;
  $('ttsGroupId').value = ttsCfg.groupId;
  $('ttsModel').value = ttsCfg.model;    $('ttsModel').placeholder = d.model;
  $('ttsVoice').value = ttsCfg.voice;    $('ttsVoice').placeholder = d.voice || '在 ElevenLabs 后台复制 Voice ID';
  $('ttsSpeed').value = ttsCfg.speed;
}

function readTtsForm() {
  var $ = function(id) { return document.getElementById(id); };
  var btn = document.querySelector('#ttsProviderRow .pf-radio-btn.selected');
  var speed = parseFloat($('ttsSpeed').value);
  return {
    provider: btn ? btn.dataset.provider : 'openai',
    url: $('ttsUrl').value.trim(), key: $('ttsKey').value.trim(), groupId: $('ttsGroupId').value.trim(),
    model: $('ttsModel').value.trim(), voice: $('ttsVoice').value.trim(),
    speed: isNaN(speed) ? 1 : Math.max(0.5, Math.min(2, speed))
  };
}

document.querySelectorAll('#ttsProviderRow .pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    // 切换服务商：沿用已填的 Key 等，地址 / 模型 / 音色清空改用该服务的默认值
    var cur = readTtsForm();
    ttsCfg = Object.assign(cur, { provider: this.dataset.provider, url: '', model: '', voice: '' });
    fillTtsForm();
  });
});

function hexToBytes(hex) {
  var out = new Uint8Array(hex.length / 2);
  for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function apiError(res) {
  return res.text().then(function(t) {
    var msg = '请求失败 ' + res.status;
    try {
      var e = JSON.parse(t);
      msg = (e.error && (e.error.message || e.error)) || (e.detail && (e.detail.message || e.detail)) || e.message || msg;
    } catch (_) {}
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  });
}

// 合成语音，返回音频 Blob；voiceId 为空时用默认音色
function ttsSynthesize(text, voiceId, cfg) {
  cfg = cfg || ttsCfg;
  var d = TTS_DEFAULTS[cfg.provider] || TTS_DEFAULTS.openai;
  var base = (cfg.url || d.url).replace(/\/$/, '');
  var model = cfg.model || d.model;
  var voice = voiceId || cfg.voice || d.voice;
  if (!cfg.key) return Promise.reject(new Error('请先填写语音 API 密钥'));
  if (!voice) return Promise.reject(new Error('请先填写音色 ID'));

  if (cfg.provider === 'minimax') {
    return fetch(base + '/v1/t2a_v2' + (cfg.groupId ? '?GroupId=' + encodeURIComponent(cfg.groupId) : ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({
        model: model, text: text, stream: false,
        voice_setting: { voice_id: voice, speed: cfg.speed, vol: 1, pitch: 0 },
        audio_setting: { format: 'mp3', sample_rate: 32000 }
      })
    }).then(function(res) {
      if (!res.ok) return apiError(res);
      return res.json().then(function(j) {
        if (j.base_resp && j.base_resp.status_code) throw new Error(j.base_resp.status_msg || ('错误 ' + j.base_resp.status_code));
        if (!j.data || !j.data.audio) throw new Error('未返回音频');
        return new Blob([hexToBytes(j.data.audio)], { type: 'audio/mpeg' });
      });
    });
  }

  if (cfg.provider === 'elevenlabs') {
    return fetch(base + '/v1/text-to-speech/' + encodeURIComponent(voice), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': cfg.key, 'Accept': 'audio/mpeg' },
      body: JSON.stringify({ text: text, model_id: model, voice_settings: { speed: cfg.speed } })
    }).then(function(res) { return res.ok ? res.blob() : apiError(res); });
  }

  // OpenAI 兼容：/audio/speech
  return fetch(base + '/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
    body: JSON.stringify({ model: model, input: text, voice: voice, speed: cfg.speed })
  }).then(function(res) { return res.ok ? res.blob() : apiError(res); });
}

document.getElementById('ttsTestBtn').addEventListener('click', function() {
  var btn = this;
  var text = document.getElementById('ttsTestText').value.trim();
  if (!text) { shakeEl(document.getElementById('ttsTestText')); return; }
  btn.disabled = true;
  btn.textContent = '合成中…';
  ttsSynthesize(text, '', readTtsForm()).then(function(blob) {
    var audio = document.getElementById('ttsTestAudio');
    if (audio.src) URL.revokeObjectURL(audio.src);
    audio.src = URL.createObjectURL(blob);
    audio.style.display = 'block';
    audio.play().catch(function() {});
  }).catch(function(err) {
    showToast('✗ ' + err.message, 'error');
  }).then(function() {
    btn.disabled = false;
    btn.textContent = '试听';
  });
});

document.getElementById('ttsSaveBtn').addEventListener('click', function() {
  ttsCfg = readTtsForm();
  mphoneStore.save('mphone_tts_cfg', ttsCfg);
  showToast('✓ 语音设置已保存', 'success');
});

// ---------- 生图 ----------
// imgCfg = { provider, gpt: {...}, novelai: {...}, openai: {...} }，每个服务商的参数分开保存
var IMG_DEFAULTS = {
  gpt:     { url: 'https://api.openai.com/v1', key: '', model: 'gpt-image-1', size: '1024x1024', quality: 'auto', style: '', negative: '' },
  novelai: { url: 'https://image.novelai.net', key: '', model: 'nai-diffusion-4-5-full', size: '832x1216',
             steps: 28, scale: 5, sampler: 'k_euler_ancestral', quality: true,
             style: '', negative: 'lowres, worst quality, bad quality, bad anatomy, jpeg artifacts, watermark' },
  openai:  { url: '', key: '', model: '', size: '1024x1024', style: '', negative: '' }
};
var imgCfg = (function() {
  var saved = mphoneStore.load('mphone_img_cfg', {}) || {};
  var cfg = { provider: 'gpt' };
  // 旧版只有一套「OpenAI 兼容」参数，迁移到 openai 下
  if (saved.key !== undefined && !saved.gpt) {
    cfg.provider = 'openai';
    cfg.openai = Object.assign({}, IMG_DEFAULTS.openai, saved);
    delete cfg.openai.provider;
  } else if (saved.provider) {
    cfg = saved;
  }
  Object.keys(IMG_DEFAULTS).forEach(function(p) { cfg[p] = Object.assign({}, IMG_DEFAULTS[p], cfg[p] || {}); });
  return cfg;
})();

function curImgProvider() {
  var btn = document.querySelector('#imgProviderRow .pf-radio-btn.selected');
  return btn ? btn.dataset.provider : 'gpt';
}

function fillImgForm() {
  var p = imgCfg.provider, c = imgCfg[p];
  var $ = function(id) { return document.getElementById(id); };
  setRadio('imgProviderRow', 'provider', p);
  var panel = document.querySelector('[data-spanel="image-api"]');
  panel.classList.remove('img-is-gpt', 'img-is-novelai', 'img-is-openai');
  panel.classList.add('img-is-' + p);
  $('imgUrl').value = c.url;
  $('imgUrl').placeholder = IMG_DEFAULTS[p].url || 'https://你的中转地址/v1';
  $('imgKey').value = c.key;
  $('imgKey').placeholder = p === 'novelai' ? '持久 API Token（pst-...）' : 'sk-...';
  $('imgKeyLabel').textContent = p === 'novelai' ? 'API Token' : 'API 密钥';
  if (p === 'novelai') {
    $('naiModel').value = c.model;
    $('naiSize').value = c.size;
    $('naiSteps').value = c.steps;
    $('naiScale').value = c.scale;
    $('naiSampler').value = c.sampler;
    $('naiQuality').checked = c.quality !== false;
  } else {
    $('imgModel').value = c.model;
    $('imgModel').placeholder = p === 'gpt' ? 'gpt-image-1' : '中转站提供的模型名';
    $('imgSize').value = c.size;
    if (p === 'gpt') $('imgQuality').value = c.quality || 'auto';
  }
  $('imgStyleLabel').textContent = p === 'novelai' ? '画师串 / 正向前缀（英文标签，逗号分隔）' : '画风提示词（自动加在每次生成前）';
  $('imgStyle').placeholder = p === 'novelai' ? '例：artist:xxx, 1girl, soft lighting' : '例：日系插画，柔和光线，高细节';
  $('imgStyle').value = c.style;
  $('imgNegative').value = c.negative;
  $('imgNegative').placeholder = p === 'novelai' ? '例：lowres, bad hands' : '例：低画质，多余手指（部分接口支持）';
}

// 读当前表单到对应服务商下（不影响其他服务商）
function readImgForm() {
  var p = curImgProvider();
  var $ = function(id) { return document.getElementById(id); };
  var c = Object.assign({}, imgCfg[p], {
    url: $('imgUrl').value.trim(), key: $('imgKey').value.trim(),
    style: $('imgStyle').value.trim(), negative: $('imgNegative').value.trim()
  });
  if (p === 'novelai') {
    var steps = parseInt($('naiSteps').value, 10), scale = parseFloat($('naiScale').value);
    Object.assign(c, {
      model: $('naiModel').value, size: $('naiSize').value,
      steps: isNaN(steps) ? 28 : Math.max(1, Math.min(50, steps)),
      scale: isNaN(scale) ? 5 : Math.max(0, Math.min(10, scale)),
      sampler: $('naiSampler').value, quality: $('naiQuality').checked
    });
  } else {
    Object.assign(c, { model: $('imgModel').value.trim(), size: $('imgSize').value });
    if (p === 'gpt') c.quality = $('imgQuality').value;
  }
  var out = Object.assign({}, imgCfg, { provider: p });
  out[p] = c;
  return out;
}

document.querySelectorAll('#imgProviderRow .pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    imgCfg = readImgForm();          // 先暂存当前服务商填写的内容
    imgCfg.provider = this.dataset.provider;
    fillImgForm();
  });
});

// GPT / OpenAI 兼容：/images/generations
function generateOpenAiImage(prompt, c, isGpt) {
  var base = (c.url || IMG_DEFAULTS.gpt.url).replace(/\/$/, '');
  var model = c.model || (isGpt ? 'gpt-image-1' : '');
  var body = { prompt: (c.style ? c.style + '，' : '') + prompt, n: 1, size: c.size || '1024x1024' };
  if (model) body.model = model;
  // gpt-image 系列固定返回 base64；dall-e 需要显式要求
  if (/^dall-e/.test(model)) body.response_format = 'b64_json';
  if (isGpt && /^gpt-image/.test(model) && c.quality && c.quality !== 'auto') body.quality = c.quality;
  if (c.negative) {
    if (isGpt) body.prompt += '\n避免出现：' + c.negative;
    else body.negative_prompt = c.negative;
  }
  return fetch(base + '/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.key },
    body: JSON.stringify(body)
  }).then(function(res) {
    if (!res.ok) return apiError(res);
    return res.json().then(function(j) {
      var item = (j.data && j.data[0]) || (j.images && j.images[0]) || {};
      if (item.b64_json) return 'data:image/png;base64,' + item.b64_json;
      if (item.url) return item.url;
      throw new Error('未返回图片');
    });
  });
}

// NovelAI 质量词（与官网预设一致）
var NAI_QUALITY = {
  v4: 'very aesthetic, masterpiece, no text',
  v3: 'best quality, amazing quality, very aesthetic, absurdres'
};

function generateNovelAiImage(prompt, c) {
  var base = (c.url || IMG_DEFAULTS.novelai.url).replace(/\/$/, '');
  var model = c.model || IMG_DEFAULTS.novelai.model;
  var modern = /nai-diffusion-4/.test(model);
  var wh = (c.size || '832x1216').split('x');
  var width = parseInt(wh[0], 10) || 832, height = parseInt(wh[1], 10) || 1216;
  var positive = [c.style, prompt, c.quality !== false ? NAI_QUALITY[modern ? 'v4' : 'v3'] : '']
    .filter(Boolean).join(', ');
  var negative = c.negative || '';
  var seed = Math.floor(Math.random() * 0xFFFFFFFF);
  var params = {
    width: width, height: height, scale: c.scale, sampler: c.sampler, steps: c.steps,
    seed: seed, n_samples: 1, sm: false, sm_dyn: false,
    dynamic_thresholding: false, controlnet_strength: 1, legacy: false,
    cfg_rescale: 0, negative_prompt: negative
  };
  if (modern) {
    Object.assign(params, {
      params_version: 4, add_original_image: true, noise_schedule: 'karras',
      legacy_v3_extend: false, skip_cfg_above_sigma: null, use_coords: false, legacy_uc: false,
      normalize_reference_strength_multiple: true, characterPrompts: [],
      v4_prompt: { caption: { base_caption: positive, char_captions: [] }, use_coords: false, use_order: true },
      v4_negative_prompt: { caption: { base_caption: negative, char_captions: [] }, legacy_uc: false },
      deliberate_euler_ancestral_bug: false, prefer_brownian: true, autoSmea: false,
      tag_hint_qt: 0, tag_hint_uc_preset: 0   // 质量词 / 负面词已直接写进提示词
    });
  } else {
    Object.assign(params, { add_original_image: false, noise_schedule: 'native', ucPreset: 3, qualityToggle: false });
  }
  return fetch(base + '/ai/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.key },
    body: JSON.stringify({ input: positive, model: model, action: 'generate', parameters: params })
  }).then(function(res) {
    if (!res.ok) return apiError(res);
    var type = res.headers.get('content-type') || '';
    if (type.indexOf('application/json') >= 0) {
      // 部分代理返回 JSON
      return res.json().then(function(j) {
        var item = (j.images && j.images[0]) || (j.data && j.data[0]) || {};
        var b64 = typeof item === 'string' ? item : (item.b64_json || item.image);
        if (b64) return /^data:/.test(b64) ? b64 : 'data:image/png;base64,' + b64;
        if (item.url) return item.url;
        throw new Error('未返回图片');
      });
    }
    // 官方接口返回 zip，里面是 PNG；少数代理直接返回图片
    return res.arrayBuffer().then(function(buf) {
      var u8 = new Uint8Array(buf);
      if (u8[0] === 0x89 && u8[1] === 0x50) return bytesToDataUrl(u8, 'image/png');
      return zipReadEntry(buf, function(name) { return /\.(png|webp|jpe?g)$/i.test(name); }).then(function(bytes) {
        return bytesToDataUrl(bytes, 'image/png');
      });
    });
  });
}

function bytesToDataUrl(bytes, type) {
  return new Promise(function(resolve) {
    var r = new FileReader();
    r.onload = function() { resolve(r.result); };
    r.readAsDataURL(new Blob([bytes], { type: type }));
  });
}

// 读取 zip 里第一个符合条件的文件（docx 导入、NovelAI 结果共用）
function zipReadEntry(buf, match) {
  var v = new DataView(buf), u8 = new Uint8Array(buf);
  var eocd = -1;
  for (var i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return Promise.reject(new Error('不是有效的压缩文件'));
  var count = v.getUint16(eocd + 10, true), cd = v.getUint32(eocd + 16, true);
  var entry = null;
  for (var n = 0; n < count; n++) {
    if (v.getUint32(cd, true) !== 0x02014b50) break;
    var nl = v.getUint16(cd + 28, true), el = v.getUint16(cd + 30, true), cl = v.getUint16(cd + 32, true);
    var fname = new TextDecoder().decode(u8.subarray(cd + 46, cd + 46 + nl));
    if (match(fname)) {
      entry = { method: v.getUint16(cd + 10, true), csize: v.getUint32(cd + 20, true), off: v.getUint32(cd + 42, true) };
      break;
    }
    cd += 46 + nl + el + cl;
  }
  if (!entry) return Promise.reject(new Error('压缩文件里没有需要的内容'));
  var lo = entry.off;
  var start = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true);
  var comp = u8.subarray(start, start + entry.csize);
  if (entry.method === 0) return Promise.resolve(comp);
  if (entry.method !== 8 || !window.DecompressionStream) return Promise.reject(new Error('浏览器不支持解压'));
  var stream = new Blob([comp]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).arrayBuffer().then(function(b) { return new Uint8Array(b); });
}

// 按当前服务商生成图片，返回可直接用作 src 的地址（url 或 dataURL）
function imageGenerate(prompt, cfg) {
  cfg = cfg || imgCfg;
  var p = cfg.provider, c = cfg[p];
  if (!c || !c.key) return Promise.reject(new Error(p === 'novelai' ? '请先填写 NovelAI Token' : '请先填写生图 API 密钥'));
  if (p === 'novelai') return generateNovelAiImage(prompt, c);
  if (p === 'openai' && !c.url) return Promise.reject(new Error('请先填写接口地址'));
  return generateOpenAiImage(prompt, c, p === 'gpt');
}

document.getElementById('imgTestBtn').addEventListener('click', function() {
  var btn = this;
  var prompt = document.getElementById('imgTestPrompt').value.trim();
  if (!prompt) { shakeEl(document.getElementById('imgTestPrompt')); return; }
  btn.disabled = true;
  btn.textContent = '生成中…';
  imageGenerate(prompt, readImgForm()).then(function(src) {
    var img = document.getElementById('imgTestPreview');
    img.src = src;
    img.style.display = 'block';
  }).catch(function(err) {
    showToast('✗ ' + err.message, 'error');
  }).then(function() {
    btn.disabled = false;
    btn.textContent = '生成测试';
  });
});

document.getElementById('imgSaveBtn').addEventListener('click', function() {
  imgCfg = readImgForm();
  mphoneStore.save('mphone_img_cfg', imgCfg);
  showToast('✓ 生图设置已保存', 'success');
});

fillTtsForm();
fillImgForm();
