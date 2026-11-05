// 眠花糖机 — 桌面「花房」：整个小手机养一盆植物（用户选品种，种下满三个月或者彻底枯萎了才能换）。
// 浇水、施肥、晒太阳、摸摸让它长大：种子 → 发芽 → 小苗 → 长叶 → 花苞 → 开花；太久不浇水会渴、会蔫，七天不浇就枯萎了（mphone_garden）

var GARDEN_SPECIES = [
  // 粉色
  { id: 'rose', name: '玫瑰', lang: '热烈的爱', color: 'pink', kind: 'rose', petal: '#e8637f', center: '#c94767', leaf: '#5f9f63' },
  { id: 'tulip', name: '郁金香', lang: '爱的告白', color: 'pink', kind: 'tulip', petal: '#f2879d', center: '#e66a86', leaf: '#7dbb79', longLeaf: true },
  { id: 'sakura', name: '樱花', lang: '珍惜眼前的幸福', color: 'pink', kind: 'sprig', petal: '#f8c6d4', center: '#e88aa5', leaf: '#8cbf7a' },
  { id: 'hyacinth', name: '风信子', lang: '倾慕与浪漫', color: 'pink', kind: 'spike', petal: '#f39fc0', center: '#e27ca6', leaf: '#7ab884', longLeaf: true, star: true, method: 'water' },
  { id: 'carnation', name: '康乃馨', lang: '温馨的祝福', color: 'pink', kind: 'carnation', petal: '#f4a0b5', center: '#e57d98', leaf: '#7db58a' },
  { id: 'peony', name: '芍药', lang: '情有独钟', color: 'pink', kind: 'rose', petal: '#f7b7c8', center: '#ee97ae', leaf: '#6fae72' },
  { id: 'cosmos', name: '波斯菊', lang: '少女的纯情', color: 'pink', kind: 'radial', petal: '#f59ab8', center: '#f3c84b', leaf: '#8cc283', n: 8, pl: 14, pw: 6, cr: 4 },
  { id: 'orchid', name: '蝴蝶兰', lang: '幸福向你飞来', color: 'pink', kind: 'radial', petal: '#f3b6d3', center: '#d9578d', leaf: '#5f9f63', n: 5, pl: 13, pw: 9, cr: 4 },
  // 黄色
  { id: 'sunflower', name: '向日葵', lang: '沉默的爱，只看着你', color: 'yellow', kind: 'radial', petal: '#f7c948', center: '#8a5a2b', leaf: '#79b26a', n: 18, pl: 17, pw: 6, cr: 13 },
  { id: 'winterjasmine', name: '迎春花', lang: '希望', color: 'yellow', kind: 'sprig', petal: '#f7d44a', center: '#e8b23a', leaf: '#7fb56f' },
  { id: 'freesia', name: '小苍兰', lang: '天真与纯洁', color: 'yellow', kind: 'bell', petal: '#f8d76a', center: '#f3e3a0', leaf: '#82b878', longLeaf: true },
  { id: 'wintersweet', name: '蜡梅', lang: '慈爱心', color: 'yellow', kind: 'sprig', petal: '#f6dd7a', center: '#b9862f', leaf: '#9a8566' },
  { id: 'jonquil', name: '黄水仙', lang: '重温爱情', color: 'yellow', kind: 'radial', petal: '#f9df6b', center: '#f2a93b', leaf: '#79b884', n: 6, pl: 11, pw: 6, cr: 5, longLeaf: true, method: 'pebble' },
  { id: 'ranunculus', name: '花毛茛', lang: '受欢迎', color: 'yellow', kind: 'rose', petal: '#f9d55b', center: '#e9b52e', leaf: '#6fae72' },
  { id: 'mimosa', name: '金合欢', lang: '秘密的爱', color: 'yellow', kind: 'dots', petal: '#f7d23e', center: '#e9b52a', leaf: '#86b07a', dotR: 3.4 },
  { id: 'dandelion', name: '蒲公英', lang: '无法停留的爱', color: 'yellow', kind: 'radial', petal: '#f7cf3c', center: '#e9b52a', leaf: '#7fb56f', n: 24, pl: 10, pw: 1.8, cr: 5 },
  // 白色
  { id: 'daisy', name: '小雏菊', lang: '藏在心底的爱', color: 'white', kind: 'radial', petal: '#ffffff', center: '#f5c542', leaf: '#78b871', n: 14, pl: 13, pw: 5, cr: 7 },
  { id: 'jasmine', name: '茉莉', lang: '你是我的', color: 'white', kind: 'radial', petal: '#ffffff', center: '#f4e9c4', leaf: '#5f9f63', n: 6, pl: 12, pw: 5.5, cr: 3 },
  { id: 'gardenia', name: '栀子花', lang: '一生的守候', color: 'white', kind: 'radial', petal: '#fffdf4', center: '#f2ecd0', leaf: '#4f9461', n: 6, pl: 15, pw: 7.5, cr: 4 },
  { id: 'lily', name: '铃兰', lang: '幸福归来', color: 'white', kind: 'bell', petal: '#ffffff', center: '#e9ecd8', leaf: '#6fb07a', longLeaf: true },
  { id: 'narcissus', name: '水仙', lang: '思念', color: 'white', kind: 'radial', petal: '#ffffff', center: '#f6c84a', leaf: '#79b884', n: 6, pl: 11, pw: 6, cr: 5, longLeaf: true, method: 'pebble' },
  { id: 'lilium', name: '百合', lang: '百年好合', color: 'white', kind: 'radial', petal: '#ffffff', center: '#cfe3b8', leaf: '#6aa86f', n: 6, pl: 18, pw: 6, cr: 3, longLeaf: true },
  { id: 'gypsophila', name: '满天星', lang: '真心喜欢', color: 'white', kind: 'dots', petal: '#ffffff', center: '#d9dcd2', leaf: '#86b07a', dotR: 2.2 },
  { id: 'camellia', name: '白山茶', lang: '理想的爱', color: 'white', kind: 'rose', petal: '#fffaf2', center: '#efe2cf', leaf: '#3f8a58' },
  // 紫色
  { id: 'lavender', name: '薰衣草', lang: '等待爱情', color: 'purple', kind: 'spike', petal: '#a88bd8', center: '#8c6bc8', leaf: '#8fb59a', longLeaf: true },
  { id: 'platycodon', name: '桔梗', lang: '真诚不变的爱', color: 'purple', kind: 'radial', petal: '#9b7fe0', center: '#e8e0ff', leaf: '#76b07a', n: 5, pl: 16, pw: 9, cr: 4 },
  { id: 'stock', name: '紫罗兰', lang: '永恒的美', color: 'purple', kind: 'spike', petal: '#b88be0', center: '#9a6fd0', leaf: '#86b28c', longLeaf: true, star: true },
  { id: 'pansy', name: '三色堇', lang: '请思念我', color: 'purple', kind: 'radial', petal: '#7d5fc4', center: '#f6d55c', leaf: '#7fb07a', n: 5, pl: 13, pw: 8, cr: 4 },
  { id: 'wisteria', name: '紫藤', lang: '醉人的恋情', color: 'purple', kind: 'drape', petal: '#b59be3', center: '#8f72cf', leaf: '#7dae7a' },
  { id: 'iris', name: '鸢尾', lang: '爱的使者', color: 'purple', kind: 'tulip', petal: '#8b76d6', center: '#f2c94c', leaf: '#77ad84', longLeaf: true },
  { id: 'lilac', name: '丁香', lang: '初恋', color: 'purple', kind: 'cluster', petal: '#c4a6e6', center: '#a885d9', leaf: '#6fa86b' },
  { id: 'morningglory', name: '牵牛花', lang: '爱情永固', color: 'purple', kind: 'trumpet', petal: '#8d7ae0', center: '#f4f0ff', leaf: '#7fb56f' },
  // 蓝色
  { id: 'forgetmenot', name: '勿忘我', lang: '不要忘记我', color: 'blue', kind: 'sprig', petal: '#7fb2ec', center: '#f6d55c', leaf: '#7fb07a' },
  { id: 'hydrangea', name: '绣球', lang: '团圆与美满', color: 'blue', kind: 'cluster', petal: '#9ec3f0', center: '#b9a6e0', leaf: '#6fa86b' },
  { id: 'cornflower', name: '矢车菊', lang: '遇见幸福', color: 'blue', kind: 'radial', petal: '#5f8fe0', center: '#3d5fae', leaf: '#86b59a', n: 12, pl: 12, pw: 3.5, cr: 6 },
  { id: 'bellflower', name: '风铃草', lang: '温柔的爱', color: 'blue', kind: 'bell', petal: '#9db8f2', center: '#c9d8fb', leaf: '#74ad7c', longLeaf: true },
  { id: 'larkspur', name: '飞燕草', lang: '自由', color: 'blue', kind: 'spike', petal: '#6f95e6', center: '#4d73c9', leaf: '#7fb58a', longLeaf: true },
  { id: 'bluerose', name: '蓝色妖姬', lang: '相守是一种承诺', color: 'blue', kind: 'rose', petal: '#5d86d9', center: '#3e63b3', leaf: '#5f9f63' },
  { id: 'bluestar', name: '蓝星花', lang: '幸福的爱', color: 'blue', kind: 'radial', petal: '#9cc4f2', center: '#5c86c9', leaf: '#86b59a', n: 5, pl: 9, pw: 6, cr: 3 },
  { id: 'bluehyacinth', name: '蓝风信子', lang: '高贵浪漫', color: 'blue', kind: 'spike', petal: '#8fb2ee', center: '#6f93d9', leaf: '#7ab884', longLeaf: true, star: true, method: 'water' },
  // 绿色（观叶植物：长到最后是「茂盛」，不开花；多肉会开小花）
  { id: 'succulent', name: '多肉', lang: '安安静静陪着你', color: 'green', kind: 'succulent', petal: '#f4a6b8', center: '#9cc9a7', leaf: '#9cc9a7', method: 'pebble' },
  { id: 'pothos', name: '绿萝', lang: '守望幸福', color: 'green', kind: 'vine', petal: '#5fae6a', center: '#3f8f50', leaf: '#5fae6a', foliage: true, method: 'water' },
  { id: 'pennywort', name: '铜钱草', lang: '财源滚滚', color: 'green', kind: 'pennywort', petal: '#7cc77a', center: '#4f9f55', leaf: '#7cc77a', foliage: true, method: 'water' },
  { id: 'mint', name: '薄荷', lang: '再爱我一次', color: 'green', kind: 'mint', petal: '#8fd19e', center: '#5fae72', leaf: '#8fd19e', foliage: true },
  { id: 'asparagus', name: '文竹', lang: '永恒', color: 'green', kind: 'fern', petal: '#6fb86f', center: '#4f9a55', leaf: '#6fb86f', foliage: true },
  { id: 'monstera', name: '龟背竹', lang: '健康长寿', color: 'green', kind: 'monstera', petal: '#3f9a5a', center: '#2f7a46', leaf: '#3f9a5a', foliage: true },
  { id: 'cactus', name: '仙人掌', lang: '坚强', color: 'green', kind: 'cactus', petal: '#f4a6c0', center: '#5aa36a', leaf: '#6fb07a', foliage: true, method: 'pebble' },
  { id: 'luckybamboo', name: '富贵竹', lang: '节节高升', color: 'green', kind: 'bamboo', petal: '#8cc96f', center: '#5f9a4a', leaf: '#6fb85f', foliage: true, method: 'water' }
];
// 按颜色分类挑（只有小圆点、不写字）；栽法跟着品种走（用户说自己选会种不活）：土培（陶土盆，大多数花）、水培（玻璃瓶，风信子）、石子（白瓷浅盆，水仙、多肉）
var GARDEN_COLORS = [['pink', '粉色', '#f2879d'], ['yellow', '黄色', '#f7c948'], ['white', '白色', '#f4f1ea'], ['purple', '紫色', '#a88bd8'], ['blue', '蓝色', '#7fb2ec'], ['green', '绿色', '#9cc9a7']];
var GARDEN_STAGES = [['种子', 0], ['发芽', 4], ['小苗', 12], ['长叶', 26], ['花苞', 44], ['开花', 66]];
// 观叶植物最后两个阶段叫「抽新叶」「茂盛」
function gardenStageName(sp, i) { return sp && sp.foliage ? ['种子', '发芽', '小苗', '长叶', '抽新叶', '茂盛'][i] : GARDEN_STAGES[i][0]; }
var GARDEN_ACTS = {
  water: { name: '浇水', pts: 3, cd: 12, done: '浇过啦，土还是湿的' },
  feed:  { name: '施肥', pts: 5, cd: 72, done: '养分还够，过几天再施' },
  sun:   { name: '晒太阳', pts: 2, cd: 6, done: '刚晒过，歇一会儿' },
  pet:   { name: '摸摸', pts: 1, cd: 1, done: '' }
};
var GARDEN_LOCK_DAYS = 90;
var garden = mphoneStore.load('mphone_garden', null);
function saveGarden() { mphoneStore.save('mphone_garden', garden); }
function gardenSpecies(id) { return GARDEN_SPECIES.filter(function(s) { return s.id === id; })[0] || GARDEN_SPECIES[0]; }
function gardenHours(t) { return t ? (Date.now() - t) / 3600000 : 1e9; }
function gardenStage(g) { var s = 0; GARDEN_STAGES.forEach(function(x, i) { if ((g.pts || 0) >= x[1]) s = i; }); return s; }
// 水：48 小时不浇有点渴，96 小时蔫了，七天不浇彻底枯萎（种下当天算浇过）
function gardenHealth(g) {
  if (g.deadAt) return 'dead';
  var h = gardenHours(g.last.water || g.plantedAt);
  if (h >= 168) { g.deadAt = Date.now(); saveGarden(); return 'dead'; }
  return h >= 96 ? 'wilt' : h >= 48 ? 'thirsty' : 'ok';
}
var GARDEN_HEALTH_TEXT = { ok: '精神很好', thirsty: '有点渴了', wilt: '蔫了，快浇水', dead: '彻底枯萎了' };
function gardenHealthText(g, hl) {
  if (g && gardenMethodOf(g) === 'water') return { ok: '精神很好', thirsty: '该换水了', wilt: '水浑了，快换水', dead: '彻底枯萎了' }[hl];
  return GARDEN_HEALTH_TEXT[hl];
}
function gardenCanReplant(g) { return !g || g.deadAt || gardenHours(g.plantedAt) >= GARDEN_LOCK_DAYS * 24; }
function gardenUserName() { try { return getMainAccount().nickname || '我'; } catch (_) { return '我'; } }

