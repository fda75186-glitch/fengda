# 星语社区后端 0.1.3

这一目录包含真实用户名与密码账号、共享帖子、图片/视频文件、评论和点赞。前端不再用匿名访客会话充当登录。相同业务API已部署到既有线上共享服务：https://xingyu-shared-community.aptbook6.chatgpt.site 。网页继续由GitHub Pages托管；本地完整包依然使用自己的独立SQLite数据。

## 运行本地 API

需要 Node.js 24（交付包内的 `runtime/node.exe` 也可使用），无需安装后端 npm 依赖：

```powershell
node backend/dev-server.mjs --port 0 --data-dir "C:/your-preview-data" --assets-dir "C:/your-project/public/images"
```

`--port 0` 自动选择空闲端口，程序只打印真实地址，例如 `{"url":"http://127.0.0.1:51234","storage":"isolated local SQLite + files"}`。SQLite 数据库与上传媒体都写入显式指定的 `--data-dir`，不会写入历史版本、远程数据库或 GitHub。仅绑定 127.0.0.1。关闭终端即停止服务；保留数据目录可继续使用已注册账号。

只有本地空数据库且指定 `--assets-dir` 时，才创建四篇“星语编辑”科普示例，点赞和评论初始为 0。该系统作者没有账号或密码，无法登录。示例帖子仍可接收真实的本地预览用户评论；云端 Worker 不自动创建示例。

启动器可以导入：

```js
import { createApiServer } from './backend/dev-server.mjs';
const api = await createApiServer({ port: 0, dataDir: './isolated-data', assetsDir: './public/images' });
// api.url, api.server; await api.close();
```

模块导入不启动服务。启动器可将 `/api/*` 代理给 `api.url`。本地前端通过 API origin 配置连接另一个端口时，媒体响应中的 `/api/media/...` 需相对 **API origin** 解析，不能相对静态页面解析。

## API 契约

所有错误统一为 `{error: "用户可读信息", code: "机器可读错误码"}`；鉴权失败 401、无权操作 403、用户名冲突 409、大小超限 413、媒体格式错误 415、限流 429。客户端不要记录密码或完整 Bearer token。

| 接口 | 请求 / 响应 |
| --- | --- |
| `GET /api/health` | `{status:"ready",version:"0.1.3",auth:"username-password",video:true,storage}` |
| `POST /api/auth/register` | JSON `{username,password}` → `{token,user:{id,name,avatar:null},expiresAt}`，201 |
| `POST /api/auth/login` | 同注册请求 → 同响应，200 |
| `GET /api/auth/me` | Bearer → `{user,expiresAt}`；不再次返回令牌 |
| `POST /api/auth/logout` | Bearer → `{ok:true}`；只撤销当前会话 |
| `GET /api/posts` | 匿名可读公开帖子；Bearer 可额外读取自己私密帖子 → `{posts:[...]}` |
| `POST /api/posts` | Bearer + 下述 JSON → `{id}`，201；随后刷新列表 |
| `POST /api/media` | Bearer + 原始文件二进制，正确 `Content-Type`；可选 URL 编码 `X-Filename` → `{url:"/api/media/<uuid>"}`，201 |
| `POST /api/images` | 兼容图片上传路径，契约同 `/api/media`，仅图片 |
| `GET/HEAD /api/media/:id` | 返回媒体，支持单个 byte range 与 206 / 416 |
| `GET/HEAD /api/images/:id` | 兼容历史图片读取路径 |
| `POST /api/posts/:id/comments` | Bearer + `{content}` → `{ok:true}`，201；作者由账号确定 |
| `POST /api/posts/:id/like` | Bearer + `{}` → `{ok:true}`，切换当前账号点赞 |
| `POST /api/posts/:id/delete` | Bearer + `{}`，仅作者可删除 → `{ok:true}` |
| `GET /api/events` | SSE `change` 事件通知列表需要刷新 |

用户名先 NFKC、去首尾空白，再按不区分大小写的规范化键唯一保存；2–30 个字符，支持中英文、数字、下划线、点和连字符。密码 8–128 个字符，密码本身不进行规范化。账号 ID 稳定；重新登录、其他浏览器登录后仍属于同一作者。令牌随机 32 字节、有效期 7 天，数据库只存令牌 SHA-256；密码使用随机 16 字节盐与 PBKDF2-HMAC-SHA256，100000 次，密码及原始令牌不写入服务日志。

