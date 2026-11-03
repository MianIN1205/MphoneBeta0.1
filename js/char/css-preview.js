// 眠花糖机 — 预览 MianIN 改的样式：确认卡片上点「预览」，直接套到对应的界面上看（不存），顶上一条「取消 / 应用」
// 全局样式：整个小手机先换上新样式，可以到处点点看；角色的样式：跳到那个角色的聊天 / 剧情窗口看，看完回到原来的对话

var cssPreviewOverride = null;   // { charId, view: 'chat' | 'drama', part }：room.js 的 roomLookPart 会先用它
var cssPreviewState = null;      // { a, onApply, back: { idx, view, active }, lastView, globalEl }
var cssPreviewBar = document.getElementById('cssPreviewBar');
document.body.appendChild(cssPreviewBar);

function cssPreviewOpenRoom(idx, view) {
  var char = charList[idx];
  if (!char) return;
  openingChatCharIdx = idx;
  chatRoomTitle.textContent = char.charAlias || char.charName || '未命名';
  renderRoomLists(idx);
  switchChatRoomSubView(view === 'drama' ? 'contacts' : 'chat');
  applyChatRoomStyle(char);
  appChatRoom.classList.add('active');
}
function previewCssAction(a, onApply) {
  if (cssPreviewState) cssPreviewEnd(false);
  var st = cssPreviewState = { a: a, onApply: onApply, back: { idx: openingChatCharIdx, view: currentCrSubView, active: appChatRoom.classList.contains('active') }, lastView: JSON.parse(JSON.stringify(crLastView)) };
  var label;
  if (!a.target || a.target === 'global') {
    // 全局：先关掉现在的全局样式，换上新的（不存）
    st.globalOld = globalCssEl.textContent;
    globalCssEl.textContent = String(a.css || '');
    label = '全局样式';
  } else {
    var c = findCharByName(a.target);
    if (!c) { cssPreviewState = null; showToast('✗ 找不到角色「' + a.target + '」', 'error'); return; }
    var drama = a.view === 'drama';
    var base = drama ? (c.dramaLook || { chatBg: c.chatBg, bubble: c.bubble, look: c.look, customCss: c.customCss || '' })
                     : { chatBg: c.chatBg, bubble: c.bubble, look: c.look, customCss: c.customCss || '' };
    var part = JSON.parse(JSON.stringify(base));
    part.customCss = a.mode === 'replace' ? String(a.css || '') : ((part.customCss ? part.customCss + '\n' : '') + String(a.css || ''));
    if (drama && (a.format === 'bubble' || a.format === 'box' || a.format === 'custom')) part.look = Object.assign({}, part.look || {}, { format: a.format });
    cssPreviewOverride = { charId: c.id, view: drama ? 'drama' : 'chat', part: part };
    cssPreviewOpenRoom(charList.indexOf(c), drama ? 'drama' : 'chat');
    label = '「' + (c.charAlias || c.charName) + '」的' + (drama ? '剧情窗口' : '聊天窗口');
  }
  document.getElementById('cssPreviewText').textContent = '正在预览' + label + '的新样式';
  cssPreviewBar.classList.add('open');
}
// apply：true = 应用（回到原来的对话后再执行确认），false = 取消
function cssPreviewEnd(apply) {
  var st = cssPreviewState;
  if (!st) return;
  cssPreviewState = null;
  cssPreviewBar.classList.remove('open');
  if (st.globalOld !== undefined) globalCssEl.textContent = st.globalOld;
  cssPreviewOverride = null;
  // 先应用（存好、卡片记成已生效），再回到原来的对话，回去时卡片按新状态重画
  if (apply && st.onApply) st.onApply();
  if (st.globalOld === undefined) {
    // 回到原来的对话（预览前在哪个角色、哪一边）；预览时跳过去不算「上次停在哪」
    if (st.back.idx >= 0 && charList[st.back.idx]) cssPreviewOpenRoom(st.back.idx, st.back.view === 'contacts' ? 'drama' : 'chat');
    if (!st.back.active) appChatRoom.classList.remove('active');
    crLastView = st.lastView;
    mphoneStore.save('mphone_last_view', crLastView);
  }
}
document.getElementById('cssPreviewCancel').addEventListener('click', function() { cssPreviewEnd(false); });
document.getElementById('cssPreviewApply').addEventListener('click', function() { cssPreviewEnd(true); });
