// 眠花糖机 — 动态（朋友圈）+ 角色自主活动

// =============================================
// 动态（朋友圈）+ 角色自主活动
// =============================================
// 动态数据：[{ id, author: { type: 'user' | 'char', id, name, avatar }, text, images: [], time,
//             visibleTo: [角色 id]（仅用户动态）, likes: [author], comments: [{ id, author, text, time, replyTo: author | null }] }]
var feedPosts = mphoneStore.load('mphone_feed', []);
var feedList          = document.getElementById('feedList');
var feedMoreBtn       = document.getElementById('feedMoreBtn');
var feedPopup         = document.getElementById('feedPopup');
var feedComposeOverlay= document.getElementById('feedComposeOverlay');
var feedComposeText   = document.getElementById('feedComposeText');
var feedComposeImgs   = document.getElementById('feedComposeImgs');
var feedComposeImgAdd = document.getElementById('feedComposeImgAdd');
var feedVisibleList   = document.getElementById('feedVisibleList');
var feedCharPickOverlay = document.getElementById('feedCharPickOverlay');
var feedCharPickList  = document.getElementById('feedCharPickList');
var feedCommentBar    = document.getElementById('feedCommentBar');
var feedCommentInput  = document.getElementById('feedCommentInput');
var feedComposeImages = [];
var feedCommentTarget = null;   // { post, replyTo }

// _busy 只是运行时状态，不写入存储
function saveFeed() {
  mphoneStore.save('mphone_feed', feedPosts.map(function(p) {
    var c = Object.assign({}, p);
    delete c._busy;
    return c;
  }));
}
function genFeedId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// 当前「我的」账号（发动态 / 评论用的身份）
function getMineAccount() {
  var accs = mphoneStore.load('mphone_mine_accounts_v1', []);
  var idx  = mphoneStore.load('mphone_mine_active_idx_v1', 0);
  var acc  = accs[idx] || accs[0] || {};
  return { type: 'user', id: acc.id || '@mphone', name: (acc.nickname || acc.realname || '我'), avatar: acc.avatar || '' };
}
function charAuthor(char) {
  return { type: 'char', id: char.id, name: char.charAlias || char.charName || '未命名', avatar: char.charAvatar || '' };
}
function findCharIdx(id) {
  for (var i = 0; i < charList.length; i++) if (charList[i].id === id) return i;
  return -1;
}
function sameAuthor(a, b) { return a && b && a.type === b.type && a.id === b.id; }

function feedTimeText(t) {
  var d = (Date.now() - t) / 1000;
  if (d < 60) return '刚刚';
  if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
  if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
  var dt = new Date(t);
  return (dt.getMonth() + 1) + '月' + dt.getDate() + '日 ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes());
}

// ---------- 渲染 ----------
function renderFeed() {
  var me = getMineAccount();
  // 横幅：主账号头像、昵称，以及自定义背景
  var bannerAv = document.querySelector('.feed-banner-avatar');
  if (bannerAv) bannerAv.style.backgroundImage = me.avatar ? 'url(' + me.avatar + ')' : '';
  document.getElementById('feedBannerName').textContent = me.name;
  var cover = mphoneStore.load('mphone_feed_cover', '');
  var bannerCard = document.getElementById('feedBannerCard');
  bannerCard.style.backgroundImage = cover ? 'url(' + cover + ')' : '';
  bannerCard.classList.toggle('has-cover', !!cover);

  feedList.innerHTML = '';
  if (!feedPosts.length) {
    feedList.innerHTML = '<div class="feed-empty-hint">还没有动态</div>';
    return;
  }
  feedPosts.forEach(function(post) { feedList.appendChild(renderFeedPost(post, me)); });
}

