// 眠花糖机 — 动态（朋友圈）：发动态、文字图、点赞评论、让角色发动态和互动、社交圈

// =============================================
// 动态（朋友圈）+ 角色自主活动
// =============================================
// 动态数据：[{ id, author: { type: 'user' | 'char', id, name, avatar }, text, images: [], textImgs: [文字图描述], time,
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
var feedComposeTextImgs = [];   // 文字图：用一段文字描述画面，显示成一张图片卡
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

// ---------- 文字图 ----------
// 动态里的方形卡片；点开时画成一张真正的图片，可以全屏看、保存、收藏
function createTextImgEl(text) {
  var el = document.createElement('div');
  el.className = 'feed-textimg';
  var span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);
  el.addEventListener('click', function(e) {
    e.stopPropagation();
    if (typeof openImgViewer === 'function') openImgViewer(textImgDataUrl(text), { source: '动态' });
  });
  return el;
}
function textImgDataUrl(text) {
  var size = 1080, pad = 130, fontSize = 52, lineH = fontSize * 1.6;
  var c = document.createElement('canvas');
  c.width = c.height = size;
  var ctx = c.getContext('2d');
  var g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#fde7ea');
  g.addColorStop(1, '#f3e6f5');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.font = fontSize + 'px "PingFang SC", "Microsoft YaHei", sans-serif';
  // 按宽度逐字换行（中文没有空格，按字符切）
  var lines = [];
  String(text).split('\n').forEach(function(para) {
    var line = '';
    Array.from(para).forEach(function(ch) {
      if (ctx.measureText(line + ch).width > size - pad * 2 && line) { lines.push(line); line = ch; }
      else line += ch;
    });
    lines.push(line);
  });
  var maxLines = Math.floor((size - pad * 2) / lineH);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'; }
  ctx.fillStyle = '#7a5a66';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  var top = size / 2 - (lines.length - 1) * lineH / 2;
  lines.forEach(function(l, i) { ctx.fillText(l, size / 2, top + i * lineH); });
  return c.toDataURL('image/png');
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
  if (avatar) { av.style.backgroundImage = 'url(' + avatar + ')'; av.classList.add('avatar-img'); }
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
    openConfirm('删除这条动态？', function() {
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
  if ((post.images && post.images.length) || (post.textImgs && post.textImgs.length)) {
    var imgs = document.createElement('div');
    imgs.className = 'feed-post-imgs';
    (post.images || []).forEach(function(src) {
      var img = document.createElement('img');
      img.src = src;
      imgs.appendChild(img);
    });
    (post.textImgs || []).forEach(function(t) { imgs.appendChild(createTextImgEl(t)); });
    el.appendChild(imgs);
  }

  // 操作：收藏 / 点赞 / 评论（角色会过一会儿自己来回应，见 feedScheduleReply）
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
  var favBtn = document.createElement('button');
  var faved = isFavRef(post.id);
  favBtn.className = 'feed-act-btn' + (faved ? ' liked' : '');
  favBtn.textContent = faved ? '★ 已收藏' : '☆ 收藏';
  favBtn.addEventListener('click', function() { toggleFavPost(post); renderFeed(); });
  actions.appendChild(favBtn);
  actions.appendChild(likeBtn);
  actions.appendChild(cmtBtn);
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
  function thumb(list, i) {
    var t = document.createElement('div');
    t.className = 'feed-compose-thumb';
    var x = document.createElement('button');
    x.textContent = '×';
    x.addEventListener('click', function() { list.splice(i, 1); renderComposeImgs(); });
    t.appendChild(x);
    feedComposeImgs.insertBefore(t, feedComposeImgAdd);
    return t;
  }
  feedComposeImages.forEach(function(src, i) { thumb(feedComposeImages, i).style.backgroundImage = 'url(' + src + ')'; });
  feedComposeTextImgs.forEach(function(text, i) {
    var t = thumb(feedComposeTextImgs, i);
    t.classList.add('textimg');
    var span = document.createElement('span');
    span.textContent = text;
    t.insertBefore(span, t.firstChild);
  });
  // 图片和文字图合计最多 9 张
  var full = feedComposeImages.length + feedComposeTextImgs.length >= 9;
  feedComposeImgAdd.style.display = full ? 'none' : '';
  feedComposeTextImgAdd.style.display = full ? 'none' : '';
}
var feedComposeTextImgAdd = document.getElementById('feedComposeTextImgAdd');
var feedTextImgRow = document.getElementById('feedTextImgRow');
var feedTextImgInput = document.getElementById('feedTextImgInput');
feedComposeTextImgAdd.addEventListener('click', function() {
  feedTextImgRow.classList.toggle('open');
  if (feedTextImgRow.classList.contains('open')) feedTextImgInput.focus();
});
document.getElementById('feedTextImgOk').addEventListener('click', function() {
  var text = feedTextImgInput.value.trim();
  if (!text) { shakeEl(feedTextImgInput); return; }
  feedComposeTextImgs.push(text);
  feedTextImgInput.value = '';
  feedTextImgRow.classList.remove('open');
  renderComposeImgs();
});

document.getElementById('feedBtnPost').addEventListener('click', function(e) {
  e.stopPropagation();
  feedPopup.classList.remove('open');
  feedComposeText.value = '';
  feedComposeImages = [];
  feedComposeTextImgs = [];
  feedTextImgInput.value = '';
  feedTextImgRow.classList.remove('open');
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
closeOnBackdrop(feedComposeOverlay);
document.getElementById('feedComposeSend').addEventListener('click', function() {
  var text = feedComposeText.value.trim();
  if (!text && !feedComposeImages.length && !feedComposeTextImgs.length) { shakeEl(feedComposeText); return; }
  feedPosts.unshift({
    id: genFeedId('p'),
    author: getMineAccount(),
    text: text,
    images: feedComposeImages.slice(),
    textImgs: feedComposeTextImgs.slice(),
    time: Date.now(),
    visibleTo: Array.from(feedVisibleList.querySelectorAll('.feed-visible-chip.on')).map(function(c) { return c.dataset.id; }),
    likes: [],
    comments: []
  });
  feedScheduleReply(feedPosts[0], 40, 240);   // 能看到的角色过一会儿来点赞、评论
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
closeOnBackdrop(feedCharPickOverlay);

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
  feedScheduleReply(feedCommentTarget.post, 30, 180);   // 被你评论 / 回复的角色过一会儿来回你
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
// char：用这个角色自己的模型（便捷拓展栏选过模型预设时），和 TA 聊天用的是同一个
function callApiOnce(messages, char, signal) {
  // 按接口类型自动适配（见 js/core/llm.js）；signal 可以中途停掉（主动消息被 ⏹ 打断时用）
  return llmRequest(messages, { stream: false, cfg: char ? getApiCfg(char) : undefined, signal: signal }).then(function(text) {
    text = typeof takeThink === 'function' ? takeThink(text).text : String(text || '');
    if (!text) throw new Error('未收到回复内容');
    return String(text).trim();
  });
}

// 现在的时间；传角色时按 TA 所在的时区
function nowText(char) {
  return charNowText(char);
}

// 角色上下文：人设 + 预设 + 世界书 + 记忆总结 + 注意力范围内的聊天
function charContextMsgs(idx) {
  return buildMsgs(idx, getChatHistory(idx));
}

function stripQuotes(s) {
  return s.replace(/^["“「『]+|["”」』]+$/g, '').trim();
}

// 这个角色最近发过的动态（新的在前）：发新动态、写评论时给 TA 看，免得每次都一样（用户反馈过动态和评论全是重复的）
function charRecentPosts(char, n) {
  var me = charAuthor(char);
  return feedPosts.filter(function(p) { return p.author && p.author.type === me.type && p.author.id === me.id; }).slice(0, n || 6);
}
var FEED_ANGLES = ['今天吃到 / 喝到的东西', '路上看到的一个小画面', '工作或学习里的一件小事', '天气和季节', '突然想起的一件旧事', '最近在听的歌、在看的书或剧', '一点说不清的小情绪', '身边的朋友或家人', '一个小小的计划或愿望', '和 {{user}} 有关、但不直说的一句话', '一句自言自语的吐槽', '睡前或刚醒时的念头'];
function generateCharPost(idx) {
  var char = charList[idx];
  if (!char) return Promise.reject(new Error('角色不存在'));
  var recent = charRecentPosts(char, 6).map(function(p) { return '· ' + fmtAgo(p.time) + '：' + String(p.text || '').slice(0, 80); });
  var angle = FEED_ANGLES[Math.floor(Math.random() * FEED_ANGLES.length)];
  var msgs = charContextMsgs(idx).concat([activityAsk(
    '【发动态】现在是 ' + nowText(char) + '。请你以「' + charAuthor(char).name + '」的身份，发一条朋友圈式的个人动态。' +
    (recent.length ? '你最近已经发过这些动态：\n' + recent.join('\n') + '\n这次要发一条新的：换一个话题、换一种说法，不要重复或改写上面任何一条，也不要和它们用一样的开头、句式和配图。' : '') +
    '这次可以从「' + angle + '」这个角度想想（只是给你一点灵感，不合适就按你自己的生活来）。' +
    '像真人发朋友圈：内容可以和最近的聊天、生活、心情相关；一两句到几小句，口语，可以分行，一般不超过 100 字；不写动作描写和 *星号*，不加 # 话题标签。' +
    '想配图的话，在正文后面用 <文字图>画面描述</文字图> 附上 1～3 张「文字图」（用一两句话描述照片里的画面，比如：窗外的晚霞，橘粉色的云）；不配图也可以。'
  )]);
  return callApiOnce(msgs, char).then(function(text) {
    text = memExtractTags(char, text).replace(/\*[^*\n]+\*/g, '').replace(/#[^#\s]{1,20}#?/g, '').replace(/[ \t]{2,}/g, ' ');   // TA 顺手记下的记忆；动作描写、# 话题标签去掉
    var textImgs = [];
    text = text.replace(/<文字图>([\s\S]*?)<\/文字图>/g, function(_, t) { if (t.trim()) textImgs.push(t.trim()); return ''; });
    feedPosts.unshift({
      id: genFeedId('p'), author: charAuthor(char), text: stripQuotes(text.trim()), images: [], textImgs: textImgs.slice(0, 9),
      time: Date.now(), likes: [], comments: []
    });
    saveFeed();
    renderFeed();
    showToast('「' + charAuthor(char).name + '」发布了新动态', 'plain');
    if (typeof renderMoments === 'function') renderMoments();   // 「此刻」那排圆圈亮一圈
    memLogFeed(char, '我在动态里发了：' + feedPosts[0].text.slice(0, 80));
    if (typeof notifyFeedPost === 'function') notifyFeedPost(char, feedPosts[0]);
    var post = feedPosts[0];
    if (typeof feedGenImages === 'function') feedGenImages(post);
    charNpcComments(post, idx).catch(function(err) { console.warn('[Mphone] NPC 评论失败:', err); });
  });
}

// ---------- 角色生活里的人（NPC）来评论 ----------
// 角色发了动态后，TA 现实生活里的朋友、同事、同学、家人……来评论：1～4 个人，每人 1～3 句；
// TA 看心情回复全部、一部分，或者都不回。这些人只存名字，作者是 { type: 'npc', id, name, ownerId: 角色 id }，
// 只有这个角色本人认识（knowsAuthor），出现过的名字记在 char.feedNpcs，下次还可能是这些人
function npcAuthor(char, name) {
  return { type: 'npc', id: 'npc:' + char.id + ':' + name, name: name, ownerId: char.id };
}
function charNpcComments(post, idx) {
  var char = charList[idx];
  if (!char) return Promise.resolve();
  var me = charAuthor(char);
  var others = charList.filter(function(c) { return c !== char; }).map(function(c) { return c.charAlias || c.charName; }).filter(Boolean);
  var known = (char.feedNpcs || []).slice(-12);
  var pastComments = [];
  charRecentPosts(char, 5).forEach(function(p) {
    if (p === post) return;
    (p.comments || []).slice(0, 4).forEach(function(c) { if (c.author && c.author.type === 'npc') pastComments.push('· ' + c.author.name + '：' + String(c.text || '').slice(0, 40)); });
  });
  pastComments = pastComments.slice(0, 12);
  var msgs = charContextMsgs(idx).concat([activityAsk(
    '【动态评论区】你刚发了一条动态：\n「' + post.text + '」' + ((post.textImgs || []).length ? '（配图：' + post.textImgs.join('；') + '）' : '') + '\n' +
    '现在你现实生活里的人来评论了：按你的人设和生活安排 1～4 个人（朋友、同事、同学、家人、网友……），名字和称呼要像真人，' +
    '不要是{{user}}' + (others.length ? '，也不要是 ' + others.join('、') : '') + '。' +
    (known.length ? '以前在你动态下出现过的人：' + known.join('、') + '，可以还是他们，也可以有新的人。' : '') +
    (pastComments.length ? '你之前几条动态下面已经有过这些评论：\n' + pastComments.join('\n') + '\n这次的评论要针对这条动态的具体内容，不要重复或改写上面的话，换不同的人、不同的说法。' : '') +
    '每人说 1～3 句，口语，像朋友圈评论那样各有各的语气，可以互相接话、打趣。' +
    '然后你看心情回复：可以都回、只回一部分，也可以一个都不回；回复一到三句，还是你平时的口吻。都不写动作描写和 *星号*。' +
    '只输出 JSON：{"comments": [{"name": "名字", "text": "评论"}], "replies": [{"to": "回复谁的名字", "text": "你的回复"}]}，不回复时 replies 为空数组。'
  )]);
  return callApiOnce(msgs, char).then(function(text) {
    var m = String(text).match(/\{[\s\S]*\}/);
    if (!m) return;
    var o; try { o = JSON.parse(m[0]); } catch (_) { return; }
    var clean = function(s) { return String(s || '').replace(/\*[^*\n]+\*/g, '').replace(/[ \t]{2,}/g, ' ').trim(); };
    var t = Date.now(), names = {};
    (Array.isArray(o.comments) ? o.comments : []).slice(0, 4).forEach(function(c) {
      var name = clean(c && c.name).slice(0, 12), txt = clean(c && c.text);
      if (!name || !txt || name === me.name) return;
      var a = npcAuthor(char, name);
      names[name] = a;
      post.comments.push({ id: genFeedId('c'), author: a, text: txt, time: t += 1000 });
    });
    (Array.isArray(o.replies) ? o.replies : []).forEach(function(r) {
      var to = names[clean(r && r.to)], txt = clean(r && r.text);
      if (!to || !txt) return;
      post.comments.push({ id: genFeedId('c'), author: me, text: txt, time: t += 1000, replyTo: to });
    });
    var got = Object.keys(names);
    if (got.length) {
      char.feedNpcs = (char.feedNpcs || []).filter(function(n) { return got.indexOf(n) < 0; }).concat(got).slice(-30);
      saveCharList();
    }
    saveFeed();
    renderFeed();
  });
}

// ---------- 社交圈 ----------
// 角色之间互相认识（角色设置 → 社交圈）才能看到彼此的动态、点赞和评论；用户和所有角色都认识
function knowsAuthor(char, author) {
  if (!author) return false;
  if (author.type === 'npc') return author.ownerId === char.id;   // 角色生活里的人：只有 TA 本人认识
  if (author.type === 'user' || author.id === char.id) return true;
  return (char.circle || []).indexOf(author.id) >= 0;
}
// 用户的动态看「谁可以看」，角色的动态要认识发布者
function charCanSeePost(char, post) {
  if (post.author.type === 'user') return (post.visibleTo || []).indexOf(char.id) >= 0;
  return knowsAuthor(char, post.author);
}

// 动态的文字版，供角色阅读（viewer：读的角色，只显示 TA 认识的人的点赞和评论）
function feedPostAsText(post, viewer) {
  var known = function(a) { return !viewer || knowsAuthor(viewer, a); };
  var lines = ['发布者：' + post.author.name + (post.author.type === 'user' ? '（用户）' : ''),
               '内容：' + (post.text || '') + (post.images && post.images.length ? '（附图 ' + post.images.length + ' 张）' : '') +
               (post.textImgs || []).map(function(t) { return '（配图：' + t + '）'; }).join('')];
  var likes = post.likes.filter(known);
  if (likes.length) lines.push('点赞：' + likes.map(function(a) { return a.name; }).join('，'));
  var comments = post.comments.filter(function(c) { return known(c.author); });
  if (comments.length) {
    lines.push('评论区：');
    comments.forEach(function(c) {
      var to = c.replyTo ? ' 回复 ' + (known(c.replyTo) ? c.replyTo.name : '某人') : '';
      lines.push('- ' + c.author.name + to + '：' + c.text);
    });
  }
  return lines.join('\n');
}

// 聊天时告诉角色：TA 认识谁，以及社交圈里最近的动态
var FEED_CONTEXT_MAX = 6;
function feedContextFor(char) {
  if (!char || !char.id) return '';
  var friends = charList.filter(function(c) { return c !== char && (char.circle || []).indexOf(c.id) >= 0; })
    .map(function(c) { return c.charAlias || c.charName; }).filter(Boolean);
  var posts = feedPosts.filter(function(p) { return charCanSeePost(char, p); }).slice(0, FEED_CONTEXT_MAX);
  var out = '【社交圈】除了用户，你认识的其他角色：' + (friends.join('、') || '没有') + '。其他角色你都不认识，也看不到他们的动态。';
  if (posts.length) {
    out += '\n你能看到的最近动态（从新到旧）：\n' + posts.map(function(p) {
      return '[' + feedTimeText(p.time) + '] ' + feedPostAsText(p, char).replace(/\n/g, '\n  ');
    }).join('\n') + '\n聊天时可以自然地提到这些动态，但不必每次都提。';
  }
  return out;
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
  var msgs = charContextMsgs(idx).concat(imgMsg, [activityAsk(
    '【动态互动】现在是 ' + nowText(char) + '。你（' + me.name + '）在刷动态时看到了' + (isOwn ? '自己发的' : '下面这条') + '动态：\n\n' +
    feedPostAsText(post, char) + '\n\n' +
    '请以角色身份决定是否点赞，并写一条评论；如果评论区里有人回复了你或评论了你的动态，就回复对方。' +
    '评论像真人在朋友圈下面回复：口语，一到三句，不写动作描写和 *星号*。' +
    '只输出 JSON：{"like": true 或 false, "comment": "评论内容"}，不想评论时 comment 为空字符串。'
  )]);
  return callApiOnce(msgs, char).then(function(text) {
    var r = parseInteraction(memExtractTags(char, text));
    r.comment = r.comment.replace(/\*[^*\n]+\*/g, '').replace(/[ \t]{2,}/g, ' ').trim();
    if (r.like && !isOwn && !post.likes.some(function(a) { return sameAuthor(a, me); })) post.likes.push(me);
    if (r.comment) {
      // 回复对象：最近一条 @ 自己或评论自己动态的用户评论
      var replyTo = null;
      for (var i = post.comments.length - 1; i >= 0; i--) {
        var c = post.comments[i];
        if (c.author.type === 'user' && (sameAuthor(c.replyTo, me) || (isOwn && !c.replyTo))) { replyTo = c.author; break; }
      }
      post.comments.push({ id: genFeedId('c'), author: me, text: r.comment, time: Date.now(), replyTo: replyTo });
      memLogFeed(char, (isOwn ? '我在自己的动态下回复：' : '我在 ' + post.author.name + ' 的动态下评论：') + r.comment.slice(0, 80));
    }
  });
}

// 到点了：用户动态 → 可见角色依次互动；角色动态 → 作者回复评论（其他角色也可能来互动）
// ---------- 角色过一会儿自己来回应（不用点按钮） ----------
// 你发了动态、发了评论后，记下一个时间 post._due（几十秒到几分钟后，随机）；到点时需要回应的角色依次来点赞、评论、回复，
// 回了就在顶上弹一条小通知。小手机关着时不会回，下次打开时补上
function feedScheduleReply(post, minSec, maxSec) {
  var at = Date.now() + (minSec + Math.random() * (maxSec - minSec)) * 1000;
  post._due = post._due ? Math.min(post._due, at) : at;
}
function feedTick() {
  var now = Date.now();
  feedPosts.forEach(function(post) {
    if (post._due && post._due <= now && !post._busy) {
      delete post._due;
      saveFeed();
      requestFeedInteraction(post, { auto: true });
    }
  });
}
setInterval(feedTick, 15000);
if (typeof onMphoneReady === 'function') onMphoneReady(function() { setTimeout(feedTick, 5000); });

// opts.auto：到点自动来的，没人要回就不提示，回了就弹「某某评论了你的动态」
function requestFeedInteraction(post, opts) {
  opts = opts || {};
  if (post._busy) return;
  var targets = [];
  charList.forEach(function(char, idx) {
    var me = charAuthor(char);
    var canSee = charCanSeePost(char, post);
    if (canSee && charNeedsToRespond(post, me)) targets.push(idx);
  });
  if (!targets.length) { if (!opts.auto) showToast('暂时没有需要回应的角色', 'success'); return; }
  var mine = post.author.type === 'user';
  post._busy = true;
  renderFeed();
  var chain = Promise.resolve();
  var errors = 0;
  targets.forEach(function(idx) {
    chain = chain.then(function() {
      var before = post.comments.length, liked = post.likes.length;
      return charInteract(post, idx).then(function() {
        if (!opts.auto) return;
        var me = charAuthor(charList[idx]);
        var said = post.comments.slice(before).filter(function(c) { return sameAuthor(c.author, me); });
        var toYou = said.some(function(c) { return c.replyTo && c.replyTo.type === 'user'; });
        var msg = said.length ? (toYou ? '回复了你' : mine ? '评论了你的动态' : '在动态下说了话')
          : post.likes.length > liked && mine ? '赞了你的动态' : '';
        if (msg) { showToast('「' + me.name + '」' + msg, 'plain'); saveFeed(); renderFeed(); }
      }).catch(function(err) { errors++; console.warn('[Mphone] 动态互动失败:', err); });
    });
  });
  chain.then(function() {
    delete post._busy;
    saveFeed();
    renderFeed();
    if (errors && !opts.auto) showToast('✗ 有 ' + errors + ' 个角色互动失败', 'error');
  });
}
