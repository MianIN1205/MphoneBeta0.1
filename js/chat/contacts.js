// 眠花糖机 — 通讯录：全部角色按首字母分组，点卡片编辑；消息页加号菜单项

// 消息页加号菜单：[0] 新建对话，[1] 新建群聊
var msgPlusItems = document.querySelectorAll('.msg-plus-popup-item');

// =============================================
// 通讯录：全部角色；点卡片编辑，右上角添加角色
// =============================================
// 名字的首字母：英文取本身，中文按拼音排序规则判断（不需要拼音库），其余归到 #
var PINYIN_LETTERS = 'ABCDEFGHJKLMNOPQRSTWXYZ';
var PINYIN_BOUNDS  = '阿八嚓哒妸发旮哈讥咔垃痳拏噢妑七呥扨它穵夕丫帀';
var pinyinCollator = (window.Intl && Intl.Collator) ? new Intl.Collator('zh-Hans-CN-u-co-pinyin') : null;
function nameInitial(name) {
  var ch = String(name || '').trim().charAt(0);
  if (/[a-z]/i.test(ch)) return ch.toUpperCase();
  if (/[一-鿿]/.test(ch) && pinyinCollator) {
    for (var i = PINYIN_BOUNDS.length - 1; i >= 0; i--) {
      if (pinyinCollator.compare(ch, PINYIN_BOUNDS[i]) >= 0) return PINYIN_LETTERS[i];
    }
  }
  return '#';
}

// 通讯录：顶部星标好友，其余按首字母分组；左侧目录点击跳到对应分组
function renderContactList() {
  var list = document.getElementById('contactList');
  var index = document.getElementById('contactIndex');
  list.innerHTML = '';
  index.innerHTML = '';
  var displayName = function(c) { return c.charAlias || c.charName || '未命名'; };
  var items = charList.map(function(c, i) { return { char: c, idx: i, letter: nameInitial(displayName(c)) }; });
  var groups = [];
  var starred = items.filter(function(it) { return it.char.starred; });
  if (starred.length) groups.push({ key: '★', label: '星标好友', items: starred });
  var byLetter = {};
  items.forEach(function(it) { (byLetter[it.letter] = byLetter[it.letter] || []).push(it); });
  Object.keys(byLetter).sort(function(a, b) {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a < b ? -1 : 1;
  }).forEach(function(l) {
    byLetter[l].sort(function(a, b) {
      var x = displayName(a.char), y = displayName(b.char);
      return pinyinCollator ? pinyinCollator.compare(x, y) : (x < y ? -1 : 1);
    });
    groups.push({ key: l, label: l, items: byLetter[l] });
  });

  var labels = {};   // 分组 key → 分组标题元素
  groups.forEach(function(g) {
    var label = document.createElement('div');
    label.className = 'contact-section-label';
    label.textContent = g.label;
    list.appendChild(label);
    labels[g.key] = label;
    g.items.forEach(function(it) { list.appendChild(createContactCard(it.char, it.idx)); });
  });

  // 左侧目录始终显示完整的 ★ A–Z #；没有角色的字母变浅，点击跳到之后最近的分组
  var ALL_KEYS = ['★'].concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), ['#']);
  ALL_KEYS.forEach(function(key, i) {
    var mark = document.createElement('span');
    mark.textContent = key;
    if (!labels[key]) mark.classList.add('empty');
    mark.addEventListener('click', function() {
      var target = null;
      for (var j = i; j < ALL_KEYS.length && !target; j++) target = labels[ALL_KEYS[j]];
      for (var k = i - 1; k >= 0 && !target; k--) target = labels[ALL_KEYS[k]];
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    index.appendChild(mark);
  });
}

function createContactCard(char, i) {
    var card = document.createElement('div');
    card.className = 'chat-char-card';
    card.dataset.index = i;

    var av = document.createElement('div');
    av.className = 'chat-char-card-avatar';
    paintCharAvatar(av, char);

    var info = document.createElement('div');
    info.className = 'chat-char-card-info';
    var nameEl = document.createElement('div');
    nameEl.className = 'chat-char-card-name';
    nameEl.textContent = char.charAlias || char.charName || '未命名';
    info.appendChild(nameEl);
    if (char.charName && char.charName !== char.charAlias) {
      var sub = document.createElement('div');
      sub.className = 'chat-char-card-last';
      sub.textContent = char.charName;
      info.appendChild(sub);
    }

    // 右侧星标：点一下加入 / 移出星标好友
    var star = document.createElement('button');
    star.className = 'contact-star-btn' + (char.starred ? ' on' : '');
    star.textContent = char.starred ? '★' : '☆';
    star.title = char.starred ? '取消星标' : '设为星标好友';
    star.addEventListener('click', function(e) {
      e.stopPropagation();
      char.starred = !char.starred;
      saveCharList();
      renderContactList();
    });

    card.appendChild(av);
    card.appendChild(info);
    card.appendChild(star);
    card.addEventListener('click', function() {
      openCharSetting(parseInt(this.dataset.index, 10));
    });
    return card;
}
