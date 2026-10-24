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

// 把一段录音（dataURL）转成文字
function sttTranscribe(src) {
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

fillMediaForm();
