# 星语 · 正式版 0.1.4

用户已确认本次白底视频预览与默认首页入口修改，并明确授权上线0.1.4。本目录是同一界面的完整文件交付版，方便队友体验与继续开发。本版按用户明确要求同步到GitHub Pages与共享社区后端；没有自动安装或运行交付包。桌面仅保留当前正式版和两个交付ZIP。

## 队友直接体验（Windows）

完整解压“完整文件包”后，双击 `启动星语.cmd`。包内已包含 `runtime/node.exe`、`dist/`、`backend/`、素材和源码，无需安装Node或开发依赖。启动入口始终按本包所在目录运行，不依赖作者电脑的预览服务。

不要直接打开 `dist/index.html`，也不要只转发一个HTML文件。请保持目录结构。更多说明见 `打开说明.txt`。

## 源码开发

需要Node.js 24和pnpm 11。在项目根目录：

```powershell
pnpm install --frozen-lockfile
node backend/dev-server.mjs --port 0 --data-dir "C:/xingyu-my-data" --assets-dir "C:/your-project/public/images"
```

把 `C:/your-project/public/images` 换为此项目的实际public/images目录。API启动后打印本机地址；在另一个终端配置该实际地址，再运行网页：

```powershell
$env:VITE_COMMUNITY_API_URL = "http://127.0.0.1:实际API端口"
$env:VITE_COMMUNITY_MODE = "preview"
pnpm dev
```

打开Vite打印的网页地址。构建给内置启动器使用：

```powershell
$env:VITE_COMMUNITY_API_URL = "/"
$env:VITE_COMMUNITY_MODE = "preview"
pnpm build
```

单独 `pnpm preview` 只启动静态网页，社区账号和发帖还需要API。

## 这一版包含什么

0.1.4修复了视频帖子预览与播放器样式同名的问题，整张卡片保持白底，播放器空白区域也为白底。每次完整打开或刷新网页均从首页开始，页面内导航继续正常使用。

全站土星Logo快捷AI入口（悬停/点击展开、可移动/隐藏）、社区右栏跟随、连续帖子展开收回、社区信息流和用户名密码登录、图文/文章/视频编辑及实时预览、草稿、探索宇宙3D模型、首页约31秒影片与既有科普页面。详情见 `版本说明.md`。

图片最多9张，每张8MiB；MP4/WebM视频最大50MiB。开发数据库、作者账号令牌和用户上传内容不随包交付。

## 数据与联网

每台电脑使用自己的本地账号/帖子数据（`runtime/community-data/`）；不同电脑不会通过此包自动共享。草稿保存在当前浏览器。线上访问使用共享账号与社区后端，帖子和媒体可以跨电脑共享。线上入口：[GitHub Pages](https://fda75186-glitch.github.io/fengda/)。后端维护指引见 `backend/README.md`。

观测地图底图与地形需联网。AI星语目前是本地科普知识演示，AR是相机叠加演示；3D图谱和影片用于科普展示，不是实时天象。素材出处见 `docs/`、`public/textures/CREDITS.md`。星语与NASA无隶属关系。

## 文件包

- 完整文件包：源码、素材、静态构建、Windows内置Node运行程序和启动入口。
- 完整源码包：源码、素材、开发/部署说明；不含静态构建或内置运行程序，适合继续开发。

旧预览说明保留在 `docs/社区预览版6历史说明.md`，其待审核描述为历史记录，当前状态以本README与 `版本状态.txt` 为准。
