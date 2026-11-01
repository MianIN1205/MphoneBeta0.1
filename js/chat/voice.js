// 眠花糖机 — 语音：长按麦克风录音、语音气泡、波形、转写

// =============================================
// 麦克风键 — 长按录音 → 语音气泡
// =============================================
var crMicBtn      = document.getElementById('crMicBtn');
var MIC_HOLD_MS   = 500;
var _micTimer     = null;
var _mediaRecorder= null;
var _audioChunks  = [];
var _recordStart  = 0;
var _micStream    = null;
var _micHolding   = false;
var _micStartX    = 0, _micStartY = 0;

// 麦克风授权后一直保持连接，离开聊天窗口或切到后台才释放：在同一次聊天里只问一次权限
// （网页拿不到永久权限；安卓选「使用应用时允许」会被浏览器记住，iPhone 会经常重新询问）
function getMicStream() {
  if (_micStream && _micStream.getAudioTracks().some(function(t) { return t.readyState === 'live'; })) {
    return Promise.resolve(_micStream);
  }
  return navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
    _micStream = stream;
    return stream;
  });
}
function releaseMic() {
  if (_mediaRecorder && _mediaRecorder.state !== 'inactive') return;   // 正在录音时不释放
  if (_micStream) { _micStream.getTracks().forEach(function(t) { t.stop(); }); _micStream = null; }
}
new MutationObserver(function() {
  if (!appChatRoom.classList.contains('active')) releaseMic();
}).observe(appChatRoom, { attributes: true, attributeFilter: ['class'] });
document.addEventListener('visibilitychange', function() {
  if (document.hidden) releaseMic();
});

// 录音浮窗 refs
var _recOverlay    = document.getElementById('recOverlay');
var _recTimerEl    = document.getElementById('recTimer');
var _recLiveCanvas = document.getElementById('recLiveCanvas');
var _recTimerInt   = null;
var _recAnimFrame  = null;
var _recAnalyser   = null;
var _recAudioCtx   = null;

function startRecOverlay() {
  _recOverlay.classList.add('active');
  var t = 0;
  _recTimerEl.textContent = '0:00';
  _recTimerInt = setInterval(function() {
    t++;
    var m = Math.floor(t / 60), s = t % 60;
    _recTimerEl.textContent = m + ':' + String(s).padStart(2, '0');
  }, 1000);
}

function stopRecOverlay() {
  _recOverlay.classList.remove('active');
  clearInterval(_recTimerInt);
  cancelAnimationFrame(_recAnimFrame);
  if (_recAudioCtx) { try { _recAudioCtx.close(); } catch(e){} _recAudioCtx = null; }
  _recAnalyser = null;
}

function startLiveWaveform(stream) {
  try {
    _recAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var src = _recAudioCtx.createMediaStreamSource(stream);
    _recAnalyser = _recAudioCtx.createAnalyser();
    _recAnalyser.fftSize = 64;
    src.connect(_recAnalyser);
    var bufLen = _recAnalyser.frequencyBinCount;
    var dataArr = new Uint8Array(bufLen);
    var cvs = _recLiveCanvas;
    var W = cvs.width, H = cvs.height;
    var ctx = cvs.getContext('2d');
    var BAR_W = 3, GAP = 2;
    var barCount = Math.floor(W / (BAR_W + GAP));
    function draw() {
      _recAnimFrame = requestAnimationFrame(draw);
      _recAnalyser.getByteFrequencyData(dataArr);
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < barCount; i++) {
        var di = Math.floor(i * bufLen / barCount);
        var norm = dataArr[di] / 255;
        var barH = Math.max(3, norm * (H - 4));
        var x = i * (BAR_W + GAP);
        var y = (H - barH) / 2;
        ctx.fillStyle = 'rgba(200,80,120,' + (0.4 + norm * 0.55) + ')';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, BAR_W, barH, 1.5);
        else { ctx.rect(x, y, BAR_W, barH); }
        ctx.fill();
      }
    }
    draw();
  } catch(e) {}
}

