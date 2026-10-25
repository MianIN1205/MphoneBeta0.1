// 眠花糖机 — 识图与语音：真实图片 / 音频发给 AI，语音识别转写

// =============================================
// 识图与语音：真实图片 / 音频发给 AI，语音识别转写
// =============================================
// mediaCfg = { vision: 是否发送真实图片, voiceMode: 'text' 转成文字 | 'audio' 发送音频 }
var mediaCfg = Object.assign({ vision: true, voiceMode: 'text' }, mphoneStore.load('mphone_media_cfg', {}));
var sttCfg   = Object.assign({ url: '', key: '', model: '' }, mphoneStore.load('mphone_stt_cfg', {}));

function fillMediaForm() {
  document.getElementById('mediaVision').checked = mediaCfg.vision;
  document.querySelectorAll('#mediaVoiceRow .pf-radio-btn').forEach(function(b) {
    b.classList.toggle('selected', b.dataset.mode === mediaCfg.voiceMode);
  });
  document.getElementById('sttUrl').value = sttCfg.url;
  document.getElementById('sttKey').value = sttCfg.key;
  document.getElementById('sttModel').value = sttCfg.model;
}
document.getElementById('mediaVision').addEventListener('change', function() {
  mediaCfg.vision = this.checked;
  mphoneStore.save('mphone_media_cfg', mediaCfg);
});
document.querySelectorAll('#mediaVoiceRow .pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    mediaCfg.voiceMode = this.dataset.mode;
    mphoneStore.save('mphone_media_cfg', mediaCfg);
    fillMediaForm();
  });
});
document.getElementById('sttSaveBtn').addEventListener('click', function() {
  sttCfg = {
    url: document.getElementById('sttUrl').value.trim(),
    key: document.getElementById('sttKey').value.trim(),
    model: document.getElementById('sttModel').value.trim()
  };
  mphoneStore.save('mphone_stt_cfg', sttCfg);
  showToast('✓ 语音识别设置已保存', 'success');
});

// 语音识别用的接口：自己填的优先，留空就用主 API
function sttEndpoint() {
  var main = getApiCfg();
  return { url: sttCfg.url || main.url, key: sttCfg.key || main.key, model: sttCfg.model || 'whisper-1' };
}
function sttReady() { var e = sttEndpoint(); return !!(e.url && e.key); }

// 把一段录音（dataURL）转成文字：先用语音识别接口；接口不支持（如 Gemini）时，改让聊天模型听写
function sttTranscribe(src) {
  return sttTranscribeWhisper(src).catch(function(err) {
    var main = getApiCfg();
    if (!main.url || !main.key || !main.model) throw err;
    return sttTranscribeByChat(src).catch(function() { throw err; });
  });
}
function sttTranscribeByChat(src) {
  return llmRequest([{ role: 'user', content: [
    { type: 'text', text: '请把这段语音逐字转写成文字，只输出转写结果，不要加任何说明。听不清就输出「（听不清）」。' },
    { type: 'input_audio', _voiceSrc: src }
  ] }], { stream: false, keepMedia: true, temperature: 0 }).then(function(text) {
    text = String(text || '').trim();
    if (!text) throw new Error('没有识别出文字');
    return text;
  });
}
function sttTranscribeWhisper(src) {
  var e = sttEndpoint();
  if (!e.url || !e.key) return Promise.reject(new Error('请先配置语音识别接口或主 API'));
  var type = (String(src).match(/^data:([^;,]+)/) || [])[1] || 'audio/webm';
  var ext = /mp4|m4a|aac/.test(type) ? 'm4a' : /mpeg|mp3/.test(type) ? 'mp3' : /wav/.test(type) ? 'wav' : /ogg/.test(type) ? 'ogg' : 'webm';
  var form = new FormData();
  form.append('file', new Blob([dataUrlToBytes(src)], { type: type }), 'voice.' + ext);
  form.append('model', e.model);
  return fetch(e.url.replace(/\/$/, '') + '/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + e.key },
    body: form
  }).then(function(res) {
    if (!res.ok) return apiError(res);
    return res.json().then(function(j) {
      var text = String((j && j.text) || '').trim();
      if (!text) throw new Error('没有识别出文字');
      return text;
    });
  });
}

