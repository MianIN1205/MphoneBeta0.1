// 眠花糖机 — 更新提示（用户要的）：第一次打开时一段整体介绍，之后每次更新弹一个小窗简单说说更新了什么，样子和备份提醒一样。
// 能关、能「不再弹出更新通知」（设置 → 辅助功能里能再打开、能再看介绍）。只留最近几次的说明，不占地方。
// 进度只记在这台手机的 localStorage：mphoneSeenV（看过哪一版）、mphoneNoteOff（不再弹出）
// 每次推有用户看得到的变化时：在 WN_NOTES 最前面加一条（v 写 bump 之后的版本号），旧的超过 5 条就删掉

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
  { v: 62, items: ['修好了点状态栏卡住、等回复时点了没反应的问题，状态栏左上角的时间也回来了', '群设置分成三页；群成员能设管理员、禁言、踢出；群聊也有便捷拓展栏，还能设回复条数、动作描写和美化', '录音键挪到正中间，按下去有手感；语音识别能一键填硅基流动、能测一下', '状态栏打开时后面会模糊、点不到后面的按钮', '相册能一次选好几张，发之前在小手机里先看看、能取消', '盲盒拆开后能选收下还是不要；抽奖图标换成转盘', '回复一条条蹦出来现在默认打开（设置 → 辅助功能能关）', '矮一点的屏幕上程序坞不会再被挤出去；iPhone 键盘弹出时顶栏不跑'] },
  { v: 61, items: ['新增群聊：拉几个角色一起聊，群里能投票、抽奖、发拼手气红包', '新增盲盒：用钱包里的钱抽，也能自己做、让 AI 做（比如某部番的周边）',
                   '「我的」里多了资产：赛博小物和现实持有', '钱包新账号有 520，充值一次最多 10 万', '更新后会像这样告诉你更新了什么'] }
];

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
    var lines = WN_INTRO.concat(fresh.length ? ['', '这次更新：'].concat(fresh[0].items.map(function(t) { return '· ' + t; })) : []);
    wnShow('欢迎来到眠花糖机', lines, '知道了', '不再弹出', function() { wnSet('mphoneNoteOff', '1'); });
    return;
  }
  if (!fresh.length || wnGet('mphoneNoteOff')) return;
  var items = [];
  fresh.forEach(function(n) { n.items.forEach(function(t) { items.push('· ' + t); }); });
  wnShow('小手机更新了', items, '知道了', '不再弹出', function() { wnSet('mphoneNoteOff', '1'); showToast('之后不会再弹了，设置 → 辅助功能里能再打开', 'plain'); });
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
    wnShow('眠花糖机', WN_INTRO.concat(WN_NOTES.length ? ['', '最近更新：'].concat(WN_NOTES[0].items.map(function(x) { return '· ' + x; })) : []), '知道了', '关闭');
  });
})();