// 绘制竖线柱状波形（AudioBuffer）
function drawWaveform(canvas, audioBuffer) {
  var ctx  = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  var data = audioBuffer.getChannelData(0);
  var BAR_W = 2.5, GAP = 2;
  var barCount = Math.floor(W / (BAR_W + GAP));
  var step = Math.max(1, Math.floor(data.length / barCount));
  var amp = H / 2;
  for (var i = 0; i < barCount; i++) {
    var sum = 0;
    for (var j = 0; j < step; j++) sum += Math.abs(data[i * step + j] || 0);
    var avg = sum / step;
    var barH = Math.max(3, avg * amp * 8);
    barH = Math.min(barH, H - 2);
    var x = i * (BAR_W + GAP);
    var y = (H - barH) / 2;
    ctx.fillStyle = 'rgba(160,80,120,0.55)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, BAR_W, barH, 1);
    else { ctx.rect(x, y, BAR_W, barH); }
    ctx.fill();
  }
}

// 绘制随机占位竖线波形（解码失败时）
function drawFlatWaveform(canvas) {
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  var BAR_W = 2.5, GAP = 2;
  var barCount = Math.floor(W / (BAR_W + GAP));
  var amp = H / 2;
  for (var i = 0; i < barCount; i++) {
    var barH = Math.random() * amp * 0.7 + 3;
    var x = i * (BAR_W + GAP);
    var y = (H - barH) / 2;
    ctx.fillStyle = 'rgba(160,80,120,0.32)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, BAR_W, barH, 1);
    else { ctx.rect(x, y, BAR_W, barH); }
    ctx.fill();
  }
}

