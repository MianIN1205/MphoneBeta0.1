// 眠花糖机 — Prompt：思维链（三选一 + 显示开关；「眠花糖机的」思考内容固定在代码里，见 js/chat/prompt.js 的 COT_CHAT / COT_DRAMA）

// =============================================
// 思考方式 mphone_cot_mode：
// · off    不思考：不加思维链，模型自带的思考也尽量关掉（js/core/llm.js 的 llmThinkOff）
// · mine   眠花糖机的：加 COT_CHAT / COT_DRAMA，模型自带的思考关掉，用我们的代替
// · native 模型自带的：不加思维链、也不去关，模型有自己的思考就用，没有就直接回
// 在聊天里显示思考：开着时每次回复前面有一条很小的折叠条（js/chat/render.js 的 renderThinkBar），默认关
// =============================================
var cotMode = mphoneStore.load('mphone_cot_mode', null);
if (!cotMode) cotMode = String(mphoneStore.load('mphone_cot_enabled', 'false')) === 'true' ? 'mine' : 'off';   // 以前只有一个开关
function cotModeNow() { return cotMode; }
// 某个角色现在用哪种（便捷拓展栏里单独选的 char.cotMode，没选就跟全局）。思维链只给聊天窗口（用户定的，和预设只给剧情对应）：
// 剧情窗口不加眠花糖机的思维链，模型自带的思考照这个设置开 / 关
var COT_MODE_NAMES = { off: '不思考', mine: '眠花糖机的', native: '模型自带的' };
function cotModeFor(char, drama) {
  var m = (char && COT_MODE_NAMES[char.cotMode]) ? char.cotMode : cotMode;
  return drama && m === 'mine' ? 'off' : m;
}
function paintCotMode() {
  document.querySelectorAll('#cotModeRow .pf-radio-btn').forEach(function(b) { b.classList.toggle('selected', b.dataset.mode === cotMode); });
}
document.querySelectorAll('#cotModeRow .pf-radio-btn').forEach(function(b) {
  b.addEventListener('click', function() { cotMode = this.dataset.mode; mphoneStore.save('mphone_cot_mode', cotMode); paintCotMode(); });
});
paintCotMode();

var cotShowToggle = document.getElementById('cotShowToggle');
cotShowToggle.checked = !!mphoneStore.load('mphone_cot_show', false);
cotShowToggle.addEventListener('change', function() {
  mphoneStore.save('mphone_cot_show', this.checked);
  // 正在看的聊天马上按新的设置重画
  if (typeof renderRoomLists === 'function' && typeof openingChatCharIdx !== 'undefined' && openingChatCharIdx >= 0 && appChatRoom.classList.contains('active')) {
    renderRoomLists(openingChatCharIdx);
  }
});
