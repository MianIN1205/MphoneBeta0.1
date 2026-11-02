// 眠花糖机 — Prompt：思维链（只有开关；思考的内容固定在代码里，见 js/chat/prompt.js 的 COT_CHAT / COT_DRAMA）

// =============================================
// 启用思维链：开着用眠花糖机自己的思考（聊天、剧情各一套）代替模型自带的；关着完全不思考
// 在聊天里显示思考：开着时每次回复前面有一条很小的折叠条（js/chat/render.js 的 renderThinkBar），默认关
// =============================================
var cotEnableToggle = document.getElementById('cotEnableToggle');
var cotShowToggle   = document.getElementById('cotShowToggle');
cotEnableToggle.checked = String(mphoneStore.load('mphone_cot_enabled', 'false')) === 'true';
cotShowToggle.checked = !!mphoneStore.load('mphone_cot_show', false);
cotEnableToggle.addEventListener('change', function() {
  mphoneStore.save('mphone_cot_enabled', this.checked ? 'true' : 'false');
});
cotShowToggle.addEventListener('change', function() {
  mphoneStore.save('mphone_cot_show', this.checked);
  // 正在看的聊天马上按新的设置重画
  if (typeof renderRoomLists === 'function' && typeof openingChatCharIdx !== 'undefined' && openingChatCharIdx >= 0 && appChatRoom.classList.contains('active')) {
    renderRoomLists(openingChatCharIdx);
  }
});