function renderFeedPost(post, me) {
  var el = document.createElement('div');
  el.className = 'feed-post';

  var head = document.createElement('div');
  head.className = 'feed-post-head';
  var av = document.createElement('div');
  av.className = 'feed-post-av';
  var avatar = post.author.type === 'char'
    ? ((charList[findCharIdx(post.author.id)] || {}).charAvatar || post.author.avatar)
    : post.author.avatar;
  if (avatar) av.style.backgroundImage = 'url(' + avatar + ')';
  var meta = document.createElement('div');
  meta.className = 'feed-post-meta';
  var name = document.createElement('div');
  name.className = 'feed-post-name';
  name.textContent = post.author.name;
  var time = document.createElement('div');
  time.className = 'feed-post-time';
  time.textContent = feedTimeText(post.time);
  meta.appendChild(name);
  meta.appendChild(time);
  var del = document.createElement('button');
  del.className = 'feed-post-del';
  del.textContent = '删除';
  del.addEventListener('click', function() {
    openPfEntryDel('删除这条动态？', function() {
      feedPosts = feedPosts.filter(function(p) { return p !== post; });
      saveFeed();
      renderFeed();
    });
  });
  head.appendChild(av);
  head.appendChild(meta);
  head.appendChild(del);
  el.appendChild(head);

  if (post.text) {
    var text = document.createElement('div');
    text.className = 'feed-post-text';
    text.textContent = post.text;
    el.appendChild(text);
  }
  if (post.images && post.images.length) {
    var imgs = document.createElement('div');
    imgs.className = 'feed-post-imgs';
    post.images.forEach(function(src) {
      var img = document.createElement('img');
      img.src = src;
      imgs.appendChild(img);
    });
    el.appendChild(imgs);
  }

  // 操作：点赞 / 评论 / ❄️ 请求角色互动
  var actions = document.createElement('div');
  actions.className = 'feed-post-actions';
  var liked = post.likes.some(function(a) { return sameAuthor(a, me); });
  var likeBtn = document.createElement('button');
  likeBtn.className = 'feed-act-btn' + (liked ? ' liked' : '');
  likeBtn.textContent = (liked ? '♥' : '♡') + ' 赞';
  likeBtn.addEventListener('click', function() {
    if (liked) post.likes = post.likes.filter(function(a) { return !sameAuthor(a, me); });
    else post.likes.push(me);
    saveFeed();
    renderFeed();
  });
  var cmtBtn = document.createElement('button');
  cmtBtn.className = 'feed-act-btn';
  cmtBtn.textContent = '评论';
  cmtBtn.addEventListener('click', function() { openFeedComment(post, null); });
  var snowBtn = document.createElement('button');
  snowBtn.className = 'feed-act-btn' + (post._busy ? ' busy' : '');
  snowBtn.textContent = '❄️';
  snowBtn.title = '请求角色互动';
  snowBtn.addEventListener('click', function() { requestFeedInteraction(post); });
  var favBtn = document.createElement('button');
  var faved = isFavRef(post.id);
  favBtn.className = 'feed-act-btn' + (faved ? ' liked' : '');
  favBtn.textContent = faved ? '★ 已收藏' : '☆ 收藏';
  favBtn.addEventListener('click', function() { toggleFavPost(post); renderFeed(); });
  actions.appendChild(favBtn);
  actions.appendChild(likeBtn);
  actions.appendChild(cmtBtn);
  actions.appendChild(snowBtn);
  el.appendChild(actions);

  if (post.likes.length || post.comments.length) {
    var box = document.createElement('div');
    box.className = 'feed-interact';
    if (post.likes.length) {
      var likes = document.createElement('div');
      likes.className = 'feed-likes';
      likes.textContent = '♥ ' + post.likes.map(function(a) { return a.name; }).join('，');
      box.appendChild(likes);
    }
    post.comments.forEach(function(c) {
      var row = document.createElement('div');
      row.className = 'feed-comment';
      var who = document.createElement('b');
      who.textContent = c.author.name;
      row.appendChild(who);
      if (c.replyTo) {
        row.appendChild(document.createTextNode(' 回复 '));
        var to = document.createElement('b');
        to.textContent = c.replyTo.name;
        row.appendChild(to);
      }
      row.appendChild(document.createTextNode('：' + c.text));
      // 点别人的评论 → 回复 TA
      row.addEventListener('click', function() {
        if (!sameAuthor(c.author, me)) openFeedComment(post, c.author);
      });
      box.appendChild(row);
    });
    el.appendChild(box);
  }
  return el;
}