// ---------- 画植物（200×260 的格子，花盆在下面，茎从 (100,196) 长出来） ----------
function gardenFlower(sp, x, y, k) {
  var s = '', i, a;
  k = k || 1;
  if (sp.kind === 'radial') {
    for (i = 0; i < sp.n; i++) {
      a = 360 / sp.n * i;
      s += '<ellipse cx="' + x + '" cy="' + (y - sp.cr * k - sp.pl * k / 2) + '" rx="' + sp.pw * k + '" ry="' + sp.pl * k / 2 + '" fill="' + sp.petal + '" stroke="rgba(0,0,0,0.06)" transform="rotate(' + a + ' ' + x + ' ' + y + ')"/>';
    }
    s += '<circle cx="' + x + '" cy="' + y + '" r="' + sp.cr * k + '" fill="' + sp.center + '"/>';
    if (sp.id === 'sunflower') for (i = 0; i < 14; i++) s += '<circle cx="' + (x + Math.cos(i * 2.4) * sp.cr * 0.55 * k * (i % 3 / 2 + 0.3)) + '" cy="' + (y + Math.sin(i * 2.4) * sp.cr * 0.55 * k * (i % 3 / 2 + 0.3)) + '" r="' + 1.3 * k + '" fill="#5e3a1a" opacity="0.6"/>';
  } else if (sp.kind === 'rose') {
    s += '<circle cx="' + x + '" cy="' + y + '" r="' + 17 * k + '" fill="' + sp.petal + '"/>';
    for (i = 0; i < 5; i++) s += '<path d="M' + (x - 15 * k + i * 3 * k) + ' ' + (y - 2 * k + i * 2 * k) + ' q' + (15 * k - i * 3 * k) + ' ' + (-16 * k + i * 4 * k) + ' ' + (30 * k - i * 6 * k) + ' 0" fill="none" stroke="' + sp.center + '" stroke-width="' + 2 * k + '" stroke-linecap="round"/>';
    s += '<path d="M' + (x - 16 * k) + ' ' + (y + 6 * k) + ' q' + 16 * k + ' ' + 16 * k + ' ' + 32 * k + ' 0" fill="' + sp.center + '" opacity="0.5"/>';
  } else if (sp.kind === 'tulip') {
    s += '<path d="M' + (x - 15 * k) + ' ' + (y - 14 * k) + ' L' + (x - 7 * k) + ' ' + (y - 4 * k) + ' L' + x + ' ' + (y - 18 * k) + ' L' + (x + 7 * k) + ' ' + (y - 4 * k) + ' L' + (x + 15 * k) + ' ' + (y - 14 * k) + ' Q' + (x + 17 * k) + ' ' + (y + 14 * k) + ' ' + x + ' ' + (y + 14 * k) + ' Q' + (x - 17 * k) + ' ' + (y + 14 * k) + ' ' + (x - 15 * k) + ' ' + (y - 14 * k) + 'Z" fill="' + sp.petal + '"/>';
    s += '<path d="M' + x + ' ' + (y - 18 * k) + ' L' + (x - 6 * k) + ' ' + (y + 12 * k) + ' M' + x + ' ' + (y - 18 * k) + ' L' + (x + 6 * k) + ' ' + (y + 12 * k) + '" stroke="' + sp.center + '" stroke-width="' + 1.5 * k + '" opacity="0.55"/>';
  } else if (sp.kind === 'spike') {
    for (i = 0; i < 9; i++) {
      var yy = y + 18 * k - i * 5 * k, ww = (9 - i * 0.6) * k;
      if (sp.star) { s += '<circle cx="' + (x - ww * 0.6) + '" cy="' + yy + '" r="' + 3.6 * k + '" fill="' + sp.petal + '"/><circle cx="' + (x + ww * 0.6) + '" cy="' + (yy - 2 * k) + '" r="' + 3.6 * k + '" fill="' + sp.petal + '"/><circle cx="' + x + '" cy="' + (yy - 3 * k) + '" r="' + 3.2 * k + '" fill="' + sp.center + '"/>'; }
      else { s += '<ellipse cx="' + (x - 3 * k) + '" cy="' + yy + '" rx="' + 2.6 * k + '" ry="' + 3.8 * k + '" fill="' + sp.petal + '" transform="rotate(-20 ' + (x - 3 * k) + ' ' + yy + ')"/><ellipse cx="' + (x + 3 * k) + '" cy="' + (yy - 2 * k) + '" rx="' + 2.6 * k + '" ry="' + 3.8 * k + '" fill="' + sp.center + '" transform="rotate(20 ' + (x + 3 * k) + ' ' + (yy - 2 * k) + ')"/>'; }
    }
  } else if (sp.kind === 'cluster') {
    for (i = 0; i < 16; i++) {
      var cx = x + Math.cos(i * 2.4) * (i % 4 + 1) * 4.6 * k, cy = y + Math.sin(i * 2.4) * (i % 4 + 1) * 3.8 * k;
      var col = i % 3 ? sp.petal : sp.center;
      s += '<g transform="translate(' + cx + ' ' + cy + ') rotate(' + i * 23 + ')"><ellipse rx="' + 3.2 * k + '" ry="' + 1.8 * k + '" fill="' + col + '"/><ellipse rx="' + 1.8 * k + '" ry="' + 3.2 * k + '" fill="' + col + '"/><circle r="' + 0.9 * k + '" fill="#fff" opacity="0.8"/></g>';
    }
  } else if (sp.kind === 'bell') {
    for (i = 0; i < 5; i++) {
      var bx = x + 6 * k + i * 7 * k, by = y + 4 * k + i * i * 0.9 * k;
      s += '<path d="M' + bx + ' ' + (by - 5 * k) + ' v' + 4 * k + '" stroke="#7aa77f" stroke-width="' + k + '"/><path d="M' + (bx - 4.5 * k) + ' ' + (by + 5 * k) + ' Q' + (bx - 4.5 * k) + ' ' + (by - 2 * k) + ' ' + bx + ' ' + (by - 2 * k) + ' Q' + (bx + 4.5 * k) + ' ' + (by - 2 * k) + ' ' + (bx + 4.5 * k) + ' ' + (by + 5 * k) + ' q-2.2 -1.4 -4.5 0 q-2.2 -1.4 -4.5 0Z" fill="' + sp.petal + '" stroke="#e3e6d3" stroke-width="0.6"/>';
    }
  } else if (sp.kind === 'sprig') {
    var spots = [[0, 0], [-16, 10], [15, 8], [-6, -14], [10, -12]];
    spots.forEach(function(p) {
      for (var j = 0; j < 5; j++) s += '<ellipse cx="' + (x + p[0] * k) + '" cy="' + (y + p[1] * k - 5 * k) + '" rx="' + 3 * k + '" ry="' + 4.6 * k + '" fill="' + sp.petal + '" transform="rotate(' + j * 72 + ' ' + (x + p[0] * k) + ' ' + (y + p[1] * k) + ')"/>';
      s += '<circle cx="' + (x + p[0] * k) + '" cy="' + (y + p[1] * k) + '" r="' + 1.8 * k + '" fill="' + sp.center + '"/>';
    });
  } else if (sp.kind === 'carnation') {
    var pp = '', pp2 = '';
    for (i = 0; i < 28; i++) {
      a = i / 28 * Math.PI * 2;
      var rr = (i % 2 ? 14 : 17) * k; pp += (x + Math.cos(a) * rr) + ',' + (y + Math.sin(a) * rr * 0.85) + ' ';
      rr = (i % 2 ? 8 : 10.5) * k; pp2 += (x + Math.cos(a + 0.1) * rr) + ',' + (y - 2 * k + Math.sin(a + 0.1) * rr * 0.8) + ' ';
    }
    s += '<polygon points="' + pp + '" fill="' + sp.petal + '"/><polygon points="' + pp2 + '" fill="' + sp.center + '" opacity="0.8"/>';
  } else if (sp.kind === 'dots') {
    [[-20, -8], [-10, -18], [2, -22], [14, -14], [22, -4], [-14, 4], [12, 6]].forEach(function(p, bi) {
      var ex = x + p[0] * k, ey = y + p[1] * k;
      s += '<path d="M' + x + ' ' + (y + 14 * k) + ' L' + ex + ' ' + ey + '" stroke="#86b07a" stroke-width="' + 0.9 * k + '"/>';
      for (var d = 0; d < 4; d++) s += '<circle cx="' + (ex + Math.cos(d * 1.7 + bi) * 3 * k) + '" cy="' + (ey + Math.sin(d * 1.7 + bi) * 3 * k) + '" r="' + (sp.dotR || 2) * k + '" fill="' + sp.petal + '" stroke="' + sp.center + '" stroke-width="0.4"/>';
    });
  } else if (sp.kind === 'drape') {
    [-14, 0, 14].forEach(function(dx, di) {
      var len = (26 + di * 4) * k;
      for (var d = 0; d < 9; d++) {
        var t = d / 8;
        s += '<circle cx="' + (x + dx * k + Math.sin(d * 1.3) * 2 * k) + '" cy="' + (y - 6 * k + t * len) + '" r="' + (5.5 - t * 3.5) * k + '" fill="' + (d % 2 ? sp.petal : sp.center) + '" opacity="0.92"/>';
      }
    });
  } else if (sp.kind === 'trumpet') {
    s += '<circle cx="' + x + '" cy="' + y + '" r="' + 15 * k + '" fill="' + sp.petal + '"/>';
    for (i = 0; i < 5; i++) { a = i * 72 * Math.PI / 180 - Math.PI / 2; s += '<path d="M' + x + ' ' + y + ' L' + (x + Math.cos(a) * 15 * k) + ' ' + (y + Math.sin(a) * 15 * k) + '" stroke="' + sp.center + '" stroke-width="' + 1.6 * k + '" opacity="0.8"/>'; }
    s += '<circle cx="' + x + '" cy="' + y + '" r="' + 5 * k + '" fill="' + sp.center + '"/>';
  } else if (sp.kind === 'succulent') {
    s += '<circle cx="' + x + '" cy="' + y + '" r="' + 4 * k + '" fill="' + sp.petal + '"/>';
    for (i = 0; i < 5; i++) s += '<ellipse cx="' + x + '" cy="' + (y - 4 * k) + '" rx="' + 2 * k + '" ry="' + 4 * k + '" fill="' + sp.petal + '" transform="rotate(' + i * 72 + ' ' + x + ' ' + y + ')"/>';
  }
  return s;
}
// 观叶植物（绿萝、铜钱草、薄荷、文竹、龟背竹、仙人掌、富贵竹）：茎从 (100,196) 长出来，k 是长到多大
function gardenHeart(x, y, z, rot, col) {
  return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')"><path d="M0 ' + z * 0.9 + ' C' + (-z * 1.2) + ' ' + z * 0.1 + ' ' + (-z * 0.7) + ' ' + (-z) + ' 0 ' + (-z * 0.35) + ' C' + z * 0.7 + ' ' + (-z) + ' ' + z * 1.2 + ' ' + z * 0.1 + ' 0 ' + z * 0.9 + 'Z" fill="' + col + '"/>' +
    '<path d="M0 ' + (-z * 0.3) + ' L0 ' + z * 0.75 + '" stroke="rgba(255,255,255,0.35)" stroke-width="0.8"/></g>';
}
function gardenFoliage(sp, st, leaf) {
  var k = [0, 0.32, 0.5, 0.68, 0.85, 1][st], s = '', i, j, n, side, hi = 'rgba(255,255,255,0.35)';
  if (sp.kind === 'vine') {
    n = [0, 2, 3, 4, 5, 6][st];
    for (i = 0; i < n; i++) {
      side = i % 2 ? 1 : -1;
      var reach = (34 + i * 9) * k, cx = 100 + side * reach * 0.6, cy = 168 - 34 * k, ex = 100 + side * reach, ey = 192 + (i % 3 === 0 ? -46 : 24 + i * 7) * k;
      s += '<path d="M100 194 Q' + cx + ' ' + cy + ' ' + ex + ' ' + ey + '" stroke="' + sp.center + '" stroke-width="1.6" fill="none"/>';
      for (j = 1; j <= 3; j++) {
        var t = j / 3, px = (1 - t) * (1 - t) * 100 + 2 * (1 - t) * t * cx + t * t * ex, py = (1 - t) * (1 - t) * 194 + 2 * (1 - t) * t * cy + t * t * ey;
        s += gardenHeart(px, py, (5 + j * 1.5) * (0.6 + k * 0.5), side * (50 + j * 25), j % 2 ? leaf : sp.center);
      }
    }
  } else if (sp.kind === 'pennywort') {
    n = [0, 2, 4, 6, 8, 10][st];
    for (i = 0; i < n; i++) {
      var ang = (i / Math.max(1, n - 1) - 0.5) * 1.3, h = (44 + (i % 3) * 16) * k + 8;
      var tx = 100 + Math.sin(ang) * h * 0.7, ty = 196 - Math.cos(ang) * h, r = 4 + 5 * k;
      s += '<path d="M100 196 Q' + (100 + Math.sin(ang) * h * 0.2) + ' ' + (196 - h * 0.6) + ' ' + tx + ' ' + ty + '" stroke="' + sp.center + '" stroke-width="1.3" fill="none"/>' +
        '<circle cx="' + tx + '" cy="' + ty + '" r="' + r + '" fill="' + leaf + '" stroke="' + sp.center + '" stroke-width="0.6"/>';
      for (j = 0; j < 6; j++) s += '<path d="M' + tx + ' ' + ty + ' l' + Math.cos(j * 1.05) * r * 0.8 + ' ' + Math.sin(j * 1.05) * r * 0.8 + '" stroke="' + hi + '" stroke-width="0.6"/>';
    }
  } else if (sp.kind === 'mint') {
    [[-11, 62], [0, 84], [11, 70]].slice(0, st >= 3 ? 3 : st >= 2 ? 2 : 1).forEach(function(c) {
      var top = 196 - c[1] * k - 6;
      s += '<path d="M100 196 Q' + (100 + c[0] * 0.5) + ' ' + (196 - c[1] * k * 0.5) + ' ' + (100 + c[0]) + ' ' + top + '" stroke="' + sp.center + '" stroke-width="1.8" fill="none"/>';
      for (var yy = 188; yy > top; yy -= 13) {
        var f = (yy - top) / (196 - top), lx = 100 + c[0] * (1 - f), rr = 3 + 4 * f + 2 * k;
        s += '<ellipse cx="' + (lx - rr) + '" cy="' + yy + '" rx="' + rr + '" ry="' + rr * 0.6 + '" fill="' + leaf + '" stroke="' + sp.center + '" stroke-width="0.5" stroke-dasharray="1.5 1" transform="rotate(25 ' + (lx - rr) + ' ' + yy + ')"/>' +
          '<ellipse cx="' + (lx + rr) + '" cy="' + yy + '" rx="' + rr + '" ry="' + rr * 0.6 + '" fill="' + leaf + '" stroke="' + sp.center + '" stroke-width="0.5" stroke-dasharray="1.5 1" transform="rotate(-25 ' + (lx + rr) + ' ' + yy + ')"/>';
      }
      s += '<ellipse cx="' + (100 + c[0]) + '" cy="' + top + '" rx="2.6" ry="4" fill="' + leaf + '"/>';
    });
  } else if (sp.kind === 'fern') {
    var H = 120 * k + 8;
    s += '<path d="M100 196 Q97 ' + (196 - H * 0.5) + ' 100 ' + (196 - H) + '" stroke="' + sp.center + '" stroke-width="1.6" fill="none"/>';
    for (i = 0; i < st + 1; i++) {
      var ly = 196 - H * (0.3 + i * 0.13), lcx = 100 + (i % 2 ? 1 : -1) * 14 * k, rx = (30 - i * 3) * k + 6;
      s += '<path d="M100 ' + ly + ' L' + lcx + ' ' + ly + '" stroke="' + sp.center + '" stroke-width="1"/>';
      for (j = 0; j < 22; j++) {
        var aa = j / 22 * Math.PI * 2;
        s += '<path d="M' + lcx + ' ' + ly + ' L' + (lcx + Math.cos(aa) * rx * (0.6 + (j % 3) * 0.2)) + ' ' + (ly + Math.sin(aa) * 6 * (0.6 + (j % 2) * 0.4)) + '" stroke="' + leaf + '" stroke-width="0.9" stroke-linecap="round"/>';
      }
    }
  } else if (sp.kind === 'monstera') {
    n = [0, 1, 2, 3, 4, 5][st];
    for (i = 0; i < n; i++) {
      side = i % 2 ? 1 : -1;
      var mx = 100 + side * (8 + i * 9) * k, my = 196 - (46 + i * 15) * k - 6, rx2 = 17 * k + 5, ry2 = 12 * k + 4, rot = side * (20 + i * 4);
      s += '<path d="M100 196 Q' + (100 + side * 4) + ' ' + (my + 30 * k) + ' ' + mx + ' ' + (my + ry2 * 0.6) + '" stroke="' + sp.center + '" stroke-width="2" fill="none"/>' +
        '<g transform="translate(' + mx + ' ' + my + ') rotate(' + rot + ')"><path d="M0 ' + ry2 + ' C' + (-rx2 * 1.1) + ' ' + ry2 * 0.6 + ' ' + (-rx2) + ' ' + (-ry2) + ' 0 ' + (-ry2 * 0.75) + ' C' + rx2 + ' ' + (-ry2) + ' ' + rx2 * 1.1 + ' ' + ry2 * 0.6 + ' 0 ' + ry2 + 'Z" fill="' + leaf + '"/>' +
        '<path d="M0 ' + ry2 + ' L0 ' + (-ry2 * 0.7) + '" stroke="' + hi + '" stroke-width="1"/>';
      if (st >= 3) for (j = 0; j < 3; j++) {
        var sy = -ry2 * 0.4 + j * ry2 * 0.45;
        s += '<path d="M' + (-rx2 * 1.02) + ' ' + sy + ' L' + (-rx2 * 0.45) + ' ' + (sy + 1) + ' M' + rx2 * 1.02 + ' ' + sy + ' L' + rx2 * 0.45 + ' ' + (sy + 1) + '" stroke="#f3f8f1" stroke-width="1.6" stroke-linecap="round"/>';
      }
      s += '</g>';
    }
  } else if (sp.kind === 'cactus') {
    var w = 18 + 16 * k, ch = 20 + 62 * k;
    s += '<rect x="' + (100 - w / 2) + '" y="' + (196 - ch) + '" width="' + w + '" height="' + ch + '" rx="' + w / 2 + '" fill="' + sp.center + '"/>' +
      '<path d="M' + (100 - w / 4) + ' ' + (194 - ch * 0.9) + ' V194 M100 ' + (196 - ch) + ' V194 M' + (100 + w / 4) + ' ' + (194 - ch * 0.9) + ' V194" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>';
    if (st >= 4) {
      s += '<rect x="' + (100 - w / 2 - 12) + '" y="' + (196 - ch * 0.62) + '" width="14" height="' + ch * 0.32 + '" rx="7" fill="' + sp.center + '"/><rect x="' + (100 - w / 2 - 4) + '" y="' + (196 - ch * 0.4) + '" width="8" height="8" fill="' + sp.center + '"/>';
    }
    for (j = 0; j < 14; j++) s += '<circle cx="' + (100 - w / 2 + 4 + (j % 4) * (w - 8) / 3) + '" cy="' + (196 - ch + 8 + Math.floor(j / 4) * (ch - 12) / 4) + '" r="0.9" fill="#fffbe8"/>';
    if (st === 5) s += gardenFlower({ kind: 'radial', n: 8, pl: 7, pw: 3, cr: 2.5, petal: sp.petal, center: '#f6d55c' }, 100, 196 - ch - 2, 1);
  } else if (sp.kind === 'bamboo') {
    [[-8, 0.7], [0, 1], [8, 0.82]].slice(0, st >= 3 ? 3 : st >= 2 ? 2 : 1).forEach(function(c) {
      var bh = (96 * c[1]) * k + 10, bx = 100 + c[0];
      s += '<rect x="' + (bx - 3) + '" y="' + (196 - bh) + '" width="6" height="' + bh + '" rx="3" fill="' + sp.petal + '"/>';
      for (var ny = 192; ny > 196 - bh + 6; ny -= 18) s += '<path d="M' + (bx - 3) + ' ' + ny + ' h6" stroke="' + sp.center + '" stroke-width="1.4"/>';
      var top = 196 - bh;
      s += '<path d="M' + bx + ' ' + (top + 4) + ' q-16 -6 -22 -22 q12 6 22 18Z" fill="' + leaf + '"/><path d="M' + bx + ' ' + (top + 2) + ' q14 -10 20 -26 q-14 10 -20 22Z" fill="' + leaf + '"/>' +
        (st >= 4 ? '<path d="M' + bx + ' ' + (top + 10) + ' q-20 2 -30 -8 q16 0 30 4Z" fill="' + leaf + '"/>' : '');
    });
  }
  return s;
}
function gardenBud(sp, x, y) {
  return '<path d="M' + (x - 7) + ' ' + (y + 6) + ' Q' + (x - 8) + ' ' + (y - 8) + ' ' + x + ' ' + (y - 14) + ' Q' + (x + 8) + ' ' + (y - 8) + ' ' + (x + 7) + ' ' + (y + 6) + ' Z" fill="' + sp.petal + '" stroke="' + sp.center + '" stroke-width="1"/>' +
    '<path d="M' + (x - 8) + ' ' + (y + 6) + ' Q' + x + ' ' + (y - 2) + ' ' + (x + 8) + ' ' + (y + 6) + '" fill="' + sp.leaf + '"/>';
}
function gardenPlantSvg(g, opt) {
  opt = opt || {};
  var sp = gardenSpecies(g.species), st = opt.stage !== undefined ? opt.stage : gardenStage(g), hl = opt.health || (g.plantedAt ? gardenHealth(g) : 'ok');
  var leaf = hl === 'dead' ? '#a08b74' : hl === 'wilt' ? '#a99a68' : hl === 'thirsty' ? '#93ad74' : sp.leaf;
  var droop = hl === 'dead' ? 38 : hl === 'wilt' ? 20 : hl === 'thirsty' ? 7 : 0;
  var H = [0, 16, 42, 76, 106, 124][st], top = 196 - H, s = '';
  var pots = gardenPot(sp.method || 'soil', st, hl), pot = pots[0];
  if (st === 0) return pot + pots[2] + pots[1];
  if (sp.foliage) {
    var ffilt = hl === 'dead' ? ' style="filter:grayscale(0.7) sepia(0.4)"' : hl === 'wilt' ? ' style="filter:saturate(0.55)"' : '';
    return pot + '<g transform="rotate(' + droop / 2 + ' 100 196)"' + ffilt + '>' + gardenFoliage(sp, st, leaf) + '</g>' + pots[1];
  }
  if (sp.kind === 'succulent') {
    var R = [0, 10, 18, 26, 32, 36][st];
    for (var r = 3; r >= 1; r--) for (var i = 0; i < 8; i++) {
      s += '<ellipse cx="100" cy="' + (192 - R * r / 3 * 0.55) + '" rx="' + (R * r / 3 * 0.38 + 2) + '" ry="' + (R * r / 3 * 0.62 + 2) + '" fill="' + (r === 1 ? sp.petal : leaf) + '" opacity="' + (0.75 + r * 0.08) + '" transform="rotate(' + (i * 45 + r * 20) + ' 100 192)"/>';
    }
    if (st >= 4) s += '<path d="M100 186 Q108 150 118 130" stroke="' + leaf + '" stroke-width="2.4" fill="none"/>' + (st === 5 ? gardenFlower(sp, 118, 128, 1.2) : gardenBud(sp, 118, 132));
    return pot + '<g transform="rotate(' + droop / 3 + ' 100 196)">' + s + '</g>' + pots[1];
  }
  // 茎（微微弯）和叶子
  s += '<path d="M100 196 Q' + (96 + H * 0.06) + ' ' + (196 - H * 0.5) + ' 100 ' + top + '" stroke="' + leaf + '" stroke-width="' + (st >= 3 ? 4 : 3) + '" fill="none" stroke-linecap="round"/>';
  if (st === 1) {
    s += '<ellipse cx="92" cy="' + (top + 2) + '" rx="8" ry="4" fill="' + leaf + '" transform="rotate(-25 92 ' + (top + 2) + ')"/><ellipse cx="108" cy="' + (top + 2) + '" rx="8" ry="4" fill="' + leaf + '" transform="rotate(25 108 ' + (top + 2) + ')"/>';
  } else {
    var n = st === 2 ? 2 : 4;
    for (var j = 0; j < n; j++) {
      var ly = 196 - H * (0.22 + j * 0.17), side = j % 2 ? 1 : -1;
      if (sp.longLeaf) s += '<path d="M100 196 Q' + (100 + side * (22 + j * 4)) + ' ' + (196 - H * 0.35) + ' ' + (100 + side * (14 + j * 6)) + ' ' + (196 - H * (0.45 + j * 0.12)) + ' Q' + (100 + side * 8) + ' ' + (196 - H * 0.3) + ' 100 196Z" fill="' + leaf + '"/>';
      else s += '<ellipse cx="' + (100 + side * 13) + '" cy="' + ly + '" rx="13" ry="6" fill="' + leaf + '" transform="rotate(' + (side * -28) + ' ' + (100 + side * 13) + ' ' + ly + ')"/><path d="M' + (100 + side * 3) + ' ' + ly + ' L' + (100 + side * 22) + ' ' + (ly - side * 0 - 6) + '" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>';
    }
  }
  if (st === 4) s += gardenBud(sp, 100, top - 6);
  if (st === 5) s += gardenFlower(sp, 100, top - (sp.kind === 'spike' ? 18 : sp.kind === 'bell' ? 0 : 10), sp.kind === 'radial' && sp.id === 'sunflower' ? 1.25 : 1.15);
  var filt = hl === 'dead' ? ' style="filter:grayscale(0.7) sepia(0.4)"' : hl === 'wilt' ? ' style="filter:saturate(0.55)"' : '';
  return pot + '<g transform="rotate(' + droop + ' 100 196)"' + filt + '>' + s + '</g>' + pots[1];
}
// 花盆：[后面一层, 前面一层, 种子]。茎都从 (100,196) 长出来
function gardenPot(method, st, hl) {
  if (method === 'water') {
    var vase = 'M86 186 L114 186 L114 199 Q148 208 147 231 Q146 255 100 255 Q54 255 53 231 Q52 208 86 199 Z';
    var murky = hl === 'wilt' || hl === 'dead';
    var roots = st === 0 ? '' : [[-1, 0], [1, 1], [0, 2], [-1, 3], [1, 4]].slice(0, Math.min(5, st + 1)).map(function(r) {
      var len = 14 + st * 6 + r[1] * 3;
      return '<path d="M100 198 q' + (r[0] * 10 + r[1]) + ' ' + len * 0.4 + ' ' + (r[0] * 6 - r[1] + 2) + ' ' + len + '" stroke="#efe6c8" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
    }).join('');
    return ['<ellipse cx="100" cy="254" rx="44" ry="5" fill="rgba(90,120,150,0.16)"/>' +
      '<path d="' + vase + '" fill="rgba(255,255,255,0.35)" stroke="rgba(160,190,210,0.7)" stroke-width="1.6"/>' +
      '<path d="M54 214 Q100 218 146 214 Q148 222 147 231 Q146 255 100 255 Q54 255 53 231 Q52 222 54 214 Z" fill="' + (murky ? 'rgba(170,175,140,0.45)' : 'rgba(150,200,235,0.45)') + '"/>' +
      '<ellipse cx="100" cy="214.5" rx="46" ry="2.2" fill="rgba(255,255,255,0.5)"/>' + roots,
      '<path d="M62 214 Q60 236 72 248" stroke="rgba(255,255,255,0.75)" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="85" y="184" width="30" height="4" rx="2" fill="rgba(200,220,235,0.9)"/>',
      '<ellipse cx="100" cy="195" rx="8" ry="6" fill="#d9c19a"/><path d="M100 189 q2 -5 0 -8" stroke="#9cc58f" stroke-width="2" fill="none" stroke-linecap="round"/>'];
  }
  if (method === 'pebble') {
    var peb = '', cols = ['#e8e2d8', '#d6d0c6', '#f3efe8', '#c9c3bb', '#ece6dc', '#dcd6cc'];
    for (var i = 0; i < 13; i++) peb += '<ellipse cx="' + (58 + i * 7 + (i % 3) * 2) + '" cy="' + (197 + (i % 2) * 2) + '" rx="' + (4 + i % 3) + '" ry="' + (2.6 + i % 2) + '" fill="' + cols[i % 6] + '" stroke="rgba(0,0,0,0.05)"/>';
    return ['<defs><linearGradient id="gpBowl" x1="0" x2="1"><stop offset="0" stop-color="#eef3f8"/><stop offset="0.5" stop-color="#ffffff"/><stop offset="1" stop-color="#e3eaf2"/></linearGradient></defs>' +
      '<ellipse cx="100" cy="251" rx="40" ry="5" fill="rgba(110,120,140,0.16)"/>' +
      '<path d="M84 234 L116 234 L113 250 L87 250 Z" fill="#e7edf4"/>' +
      '<path d="M48 198 L152 198 Q148 236 100 238 Q52 236 48 198 Z" fill="url(#gpBowl)" stroke="rgba(170,185,205,0.5)"/>' +
      '<path d="M58 214 q42 14 84 0" stroke="#a9c2e6" stroke-width="1.6" fill="none" opacity="0.7"/><path d="M64 222 q36 10 72 0" stroke="#a9c2e6" stroke-width="1" fill="none" opacity="0.5"/>' +
      '<ellipse cx="100" cy="198" rx="52" ry="5.5" fill="#f6f3ee" stroke="rgba(170,185,205,0.45)"/>' + peb, '',
      '<ellipse cx="100" cy="194" rx="5" ry="3" fill="#94704f"/>'];
  }
  return ['<defs><linearGradient id="gpPot" x1="0" x2="1"><stop offset="0" stop-color="#f6c9b6"/><stop offset="0.5" stop-color="#f9dacd"/><stop offset="1" stop-color="#eab5a2"/></linearGradient></defs>' +
    '<ellipse cx="100" cy="250" rx="52" ry="6" fill="rgba(140,90,80,0.18)"/>' +
    '<path d="M58 204 L142 204 L132 250 Q100 256 68 250 Z" fill="url(#gpPot)"/>' +
    '<rect x="52" y="194" width="96" height="14" rx="5" fill="#f3bfa9"/><rect x="52" y="194" width="96" height="4" rx="2" fill="#fbe0d4"/>' +
    '<path d="M74 222 q26 10 52 0" stroke="#fff" stroke-opacity="0.45" stroke-width="2" fill="none"/>' +
    '<ellipse cx="100" cy="197" rx="44" ry="5" fill="#7a5b48"/>', '',
    '<ellipse cx="100" cy="195" rx="9" ry="3.5" fill="#94704f"/><ellipse cx="100" cy="193" rx="3" ry="2" fill="#c9a77a"/>'];
}
function gardenMethodOf(g) { return gardenSpecies(g.species).method || 'soil'; }
function gardenMethodName(m) { return { soil: '土培', water: '水培', pebble: '石子' }[m] || '土培'; }
function gardenSvg(g, opt, cls) { return '<svg class="' + (cls || 'gd-plant') + '" viewBox="' + (cls === 'gd-pick-svg' ? '30 40 140 216' : '0 0 200 260') + '" aria-hidden="true">' + gardenPlantSvg(g, opt) + '</svg>'; }

