// 眠花糖机 — 接口报错记录：外部接口出错时记下来（不记密钥），供内置助手 MianIN 答疑

// =============================================
// 接口报错记录：外部接口返回错误或连不上时记下来，供内置助手答疑
// 只记地址（去掉 ? 后面的参数）、状态码和报错文字，不记密钥
// =============================================
var apiErrorLog = mphoneStore.load('mphone_api_errors', []);
var API_ERROR_MAX = 20;
function apiFeatureName(path) {
  if (/chat\/completions/.test(path)) return '聊天回复';
  if (/\/models\/?$/.test(path)) return '获取模型列表';
  if (/audio\/transcriptions/.test(path)) return '语音转文字';
  if (/audio\/speech|t2a|text-to-speech/.test(path)) return '语音合成';
  if (/image/.test(path)) return '生图';
  return '接口请求';
}
// 报错文字里可能带着密钥片段，存之前打码
function redactSecret(text) {
  return String(text || '').replace(/(sk|key|pk)-[A-Za-z0-9_\-]{6,}/gi, '$1-***').replace(/Bearer\s+\S+/gi, 'Bearer ***').slice(0, 300);
}
function logApiError(url, status, message) {
  var u;
  try { u = new URL(url, location.href); } catch (_) { return; }
  apiErrorLog.push({ time: Date.now(), feature: apiFeatureName(u.pathname), url: u.origin + u.pathname,
                     status: status, message: redactSecret(message) });
  if (apiErrorLog.length > API_ERROR_MAX) apiErrorLog = apiErrorLog.slice(-API_ERROR_MAX);
  mphoneStore.save('mphone_api_errors', apiErrorLog);
}
(function() {
  var rawFetch = window.fetch;
  if (!rawFetch) return;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var external = false;
    try { external = new URL(url, location.href).origin !== location.origin; } catch (_) {}
    var p = rawFetch.apply(this, arguments);
    if (!external) return p;
    return p.then(function(res) {
      if (!res.ok) {
        res.clone().text().then(function(t) {
          var msg = t;
          try { var j = JSON.parse(t); msg = (j.error && (j.error.message || j.error)) || j.message || j.detail || t; } catch (_) {}
          logApiError(url, res.status, typeof msg === 'string' ? msg : JSON.stringify(msg));
        }, function() { logApiError(url, res.status, ''); });
      }
      return res;
    }, function(err) {
      if (!err || err.name !== 'AbortError') logApiError(url, 0, (err && err.message) || '连接失败');
      throw err;
    });
  };
})();