// 创建语音气泡并添加到消息列表
// dataURL → 字节
function dataUrlToBytes(src) {
  var b64 = String(src).split(',')[1] || '';
  var bin = atob(b64);
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function getDecodeCtx() {
  if (!window._mphoneDecodeCtx) window._mphoneDecodeCtx = new (window.AudioContext || window.webkitAudioContext)();
  return window._mphoneDecodeCtx;
}
function decodeAudioBytes(bytes) {
  return new Promise(function(resolve, reject) {
    try { getDecodeCtx().decodeAudioData(bytes.buffer.slice(0), resolve, reject); } catch (e) { reject(e); }
  });
}

// 语音消息气泡：m = { role: 'user', content: '[语音消息]', voice: { src: dataURL, dur: 秒 }, transcript }
// 返回行元素；转写区作为附属元素（删除消息时一起移除）
function createVoiceBubble(m, list, empty) {
  if (empty) empty.style.display = 'none';
  var durationSec = m.voice.dur || 1;
  var mins   = Math.floor(durationSec / 60);
  var secs   = Math.round(durationSec % 60);
  var durStr = mins + ':' + String(secs).padStart(2, '0');
  var audio  = new Audio(m.voice.src);

  // 气泡宽度按时长自适应（短语音 120px … ≥18s→220px）
  var bubbleW = Math.min(220, Math.max(120, 92 + durationSec * 7));

  var row = document.createElement('div');
  row.className = 'chat-msg-row user';
  row.appendChild(createMsgAvatar('user'));

  // 气泡（点击非播放键区域 → 展开/收起转文字）
  var bubble = document.createElement('div');
  bubble.className = 'chat-msg-bubble';
  bubble.style.cssText = 'padding:8px 10px;cursor:pointer;user-select:none;-webkit-user-select:none;width:' + bubbleW + 'px;box-sizing:border-box;';

  var inner = document.createElement('div');
  inner.className = 'voice-bubble-inner';

  var playBtn = document.createElement('button');
  playBtn.className = 'voice-play-btn';
  playBtn.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" fill="rgba(160,80,120,0.85)"><polygon points="3,2 14,8 3,14"/></svg>';

  // 波形宽度 = 气泡宽 − 左右内边距 20 − 播放键 28 − 两个间距 14 − 时长 32
  var cvsW = Math.max(24, bubbleW - 94);
  var cvs = document.createElement('canvas');
  cvs.className = 'voice-waveform';
  cvs.width = cvsW; cvs.height = 28;

  var durEl = document.createElement('span');
  durEl.className = 'voice-duration';
  durEl.textContent = durStr;

  inner.appendChild(playBtn);
  inner.appendChild(cvs);
  inner.appendChild(durEl);
  bubble.appendChild(inner);
  row.appendChild(bubble);

  // 转文字区域（有转写时默认展开，可直接修改）
  var transcriptWrap = document.createElement('div');
  transcriptWrap.className = 'voice-transcript-wrap' + (m.transcript ? ' open' : '');
  var transcriptEl = document.createElement('div');
  transcriptEl.className = 'voice-transcript';
  transcriptEl.setAttribute('contenteditable', 'true');
  transcriptEl.setAttribute('data-placeholder', '点这里输入或修改转写文字');
  transcriptEl.textContent = m.transcript || '';
  transcriptWrap.appendChild(transcriptEl);

  transcriptEl.addEventListener('blur', function() {
    var txt = this.textContent.trim();
    if (txt === (m.transcript || '')) return;
    m.transcript = txt;
    saveHistories();
  });

  // 解码绘制静态波形（结果缓存供停止播放后重绘）
  var _decoded = null;
  function drawStaticWave() {
    if (_decoded) drawWaveform(cvs, _decoded); else drawFlatWaveform(cvs);
  }
  decodeAudioBytes(dataUrlToBytes(m.voice.src))
    .then(function(decoded) { _decoded = decoded; drawWaveform(cvs, decoded); })
    .catch(function() { drawFlatWaveform(cvs); });

  // 播放时波纹动画
  var _waveAnim = null;
  function startWaveAnim() {
    var ctx2 = cvs.getContext('2d');
    var W = cvs.width, H = cvs.height;
    var BAR_W = 2.5, GAP = 2;
    var barCount = Math.floor(W / (BAR_W + GAP));
    var phase = 0;
    function frame() {
      if (audio.paused || audio.ended) return;
      _waveAnim = requestAnimationFrame(frame);
      phase += 0.10;
      ctx2.clearRect(0, 0, W, H);
      for (var i = 0; i < barCount; i++) {
        var wave = 0.5 + 0.5 * Math.sin(phase + i * 0.38);
        var barH = 3 + wave * (H - 8);
        var x = i * (BAR_W + GAP);
        var y = (H - barH) / 2;
        ctx2.fillStyle = 'rgba(200,80,120,' + (0.35 + wave * 0.58) + ')';
        ctx2.beginPath();
        if (ctx2.roundRect) ctx2.roundRect(x, y, BAR_W, barH, 1);
        else { ctx2.rect(x, y, BAR_W, barH); }
        ctx2.fill();
      }
    }
    _waveAnim = requestAnimationFrame(frame);
  }
  function stopWaveAnim() {
    cancelAnimationFrame(_waveAnim); _waveAnim = null;
    drawStaticWave();
  }

  // 播放 / 停止
  var _playing = false;
  var PLAY_SVG  = '<svg viewBox="0 0 16 16" width="12" height="12" fill="rgba(160,80,120,0.85)"><polygon points="3,2 14,8 3,14"/></svg>';
  var PAUSE_SVG = '<svg viewBox="0 0 16 16" width="12" height="12" fill="rgba(160,80,120,0.85)"><rect x="2" y="2" width="4" height="12"/><rect x="10" y="2" width="4" height="12"/></svg>';
  playBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (_playing) {
      audio.pause(); audio.currentTime = 0;
      playBtn.innerHTML = PLAY_SVG; _playing = false; stopWaveAnim();
    } else {
      audio.play().catch(function(){});
      playBtn.innerHTML = PAUSE_SVG; _playing = true; startWaveAnim();
    }
  });
  audio.addEventListener('ended', function() {
    playBtn.innerHTML = PLAY_SVG; _playing = false; stopWaveAnim();
  });

  // 点击气泡非播放键区域 → 展开/收起转文字；还没转写时用语音识别接口转写这段录音
  bubble.addEventListener('click', function(e) {
    if (e.target === playBtn || playBtn.contains(e.target)) return;
    var open = !transcriptWrap.classList.contains('open');
    transcriptWrap.classList.toggle('open', open);
    if (open && !m.transcript && !m._transcribing) {
      transcribeVoiceMsg(m, transcriptEl);
    }
    list.scrollTop = list.scrollHeight;
  });

  row._voiceTranscriptEl = transcriptEl;
  list.appendChild(row);
  list.appendChild(transcriptWrap);
  row._msg = m;
  row._extras = [transcriptWrap];
  list.scrollTop = list.scrollHeight;
  return row;
}