// 点击横幅卡片更换背景
document.getElementById('feedBannerCard').addEventListener('click', function() {
  openImgPicker(function(src) {
    mphoneStore.save('mphone_feed_cover', src);
    renderFeed();
  });
});

// ---------- 菜单（仅在动态页显示） ----------
document.querySelectorAll('.chat-tab-item').forEach(function(tab) {
  tab.addEventListener('click', function() {
    var isFeed = this.dataset.tab === 'feed';
    feedMoreBtn.classList.toggle('visible', isFeed);
    if (!isFeed) { feedPopup.classList.remove('open'); closeFeedComment(); }
    else renderFeed();
  });
});
dockChat.addEventListener('click', function() {
  feedMoreBtn.classList.remove('visible');
  feedPopup.classList.remove('open');
});
feedMoreBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  feedPopup.classList.toggle('open');
});
document.addEventListener('click', function(e) {
  if (!feedPopup.contains(e.target) && e.target !== feedMoreBtn) feedPopup.classList.remove('open');
});

// ---------- 发动态 ----------
function renderComposeImgs() {
  feedComposeImgs.querySelectorAll('.feed-compose-thumb').forEach(function(t) { t.remove(); });
  feedComposeImages.forEach(function(src, i) {
    var t = document.createElement('div');
    t.className = 'feed-compose-thumb';
    t.style.backgroundImage = 'url(' + src + ')';
    var x = document.createElement('button');
    x.textContent = '×';
    x.addEventListener('click', function() { feedComposeImages.splice(i, 1); renderComposeImgs(); });
    t.appendChild(x);
    feedComposeImgs.insertBefore(t, feedComposeImgAdd);
  });
  feedComposeImgAdd.style.display = feedComposeImages.length >= 9 ? 'none' : '';
}

document.getElementById('feedBtnPost').addEventListener('click', function(e) {
  e.stopPropagation();
  feedPopup.classList.remove('open');
  feedComposeText.value = '';
  feedComposeImages = [];
  renderComposeImgs();
  // 谁可以看：默认全部角色
  feedVisibleList.innerHTML = '';
  charList.forEach(function(char) {
    var chip = document.createElement('span');
    chip.className = 'feed-visible-chip on';
    chip.dataset.id = char.id;
    chip.textContent = char.charAlias || char.charName || '未命名';
    chip.addEventListener('click', function() { this.classList.toggle('on'); });
    feedVisibleList.appendChild(chip);
  });
  feedComposeOverlay.classList.add('open');
});

feedComposeImgAdd.addEventListener('click', function() {
  openImgPicker(function(src) { feedComposeImages.push(src); renderComposeImgs(); });
});
document.getElementById('feedComposeCancel').addEventListener('click', function() {
  feedComposeOverlay.classList.remove('open');
});
feedComposeOverlay.addEventListener('click', function(e) {
  if (e.target === feedComposeOverlay) feedComposeOverlay.classList.remove('open');
});
document.getElementById('feedComposeSend').addEventListener('click', function() {
  var text = feedComposeText.value.trim();
  if (!text && !feedComposeImages.length) { shakeEl(feedComposeText); return; }
  feedPosts.unshift({
    id: genFeedId('p'),
    author: getMineAccount(),
    text: text,
    images: feedComposeImages.slice(),
    time: Date.now(),
    visibleTo: Array.from(feedVisibleList.querySelectorAll('.feed-visible-chip.on')).map(function(c) { return c.dataset.id; }),
    likes: [],
    comments: []
  });
  saveFeed();
  renderFeed();
  feedComposeOverlay.classList.remove('open');
});

