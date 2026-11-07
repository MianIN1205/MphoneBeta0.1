// 眠花糖机 — Prompt：文风库（自带的文风 + 自己写的）。剧情设置里的「文风」从这里挑；自带的能改、能恢复，自己写的能删（mphone_style_lib）
// 文字都是这个项目自己写的；带作者作品的几种只拿来说明笔法，要求不照抄原句、不在正文里提作者

var STYLE_REF_NOTE = '（参考的作品只学笔法和味道，不照抄原句，也不在正文里提到这些作者和作品。）';
var STYLE_BUILTIN = [
  { id: 'delicate', name: '细腻', text: '用具体的细节写出画面——光线、声音、温度、气味，人物细小的动作和表情；少用空泛的形容词和套话，让读的人自己感受到情绪，而不是直接告诉 TA。' },
  { id: 'romance', name: '细腻言情', text: '把心思写得很细——一个眼神、一句话里藏着的在意，靠近又退开的拉扯，欲言又止的停顿；多写人物之间的小动作和气氛的变化，情绪一层层往上走，不直白喊出来。可以参考八月长安《你好，旧时光》、Priest、墨宝非宝那样的细腻情感描写。' + STYLE_REF_NOTE },
  { id: 'zhang', name: '华丽苍凉', text: '用精准又出人意料的比喻和色彩写人写物，句子有华丽的质感，底色却是冷的、清醒的；人物的心思藏在衣饰、器物、天气和光影里，读完有一点凉。可以参考张爱玲《倾城之恋》《金锁记》的笔法。' + STYLE_REF_NOTE },
  { id: 'wang', name: '温润白描', text: '语言平淡、干净、有生活气，用白描写日常的小事和人情，不煽情，温暖藏在细节里，读起来像慢慢喝一碗热汤。可以参考汪曾祺《受戒》《人间草木》、沈从文《边城》的笔法。' + STYLE_REF_NOTE },
  { id: 'murakami', name: '疏离都市', text: '语气平静克制，带一点疏离和孤独感；用具体的物件、音乐、食物、天气写情绪，比喻新奇而准确，对话简短，留很多空白。可以参考村上春树《挪威的森林》的笔法。' + STYLE_REF_NOTE },
  { id: 'film', name: '电影镜头', text: '像在写一部电影——注意镜头的远近和切换、光线和色调、声音和安静，用画面推进情绪，少用直接的心理说明。' },
  { id: 'ancient', name: '古风', text: '用词典雅，可以半文半白，但读起来要通顺自然；写景写人有古典的意境（衣袂、烛火、檐下雨声），人物说话合乎身份和时代，不夹现代口语。' },
  { id: 'funny', name: '搞笑', text: '节奏轻快，善用反差、吐槽、夸张和出人意料的展开，人物会犯傻、会接梗、会一本正经地胡说八道；笑点从人物性格和情境里自然长出来，不硬塞段子，也不把人物写崩，该认真的地方照样认真。' },
  { id: 'flirty', name: '暧昧撩人', text: '写两个人靠近时的气氛和张力——呼吸、体温、指尖不经意擦过、忽然安静下来的空气，心跳和欲言又止；多写感官和情绪，把心动和彼此的吸引写得具体、让人脸红，但留一点余地给想象，不写露骨的细节。' },
  { id: 'clean', name: '简洁干净', text: '句子短，少修饰，用准确的动词和名词把场景和动作交代清楚，留一点空白给读的人。' },
  { id: 'casual', name: '轻松口语', text: '像在讲一个生动的故事，语气自然、有生活气，可以带一点幽默，不端着。' },
  { id: 'literary', name: '文艺', text: '语言有韵律和画面感，可以用恰当的比喻和意象，但不堆砌辞藻；情绪克制，点到为止。' }
];
var styleLib = Object.assign({ edits: {}, custom: [] }, mphoneStore.load('mphone_style_lib', {}) || {});
function saveStyleLib() { mphoneStore.save('mphone_style_lib', styleLib); }
// 全部文风：自带的（套上改过的字）+ 自己写的
function styleList() {
  return STYLE_BUILTIN.map(function(s) {
    var e = styleLib.edits[s.id];
    return { id: s.id, name: (e && e.name) || s.name, text: (e && e.text) || s.text, builtin: true, edited: !!e };
  }).concat((styleLib.custom || []).map(function(s) { return { id: s.id, name: s.name, text: s.text, builtin: false }; }));
}
function styleById(id) { var l = styleList(); return l.filter(function(s) { return s.id === id; })[0] || l[0]; }
function styleText(id) { var s = styleById(id); return '【文风】' + s.name + '：' + s.text; }

