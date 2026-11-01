// 眠花糖机 — Prompt：场景说明（聊天窗口 = 隔着屏幕；剧情窗口 = 剧情空间）

// =============================================
// Prompt — 场景说明：聊天窗口 = 隔着屏幕的线上；剧情窗口 = 可以见面、自由发展的剧情空间
// 发消息时按窗口放进提示词（见 js/chat/prompt.js buildMsgs）；清空就恢复默认
// =============================================
var DEFAULT_SCENE_CHAT = [
  '【当前场景：线上聊天】',
  '你和{{user}}此刻正隔着手机屏幕，用聊天软件互发消息。你们不在同一个空间：看不到对方、碰不到对方，只能通过文字、表情、语音和图片来表达。',
  '- 不要写拥抱、牵手、摸头这类身体接触，也不要写两人同处一室的动作描写；想表达亲近，就用聊天的方式（语气、表情、发图、语音）。',
  '- 可以说想见面、约好见面，但真正的见面不在这里发生。',
  '- 如果你们在「剧情空间」里有过近距离的经历，你都记得，可以自然地提起、回味；但你清楚那是在剧情空间里发生的，现在你们仍然隔着屏幕。'
].join('\n');
var DEFAULT_SCENE_DRAMA = [
  '【当前场景：剧情空间】',
  '这里是一个特殊的空间，不受手机屏幕的限制：你和{{user}}可以身处同一个地方，面对面交谈，也可以有近距离的接触。',
  '- 用叙事的方式推进：可以描写动作、神态、环境和旁白，自由发展线下剧情和 if 线。',
  '- 可以按剧情需要引入其他角色、地点和事件，让故事有更多发展；但不要替{{user}}决定行动和结果。',
  '- 你清楚自己现在身处剧情空间。线上聊天里的事你也记得，可以作为前情自然延续。'
].join('\n');
[['sceneChatTA', 'mphone_scene_chat', DEFAULT_SCENE_CHAT], ['sceneDramaTA', 'mphone_scene_drama', DEFAULT_SCENE_DRAMA]].forEach(function(s) {
  var ta = document.getElementById(s[0]);
  ta.value = mphoneStore.load(s[1], '') || s[2];
  ta.addEventListener('input', function() { mphoneStore.save(s[1], this.value.trim() ? this.value : ''); });
  ta.addEventListener('blur', function() { if (!this.value.trim()) this.value = s[2]; });
});
function scenePrompt(isDrama) {
  var v = document.getElementById(isDrama ? 'sceneDramaTA' : 'sceneChatTA').value.trim();
  return v || (isDrama ? DEFAULT_SCENE_DRAMA : DEFAULT_SCENE_CHAT);
}