// ---------- 让角色发动态 ----------
document.getElementById('feedBtnCharPost').addEventListener('click', function(e) {
  e.stopPropagation();
  feedPopup.classList.remove('open');
  feedCharPickList.innerHTML = '';
  charList.forEach(function(char, idx) {
    var item = document.createElement('div');
    item.className = 'mine-acc-item';
    var av = document.createElement('div');
    av.className = 'mine-acc-item-av';
    if (char.charAvatar) av.style.backgroundImage = 'url(' + char.charAvatar + ')';
    var info = document.createElement('div');
    info.className = 'mine-acc-item-info';
    var nm = document.createElement('div');
    nm.className = 'mine-acc-item-name';
    nm.textContent = char.charAlias || char.charName || '未命名';
    info.appendChild(nm);
    item.appendChild(av);
    item.appendChild(info);
    item.addEventListener('click', function() {
      feedCharPickOverlay.classList.remove('open');
      showToast('「' + nm.textContent + '」正在编辑动态…', 'success');
      generateCharPost(idx).catch(function(err) { showToast('✗ ' + err.message, 'error'); });
    });
    feedCharPickList.appendChild(item);
  });
  feedCharPickOverlay.classList.add('open');
});
document.getElementById('feedCharPickCancel').addEventListener('click', function() {
  feedCharPickOverlay.classList.remove('open');
});
feedCharPickOverlay.addEventListener('click', function(e) {
  if (e.target === feedCharPickOverlay) feedCharPickOverlay.classList.remove('open');
});

// ---------- 评论 ----------
function openFeedComment(post, replyTo) {
  feedCommentTarget = { post: post, replyTo: replyTo };
  feedCommentInput.value = '';
  feedCommentInput.placeholder = replyTo ? '回复 ' + replyTo.name + '…' : '评论…';
  feedCommentBar.classList.add('open');
  feedCommentInput.focus();
}
function closeFeedComment() {
  feedCommentBar.classList.remove('open');
  feedCommentTarget = null;
}
function sendFeedComment() {
  var text = feedCommentInput.value.trim();
  if (!text) { shakeEl(feedCommentInput); return; }
  if (!feedCommentTarget) return;
  feedCommentTarget.post.comments.push({
    id: genFeedId('c'), author: getMineAccount(), text: text, time: Date.now(),
    replyTo: feedCommentTarget.replyTo
  });
  saveFeed();
  closeFeedComment();
  renderFeed();
}
document.getElementById('feedCommentSend').addEventListener('click', sendFeedComment);
feedCommentInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); sendFeedComment(); }
  if (e.key === 'Escape') closeFeedComment();
});

// ---------- AI 调用（非流式，返回完整文本） ----------
function callApiOnce(messages) {
  var cfg = getApiCfg();
  if (!cfg.url || !cfg.key || !cfg.model) return Promise.reject(new Error('请先在设置中配置 API 和模型'));
  return resolveMediaParts(messages).then(function(ms) {
    return fetch(cfg.url.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, messages: ms, temperature: cfg.temp, stream: false })
    });
  }).then(function(res) {
    return res.text().then(function(t) {
      var d = null;
      try { d = JSON.parse(t); } catch (_) {}
      if (!res.ok) throw new Error((d && d.error && d.error.message) || ('请求失败 ' + res.status));
      var content = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if (!content) throw new Error('未收到回复内容');
      return String(content).trim();
    });
  });
}

