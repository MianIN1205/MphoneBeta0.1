# 眠花糖机 — 版本号一起加一：index.html 里样式和 boot.js 的 ?v=、js/core/boot.js 的 MPHONE_V、sw.js 的 V（缓存名跟着变）。
# 每次改了 css / js 要推之前跑一次：python3 tools/bump-version.py
# 新页面只要新版本的文件、旧页面只要旧的，网慢时不会新旧混着用。文件都是 CRLF，读写时不改换行。
import io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rd(p):
    return io.open(os.path.join(ROOT, p), encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='').write(s)


sw = rd('sw.js')
old = int(re.search(r"const V = '(\d+)';", sw).group(1))
new = old + 1
wr('sw.js', sw.replace("const V = '%d';" % old, "const V = '%d';" % new, 1))
boot = rd('js/core/boot.js')
wr('js/core/boot.js', boot.replace("var MPHONE_V = '%d';" % old, "var MPHONE_V = '%d';" % new, 1))
html = rd('index.html')
html, n = re.subn(r'\?v=%d"' % old, '?v=%d"' % new, html)
wr('index.html', html)
print('版本 %d -> %d（index.html 里改了 %d 处）' % (old, new, n))
