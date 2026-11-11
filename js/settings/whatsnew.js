// 眠花糖机 — 更新提示（用户要的），还有给小梦的「用户还没用过的玩法」；更新提示：第一次打开时一段整体介绍，之后每次更新弹一个小窗简单说说更新了什么，样子和备份提醒一样。
// 能关、能「不再弹出更新通知」（设置 → 辅助功能里能再打开、能再看介绍）。只留最近几次的说明，不占地方。
// 进度只记在这台手机的 localStorage：mphoneSeenV（看过哪一版）、mphoneNoteOff（不再弹出）
// 每次推有用户看得到的变化时：在 WN_NOTES 最前面加一条（v 写 bump 之后的版本号，d 写日期「M月D日」），旧的超过 5 条就删掉

var WN_INTRO = [
  '眠花糖机 · Muse 是一台和角色们一起生活的小手机。',
  '· 先去「设置」填好 API，才能和角色聊天',
  '· Chat：和角色私聊、建群；聊天窗口像微信，剧情窗口一起演一段故事；打完字点 ❄️ 请 TA 回复',
  '· 桌面上的书架、花房、星星瓶、慢信、盲盒、桌宠、记忆库……都是和角色有关的小地方',
  '· Prompt 页放世界书、预设和文风',
  '· 不懂的可以问消息列表最上面的 MianIN',
  '· 记得常备份：iPhone 删掉桌面图标会连数据一起清空'
];
var WN_NOTES = [
  { v: 76, d: '11月11日', items: ['角色的记忆更像人了：每条记忆会记着当时的心情和留在心里的画面（比如「病房、蚊子、凌晨三点」），你说到相关的东西时 TA 会自然想起来。以前的记忆可以在记忆库里点「给 N 条补上心情和画面」。', '记忆库里多了「TA 知道的你」：TA 平时就知道的关于你的事，不用回想。写日记时顺带整理，没写日记的一周整理一次，也能自己改。', '记忆库能按心情筛了，编辑记忆时也能选心情、写画面。'] },
  { v: 75, d: '11月11日', items: ['每个角色可以单独连一个记忆库了：记忆库 → 连接设置最下面「每个角色用哪个记忆库」，点一个角色选「默认的 / 单独的 / 不同步」。单独的那个只放 TA 的人设和记忆，别的角色不会进去；默认库和单独的库互不影响，从一个库拉下来的记忆不会被带进另一个', '单独的记忆库里不看名字，里面的都算 TA 的；默认库里能写「在记忆库里叫」，别的小手机里叫法不一样也对得上', '长期和珍贵记忆一条能放一整件事了（最多 2000 字），新角色的「记忆最多占用」默认改成 6000', '记忆库网页多了「导入 / 导出」（记忆库要重新部署一次才有）'] },
  { v: 73, d: '11月11日', items: ['聊天和剧情衔接得更好了：走完剧情回到聊天，TA 记得刚才的事，第一次开口会自然地提起；带过去的是之前经过的摘要加最后几句，不再是一长串', '剧情窗口输入框上面那排符号的最右边多了「总结」：能打开「显示每轮摘要」（每次回复最下面一行灰色小字）；还能把一段剧情存成一个存档——选从第几条到第几条，让 TA 合并摘要或总结全文，起个名字，写好能改。哪次发生了什么分开存着，TA 之后照着这些记得'] },
  { v: 72, d: '11月11日', items: ['世界书的每一条可以选「背景设定」或「写法要求」：写法要求是 TA 要照着做的规矩，放在离回复最近的地方，更管用；以前的条目都还是背景设定', '世界书里多了三个自带的文件夹：模型适配 · Claude、模型适配 · Gemini、人设风格。不会自己生效，在角色设置的关联世界书里勾上才用：用哪个模型勾哪本，人设风格一个角色只勾一条', '角色设置里的关联世界书，条目多的时候能上下滑了'] },
  { v: 71, d: '11月11日', items: ['表情包：角色把名字写差一点（多了标点、括号写成【】、只写了一部分）也能发出来了；实在对不上、或者图片打不开的那条会藏起来，不再剩一行「[表情包：名字]」', '表情包可以同名了，导入时不再在后面排数字；同名的角色会随机挑一个发'] },
];