function nowText() {
  var d = new Date();
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEKDAYS[d.getDay()] + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// 角色上下文：人设 + 预设 + 世界书 + 记忆总结 + 注意力范围内的聊天
function charContextMsgs(idx) {
  return buildMsgs(idx, getChatHistory(idx));
}

function stripQuotes(s) {
  return s.replace(/^["“「『]+|["”」』]+$/g, '').trim();
}

function generateCharPost(idx) {
  var char = charList[idx];
  if (!char) return Promise.reject(new Error('角色不存在'));
  var msgs = charContextMsgs(idx).concat([{
    role: 'system',
    content: '【发动态】现在是 ' + nowText() + '。请你以「' + charAuthor(char).name + '」的身份，发一条朋友圈 / 微博式的个人动态。' +
             '内容可以和最近的聊天、生活、心情相关，口吻自然，符合人设，一般不超过 100 字。只输出动态正文，不要加引号、标题或任何说明。'
  }]);
  return callApiOnce(msgs).then(function(text) {
    feedPosts.unshift({
      id: genFeedId('p'), author: charAuthor(char), text: stripQuotes(text), images: [],
      time: Date.now(), likes: [], comments: []
    });
    saveFeed();
    renderFeed();
    showToast('「' + charAuthor(char).name + '」发布了新动态', 'success');
  });
}

// 动态的文字版，供角色阅读
function feedPostAsText(post) {
  var lines = ['发布者：' + post.author.name + (post.author.type === 'user' ? '（用户）' : ''),
               '内容：' + (post.text || '') + (post.images && post.images.length ? '（附图 ' + post.images.length + ' 张）' : '')];
  if (post.likes.length) lines.push('点赞：' + post.likes.map(function(a) { return a.name; }).join('，'));
  if (post.comments.length) {
    lines.push('评论区：');
    post.comments.forEach(function(c) {
      lines.push('- ' + c.author.name + (c.replyTo ? ' 回复 ' + c.replyTo.name : '') + '：' + c.text);
    });
  }
  return lines.join('\n');
}

// 解析角色返回的 { like, comment }，容错处理多余文字
function parseInteraction(text) {
  var m = text.match(/\{[\s\S]*\}/);
  if (m) { try { var o = JSON.parse(m[0]); return { like: !!o.like, comment: String(o.comment || '').trim() }; } catch (_) {} }
  return { like: false, comment: stripQuotes(text) };
}

// 角色是否需要回应：没评论过，或者用户在 TA 上次发言后又回复了 TA
function charNeedsToRespond(post, author) {
  var lastMine = -1, lastToMe = -1;
  post.comments.forEach(function(c, i) {
    if (sameAuthor(c.author, author)) lastMine = i;
    if (c.author.type === 'user' && (sameAuthor(c.replyTo, author) || (!c.replyTo && sameAuthor(post.author, author)))) lastToMe = i;
  });
  return lastMine === -1 || lastToMe > lastMine;
}

function charInteract(post, idx) {
  var char = charList[idx];
  var me = charAuthor(char);
  var isOwn = sameAuthor(post.author, me);
  // 动态配图：开启识图时把真实图片发给角色看
  var imgMsg = (mediaCfg.vision && post.images && post.images.length)
    ? [{ role: 'user', content: [{ type: 'text', text: '（这是这条动态附带的图片）' }].concat(
        post.images.map(function(src) { return { type: 'image_url', image_url: { url: src } }; })) }]
    : [];
  var msgs = charContextMsgs(idx).concat(imgMsg, [{
    role: 'system',
    content: '【动态互动】现在是 ' + nowText() + '。你（' + me.name + '）在刷动态时看到了' + (isOwn ? '自己发的' : '下面这条') + '动态：\n\n' +
             feedPostAsText(post) + '\n\n' +
             '请以角色身份决定是否点赞，并写一条简短评论；如果评论区里有人回复了你或评论了你的动态，就回复对方。' +
             '只输出 JSON：{"like": true 或 false, "comment": "评论内容"}，不想评论时 comment 为空字符串。'
  }]);
  return callApiOnce(msgs).then(function(text) {
    var r = parseInteraction(text);
    if (r.like && !isOwn && !post.likes.some(function(a) { return sameAuthor(a, me); })) post.likes.push(me);
    if (r.comment) {
      // 回复对象：最近一条 @ 自己或评论自己动态的用户评论
      var replyTo = null;
      for (var i = post.comments.length - 1; i >= 0; i--) {
        var c = post.comments[i];
        if (c.author.type === 'user' && (sameAuthor(c.replyTo, me) || (isOwn && !c.replyTo))) { replyTo = c.author; break; }
      }
      post.comments.push({ id: genFeedId('c'), author: me, text: r.comment, time: Date.now(), replyTo: replyTo });
    }
  });
}

// ❄️：用户动态 → 可见角色依次互动；角色动态 → 作者回复评论（其他角色也可能来互动）
function requestFeedInteraction(post) {
  if (post._busy) return;
  var targets = [];
  charList.forEach(function(char, idx) {
    var me = charAuthor(char);
    var canSee = post.author.type === 'user' ? (post.visibleTo || []).indexOf(char.id) >= 0 : true;
    if (canSee && charNeedsToRespond(post, me)) targets.push(idx);
  });
  if (!targets.length) { showToast('暂时没有需要回应的角色', 'success'); return; }
  post._busy = true;
  renderFeed();
  var chain = Promise.resolve();
  var errors = 0;
  targets.forEach(function(idx) {
    chain = chain.then(function() {
      return charInteract(post, idx).catch(function(err) { errors++; console.warn('[Mphone] 动态互动失败:', err); });
    });
  });
  chain.then(function() {
    delete post._busy;
    saveFeed();
    renderFeed();
    if (errors) showToast('✗ 有 ' + errors + ' 个角色互动失败', 'error');
  });
}

// ---------- 自主活动 ----------
var DEFAULT_AUTO = { msgOn: false, mode: 'random', fixedMin: 60, randMin: 30, randMax: 180, postOn: false, postChance: 30 };
var autoCard = document.querySelector('.auto-card');

function setAutoForm(a) {
  a = Object.assign({}, DEFAULT_AUTO, a || {});
  document.getElementById('autoMsgOn').checked  = a.msgOn;
  document.getElementById('autoPostOn').checked = a.postOn;
  document.getElementById('autoFixedMin').value = a.fixedMin;
  document.getElementById('autoRandMin').value  = a.randMin;
  document.getElementById('autoRandMax').value  = a.randMax;
  document.getElementById('autoPostChance').value = a.postChance;
  document.querySelectorAll('#autoModeRow .pf-radio-btn').forEach(function(b) {
    b.classList.toggle('selected', b.dataset.mode === a.mode);
  });
  syncAutoFormUI();
}

function readAutoForm() {
  var num = function(id, def, min, max) {
    var v = parseInt(document.getElementById(id).value, 10);
    if (isNaN(v)) v = def;
    return Math.max(min, Math.min(max, v));
  };
  var modeBtn = document.querySelector('#autoModeRow .pf-radio-btn.selected');
  var rMin = num('autoRandMin', 30, 1, 10080), rMax = num('autoRandMax', 180, 1, 10080);
  return {
    msgOn:      document.getElementById('autoMsgOn').checked,
    mode:       modeBtn ? modeBtn.dataset.mode : 'random',
    fixedMin:   num('autoFixedMin', 60, 1, 10080),
    randMin:    Math.min(rMin, rMax),
    randMax:    Math.max(rMin, rMax),
    postOn:     document.getElementById('autoPostOn').checked,
    postChance: num('autoPostChance', 30, 0, 100)
  };
}

function syncAutoFormUI() {
  document.getElementById('autoMsgSub').classList.toggle('open', document.getElementById('autoMsgOn').checked);
  document.getElementById('autoPostSub').classList.toggle('open', document.getElementById('autoPostOn').checked);
  var modeBtn = document.querySelector('#autoModeRow .pf-radio-btn.selected');
  autoCard.classList.toggle('mode-fixed', !!modeBtn && modeBtn.dataset.mode === 'fixed');
}

document.getElementById('autoMsgOn').addEventListener('change', syncAutoFormUI);
document.getElementById('autoPostOn').addEventListener('change', syncAutoFormUI);
document.querySelectorAll('#autoModeRow .pf-radio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('#autoModeRow .pf-radio-btn').forEach(function(b) { b.classList.remove('selected'); });
    this.classList.add('selected');
    syncAutoFormUI();
  });
});

