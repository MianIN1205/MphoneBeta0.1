// 眠花糖机 — 小手机顶上的状态栏：时钟、电量（真实电量记在 phoneBattery 给角色看）

function updateClock() {
  const now = new Date();
  const timeStr = pad(now.getHours()) + ':' + pad(now.getMinutes());
  document.getElementById('statusTime').textContent = timeStr;
  document.getElementById('clockDisplay').textContent = timeStr;
  document.getElementById('dateDisplay').textContent =
    now.getFullYear() + '年' + pad(now.getMonth()+1) + '月' +
    pad(now.getDate()) + '日 ' + WEEKDAYS[now.getDay()];
}
updateClock();
setInterval(updateClock, 1000);

// 真实电量（给角色看）；浏览器不提供电量时 real 为 false
var phoneBattery = { level: 0.8, charging: false, real: false };
function setBatteryLevel(level) {
  const pct = Math.max(0, Math.min(1, level));
  const fill = document.getElementById('batteryFill');
  fill.style.width = (pct * 100) + '%';
  fill.style.background = pct <= 0.2 ? '#e74c3c' : '#333';
}
if ('getBattery' in navigator) {
  navigator.getBattery().then(function(bat) {
    var sync = function() { phoneBattery = { level: bat.level, charging: bat.charging, real: true }; };
    sync();
    setBatteryLevel(bat.level);
    bat.addEventListener('levelchange', function() { sync(); setBatteryLevel(bat.level); });
    bat.addEventListener('chargingchange', sync);
  }).catch(function() { setBatteryLevel(0.8); });
} else { setBatteryLevel(0.8); }
