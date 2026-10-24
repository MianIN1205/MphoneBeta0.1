// 眠花糖机 — 角色设置 — 聊天背景卡片

// =============================================
// 角色设置 — 聊天背景卡片
// =============================================
var chatBgSwatches = document.getElementById('chatBgSwatches');
var chatBgPreview  = document.getElementById('chatBgPreview');
var selectedChatBgColor = '#FFF0F5';
var selectedChatBgImage = '';

chatBgPreview.style.background = selectedChatBgColor;

chatBgSwatches.querySelectorAll('.chat-bg-swatch').forEach(function(swatch) {
  swatch.addEventListener('click', function() {
    selectedChatBgColor = this.dataset.color;
    selectedChatBgImage = '';
    chatBgSwatches.querySelectorAll('.chat-bg-swatch').forEach(function(s) {
      s.classList.remove('selected');
    });
    this.classList.add('selected');
    chatBgPreview.style.background = selectedChatBgColor;
  });
});

// =============================================
// 角色设置 — 气泡卡片
// =============================================
// 颜色预设单选
document.getElementById('bubblePresetRow').querySelectorAll('.bubble-preset-item').forEach(function(item) {
  item.addEventListener('click', function() {
    document.getElementById('bubblePresetRow').querySelectorAll('.bubble-preset-item').forEach(function(i) {
      i.classList.remove('selected');
    });
    this.classList.add('selected');
  });
});

// 透明度滑条 + 💬 浮标
var bubbleOpacitySlider = document.getElementById('bubbleOpacitySlider');
var bubbleOpacityValue  = document.getElementById('bubbleOpacityValue');
var bubbleSliderThumb   = document.getElementById('bubbleSliderThumb');

function updateBubbleSliderThumb() {
  var val = parseInt(bubbleOpacitySlider.value, 10);
  var pct = val / 100;
  bubbleOpacityValue.textContent = val + '%';
  bubbleSliderThumb.style.left = (pct * bubbleOpacitySlider.offsetWidth) + 'px';
}

bubbleOpacitySlider.addEventListener('input', updateBubbleSliderThumb);
requestAnimationFrame(function() { requestAnimationFrame(updateBubbleSliderThumb); });

// 效果 chip 单选
document.getElementById('bubbleEffectChips').querySelectorAll('.bubble-effect-chip').forEach(function(chip) {
  chip.addEventListener('click', function() {
    document.getElementById('bubbleEffectChips').querySelectorAll('.bubble-effect-chip').forEach(function(c) {
      c.classList.remove('selected');
    });
    this.classList.add('selected');
  });
});

// =============================================
// 角色设置 — 自定义 CSS
// =============================================
var customCssInput    = document.getElementById('customCssInput');
var customCssApplyBtn = document.getElementById('customCssApplyBtn');
// 应用 = 预览：把当前表单（含背景/气泡/CSS）套到聊天室；点「保存」才写入角色
customCssApplyBtn.addEventListener('click', function() {
  applyChatRoomStyle(readCharForm());
  customCssApplyBtn.classList.add('applied');
  customCssApplyBtn.textContent = '已应用';
  setTimeout(function() {
    customCssApplyBtn.classList.remove('applied');
    customCssApplyBtn.textContent = '应用';
  }, 1800);
});