// 聊天回复后按概率发动态
function maybeAutoPostAfterChat(idx) {
  var char = charList[idx];
  if (!char || !char.auto || !char.auto.postOn) return;
  if (Math.random() * 100 >= char.auto.postChance) return;
  if (char._autoBusy) return;
  char._autoBusy = true;
  generateCharPost(idx)
    .catch(function(err) { console.warn('[Mphone] 自动发动态失败:', err); })
    .then(function() { delete char._autoBusy; });
}

// 主动发消息：写入聊天记录；正在看这个聊天就直接显示，否则计未读
function autoSendMessage(idx) {
  var char = charList[idx];
  var hist = getChatHistory(idx);
  var last = hist[hist.length - 1];
  var gap = '';
  // 优先用最后一条消息的时间（旧记录没有时间时退回本次打开后的记录）
  var lastAt = (last && last.time) || char._lastChatAt;
  if (lastAt) {
    var mins = Math.round((Date.now() - lastAt) / 60000);
    gap = '距离你们上次聊天大约过去了 ' + (mins >= 60 ? Math.round(mins / 60) + ' 小时' : mins + ' 分钟') + '。';
  }
  var msgs = charContextMsgs(idx).concat([{
    role: 'system',
    content: '【主动消息】现在是 ' + nowText() + '。' + gap + '请你以「' + charAuthor(char).name + '」的身份主动给对方发一条消息，' +
             '可以是分享日常、想念、追问之前的话题等，自然简短，符合人设与当前关系' + (last && last.role === 'assistant' ? '（对方还没回复你上一条消息）' : '') + '。只输出消息内容本身。'
  }]).concat(chatFormatRules(char));
  return callApiOnce(msgs).then(function(text) {
    text = stripQuotes(text);
    var viewing = appChatRoom.classList.contains('active') && openingChatCharIdx === idx;
    var showNow = viewing && currentCrSubView === 'chat';
    var added = commitAssistantReply(hist, text,
      showNow ? document.getElementById('chatMsgList') : null,
      showNow ? document.getElementById('chatRoomEmpty') : null);
    saveHistories();
    // 主动发来消息的角色出现在消息列表
    if (!char.inChat) { char.inChat = true; saveCharList(); }
    if (!viewing) {
      chatUnread[char.id] = (chatUnread[char.id] || 0) + added.length;
      mphoneStore.save('mphone_unread', chatUnread);
      showToast('「' + charAuthor(char).name + '」给你发来一条消息', 'success');
    }
    renderChatCharList();
  });
}

