# 星语正式版0.1.8

2026-10-14用户授权将已确认0.1.8发布到既有GitHub Pages和共享社区后端。包含Vue3/Three.js宇宙飞船与虫洞地图、逐层进入星系和示意系统、观测指南、知识卡、用户名密码社区和图文/文章/视频发布。

前端入口：https://fda75186-glitch.github.io/fengda/
共享服务：https://xingyu-shared-community.aptbook6.chatgpt.site

AI星语目前是本地知识匹配演示，未接入LLM或RAG；摄像头是本机叠加，语音是浏览器朗读。NASA真实系外目录与未知结构的科普示意分别标注。不要宣称完整宇宙测绘或实时天象。

Node24和pnpm11开发：pnpm install --frozen-lockfile。GitHub Actions配置/fengda/路径与共享API，构建后发布Pages。86项前端逻辑测试与6项后端测试通过，用户人工确认视觉，无自动UI/GL审核。素材来源和科普来源见docs与public/textures/CREDITS.md。

没有上传本机账号、令牌、数据库或用户媒体。保留既有云端D1/R2数据；此次共享地图服务更新不做删除或破坏性迁移。源码可回退到发布前提交b9dcf9fa2337988975275a9e81892fc16dd09766，回退不删除云端用户数据。