// 录音 → 16kHz 单声道 WAV（base64），供「发送音频」使用；结果缓存，同一段录音只转一次
var wavCache = {};
function voiceToWavBase64(src) {
  if (wavCache[src]) return Promise.resolve(wavCache[src]);
  return decodeAudioBytes(dataUrlToBytes(src)).then(function(buf) {
    var RATE = 16000;
    var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var len = Math.max(1, Math.ceil(buf.duration * RATE));
    var off = new Offline(1, len, RATE);
    var node = off.createBufferSource();
    node.buffer = buf;
    node.connect(off.destination);
    node.start(0);
    return off.startRendering();
  }).then(function(rendered) {
    var pcm = rendered.getChannelData(0);
    var bytes = new Uint8Array(44 + pcm.length * 2);
    var v = new DataView(bytes.buffer);
    var w = function(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE');
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    for (var i = 0; i < pcm.length; i++) {
      var s = Math.max(-1, Math.min(1, pcm[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    var bin = '';
    for (var j = 0; j < bytes.length; j += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(j, j + 0x8000));
    wavCache[src] = btoa(bin);
    return wavCache[src];
  });
}

// 发送前把消息里的录音占位换成真正的音频数据
function resolveMediaParts(msgs) {
  var jobs = [];
  msgs.forEach(function(msg) {
    if (!Array.isArray(msg.content)) return;
    msg.content.forEach(function(part, i) {
      if (part.type !== 'input_audio' || !part._voiceSrc) return;
      jobs.push(voiceToWavBase64(part._voiceSrc).then(function(b64) {
        msg.content[i] = { type: 'input_audio', input_audio: { data: b64, format: 'wav' } };
      }, function() {
        msg.content[i] = { type: 'text', text: '（这段语音无法转换格式）' };
      }));
    });
  });
  return Promise.all(jobs).then(function() { return msgs; });
}

// ---------- 测试：当前模型能不能真的看到图片、听到语音 ----------
// 识图：画一张写着随机数字的图，问模型图里写了什么；语音：合成 3 声「嘟」，问模型听到几声
function mediaTestResult(text, ok) {
  var el = document.getElementById('mediaTestResult');
  el.textContent = text;
  el.style.color = ok === true ? '#4f9a6a' : ok === false ? '#c0506a' : '';
}
function mediaTestAsk(content) {
  // 测试时原样发送图片 / 音频，不自动换成文字
  return llmRequest([{ role: 'user', content: content }], { stream: false, keepMedia: true, temperature: 0 })
    .then(function(text) { return String(text || '').trim(); });
}
document.getElementById('mediaTestImgBtn').addEventListener('click', function() {
  var code = String(Math.floor(1000 + Math.random() * 9000));
  var c = document.createElement('canvas');
  c.width = 320; c.height = 160;
  var x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 320, 160);
  x.fillStyle = '#222'; x.font = 'bold 72px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(code, 160, 80);
  mediaTestResult('正在测试识图…');
  mediaTestAsk([
    { type: 'text', text: '图片里写的是什么数字？只回答数字。' },
    { type: 'image_url', image_url: { url: c.toDataURL('image/png') } }
  ]).then(function(reply) {
    var ok = reply.indexOf(code) >= 0;
    mediaTestResult(ok ? '✓ 识图正常：图里是 ' + code + '，模型回答「' + reply.slice(0, 30) + '」'
                       : '✗ 模型没认出来：图里是 ' + code + '，模型回答「' + reply.slice(0, 40) + '」', ok);
  }, function(err) { mediaTestResult('✗ 识图请求失败：' + err.message, false); });
});
document.getElementById('mediaTestAudioBtn').addEventListener('click', function() {
  // 3 声 880Hz 的「嘟」，16kHz 单声道 WAV
  var rate = 16000, n = rate * 2, pcm = new Int16Array(n);
  for (var i = 0; i < n; i++) {
    var t = i / rate, k = Math.floor(t / 0.6), inBeep = k < 3 && (t - k * 0.6) < 0.3;
    pcm[i] = inBeep ? Math.round(Math.sin(2 * Math.PI * 880 * t) * 12000) : 0;
  }
  var bytes = new Uint8Array(44 + n * 2), v = new DataView(bytes.buffer);
  var w = function(o, s) { for (var j = 0; j < s.length; j++) v.setUint8(o + j, s.charCodeAt(j)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (var q = 0; q < n; q++) v.setInt16(44 + q * 2, pcm[q], true);
  var bin = '';
  for (var p = 0; p < bytes.length; p += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(p, p + 0x8000));
  mediaTestResult('正在测试语音…');
  mediaTestAsk([
    { type: 'text', text: '这段音频里一共有几声「嘟」的提示音？只回答一个阿拉伯数字。' },
    { type: 'input_audio', input_audio: { data: btoa(bin), format: 'wav' } }
  ]).then(function(reply) {
    var ok = /3|三/.test(reply);
    mediaTestResult(ok ? '✓ 语音正常：模型听到了 3 声，回答「' + reply.slice(0, 30) + '」'
                       : '✗ 模型可能没听到音频：应为 3 声，模型回答「' + reply.slice(0, 40) + '」', ok);
  }, function(err) { mediaTestResult('✗ 语音请求失败：' + err.message + '（这个模型或接口可能不支持音频输入）', false); });
});

fillMediaForm();