密码工作因子采用 Cloudflare 当前可执行的兼容上限；提升上限的 [workerd 官方 PR](https://github.com/cloudflare/workerd/pull/7550) 在本次制作时尚未合并。这是平台兼容选择，不声称满足更高工作因子的推荐值。部署前应重新核对目标运行时限制；未来提高成本应保存每条账号的算法版本并增加升级迁移。此版本没有邮件找回密码或身份验证功能。

发布请求：

```json
{
  "title": "今晚的月亮",
  "content": "我的观测记录与拍摄心得。",
  "kind": "image",
  "category": "观星日记",
  "communities": ["观星日记"],
  "topics": ["月球"],
  "images": ["/api/media/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"],
  "video": "",
  "cover": "",
  "visibility": "public",
  "originality": "original",
  "sourceUrl": "",
  "format": "plain",
  "target": "月球",
  "location": ""
}
```

`kind` 可为 image/article/video。标题 2–80 字、正文 1–20000 字；图片最多 9 张、每张 ≤ 8 MiB（JPG/PNG/WebP）；视频 MP4/WebM ≤ 50 MiB。视频类型必须上传视频。关联社区最多 2 项、话题最多 5 项。类别为观星日记/天文问答/摄影分享/学习交流，兼容将旧“星空摄影”映射为摄影分享、“行星观测”映射为观星日记。`originality` 支持 original/repost 或原创/转载，`sourceUrl` 仅允许 http/https；`format` 为 plain/markdown。上传会检查文件头与声明格式一致，但不做转码或内容审核。

帖子的 `author`、`authorId` 从服务器会话确定，客户端伪造作者字段无效。发帖只能引用自己上传的媒体，不能使用外部任意链接。列表保留原字段并增加 `kind/type, authorId, authorAvatar, communities, topics/tags, video/videoUrl, cover/coverImage, visibility, originality, sourceUrl, format, isExample`。`isExample` 仅标识本地编辑科普示例，不代表用户假活动。

公开帖子引用的媒体可以匿名读取；未发布或只被私密帖子引用的媒体仅作者 Bearer 可读。私密图片/视频预览需用授权 `fetch` 后创建 Blob URL，不应将 Bearer token 放在媒体 URL 查询参数。编辑器在发布前优先使用用户本地选择文件的 Blob 预览。所有文本必须按纯文本/安全 Markdown 渲染，不能直接 `v-html` 拼接原文。

## 云端部署源码

`api.mjs` 是本地与 Worker 共用的业务实现；`worker.mjs` 使用 D1/R2；`local-adapter.mjs` 使用 Node 内置 SQLite 与文件流。它们的接口、鉴权、媒体大小和可见性判断相同。既有服务的路由与初始 SQL 保留在 `reference/` 供追溯，仅为源码参考，不是部署入口。没有复制原站 project_id 或密钥配置。

**本版已获用户确认并授权上线**。现有Sites服务使用Vinext/D1/R2适配器、同一api.mjs和追加的schema迁移；以下为独立Cloudflare部署的手工说明：

1. 创建独立 Cloudflare D1 数据库与 R2 bucket，复制 `wrangler.example.jsonc` 为 `wrangler.jsonc`，填入实际新数据库 ID、bucket、公开 API 域名及 GitHub Pages CORS origin。
2. 使用 Wrangler 登录账户，运行 `npx wrangler@4 d1 migrations apply xingyu-community-013 --remote --config wrangler.jsonc`。
3. 运行 `npx wrangler@4 deploy --config wrangler.jsonc`，部署确认后才将前端 API origin 指向新服务。前端继续由 GitHub Pages 托管。

数据库迁移 0000 建立旧结构，0001 加入账号及扩展媒体/帖子字段。对既有数据库迁移前须备份并核实迁移记录；旧匿名话题可以读取，但该版不接受匿名写入，也不把原浏览器访客身份自动认领为新账号。`POST /api/session` 明确返回 410，提示注册/登录，避免匿名身份冒充账号。

官方部署资料：[D1 Wrangler 命令](https://developers.cloudflare.com/d1/wrangler-commands/)、[R2 创建 bucket](https://developers.cloudflare.com/r2/buckets/create-buckets/)、[Node SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)。

本地 SSE 使用同一业务写入的订阅通知，无需轮询；D1 云端沿用旧服务的 SSE revision 查询，每段连接约 100 秒后重连。没有另接第二套实时数据库。客户端收到事件后刷新帖子，网络断开应保留错误和重试状态。

## 验证

```powershell
node --test backend/tests/api.test.mjs
```

测试只创建临时 SQLite/文件目录，结束后清理；不启动常驻服务、访问云数据库或发布真实帖子。验证注册与规范化用户名唯一性、错误密码、稳定用户身份、无登录不能发帖、媒体类型/大小/所有权、作者不可伪造、私密帖子及附件权限、点赞评论、视频 Range 和注销。界面仍由用户人工审核。
