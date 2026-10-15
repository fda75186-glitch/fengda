# 星语正式版 0.1.9

已获用户授权，将人工确认的0.1.9-preview.4发布到原GitHub Pages及共享服务。

网站：https://fda75186-glitch.github.io/fengda/
共享API：https://xingyu-shared-community.aptbook6.chatgpt.site

本版接入真实腾讯Hy4流式对话及Function Calling，支持站内检索、知识卡制作、工作室同步和社区文章草稿。知识卡可编辑确认后直接分享到社区，重复确认去重；任何发布仍由用户检查并明确确认。API凭据只存云端Secret，前端和源码中不含凭据。图片生成尚待腾讯模型授权，保持关闭。

保留Vue3/Three.js宇宙航行、虫洞地图与逐层探索、NASA系外目录、观测指南、知识阅读、用户名密码社区及图文文章视频发布。科普示意与真实目录分别标注。

Node24、pnpm11：pnpm install --frozen-lockfile，pnpm test，pnpm build。GitHub Actions设置/fengda/路径及既有共享API后发布。已确认应用166项纯Node检查、真实Hy4制卡及隔离HTTP分享验证通过；用户人工确认视觉，无自动UI/GL审核。

没有上传本机数据库、账号、令牌或媒体。云端保留原D1/R2绑定，只新增image_generations任务表，不删除已有用户数据。AI共享定义位于shared/，后端位于backend/；部署说明见docs。回退可恢复前一前端提交及Sites已保存版本，保留数据库与媒体。