// ---------- 界面 ----------
var gdBody = document.querySelector('#appGreenhouse .settings-content');
gdBody.classList.add('gd-body');
function renderGarden(fx) {
  gdBody.innerHTML = '';
  var scene = document.createElement('div');
  scene.className = 'gd-scene';
  scene.innerHTML = '<div class="gd-glass"></div><div class="gd-beams"></div><div class="gd-table"></div><div class="gd-pot-wrap"></div><div class="gd-fx"></div>';
  gdBody.appendChild(scene);
  if (!garden || !garden.species) { renderGardenPick(scene); return; }
  var g = garden, sp = gardenSpecies(g.species), st = gardenStage(g), hl = gardenHealth(g);
  scene.classList.toggle('sunny', gardenHours(g.last.sun) < 6);
  scene.querySelector('.gd-pot-wrap').innerHTML = gardenSvg(g);
  var days = Math.floor(gardenHours(g.plantedAt) / 24) + 1;
  var info = document.createElement('div');
  info.className = 'settings-card gd-info';
  var bars = [['水分', Math.max(0, 1 - gardenHours(g.last.water || g.plantedAt) / 96), '#8fc3ea'], ['阳光', Math.max(0, 1 - gardenHours(g.last.sun) / 24), '#f6cf6a'], ['养分', Math.max(0, 1 - gardenHours(g.last.feed) / 168), '#9fd3a8']];
  info.innerHTML = '<div class="gd-title"><b></b><span></span></div><div class="gd-sub"></div><div class="gd-bars"></div><div class="gd-acts"></div>';
  info.querySelector('b').textContent = sp.name;
  if (sp.lang) { var lg = document.createElement('em'); lg.className = 'gd-title-lang'; lg.textContent = sp.lang; info.querySelector('.gd-title').appendChild(lg); }
  info.querySelector('.gd-title span').textContent = gardenStageName(sp, st);
  var hydro = gardenMethodOf(g) === 'water';
  info.querySelector('.gd-sub').textContent = '种下第 ' + days + ' 天 · ' + gardenMethodName(gardenMethodOf(g)) + ' · ' + gardenHealthText(g, hl) + (st < 5 && hl !== 'dead' ? ' · 离「' + gardenStageName(sp, st + 1) + '」还差一点点' : '');
  bars.forEach(function(b) {
    var row = document.createElement('div');
    row.className = 'gd-bar';
    row.innerHTML = '<span>' + b[0] + '</span><i><em style="width:' + Math.round(b[1] * 100) + '%;background:' + b[2] + '"></em></i>';
    info.querySelector('.gd-bars').appendChild(row);
  });
  Object.keys(GARDEN_ACTS).forEach(function(k) {
    var a = GARDEN_ACTS[k], btn = document.createElement('button');
    btn.className = 'gd-act gd-act-' + k;
    btn.innerHTML = '<span class="gd-act-ic"></span><span>' + (k === 'water' && hydro ? '换水' : a.name) + '</span>';
    btn.disabled = hl === 'dead';
    btn.addEventListener('click', function() { gardenDo(k); });
    info.querySelector('.gd-acts').appendChild(btn);
  });
  gdBody.appendChild(info);
  // 照顾记录
  if ((g.log || []).length) {
    var log = document.createElement('div');
    log.className = 'settings-card gd-log';
    log.innerHTML = '<div class="bubble-section-label" style="margin-bottom:6px;">照顾记录</div>';
    g.log.slice(-8).reverse().forEach(function(x) {
      var d = new Date(x.t), row = document.createElement('div');
      row.className = 'gd-log-row';
      row.textContent = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '　' + x.text;
      log.appendChild(row);
    });
    gdBody.appendChild(log);
  }
  // 换一盆：满三个月或者枯萎了才行
  var re = document.createElement('div');
  re.className = 'gd-replant';
  if (gardenCanReplant(g)) {
    var rb = document.createElement('button');
    rb.className = 'mine-acc-btn mine-acc-btn-close';
    rb.textContent = hl === 'dead' ? '重新种一盆' : '换一盆';
    rb.addEventListener('click', function() {
      openConfirm(hl === 'dead' ? '重新选一颗种子？' : '换掉这盆' + sp.name + '？换了以后三个月内不能再换', function() { garden = null; saveGarden(); renderGarden(); });
    });
    re.appendChild(rb);
  } else {
    re.textContent = '种满三个月（还要 ' + Math.ceil(GARDEN_LOCK_DAYS - gardenHours(g.plantedAt) / 24) + ' 天）或者彻底枯萎了，才能换一盆';
  }
  gdBody.appendChild(re);
  if (fx) gardenFx(scene, fx);
}
function gardenDo(k) {
  var g = garden, a = GARDEN_ACTS[k];
  if (!g || gardenHealth(g) === 'dead') return;
  var fresh = gardenHours(g.last[k]) >= a.cd;
  var before = gardenStage(g);
  if (k !== 'pet' && !fresh) { showToast(a.done, 'plain'); renderGarden(k); return; }
  g.last[k] = Date.now();
  if (fresh) g.pts = (g.pts || 0) + a.pts;
  if (k === 'pet' || fresh) {
    var who = gardenUserName();
    var text = { water: who + (gardenMethodOf(g) === 'water' ? '给它换了一瓶清水' : '给它浇了水'), feed: who + '施了一点肥', sun: who + '把它搬到阳光下晒了晒', pet: who + '轻轻摸了摸它的叶子' }[k];
    var lastLog = (g.log || [])[g.log.length - 1];
    if (!(k === 'pet' && lastLog && lastLog.text === text && Date.now() - lastLog.t < 3600000)) g.log = (g.log || []).concat({ t: Date.now(), text: text }).slice(-40);
  }
  saveGarden();
  renderGarden(k);
  var after = gardenStage(g);
  var gsp = gardenSpecies(g.species);
  if (after > before) showToast('✿ 它' + (after === 5 ? (gsp.foliage ? '长得茂盛了！' : '开花了！') : '长成「' + gardenStageName(gsp, after) + '」了'), 'success');
}
// 小动效：浇水掉水滴、施肥冒小亮点、晒太阳光更亮、摸摸冒爱心
function gardenFx(scene, k) {
  var box = scene.querySelector('.gd-fx'), n = k === 'water' ? 9 : k === 'feed' ? 8 : k === 'pet' ? 5 : 0;
  if (k === 'sun') { scene.classList.add('sun-pulse'); setTimeout(function() { scene.classList.remove('sun-pulse'); }, 1400); }
  for (var i = 0; i < n; i++) {
    var e = document.createElement('span');
    e.className = 'gd-fx-' + k;
    e.textContent = k === 'pet' ? '♥' : '';
    e.style.left = (38 + Math.random() * 24) + '%';
    e.style.animationDelay = (i * 0.09) + 's';
    box.appendChild(e);
  }
  setTimeout(function() { box.innerHTML = ''; }, 1800);
}
// 还没种：选一颗种子（种下以后三个月内不能换）。一个颜色一页、每页 2 排 × 4 个（用户定的），左右滑翻页，上面的小圆点就是页签；
// 栽法跟着品种走；上面的温室里先看长好的样子，下面一行花语
var gdPick = { color: 'pink', species: '' };
function renderGardenPick(scene) {
  if (!gdPick.species) gdPick.species = GARDEN_SPECIES.filter(function(x) { return x.color === gdPick.color; })[0].id;
  var sp = gardenSpecies(gdPick.species);
  scene.querySelector('.gd-pot-wrap').innerHTML = gardenSvg({ species: sp.id }, { stage: 5, health: 'ok' });
  var card = document.createElement('div');
  card.className = 'settings-card';
  card.innerHTML = '<div class="gd-title" style="justify-content:center;"><b>选一颗种子</b></div><div class="gd-sub" style="text-align:center;">整个小手机只养这一盆。种下以后要满三个月，或者它彻底枯萎了，才能换</div>' +
    '<div class="gd-colors"></div><div class="gd-pick"></div><div class="gd-lang"></div><button class="mine-acc-btn mine-acc-btn-add gd-plant-btn"></button>';
  var pickBox = card.querySelector('.gd-pick'), dots = card.querySelector('.gd-colors'), selPage = 0;
  GARDEN_COLORS.forEach(function(c, ci) {
    if (c[0] === sp.color) selPage = ci;
    var d = document.createElement('button');
    d.className = 'gd-color' + (c[0] === sp.color ? ' on' : '');
    d.innerHTML = '<i style="background:' + c[2] + '"></i>';
    d.setAttribute('aria-label', c[1]);
    d.addEventListener('click', function() { pickBox.scrollTo({ left: ci * pickBox.clientWidth, behavior: 'smooth' }); });
    dots.appendChild(d);
    var page = document.createElement('div');
    page.className = 'gd-pick-page';
    GARDEN_SPECIES.filter(function(x) { return x.color === c[0]; }).forEach(function(x) {
      var b = document.createElement('button');
      b.className = 'gd-pick-item' + (x.id === sp.id ? ' on' : '');
      b.innerHTML = gardenSvg({ species: x.id }, { stage: 5, health: 'ok' }, 'gd-pick-svg') + '<span>' + x.name + '</span>';
      b.addEventListener('click', function() { gdPick.species = x.id; gdPick.color = x.color; renderGarden(); });
      page.appendChild(b);
    });
    pickBox.appendChild(page);
  });
  pickBox.addEventListener('scroll', function() {
    var cur = Math.round(pickBox.scrollLeft / Math.max(1, pickBox.clientWidth));
    [].forEach.call(dots.children, function(d, i) { d.classList.toggle('on', i === cur); });
  });
  card.querySelector('.gd-lang').textContent = '花语：' + sp.lang;
  var go = card.querySelector('.gd-plant-btn');
  go.textContent = '种下' + sp.name;
  go.addEventListener('click', function() {
    var method = sp.method || 'soil';
    openConfirm('种下一颗' + sp.name + '（' + gardenMethodName(method) + '）？三个月内不能换哦', function() {
      garden = { species: sp.id, plantedAt: Date.now(), pts: 0, last: { water: Date.now() }, log: [{ t: Date.now(), text: gardenUserName() + '种下了一颗' + sp.name + '的种子（' + gardenMethodName(method) + '）' }] };
      gdPick = { color: 'pink', species: '' };
      saveGarden();
      renderGarden('water');
    });
  });
  gdBody.appendChild(card);
  pickBox.scrollLeft = selPage * pickBox.clientWidth;   // 停在选中的那朵所在的颜色页
}
document.getElementById('dockGreenhouse').addEventListener('click', function() { renderGarden(); });

// 角色也知道花房里那盆花（聊天窗口的现实感知里带一句）
function gardenContextLine() {
  if (!garden || !garden.species) return '';
  var sp = gardenSpecies(garden.species);
  return '用户在小手机的花房里养了一盆' + sp.name + '（' + gardenMethodName(gardenMethodOf(garden)) + '），现在是「' + gardenStageName(sp, gardenStage(garden)) + '」，' + gardenHealthText(garden, gardenHealth(garden)) + '。';
}
