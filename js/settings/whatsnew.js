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
  { v: 66, d: '11月10日', items: ['键盘弹出、抽屉打开时，聊天停在最新的消息，不用再手动往下滑'] },
  { v: 65, d: '11月10日', items: ['思维链换成和世界书一样的列表：点进去能看能改，也能自己新建', '多了一条自带的「全面」思维链：更懂你的情绪、更贴人设、更像真人聊天'] },
  { v: 64, d: '11月10日', items: ['几次更新一起看时按日期排成时间线', '新角色默认打开拓展栏、线上动作描写、拍一拍', '按住消息气泡会轻轻往下沉，松手就是长按菜单', '有状态栏时名字右边有个小三角，点名字就能看', '问小梦「有什么好玩的」，祂会介绍你还没试过的玩法'] },
  { v: 63, d: '11月10日', items: ['群聊有了群公告和群昵称', '群里可以开「悄悄话」：成员之间私下说几句，你看得到', '群里可以让成员各用自己的模型回复（更像本人，但慢一些）', '点群成员就能去私聊、改群昵称、设管理员、禁言、踢出'] },
  { v: 62, d: '11月10日', items: ['修好了点状态栏卡住、等回复时点了没反应的问题，状态栏左上角的时间也回来了', '群设置分成三页；群成员能设管理员、禁言、踢出；群聊也有便捷拓展栏，还能设回复条数、动作描写和美化', '录音键挪到正中间，按下去有手感；语音识别能一键填硅基流动、能测一下', '状态栏打开时后面会模糊、点不到后面的按钮', '相册能一次选好几张，发之前在小手机里先看看、能取消', '盲盒拆开后能选收下还是不要；抽奖图标换成转盘', '回复一条条蹦出来现在默认打开（设置 → 辅助功能能关）', '矮一点的屏幕上程序坞不会再被挤出去；iPhone 键盘弹出时顶栏不跑'] },
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
