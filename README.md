# 星语 · 天文科普平台 0.1.1

传智杯参赛作品，面向大众与学生。用户于 2026-10-10 确认采用探索宇宙 3D 预览版 3，正式版本号为 `0.1.1`，以第一版 `0.1.0` 为基础。

探索宇宙的八大行星、太阳、月球、仙女座星系与黑洞均使用交互式三维展示，支持拖动旋转、缩放、暂停与重置。仙女座星系采用用户确认的暖白核心、深褐尘埃带和蓝色旋臂效果；黑洞采用白金吸积盘与弯曲光带。大图、天体卡片和详情同步呈现三维模型。

## 打开交付包

在完整启动包中双击 `启动星语.cmd`，即可打开本地网站。程序从当前目录读取 `dist` 和 `runtime/node.exe`；解压后保持目录完整，无需安装开发依赖。默认打开仙女座星系。

## 启动源码

安装 Node.js 24 和 pnpm 11 后，在项目根目录运行：

```powershell
pnpm install
pnpm dev
```

访问终端显示的地址，开发期间保持终端运行。构建生产网站：

```powershell
pnpm build
pnpm preview
```

生产文件生成到 `dist`。源码包包含网页源码、纹理、图片、影片、资料和构建配置；不包含开发依赖和本机运行程序。

## GitHub 托管

源码仓库：[fda75186-glitch/fengda](https://github.com/fda75186-glitch/fengda)。在线入口：[GitHub Pages](https://fda75186-glitch.github.io/fengda/)。发布进度以仓库 Actions 为准。

仓库使用 `.github/workflows/pages.yml` 构建发布。GitHub Pages 的 Source 设置为 GitHub Actions。工作流根据 GitHub 返回的 `base_path` 生成资源路径，适配带仓库名的网址；推送到 `main` 会自动发布。每次新版本仍须先提供预览，用户人工确认后再发布。

## 功能与素材

首页科普影片、探索宇宙、知识卡、星空图谱、AI 星语、天文挑战、观测指南、AR 宇宙云图、本地社区、阅读与收藏。

AI 与知识卡使用本地科普知识，AR 为相机叠加演示；当前社区、评论和收藏存储在访问者自己的浏览器。观测地图需联网加载底图和地形，图谱位置不是实时天象。

行星纹理随项目提供，来源见 `public/textures/CREDITS.md`。仙女座纹理为生成的科普美术素材，来源与提示词见 `public/textures/galaxy-reference-v3.md`，星系与黑洞效果属于科普示意。其他素材来源见 `docs/素材来源.md`、`docs/第三版素材与交互更新.md` 和 `docs/地图数据来源.md`。

## 目录

- `src/`：页面、交互、模型、科普数据与样式。
- `public/`：Logo、纹理、图片和首页影片。
- `docs/`：方案、版本和素材资料。
- `tests/`：已有功能测试。
- `.github/workflows/pages.yml`：GitHub Pages 发布工作流。

星语与 NASA 无隶属关系。团队姓名、学校与分工由参赛团队正式填写。
