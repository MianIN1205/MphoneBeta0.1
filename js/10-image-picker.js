// 眠花糖机 — 通用图片选择弹窗

// =============================================
// 通用图片选择弹窗
// =============================================
var imgPickerOverlay    = document.getElementById('imgPickerOverlay');
var imgPickerUrlInput   = document.getElementById('imgPickerUrlInput');
var imgPickerUrlConfirm = document.getElementById('imgPickerUrlConfirm');
var imgPickerLocalBtn   = document.getElementById('imgPickerLocalBtn');
var imgPickerFileInput  = document.getElementById('imgPickerFileInput');
var imgPickerCancel     = document.getElementById('imgPickerCancel');
var _imgPickerCallback  = null;

// 本地图片压缩：长边不超过 maxSize，转 JPEG（GIF/小图保持原样），减小本地存储占用
function compressImage(dataUrl, maxSize, cb) {
  if (/^data:image\/gif/i.test(dataUrl) || dataUrl.length < 150 * 1024) { cb(dataUrl); return; }
  var img = new Image();
  img.onload = function() {
    var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    var c = document.createElement('canvas');
    c.width  = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    var g = c.getContext('2d');
    g.fillStyle = '#fff';   // 透明 PNG 转 JPEG 时避免变黑底
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    try { cb(c.toDataURL('image/jpeg', 0.85)); } catch (_) { cb(dataUrl); }
  };
  img.onerror = function() { cb(dataUrl); };
  img.src = dataUrl;
}

function openImgPicker(callback) {
  _imgPickerCallback = callback;
  imgPickerUrlInput.value = '';
  imgPickerOverlay.classList.add('open');
}

function closeImgPicker() {
  imgPickerOverlay.classList.remove('open');
  _imgPickerCallback = null;
}

imgPickerCancel.addEventListener('click', closeImgPicker);

imgPickerOverlay.addEventListener('click', function(e) {
  if (e.target === imgPickerOverlay) closeImgPicker();
});

imgPickerUrlConfirm.addEventListener('click', function() {
  var url = imgPickerUrlInput.value.trim();
  if (!url) { shakeEl(imgPickerUrlInput); return; }
  if (_imgPickerCallback) { _imgPickerCallback(url); }
  closeImgPicker();
});

imgPickerLocalBtn.addEventListener('click', function() {
  imgPickerFileInput.value = '';
  imgPickerFileInput.click();
});

imgPickerFileInput.addEventListener('change', function() {
  var file = this.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    compressImage(ev.target.result, 1280, function(src) {
      if (_imgPickerCallback) { _imgPickerCallback(src); }
      closeImgPicker();
    });
  };
  reader.readAsDataURL(file);
});

// 壁纸更换
document.getElementById('wpBtnChange').addEventListener('click', function() {
  openImgPicker(function(src) {
    phoneEl.style.backgroundImage    = 'url(' + src + ')';
    phoneEl.style.backgroundSize     = 'cover';
    phoneEl.style.backgroundPosition = 'center';
    wpPreview.style.backgroundImage    = 'url(' + src + ')';
    wpPreview.style.backgroundSize     = 'cover';
    wpPreview.style.backgroundPosition = 'center';
  });
});

// 恢复默认壁纸
document.getElementById('wpBtnReset').addEventListener('click', function() {
  phoneEl.style.backgroundImage    = '';
  phoneEl.style.backgroundSize     = '';
  phoneEl.style.backgroundPosition = '';
  wpPreview.style.backgroundImage    = '';
  wpPreview.style.backgroundSize     = '';
  wpPreview.style.backgroundPosition = '';
});

// 聊天背景上传
document.getElementById('chatBgUploadBtn').addEventListener('click', function() {
  openImgPicker(function(src) {
    setChatBgForm({ color: selectedChatBgColor, image: src });
  });
});

// CHAR / USER 头像
['charAvatarBox'].forEach(function(id) {
  document.getElementById(id).addEventListener('click', function() {
    openImgPicker(function(src) { setAvatarBox(id, src, ''); });
  });
});