// ---------- 文风库那一栏 ----------
var styleEditing = null;   // 正在改的文风 id（新建时是 ''）
function renderStyleLib() {
  var box = document.getElementById('styleLibList');
  if (!box) return;
  box.innerHTML = '';
  styleList().forEach(function(s) {
    var card = document.createElement('div');
    card.className = 'style-card';
    card.innerHTML = '<div class="style-card-head"><b></b><span class="style-tag"></span></div><div class="style-card-text"></div>';
    card.querySelector('b').textContent = s.name;
    card.querySelector('.style-tag').textContent = s.builtin ? (s.edited ? '自带 · 改过' : '自带') : '自己写的';
    card.querySelector('.style-card-text').textContent = s.text;
    card.addEventListener('click', function() { openStyleEdit(s.id); });
    box.appendChild(card);
  });
}
function openStyleEdit(id) {
  styleEditing = id;
  var s = id ? styleById(id) : null;
  document.getElementById('styleEditTitle').textContent = s ? '编辑文风' : '新建文风';
  document.getElementById('styleEditName').value = s ? s.name : '';
  document.getElementById('styleEditText').value = s ? s.text : '';
  var del = document.getElementById('styleEditDel');
  del.style.display = s && (!s.builtin || s.edited) ? '' : 'none';
  del.textContent = s && s.builtin ? '恢复自带' : '删除';
  document.getElementById('styleEditOverlay').classList.add('open');
}
function closeStyleEdit() { document.getElementById('styleEditOverlay').classList.remove('open'); styleEditing = null; }
// 文风库改了：用到这个文风的默认剧情预设，那条「文风」条目跟着换
function styleLibChanged() {
  saveStyleLib();
  renderStyleLib();
  if (typeof stPresets !== 'undefined') {
    stPresets.forEach(function(p) {
      if (!p.builtin) return;
      var en = (p.entries || []).filter(function(e) { return e.key === 'style'; })[0];
      if (en && typeof plotText === 'function') en.content = plotText('style', Object.assign({}, typeof PLOT_DEFAULT_OPTS !== 'undefined' ? PLOT_DEFAULT_OPTS : {}, p.opts || {}));
    });
    if (typeof saveStPresetsToStorage === 'function') { saveStPresetsToStorage(); renderStEntryList(); }
  }
}
document.getElementById('styleLibAdd').addEventListener('click', function() { openStyleEdit(''); });
document.getElementById('styleEditCancel').addEventListener('click', closeStyleEdit);
closeOnBackdrop(document.getElementById('styleEditOverlay'), closeStyleEdit);
document.getElementById('styleEditSave').addEventListener('click', function() {
  var name = document.getElementById('styleEditName').value.trim(), text = document.getElementById('styleEditText').value.trim();
  if (!name) { shakeEl(document.getElementById('styleEditName')); return; }
  if (!text) { shakeEl(document.getElementById('styleEditText')); return; }
  var s = styleEditing ? styleById(styleEditing) : null;
  if (s && s.builtin) styleLib.edits[s.id] = { name: name, text: text };
  else if (s) styleLib.custom.forEach(function(c) { if (c.id === s.id) { c.name = name; c.text = text; } });
  else styleLib.custom.push({ id: 'my' + Date.now().toString(36), name: name, text: text });
  closeStyleEdit();
  styleLibChanged();
  showToast('✓ 文风存好了，剧情设置里可以选', 'success');
});
document.getElementById('styleEditDel').addEventListener('click', function() {
  var s = styleEditing ? styleById(styleEditing) : null;
  if (!s) return;
  if (s.builtin) {
    openConfirm('把「' + s.name + '」恢复成自带的写法？', function() { delete styleLib.edits[s.id]; closeStyleEdit(); styleLibChanged(); });
  } else {
    openConfirm('删除文风「' + s.name + '」？', function() {
      styleLib.custom = styleLib.custom.filter(function(c) { return c.id !== s.id; });
      closeStyleEdit(); styleLibChanged();
    });
  }
});
renderStyleLib();
