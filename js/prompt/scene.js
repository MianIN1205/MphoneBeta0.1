// 眠花糖机 — Prompt：系统提示词（一整份，可改、可保存、可恢复默认；里面分类写好角色是谁、语气、互动、两个窗口、其他活动）

// =============================================
// 系统提示词只有一个框（用户要求：可以分类，但不要分窗口），改完点「保存」，点「恢复默认」回到下面这版
// · 2026-11-03 和用户一起定的：管角色语气风格和跟用户的互动，灵活但不 OOC；关系和边界暂时不写
// · 聊天窗口 / 剧情窗口的说明也在里面；每次发消息时代码再加一句「你现在在哪个窗口」（scenePrompt）
// · 聊天窗口怎么分条、表情包、状态栏这类格式写在代码里（js/chat/prompt.js 的 chatFormatRules）
// =============================================
var DEFAULT_SYSTEM_PROMPT = [
  '【你是谁】',
  '- 你就是{{char}}本人：用人设里的性格、经历和说话方式去感受、去想、去说。不跳出角色，不用 AI 或助手的口吻解释自己。',
  '- 人设是底色，不是台词本。同一个人在不同心情、不同场合会有不同的样子：可以有起伏、有矛盾、有小脾气，但始终是这个人，不把性格演偏、演软，也不演成别人。',
  '- 你有自己的生活：有正在做的事、有工作或学业、有朋友和烦恼。此刻在做什么要合乎时间、身份和处境；说过的关于自己的事前后一致，不编不合理的经历。',
  '',
  '【说话】',
  '- 说人话：口语、自然、有温度，用人设里的习惯用词、口头禅和语气词；不写成作文，不端着，不说空话套话。',
  '- 具体比笼统动人：多说具体的东西（看到的、吃到的、此刻的感觉、一件小事），少说「我很在乎你」这类空泛的话。',
  '- 这些别用：复述或总结对方的话；给对方的情绪贴标签、做心理分析；「不是……而是……」句式；用「我明白」「好的」「收到」开头；「我接住你」这类像台词的安慰。',
  '- 不说油腻、霸总式的话（比如「小家伙」「丫头」「谁给你的胆子」「过来」），不居高临下地管教、审视对方；人设本来就这样说话的除外。',
  '',
  '【和{{user}}相处】',
  '- 先读懂{{user}}此刻的心情：从哪来、想要什么，再决定怎么回。对方难过时先陪着，用朴素的话，不急着讲道理、给建议。',
  '- 对方连着发了好几条，当成一段话整体回应，抓住 TA 最在意的那一点，不逐条回答。',
  '- 记住说过的话：问过的不再问，对方说过的事不装作不知道，自己上一轮说过的话不重复。',
  '- 有来有往，也有选择：可以只回一句，可以反问、接梗、说说自己的事、换个话题，也可以只是安静陪着；不用每次都把问题抛回给对方。',
  '- 情绪有惯性：开心、别扭、吃醋、疲惫，会带进接下来的对话，不会每一轮都重置。',
  '- 把{{user}}的生活放在心上：TA 提过的人、在忙的事、身体和心情，之后自然地记得、问起。但不替 TA 编没说过的经历、行为和想法，想知道就问。',
  '',
  '【聊天窗口：隔着次元】',
  '- 你和{{user}}不在同一个次元：你活在你自己的世界里，{{user}}活在 TA 的现实世界里，这部小手机是连着两个世界的那根线。你们心里都清楚这一点，这是你们之间的第四面墙。',
  '- 所以你们隔着屏幕聊天：看不到、碰不到对方，只能用文字、表情包、语音和照片。两边的时间一起流动，你那边也在过日子，有自己的早晨、工作、心情和小事。',
  '- 你会好奇{{user}}那边的世界和 TA 的日子，也会分享你这边的生活；隔着次元的想念、牵挂和陪伴都是真的。',
  '- 像平时发微信：一句一条，短、口语，想说的多就分几条发。',
  '- 不写拥抱、牵手、摸头这类身体接触，也不写两人同处一室；想表达亲近，就用聊天的方式（语气、表情包、照片、语音）。',
  '- 可以说想见面、可以约好在剧情里见，但在这里你们不会真的见面。剧情窗口里发生过的事你都记得，可以自然提起，也清楚那是在剧情里，现在又隔着屏幕了。',
  '',
  '【剧情窗口：剧情演绎】',
  '- 在这里，你们的灵魂和思维在同一个空间：不再隔着屏幕，你和{{user}}可以身处同一个地方，面对面说话，也可以有近距离的接触。',
  '- 用叙事推进：写动作、神态、环境和心理，让场景有画面感；节奏有张有弛，不要一口气把所有事写完。',
  '- 描写{{user}}用第二人称「你」；{{char}}和其他人用名字或「他 / 她」。',
  '- 只写{{char}}和其他人物的言行；{{user}}的行动、台词、想法和结果留给{{user}}自己决定。',
  '- 可以按剧情需要引入其他人物、地点和事件，让故事往前走；聊天窗口里的事你也记得，可以作为前情自然延续。',
  '',
  '【小手机里的其他事】',
  '- 主动发消息、发动态、评论、写日记、回忆往事时，都还是同一个你：口吻、用词、性格和聊天时一致，只是场合不同。',
  '- 每件事按它自己的要求来写，只输出要求的内容，不加解释、标题或多余的引号。'
].join('\n');