// 用语音识别接口转写一条语音消息，结果写回记录并显示
function transcribeVoiceMsg(m, el) {
  m._transcribing = true;
  if (el) el.textContent = '转写中…';
  return sttTranscribe(m.voice.src).then(function(text) {
    m.transcript = text;
    if (el) { el.textContent = text; el.closest('.voice-transcript-wrap').classList.add('open'); }
    saveHistories();
    return text;
  }).catch(function(err) {
    if (el) el.textContent = '';
    if (el) el.setAttribute('data-placeholder', '转写失败：' + err.message + '（可手动输入）');
    throw err;
  }).then(function(t) { delete m._transcribing; return t; }, function(e) { delete m._transcribing; throw e; });
}

// 麦克风长按录音事件绑定
crMicBtn.addEventListener('pointerdown', function(e) {
  e.preventDefault();
  // 捕获指针：手指/鼠标移出按钮后松开也能收到 pointerup
  try { crMicBtn.setPointerCapture(e.pointerId); } catch (_) {}
  _micStartX = e.clientX; _micStartY = e.clientY;
  _micHolding = false;
  _micTimer = setTimeout(function() {
    _micHolding = true;
    getMicStream()
      .then(function(stream) {
        // 等待麦克风授权期间已经松手 → 不再开始录音
        if (!_micHolding) return;
        _audioChunks  = [];
        _mediaRecorder= new MediaRecorder(stream);
        _mediaRecorder.ondataavailable = function(ev) {
          if (ev.data && ev.data.size > 0) _audioChunks.push(ev.data);
        };
        _mediaRecorder.start();
        _recordStart = Date.now();
        crMicBtn.classList.add('recording');
        startRecOverlay();
        startLiveWaveform(stream);
      })
      .catch(function(err) {
        console.warn('[Mphone] 麦克风访问失败:', err);
        showToast('✗ 无法访问麦克风', 'error');
        _micHolding = false;
      });
  }, MIC_HOLD_MS);
});

function stopRecording() {
  clearTimeout(_micTimer);
  crMicBtn.classList.remove('recording');
  stopRecOverlay();
  if (!_micHolding || !_mediaRecorder || _mediaRecorder.state === 'inactive') {
    _micHolding = false; return;
  }
  _micHolding = false;
  var duration = (Date.now() - _recordStart) / 1000;
  _mediaRecorder.onstop = function() {
    // iPhone Safari 录的是 audio/mp4，其他浏览器多为 audio/webm，按录音器实际格式保存
    var type = (_mediaRecorder.mimeType || 'audio/webm').split(';')[0];
    var blob = new Blob(_audioChunks, { type: type });
    if (!appChatRoom.classList.contains('active') || document.hidden) releaseMic();
    if (duration < 0.6) { showToast('录音时间太短', 'error'); return; }
    if (openingChatCharIdx === -1) return;
    var reader = new FileReader();
    reader.onload = function() {
      var m = { role: 'user', content: '[语音消息]', voice: { src: reader.result, dur: Math.round(duration * 10) / 10 }, time: Date.now() };
      if (pendingQuote) { m.quote = pendingQuote; clearQuote(); }
      getChatHistory(openingChatCharIdx).push(m);
      saveHistories();
      var row = renderHistMsg(m, document.getElementById('chatMsgList'), document.getElementById('chatRoomEmpty'));
      // 「转成文字」模式：录完自动转写
      if (mediaCfg.voiceMode === 'text' && sttReady()) {
        transcribeVoiceMsg(m, row && row._voiceTranscriptEl).catch(function(err) {
          showToast('✗ 语音转写失败：' + err.message, 'error');
        });
      }
    };
    reader.readAsDataURL(blob);
  };
  _mediaRecorder.stop();
}

crMicBtn.addEventListener('pointerup',     stopRecording);
crMicBtn.addEventListener('pointercancel', stopRecording);
crMicBtn.addEventListener('pointermove', function(e) {
  var dx = e.clientX - _micStartX, dy = e.clientY - _micStartY;
  if (dx * dx + dy * dy > 400) stopRecording();
});
