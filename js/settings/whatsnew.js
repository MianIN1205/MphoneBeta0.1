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
  { v: 71, d: '11月11日', items: ['表情包：角色把名字写差一点（多了标点、括号写成【】、只写了一部分）也能发出来了；实在对不上、或者图片打不开的那条会藏起来，不再剩一行「[表情包：名字]」', '表情包可以同名了，导入时不再在后面排数字；同名的角色会随机挑一个发'] },
  { v: 70, d: '11月11日', items: ['连通记忆库现在连人设一起同步：人设是记忆库里的「人设核心」，几台设备、几个小手机上的 TA 用同一份；两边不一样时会问你用哪个版本，没选的那份留着，「连接设置」里能返回上个版本。记忆库是以前部署的话，要重新部署一次才有']} ,
  { v: 69, d: '11月11日', items: ['设置 → 备份下面多了「从别的小手机搬家」：选一个别的小手机的备份，认出里面的角色、聊天记录、记忆、世界书、表情包，勾上要的就导进来', '小梦能直接发文件给你了，点开能复制、能保存', '状态栏设置变简单了：平时只看预设和现在的样子，规则和代码点开才看', '能单独导出：角色卡（酒馆也能用）、世界书（整本或全部）、CSS / 状态栏 / 桌面图标预设', '拓展栏里世界书、剧情预设都能点开一条条开关，思维链那里能开关「显示思考」；开了我们的思维链时角色会先想完再回', '仿siya 变得更细、更柔和了，拓展栏挤进了顶栏；群聊里不用仿siya', '剧情窗口也能有状态栏了（角色设置 → 美化 → 状态栏里打开「剧情窗口也写状态栏」），点名字看最近 5 条；状态栏画好就存下来，打开更快'] },
  { v: 68, d: '11月11日', items: ['表情包多的时候每个分类都会给角色看到，名字里带感叹号的表情包也能发出来了', '一起看：先挑书进去，想一起看了再点下面的「一起看」；在书里聊天时角色才看书页，也先不写状态栏', '「继续看」小条挪到输入框上面', '书架上长按一本书：看封面、名字、备注，能编辑、删除；没换封面图的书名直接印在封面上', '录音条变小了，按下去更快开始录；右边多了「文」，滑过去松手就转成文字发出去，下面写着现在的模型能不能听语音'] },
  { v: 67, d: '11月10日', items: ['状态栏预设、CSS 预设挪到最上面，点开选一个就套用，右边能保存、删除', '新角色默认打开状态栏（自带的文字状态栏）'] },
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
