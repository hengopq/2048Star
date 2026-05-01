# 2048 星核方阵

`Game2` 是一个零依赖的 2048 小游戏，包含开始菜单、用户选择、游戏音乐、方块动画、积分表和排行榜。

## 运行

推荐用本地静态服务器打开：

```powershell
cd E:\DevTools\Game2
node .\dev-server.cjs
```

然后访问 `http://127.0.0.1:5174`。

也可以直接打开 `index.html`，但浏览器对本地模块脚本的限制不完全一致。

## 结构

- `index.html`：页面结构
- `assets/css/styles.css`：界面、布局和动画
- `assets/js/game2048.js`：2048 棋盘逻辑
- `assets/js/audio.js`：Web Audio 背景音乐和音效
- `assets/js/storage.js`：本地用户、积分表和排行榜存储
- `assets/js/app.js`：界面交互和游戏流程