// 好几次更新没看：合成一个，按日期排成时间线（同一天的放一起，新的在上面；用户要的，不一条条弹、也不只弹最后一次）
function wnTimeline(notes) {
  var out = [], last = null;
  notes.forEach(function(n) {
    if (n.d !== last) { if (out.length) out.push(''); out.push('【' + (n.d || '更新') + '】'); last = n.d; }
    n.items.forEach(function(t) { out.push('· ' + t); });
  });
  return out;
}
function wnGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function wnSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} }
function wnShow(title, lines, okText, offText, onOff) {
  var ov = document.createElement('div');
  ov.className = 'mine-acc-overlay open';
  ov.innerHTML = '<div class="mine-acc-modal"><div class="mine-acc-title"></div><div class="stk-hint wn-text"></div>' +
    '<div class="mine-acc-actions"><button class="mine-acc-btn mine-acc-btn-close"></button><button class="mine-acc-btn mine-acc-btn-add"></button></div></div>';
  ov.querySelector('.mine-acc-title').textContent = title;
  ov.querySelector('.wn-text').textContent = lines.join('\n');
  ov.querySelector('.wn-text').style.cssText = 'white-space:pre-line;font-size:12.5px;color:#776;max-height:50vh;overflow-y:auto;';
  var off = ov.querySelector('.mine-acc-btn-close'), ok = ov.querySelector('.mine-acc-btn-add');
  off.textContent = offText; ok.textContent = okText;
  ok.addEventListener('click', function() { ov.remove(); });
  off.addEventListener('click', function() { ov.remove(); if (onOff) onOff(); });
  (document.querySelector('.phone') || document.body).appendChild(ov);
}
// 打开时看一次：没看过介绍 → 介绍（带上这次的更新）；看过 → 只说比上次新的那几条
function wnCheck(tries) {
  var br = document.getElementById('backupRemindOverlay');
  if (br && br.classList.contains('open')) { if ((tries || 0) < 30) setTimeout(function() { wnCheck((tries || 0) + 1); }, 2000); return; }   // 等备份提醒关了再弹
  var cur = parseInt(MPHONE_V, 10), seen = parseInt(wnGet('mphoneSeenV'), 10);
  var fresh = WN_NOTES.filter(function(n) { return !(n.v <= seen); });
  if (seen >= cur) return;
  wnSet('mphoneSeenV', String(cur));
  if (!seen) {
    var lines = WN_INTRO.concat(fresh.length ? ['', '最近更新：'].concat(wnTimeline(fresh)) : []);
    wnShow('欢迎来到眠花糖机', lines, '知道了', '不再弹出', function() { wnSet('mphoneNoteOff', '1'); });
    return;
  }
  if (!fresh.length || wnGet('mphoneNoteOff')) return;
  wnShow('小手机更新了', wnTimeline(fresh), '知道了', '不再弹出', function() { wnSet('mphoneNoteOff', '1'); showToast('之后不会再弹了，设置 → 辅助功能里能再打开', 'plain'); });
}
onMphoneReady(function() { setTimeout(wnCheck, 2500); });

// 设置 → 辅助功能：更新后告诉我 / 再看一次介绍
(function() {
  var t = document.getElementById('wnNotesOn'), b = document.getElementById('wnIntroBtn');
  if (t) {
    t.checked = !wnGet('mphoneNoteOff');
    t.addEventListener('change', function() { wnSet('mphoneNoteOff', this.checked ? null : '1'); });
  }
  if (b) b.addEventListener('click', function() {
    wnShow('眠花糖机', WN_INTRO.concat(WN_NOTES.length ? ['', '最近更新：'].concat(wnTimeline(WN_NOTES)) : []), '知道了', '关闭');
  });
})();

// 给小梦：用户还没用过的玩法（用户问「有什么好玩的」时祂挑几个介绍）
function wnUnusedFeatures() {
  var out = [];
  if (!charList.some(function(c) { return c.isGroup; })) out.push('群聊（消息页右上 + →「新建群聊」，能投票、抽奖、发红包、说悄悄话）');
  if (typeof assetStore !== 'undefined' && !assetStore.cyber.length) out.push('盲盒（桌面「盲盒」，用钱包里的钱抽，也能让 AI 做一套某部番的周边）');
  if (typeof letters !== 'undefined' && !letters.length) out.push('慢信（桌面「慢信」，写给未来的自己或角色，到日子才能拆）');
  if (typeof garden !== 'undefined' && !(garden && garden.species)) out.push('花房（桌面「花房」，养一盆花，还能分享给角色让 TA 悄悄来照顾）');
  if (typeof bookMetas !== 'undefined' && !bookMetas.length) out.push('一起看（书架右上「导入图书」放一本小说，聊天加号第二页「一起看」，边看边聊）');
  if (typeof petCfg !== 'undefined' && !(petCfg.pets || []).length) out.push('桌宠（桌面「桌宠」，捏一只像素小动物，或者用 Q 版的 TA）');
  if (typeof stars !== 'undefined' && !stars.length) out.push('星星瓶（角色每天会折一颗星星写给你，偶尔还有匿名的）');
  if (typeof assetStore !== 'undefined' && !assetStore.real.length) out.push('现实持有（我的 → 资产，记下现实里的东西，聊天时角色也能帮你记）');
  return out;
}
