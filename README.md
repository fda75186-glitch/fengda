# 星语 · 天文科普平台

传智杯参赛作品，面向大众与学生的天文科普网站。第二版 `0.2.0`，采用 Vue 3、Vite、MapLibre GL、Three.js 和 Lucide 图标。

## 启动与开发

安装 Node.js 24 和 pnpm 11 后，在仓库根目录执行：

```powershell
pnpm install
pnpm dev
```

访问 http://127.0.0.1:5173/ 。开发预览期间保持终端运行。

```powershell
pnpm build
pnpm preview
```

生产网站文件生成到 `dist`。这个仓库包含可重新构建的源码及图片视频素材，不需要提交依赖目录或本机 Node 运行程序。

## GitHub 托管与在线体验

1. 将当前目录内容上传到自己的 GitHub 仓库，默认分支使用 `main`。
2. 打开仓库 **Settings → Pages**，将 **Source** 设置为 **GitHub Actions**。
3. 打开 **Actions → Publish StarWhisper to GitHub Pages → Run workflow**。
4. 发布成功后，Pages 设置页和工作流会显示真实在线地址。之后推送到 `main` 会自动更新网站。

工作流使用 GitHub 返回的 `base_path` 生成资源路径，适配 `用户名.github.io/仓库名/`。部署未完成前，不将地址模板当成可用链接。

发布方法参考 [GitHub Pages 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) 和 [Vite 官方部署指南](https://vite.dev/guide/static-deploy.html)。

## 第二版功能

原创观星影片、交互式三维天体、全站横条搜索、统一方框按压按钮、共享天文社区、社区内知识问答、地标历史科普、本地地理概览备用地图，以及第一版已有的文章、知识卡、星空图谱、AR 与收藏。

共享社区通过 `https://xingyu-shared-community.aptbook6.chatgpt.site` 的服务端 API 保存话题、照片、评论与点赞。每个浏览器使用匿名访客会话，昵称不代表经过验证的实名或注册账户。不同电脑可以读取彼此公开发布的内容；管理自己话题需要保留发布时浏览器中的访客会话。数据库与图片不放在 GitHub 仓库中。

`community-service/` 是完整后端源码，使用 Cloudflare Worker、D1 与 R2，由 Sites 发布。前端继续使用 GitHub Pages；Pages 无法直接执行数据库接口。迁移后端时必须配置真实数据库、图片桶与公开接口地址，不能单独双击后端文件启动云端服务。

AI 回答与知识卡仍是本地知识演示；AR 是相机叠加科普演示。三维模型及镜头未按真实距离比例绘制。外部立体地图加载失败时，本地地理概览与地标科普继续可用。

## 本地直接体验

完整离线启动包中，双击 `启动星语.cmd`。它使用随包附带的 Node 启动本地网站，无需安装依赖。共享社区和在线地图仍需要互联网。请不要双击 `dist/index.html`。

## 原创影片生成

运行 `pnpm dev` 后访问 `/film-render.html`，点击“生成观星影片”。三维镜头源码位于 `src/components/ObservatoryJourney.vue`；导出的 WebM 可以用 FFmpeg 转成 MP4。公开首页播放已经生成的影片，以减少设备性能要求。

## 素材来源

- [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/)：月球球面纹理及高程。
- [NASA Blue Marble](https://earthobservatory.nasa.gov/features/BlueMarble)：地球球面纹理。
- [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)：公有领域陆地地理数据。
- 木星、土星的模型表面由代码生成，属于科普示意；真实摄影与其署名见原有素材说明。


## 源码目录

- `src/`：页面、交互、科普数据和样式。
- `public/`：Logo、图片和首页影片素材。
- `tests/`：已有的知识、社区、交互、轨道与观测地测试。
- `docs/`：方案、版本记录、素材来源和地图坐标来源。
- `.github/workflows/pages.yml`：GitHub Pages 自动发布工作流。

素材来源与署名见 `docs/素材来源.md`、`docs/第三版素材与交互更新.md`、`docs/地图数据来源.md`。星语与 NASA 无隶属关系。团队姓名、学校和分工由参赛团队正式填写。
