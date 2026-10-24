// 眠花糖机 — 麦克风键 — 长按录音 → 语音气泡

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

  // 气泡宽度按时长自适应（2s→114px … ≥20s→220px）
  var bubbleW = Math.min(220, Math.max(100, 80 + durationSec * 7));

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

  var cvsW = Math.max(40, bubbleW - 28 - 36 - 26);
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
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function(stream) {
        // 等待麦克风授权期间已经松手 → 不再开始录音
        if (!_micHolding) {
          stream.getTracks().forEach(function(t) { t.stop(); });
          return;
        }
        _micStream    = stream;
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
    if (_micStream) { _micStream.getTracks().forEach(function(t) { t.stop(); }); _micStream = null; }
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

// 打开对话室时初始化消息列表与剧情列表，并绑定底栏相册图片按钮与加号扩展面板
(function() {
  var crAlbumBtn       = document.getElementById('crAlbumBtn');
  var crAlbumFileInput = document.getElementById('crAlbumFileInput');
  var chatRoomContent  = document.getElementById('chatRoomContent');

  // 点击剧情底栏「图片」按钮 → 打开设备相册发送图片
  if (crAlbumBtn && crAlbumFileInput) {
    crAlbumBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      crAlbumFileInput.value = '';
      crAlbumFileInput.click();
    });

    crAlbumFileInput.addEventListener('change', function() {
      var file = this.files && this.files[0];
      if (!file || openingChatCharIdx === -1) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        compressImage(ev.target.result, 1024, function(dataUrl) {
          var im = { role: 'user', content: '[图片消息]', imgSrc: dataUrl, time: Date.now() };
          if (pendingQuote) { im.quote = pendingQuote; clearQuote(); }
          getActiveHistory(openingChatCharIdx).push(im);
          renderHistMsg(im);
          saveHistories();
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // 点击底栏「+」按钮 → 底栏上升，下方展开/收起 4×2 微信小功能面板
  if (crPlusBtn && crPlusPanel) {
    crPlusBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleCrDrawer(crPlusPanel, crPlusBtn);
    });

    // 表情键 → 升起表情包抽屉（内容暂时留空）
    if (crEmojiBtn && crEmojiPanel) {
      crEmojiBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleCrDrawer(crEmojiPanel, crEmojiBtn);
      });
    }

    // 点击 4×2 面板中的功能按键（其中「相册」也可直接调起设备相册发送图片）
    crPlusPanel.querySelectorAll('.cr-plus-item').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var funcName = this.dataset.func || '';
        if (funcName === '相册' && crAlbumFileInput) {
          crAlbumFileInput.value = '';
          crAlbumFileInput.click();
          closeCrPlusPanel();
        } else {
          showToast('「' + funcName + '」功能开发中', 'success');
        }
      });
    });
  }

  // 点击聊天内容区或聚焦输入框时收起底部加号面板
  if (chatRoomContent) {
    chatRoomContent.addEventListener('click', function() {
      closeCrPlusPanel();
    });
  }
  if (crInput) {
    crInput.addEventListener('focus', function() {
      closeCrPlusPanel();
    });
  }

  var origRender = renderChatCharList;
  renderChatCharList = function() {
    origRender();
    document.querySelectorAll('#chatCharList .chat-char-card').forEach(function(card) {
      card.addEventListener('click', function() {
        chatRoomSession++;   // 新的一次对话：角色设置界面回到第一页
        renderRoomLists(parseInt(this.dataset.index, 10));
      }, true);
    });
  };
  renderChatCharList();
})();

// 打开对话时绘制聊天、剧情两个列表；只画最近 ROOM_PAGE 条，滑到顶部再加载更早的
var ROOM_PAGE = 50;
function renderMsgPage(list, empty, hist, count) {
  list.innerHTML = '';
  list.appendChild(empty);
  empty.style.display = hist.length ? 'none' : 'flex';
  var start = Math.max(0, hist.length - count);
  list._hist = hist;
  list._empty = empty;
  list._firstMsg = hist[start] || null;
  list._lastTime = 0;
  list._altTime = 0;
  list._needBottom = true;   // 隐藏时设不了滚动位置，显示出来后再滚到底
  if (start > 0) {
    var more = document.createElement('div');
    more.className = 'cr-load-more';
    more.textContent = '上滑查看更早的消息';
    list.appendChild(more);
  }
  hist.slice(start).forEach(function(m) { renderHistMsg(m, list, empty); });
}
// 滑到顶部：多画一页，并保持当前看到的位置不动
function loadEarlierMsgs(list) {
  var hist = list._hist;
  if (!hist || list._loading || list._needBottom) return;
  var start = hist.indexOf(list._firstMsg);
  if (start <= 0) return;
  list._loading = true;
  var oldH = list.scrollHeight, oldTop = list.scrollTop;
  renderMsgPage(list, list._empty, hist, hist.length - start + ROOM_PAGE);
  list._needBottom = false;
  list.scrollTop = list.scrollHeight - oldH + oldTop;
  list._loading = false;
}
['chatMsgList', 'dramaMsgList'].forEach(function(id) {
  var list = document.getElementById(id);
  if (list) list.addEventListener('scroll', function() { if (list.scrollTop < 30) loadEarlierMsgs(list); });
});
function scrollPendingLists() {
  ['chatMsgList', 'dramaMsgList'].forEach(function(id) {
    var list = document.getElementById(id);
    if (list && list._needBottom && list.clientHeight) { list.scrollTop = list.scrollHeight; list._needBottom = false; }
  });
}

function renderRoomLists(idx) {
  // 聊天子视图
  var list = document.getElementById('chatMsgList');
  var emptyDiv = document.createElement('div');
  emptyDiv.className = 'chat-room-empty'; emptyDiv.id = 'chatRoomEmpty';
  emptyDiv.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span>开始聊天吧</span>';
  renderMsgPage(list, emptyDiv, getChatHistory(idx), ROOM_PAGE);

  // 剧情子视图
  var dList = document.getElementById('dramaMsgList');
  if (!dList) { setTimeout(scrollPendingLists, 0); return; }
  var dEmpty = document.createElement('div');
  dEmpty.className = 'drama-empty-hint'; dEmpty.id = 'dramaRoomEmpty';
  dEmpty.innerHTML = '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="17" y1="7" x2="22" y2="7"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="2" y1="17" x2="7" y2="17"></line></svg><span>暂无剧情</span>';
  var dHist = getDramaHistory(idx);
  renderMsgPage(dList, dEmpty, dHist, ROOM_PAGE);

  // 剧情还没开始：从开场白列表里选一段作为开头
  var openings = charList[idx].openings || [];
  if (!dHist.length && openings.length) {
    var picker = document.createElement('div');
    picker.className = 'drama-opening-picker';
    picker.innerHTML = '<div class="drama-opening-title">选择一段开场白</div>';
    openings.forEach(function(text) {
      var item = document.createElement('div');
      item.className = 'drama-opening-item';
      var shown = fillMacros(text, charList[idx]);   // 开场白里的 {{char}} / {{user}} 换成名字
      item.textContent = shown;
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        var m = { role: 'assistant', content: shown, time: Date.now() };
        getDramaHistory(idx).push(m);
        saveHistories();
        renderHistMsg(m, dList, dEmpty);
      });
      picker.appendChild(item);
    });
    dEmpty.appendChild(picker);
  }
  setTimeout(scrollPendingLists, 0);
}
