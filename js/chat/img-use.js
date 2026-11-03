// 眠花糖机 — 图片用文字图还是生图（设置 → 生图 API →「在哪里用生图」）：聊天里角色发的照片、动态配图、查手机的相册、剧情配图
// 生图 API 没填好时一律先用文字图片（剧情就不配图）；生出来的图压小一点再存（gpt-image 返回的是很大的 dataURL）

var IMG_USE_DEFAULT = { chat: 'text', feed: 'text', album: 'text', drama: 'off' };
function imgGenReady() {
  var c = imgCfg && imgCfg[imgCfg.provider];
  return !!(c && c.key && (imgCfg.provider !== 'openai' || c.url));
}
// scope：chat / feed / album / drama → 'text' | 'gen' | 'off'
function imgUse(scope) {
  var v = Object.assign({}, IMG_USE_DEFAULT, (imgCfg && imgCfg.use) || {})[scope];
  if (v === 'gen' && !imgGenReady()) return scope === 'drama' ? 'off' : 'text';
  return v;
}
// 照着一段画面描述生一张图，返回能直接用的 src（dataURL 压到 768 像素以内）
function genImageFromDesc(desc) {
  return imageGenerate(String(desc || '').slice(0, 600)).then(function(src) {
    if (!/^data:/.test(src)) return src;
    return new Promise(function(resolve) { compressImage(src, 768, resolve); });
  });
}
// 一个一个排队生，不同时发好几个请求
var imgGenQueue = Promise.resolve();
function queueImageGen(desc) {
  var p = imgGenQueue.then(function() { return genImageFromDesc(desc); });
  imgGenQueue = p.catch(function() {});
  return p;
}

// ---------- 聊天：角色发的照片 <照片>画面</照片> ----------
// 回复里的照片拆成单独一条：先是文字图片（m.textImg），生图模式下画好了再换成真图片（m.imgSrc）
var PHOTO_TAG_RE = /<照片>([\s\S]*?)<\/照片>/g;
var PHOTO_GAP = 30;   // 最近这么多条里 TA 发过照片，就先不再发（用户说频率别太高）
function photoRecentlySent(hist) {
  return (hist || []).slice(-PHOTO_GAP).some(function(m) { return m.photo && m.role === 'assistant'; });
}
function photoSplitParts(parts, hist) {
  var blocked = photoRecentlySent(hist);
  var out = [];
  parts.forEach(function(p) {
    if (typeof p !== 'string' || p.indexOf('<照片>') < 0) { out.push(p); return; }
    var last = 0, m;
    PHOTO_TAG_RE.lastIndex = 0;
    while ((m = PHOTO_TAG_RE.exec(p))) {
      var before = p.slice(last, m.index).trim();
      if (before) out.push(before);
      var desc = m[1].replace(/\s+/g, ' ').trim();
      if (desc && !blocked) { out.push({ content: '[照片] ' + desc, textImg: desc, photo: true }); blocked = true; }   // 一次最多一张
      last = PHOTO_TAG_RE.lastIndex;
    }
    var rest = p.slice(last).trim();
    if (rest) out.push(rest);
  });
  return out;
}
// 记录里还没画的照片（生图模式）：画好换上，正在看这个对话就重画列表
function genPendingPhotos(hist, msgs) {
  msgs.forEach(function(m) {
    if (!m.textImg || m.imgSrc || m._genning) return;
    m._genning = true;
    queueImageGen(m.textImg).then(function(src) {
      m.imgSrc = src;
      saveHistories();
      if (appChatRoom.classList.contains('active') && getActiveHistory(openingChatCharIdx) === hist) {
        renderRoomLists(openingChatCharIdx);
        var l = getActiveMsgListEl();
        if (l) setTimeout(function() { l.scrollTop = l.scrollHeight; }, 0);
      }
    }).catch(function(err) {
      console.warn('[Mphone] 照片没画出来:', err);
    }).then(function() { delete m._genning; });
  });
}

// ---------- 动态：配的文字图在生图模式下一张张画出来，画好一张换一张 ----------
function feedGenImages(post) {
  if (imgUse('feed') !== 'gen' || !post || !(post.textImgs || []).length) return;
  post.textImgs.slice().forEach(function(t) {
    queueImageGen(t).then(function(src) {
      var i = post.textImgs.indexOf(t);
      if (i >= 0) post.textImgs.splice(i, 1);
      post.images = (post.images || []).concat(src);
      saveFeed();
      if (typeof renderFeed === 'function') renderFeed();
    }).catch(function(err) { console.warn('[Mphone] 动态配图没画出来:', err); });
  });
}
