// 眠花糖机 — 聊天 / 剧情记录：按角色存取、保存时去掉临时字段、当前窗口用哪份记录、角色用哪套 API

// =============================================
// 聊天对话室 — 消息发送与渲染
// =============================================
// 聊天 / 剧情记录按角色 id 存储（chatHistories 在 charList 旁加载），idx 为 charList 下标
function charKey(idx) { return charList[idx] ? charList[idx].id : '_none'; }
function getChatHistory(idx) { var k = charKey(idx); if (!chatHistories[k]) chatHistories[k] = []; return chatHistories[k]; }
function getDramaHistory(idx) { var k = charKey(idx); if (!dramaHistories[k]) dramaHistories[k] = []; return dramaHistories[k]; }
// 一条消息要保存的字段；alts 是「重新生成」留下的多个版本（每个版本是一组消息）
function stripMsg(m) {
  var o = { role: m.role, content: m.content, imgSrc: m.imgSrc, sticker: m.sticker, status: m.status, time: m.time,
            quote: m.quote, recalled: m.recalled, recalledText: m.recalledText, recalledBy: m.recalledBy,
            voice: m.voice, transcript: m.transcript, action: m.action, recap: m.recap, pat: m.pat, patSuffix: m.patSuffix, cal: m.cal,
            narr: m.narr, think: m.think, errs: m.errs, file: m.file, textImg: m.textImg, photo: m.photo, illus: m.illus };
  if (m.alts) {
    o.alts = m.alts.map(function(group) {
      return group.map(function(g) { return { role: g.role, content: g.content, sticker: g.sticker, status: g.status, time: g.time, action: g.action, recap: g.recap, pat: g.pat, cal: g.cal, think: g.think,
                                              recalled: g.recalled, recalledText: g.recalledText, recalledBy: g.recalledBy }; });
    });
    o.altIdx = m.altIdx;
  }
  return o;
}
function saveHistories() {
  // 只保存需要的字段（去掉运行时状态）；语音录音以 dataURL 保存，刷新后可以重新播放
  var strip = function(all) {
    var out = {};
    Object.keys(all).forEach(function(k) {
      out[k] = all[k].map(stripMsg);
    });
    return out;
  };
  mphoneStore.save('mphone_chat_histories', strip(chatHistories));
  mphoneStore.save('mphone_drama_histories', strip(dramaHistories));
}
function getActiveHistory(idx) {
  return (currentCrSubView === 'contacts') ? getDramaHistory(idx) : getChatHistory(idx);
}
function getActiveMsgListEl() {
  return document.getElementById(currentCrSubView === 'contacts' ? 'dramaMsgList' : 'chatMsgList');
}
function getActiveEmptyEl() {
  return document.getElementById(currentCrSubView === 'contacts' ? 'dramaRoomEmpty' : 'chatRoomEmpty');
}
// 传入角色且它在便捷拓展栏选了模型预设时，用那套预设（见 js/chat/quick-bar.js）
function getApiCfg(char) {
  var p = (char && typeof charApiPreset === 'function') ? charApiPreset(char) : null;
  if (p) return { url: p.url || '', key: p.key || '', model: p.model || '', temp: isNaN(parseFloat(p.temp)) ? 0.8 : parseFloat(p.temp) };
  return {
    url:   (document.getElementById('apiUrl').value.trim()  || mphoneStore.load('mphone_api_url', null)     || ''),
    key:   (document.getElementById('apiKey').value.trim()  || mphoneStore.load('mphone_api_key', null)     || ''),
    model: (modelDisplay.textContent.trim() === '请选择模型' ? '' : modelDisplay.textContent.trim()),
    temp:  parseFloat(tempSlider.value || mphoneStore.load('mphone_temperature', null) || '0.8')
  };
}
