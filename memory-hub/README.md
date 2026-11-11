# 眠花糖机记忆库

几个小手机、几台设备共用同一份角色核心（人设）和记忆，让角色在哪儿都是同一个 TA：部署在你自己的 Cloudflare 账号里（Worker + D1 数据库），数据只在你的账号里，别人看不到。

- **网页**：打开它的网址就能翻看、记、改、删。「导入 / 导出」能把整理好的文件（人设核心、设定、关系、记忆）一次放进来，也能把全部存成一个文件当备份。
- **眠花糖机**：桌面「记忆库」→「连通记忆库」→「连接设置」填网址和密码，就会自动同步（人设、长期 / 珍贵记忆、聊出来的设定、关系里程碑）。人设以记忆库里的「人设核心」为准：在网页里或别的设备上改了，这边跟着换。连不上时照样能聊，连上再同步。
- **别的小手机（MCP）**：网页里「给别的小手机连」有带连接码的 MCP 地址，填进那个小手机的 MCP 设置就行。它的 AI 能自己「了解自己」（拿到人设核心、设定、关系和最近的记忆）「回忆」「记下」；人设核心它只能看、不能改。角色名字要和这边一样，记忆才对得上。

## 部署方法一：一键部署

点这个按钮，按提示登录 Cloudflare 和 GitHub，它会在你的 GitHub 里复制一份代码、在你的 Cloudflare 里建好数据库并部署：

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MianIN1205/MphoneBeta0.1/tree/main/memory-hub)

## 部署方法二：在 Cloudflare 网页上手动建

1. 打开 https://dash.cloudflare.com ，左边「存储和数据库」→「D1 SQL 数据库」→「创建」，名字填 `mphone-memory`。
2. 左边「Workers 和 Pages」→「创建」→ 选「从 Hello World 开始」，名字填 `mphone-memory`，部署。
3. 部署好后点「编辑代码」，把 `src/index.js` 的全部内容粘贴进去，替换掉原来的，右上角「部署」。
4. 回到这个 Worker 的「设置」→「绑定」→「添加」→「D1 数据库」：变量名填 `DB`（大写），数据库选 `mphone-memory`，保存。

## 部署好以后

1. 打开 Worker 的网址（类似 `https://mphone-memory.你的名字.workers.dev`），第一次会让你设一个密码（至少 6 位），之后都用它。**部署完请马上设**，谁先设谁就是主人。
2. 不开梯子，用手机打开 `网址/api/ping`，看到 `"ok":true` 就是连得上。
