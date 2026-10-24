// 眠花糖机 — API 配置持久化 — 加载已保存配置

// =============================================
// API 配置持久化 — 加载已保存配置
// =============================================
(function loadSavedConfig() {
  var su = mphoneStore.load('mphone_api_url', null) || '';
  var sk = mphoneStore.load('mphone_api_key', null) || '';
  var st = mphoneStore.load('mphone_temperature', null) || '0.80';
  if (su) document.getElementById('apiUrl').value = su;
  if (sk) document.getElementById('apiKey').value = sk;
  var sm = mphoneStore.load('mphone_model', null) || '';
  if (sm) modelDisplay.textContent = sm;
  tempSlider.value = st;
  updateSliderThumb();
})();

document.getElementById('btnApply').addEventListener('click', function() {
  var url   = document.getElementById('apiUrl').value.trim();
  var key   = document.getElementById('apiKey').value.trim();
  var model = modelDisplay.textContent.trim();
  var temp  = tempSlider.value;
  mphoneStore.save('mphone_api_url', url);
  mphoneStore.save('mphone_api_key', key);
  mphoneStore.save('mphone_temperature', temp);
  if (model && model !== '请选择模型') {
    mphoneStore.save('mphone_model', model);
  } else {
    mphoneStore.remove('mphone_model');
  }
  var btn = this, orig = btn.textContent;
  btn.textContent = '✓ 已保存'; btn.style.color = '#4CAF50';
  setTimeout(function() { btn.textContent = orig; btn.style.color = ''; }, 1500);
});

// 刷新模型 — 真实 API（含旋转状态 + Toast 反馈）
var _refreshing = false;
refreshBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  if (_refreshing) return;
  var url = document.getElementById('apiUrl').value.trim() || mphoneStore.load('mphone_api_url', null) || '';
  var key = document.getElementById('apiKey').value.trim() || mphoneStore.load('mphone_api_key', null) || '';
  if (!url || !key) return;
  _refreshing = true;
  refreshBtn.classList.add('spinning');
  fetch(url.replace(/\/$/, '') + '/models', { headers: { 'Authorization': 'Bearer ' + key } })
    .then(function(r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function(d) {
      var models = (d.data || []).map(function(m) { return m.id; }).sort();
      if (!models.length) throw new Error('empty');
      modelPopup.innerHTML = '';
      models.forEach(function(id) {
        var item = document.createElement('div');
        item.className = 'model-popup-item';
        item.dataset.model = id;
        item.textContent = id;
        item.addEventListener('click', function(ev) {
          ev.stopPropagation();
          document.querySelectorAll('.model-popup-item').forEach(function(i) { i.classList.remove('selected'); });
          item.classList.add('selected');
          modelDisplay.textContent = id;
          modelPopup.classList.remove('open');
          modelChevron.classList.remove('open');
        });
        modelPopup.appendChild(item);
      });
      // 优先恢复上次保存的模型，找不到则选第一个
      var savedModel = mphoneStore.load('mphone_model', null) || '';
      var matchedModel = (savedModel && models.indexOf(savedModel) >= 0) ? savedModel : models[0];
      modelPopup.querySelectorAll('.model-popup-item').forEach(function(it) {
        it.classList.toggle('selected', it.dataset.model === matchedModel);
      });
      modelDisplay.textContent = matchedModel;
      refreshBtn.classList.remove('spinning');
      _refreshing = false;
      showToast('✓ 刷新成功', 'success');
    })
    .catch(function(err) {
      console.warn('[Mphone] 获取模型列表失败:', err);
      refreshBtn.classList.remove('spinning');
      _refreshing = false;
      showToast('✗ 获取失败', 'error');
    });
});