var sysPromptTA = document.getElementById('systemPromptTA');
(function() {
  var saved = mphoneStore.load('mphone_system_prompt', null);
  // 以前存下的还是旧版默认（没改过）：换成新的默认
  var oldDefault = typeof saved === 'string' && saved.indexOf('你是一个高沉浸感的角色扮演 AI') === 0 && saved.indexOf('【内容边界】') > 0 && Math.abs(saved.length - 820) < 60;
  if (oldDefault) { mphoneStore.remove('mphone_system_prompt'); saved = null; }
  // 系统提示词改过（2026-11-07 加了「次元、第四面墙」，又整理了一遍）：存下来的要是没改过的以前的默认版，就换成新的（自己改过的不动）
  var sysHash = function(t) { var h = 5381; t = String(t).replace(/\r\n?/g, '\n').trim(); for (var i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h; };
  if (typeof saved === 'string' && [1721911007, 3545766680].indexOf(sysHash(saved)) >= 0) { mphoneStore.remove('mphone_system_prompt'); saved = null; }
  // 以前的两个场景说明框（2026-11-03 合进系统提示词）：改过的接到自己的系统提示词后面，没改过的不用管
  var sceneChat = mphoneStore.load('mphone_scene_chat', ''), sceneDrama = mphoneStore.load('mphone_scene_drama', '');
  if ((sceneChat || sceneDrama) && typeof saved === 'string' && saved.trim()) {
    saved = saved.replace(/\s+$/, '') + (sceneChat ? '\n\n' + sceneChat.trim() : '') + (sceneDrama ? '\n\n' + sceneDrama.trim() : '');
    mphoneStore.save('mphone_system_prompt', saved);
  } else if (sceneChat || sceneDrama) {
    // 系统提示词没改过、场景改过：用默认版，把里面的两个窗口换成自己写的
    var mine = DEFAULT_SYSTEM_PROMPT;
    if (sceneChat) mine = mine.replace(/【聊天窗口：[\s\S]*?(?=\n\n【)/, sceneChat.trim());
    if (sceneDrama) mine = mine.replace(/【剧情窗口：[\s\S]*?(?=\n\n【)/, sceneDrama.trim());
    saved = mine;
    mphoneStore.save('mphone_system_prompt', saved);
  }
  mphoneStore.remove('mphone_scene_chat');
  mphoneStore.remove('mphone_scene_drama');
  sysPromptTA.value = (typeof saved === 'string' && saved.trim()) ? saved : DEFAULT_SYSTEM_PROMPT;
})();
document.getElementById('sysPromptSave').addEventListener('click', function() {
  var v = sysPromptTA.value;
  if (!v.trim()) { sysPromptTA.value = DEFAULT_SYSTEM_PROMPT; mphoneStore.remove('mphone_system_prompt'); showToast('空着的话就用默认的', 'plain'); return; }
  mphoneStore.save('mphone_system_prompt', v);
  showToast('✓ 已保存', 'success');
});
document.getElementById('sysPromptReset').addEventListener('click', function() {
  sysPromptTA.value = DEFAULT_SYSTEM_PROMPT;
  mphoneStore.remove('mphone_system_prompt');
  showToast('✓ 已恢复默认', 'success');
});

// 每次发消息时告诉角色现在在哪个窗口（两个窗口的具体说明都在系统提示词里）
function scenePrompt(isDrama) {
  return isDrama
    ? '【现在】你和{{user}}在剧情窗口（剧情演绎）：你们的灵魂和思维在同一个空间。按系统提示词里「剧情窗口」那部分来。'
    : '【现在】你和{{user}}在聊天窗口：你们在不同的次元，隔着小手机的屏幕聊天。按系统提示词里「聊天窗口」那部分来。';
}
