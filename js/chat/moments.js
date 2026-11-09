// 眠花糖机 — 消息列表最上面那排圆圈「此刻」：每个圆圈是一个角色，TA 换了签名（此刻在做什么）或发了新动态，头像发一圈粉色的光；
// 点开是一张小卡片：TA 此刻在做什么、最新一条动态，「去聊天」。「+」挑放哪几个角色上来（mphone_moment_chars、mphone_moment_seen）

var momentPick = mphoneStore.load('mphone_moment_chars', null);   // 用户挑的角色 id；没挑过就放最近聊过的三个
var momentSeen = mphoneStore.load('mphone_moment_seen', {}) || {};
var MOMENT_MAX = 8;
function momentChars() {
  if (Array.isArray(momentPick)) return momentPick.map(function(id) { return charList.filter(function(c) { return c.id === id; })[0]; }).filter(Boolean);
  return charList.filter(function(c) { return c.id && !c.isGroup && (c.inChat || c.builtinAssistant); }).map(function(c) {
    var last = typeof lastSessionMsg === 'function' ? lastSessionMsg(c) : null;
    return { c: c, t: (last && last.time) || c.chatTouchedAt || 0 };
  }).sort(function(a, b) { return b.t - a.t; }).slice(0, 3).map(function(x) { return x.c; });
}
function momentLatestPost(char) {
  if (typeof feedPosts === 'undefined') return null;
  return feedPosts.filter(function(p) { return p.author && p.author.type === 'char' && p.author.id === char.id; })[0] || null;
}
// 有没有新东西：签名换了的时间、最新动态的时间，比上次点开晚
function momentNewAt(char) {
  var post = momentLatestPost(char);
  return Math.max(char.headStatusAt || 0, char.charBioAt || 0, (post && post.time) || 0);
}
function momentHasNew(char) { var t = momentNewAt(char); return t > 0 && t > (momentSeen[char.id] || 0); }

function renderMoments() {
  var row = document.querySelector('.chat-avatar-row');
  if (!row) return;
  row.innerHTML = '';
  momentChars().forEach(function(c) {
    var item = document.createElement('div');
    item.className = 'moment-item' + (momentHasNew(c) ? ' has-new' : '') + (c.builtinAssistant ? ' is-helper' : '');   // 有新东西：角色发蓝光，MianIN 粉光
    item.innerHTML = '<div class="moment-ring"><div class="chat-avatar moment-av"></div></div><span class="moment-name"></span>';
    if (typeof paintCharAvatar === 'function') paintCharAvatar(item.querySelector('.moment-av'), c);
    item.querySelector('.moment-name').textContent = c.charAlias || c.charName || '未命名';
    item.addEventListener('click', function() { openMoment(c); });
    row.appendChild(item);
  });
  var add = document.createElement('div');
  add.className = 'moment-item';
  add.innerHTML = '<div class="chat-avatar-add"><svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div><span class="moment-name">&nbsp;</span>';
  add.addEventListener('click', openMomentPick);
  row.appendChild(add);
}

// 点开一个圆圈：TA 此刻
var momentCur = null;
function openMoment(c) {
  momentCur = c;
  var box = document.getElementById('momentCard');
  if (typeof paintCharAvatar === 'function') paintCharAvatar(box.querySelector('.moment-card-av'), c);
  box.querySelector('.moment-card-name').textContent = c.charAlias || c.charName || '未命名';
  var st = box.querySelector('.moment-card-status');
  st.textContent = c.headStatus || (typeof CHAT_SUB_DEFAULT === 'string' ? CHAT_SUB_DEFAULT : '在呢');
  box.querySelector('.moment-card-bio').textContent = c.charBio || '还没有个性签名';
  box.querySelector('.moment-card-when').textContent = c.headStatusAt ? fmtAgo(c.headStatusAt) : '';
  var post = momentLatestPost(c), pb = box.querySelector('.moment-card-post');
  pb.style.display = post ? '' : 'none';
  if (post) {
    pb.querySelector('.moment-card-post-text').textContent = post.text || ((post.textImgs || [])[0] ? '[图片] ' + post.textImgs[0] : '[图片]');
    pb.querySelector('.moment-card-post-when').textContent = fmtAgo(post.time);
  }
  document.getElementById('momentOverlay').classList.add('open');
  momentSeen[c.id] = Date.now();
  mphoneStore.save('mphone_moment_seen', momentSeen);
  renderMoments();
}
function closeMoment() { document.getElementById('momentOverlay').classList.remove('open'); momentCur = null; }
closeOnBackdrop(document.getElementById('momentOverlay'), closeMoment);
document.getElementById('momentClose').addEventListener('click', closeMoment);
document.getElementById('momentChat').addEventListener('click', function() {
  var c = momentCur;
  closeMoment();
  if (c && typeof openFromNotification === 'function') openFromNotification({ open: 'chat', charId: c.id });
});

// 「+」：挑放哪几个角色上来（最多 8 个）
function openMomentPick() {
  var cur = momentChars().map(function(c) { return c.id; }), list = document.getElementById('momentPickList');
  list.innerHTML = '';
  charList.filter(function(c) { return c.id && !c.isGroup; }).forEach(function(c) {
    var chip = document.createElement('span');
    chip.className = 'feed-visible-chip' + (cur.indexOf(c.id) >= 0 ? ' on' : '');
    chip.textContent = c.charAlias || c.charName || '未命名';
    chip.addEventListener('click', function() {
      var i = cur.indexOf(c.id);
      if (i >= 0) cur.splice(i, 1);
      else if (cur.length >= MOMENT_MAX) { showToast('最多放 ' + MOMENT_MAX + ' 个', 'plain'); return; }
      else cur.push(c.id);
      chip.classList.toggle('on', cur.indexOf(c.id) >= 0);
      momentPick = cur.slice();
      mphoneStore.save('mphone_moment_chars', momentPick);
      renderMoments();
    });
    list.appendChild(chip);
  });
  document.getElementById('momentPickOverlay').classList.add('open');
}
closeOnBackdrop(document.getElementById('momentPickOverlay'));
document.getElementById('momentPickDone').addEventListener('click', function() { document.getElementById('momentPickOverlay').classList.remove('open'); });
onMphoneReady(renderMoments);