// 调度：每个角色记录下次活动时间 { 角色 id: { at, sig } }，设置变化时重新排期
var autoNext = mphoneStore.load('mphone_auto_next', {});

function autoSig(a) { return JSON.stringify([a.msgOn, a.mode, a.fixedMin, a.randMin, a.randMax, a.postOn]); }
function autoDelay(a) {
  var mins = a.mode === 'fixed' ? a.fixedMin : a.randMin + Math.random() * (a.randMax - a.randMin);
  return mins * 60000;
}

function autoTick() {
  var now = Date.now();
  var changed = false;
  charList.forEach(function(char, idx) {
    var a = char.auto;
    if (!a || !(a.msgOn || a.postOn)) {
      if (autoNext[char.id]) { delete autoNext[char.id]; changed = true; }
      return;
    }
    // 只开了「发动态」时，定时发动态的间隔沿用随机 / 固定设置
    var sig = autoSig(a);
    var plan = autoNext[char.id];
    if (!plan || plan.sig !== sig) {
      autoNext[char.id] = { at: now + autoDelay(a), sig: sig };
      changed = true;
      return;
    }
    if (now < plan.at || char._autoBusy) return;

    // 到点：只执行一次（关闭页面期间错过的不补发多次），然后重新排期
    autoNext[char.id] = { at: now + autoDelay(a), sig: sig };
    changed = true;
    var doPost = a.postOn && (!a.msgOn || Math.random() < 0.3);
    char._autoBusy = true;
    (doPost ? generateCharPost(idx) : autoSendMessage(idx))
      .catch(function(err) { console.warn('[Mphone] 自主活动失败:', err); })
      .then(function() { delete char._autoBusy; });
  });
  // 清理已删除角色
  Object.keys(autoNext).forEach(function(id) {
    if (findCharIdx(id) < 0) { delete autoNext[id]; changed = true; }
  });
  if (changed) mphoneStore.save('mphone_auto_next', autoNext);
}

// 记录最近一次聊天时间，供主动消息参考
document.getElementById('crInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey && charList[openingChatCharIdx]) charList[openingChatCharIdx]._lastChatAt = Date.now();
});

// 动态里的收藏状态要用到后面脚本的函数，等全部加载完再画
onMphoneReady(function() {
  renderFeed();
  setTimeout(autoTick, 5000);
});
setInterval(autoTick, 30000);
