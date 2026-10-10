# 星语 · 天文科普平台

传智杯参赛作品，面向大众与学生的天文科普网站。第一版 `0.1.0`，采用 Vue 3、Vite、MapLibre GL 和 Lucide 图标。

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

## 第一版功能

首页科普影片、探索宇宙与文章阅读、知识卡、八大行星公转图谱、AI 星语、天文挑战、真实地形观测地图、AR 宇宙云图、本地社区，以及阅读记录与收藏。

品牌标识统一为立体土星，支持页面切换与按钮反馈、滚动显现、可移动及隐藏的星语快捷入口。

AI 和知识卡是本地知识演示；AR 是科普相机叠加演示；社区、评论和收藏保存在访问者自己的浏览器，未接入账户、云端数据库或真实大模型。地图需要联网加载底图和地形，轨道位置不是实时天象。

## 源码目录

- `src/`：页面、交互、科普数据和样式。
- `public/`：Logo、图片和首页影片素材。
- `tests/`：已有的知识、社区、交互、轨道与观测地测试。
- `docs/`：方案、版本记录、素材来源和地图坐标来源。
- `.github/workflows/pages.yml`：GitHub Pages 自动发布工作流。

素材来源与署名见 `docs/素材来源.md`、`docs/第三版素材与交互更新.md`、`docs/地图数据来源.md`。星语与 NASA 无隶属关系。团队姓名、学校和分工由参赛团队正式填写。