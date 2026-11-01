// 眠花糖机 — Prompt：思维链

// =============================================
// Prompt — 思维链 (CoT) 面板
// =============================================
var cotEnableToggle = document.getElementById('cotEnableToggle');
var cotPromptTA     = document.getElementById('cotPromptTA');

(function initCotState() {
  var savedCotEnabled = mphoneStore.load('mphone_cot_enabled', null);
  var savedCotPrompt  = mphoneStore.load('mphone_cot_prompt', null);
  if (savedCotEnabled !== null) {
    cotEnableToggle.checked = (String(savedCotEnabled) === 'true');
  }
  if (savedCotPrompt !== null) {
    cotPromptTA.value = savedCotPrompt;
  } else {
    cotPromptTA.value = '在正式回复前，请先在内心梳理当前场景、角色情绪变化与潜台词，确保言行符合人设逻辑，然后再输出正式的角色回复。';
  }
})();

cotEnableToggle.addEventListener('change', function() {
  mphoneStore.save('mphone_cot_enabled', this.checked ? 'true' : 'false');
});

cotPromptTA.addEventListener('input', function() {
  mphoneStore.save('mphone_cot_prompt', this.value);
});
