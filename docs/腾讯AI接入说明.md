# 0.1.9-preview.1：腾讯混元真实流式对话

以已采用并上线的正式0.1.8为基线。本次用户选择元宝，并确认只有元宝App账号。网站接入使用腾讯官方模型API，不复用元宝网页Cookie，也不承诺与元宝App完整功能/回答相同。

## 当前交付范围

- AI星语改为服务端调用模型、浏览器读取真实SSE流；移除定时器模拟逐字输出。
- 腾讯TokenHub默认模型hy3；兼容已有旧版混元API Key的hunyuan-turbos-latest。
- 登录后提问，服务端校验既有社区会话；按账号/全站限流并限制并发、输入长度及输出。
- 显示连接、生成、停止、失败、长度截断状态，保留已生成文字；对话切换和离开时取消旧请求。
- 密钥不下发浏览器、不进入日志；未配置密钥时明确显示未接入，不回退成假AI回答。
- 本轮是大模型对话接入，不包含RAG、Agent工具工作流、图像理解、实时天气或自动联网查询。知识卡创作仍保留原本地模板，未将它改称模型生成。

## 启用真实调用

1. 在[腾讯云TokenHub API Key管理](https://console.cloud.tencent.com/tokenhub/apikey)准备腾讯云账号及广州地域模型服务，创建可访问Hy3的在线推理API Key。服务开通、额度和费用以官方控制台为准。
2. 打开本机配置入口，把Key填写在密码框；不要发送到聊天、源码或GitHub。默认选TokenHub、模型ID为hy3；当前入口使用广州域名，须匹配该地域的Key。已有旧版混元Key可选旧接口并填写对应模型ID。
3. 配置页仅保存`.env.ai.local.json`，预览API在请求时加载；回到AI星语刷新状态，使用社区账号登录，发送一个问题确认真实模型响应。

本机配置页手动入口（预览目录）：

```powershell
node tools/configure-tencent-ai.mjs .env.ai.local.json
```

API预览启动时指定：

```powershell
node backend/dev-server.mjs --port 63601 --data-dir "C:/your-existing-preview-data" --assets-dir "C:/your-project/public/images" --ai-config-file "C:/your-project/.env.ai.local.json"
```

实际数据路径必须使用当前预览目录记录，不得改为历史用户服务目录或把用户数据库打包。云端正式接入时使用Sites运行时Secret：`TENCENT_API_KEY`，以及服务端`TENCENT_AI_ENDPOINT`、`TENCENT_AI_MODEL`；不将密钥写入VITE环境变量。新界面先由用户预览确认后再上线。

## 官方接口与资料

- [TokenHub API使用说明](https://cloud.tencent.com/document/product/1823/130078)：默认广州域名`https://tokenhub.tencentmaas.com`，模型列表包含hy3，Bearer API Key。
- [语言模型调用概览](https://cloud.tencent.com/document/product/1823/130079)：OpenAI兼容`/v1/chat/completions`协议。
- [旧版混元兼容接口](https://cloud.tencent.com/document/product/1729/111007)：`https://api.hunyuan.cloud.tencent.com/v1/chat/completions`。腾讯提示新服务逐步迁移TokenHub。

只允许上述明确的官方接口，客户端不能指定上游URL/模型或system角色。取消和超时中止上游读取，不展示隐藏推理内容，不透出上游原始错误/密钥。输出来源不由前端本地文章冒充。

## 验证边界

无API Key时，只能确认真实接入代码和模拟上游契约测试通过，不能宣称已验证腾讯模型实际回答。未自动浏览器/UI/GL审核，不自动购买服务，也未改变公网版本。

2026-10-15验证：前端106项、后端24项纯Node逻辑/契约测试通过，共130项；Vite构建通过。包含跨标签页退出/清空存储立即取消AI，以及旧鉴权响应不能覆盖新账号的回归验证。API及本机配置页HTTP检查通过；真实腾讯模型调用尚未验证。

## 2026-10-15真实接入验证

用户自行创建并提供API Key后，已仅保存到本机受Git忽略的私密配置。控制台显示这把Key仅绑定Hy4 preview，所以本机实际模型配置为hy4-preview；没有扩大云端权限。原Hy3调用不匹配该Key的服务范围，已按实际授权纠正。

根据[腾讯官方深度思考文档](https://intl.cloud.tencent.com/zh/document/product/1300/80637)，Hy3/Hy4默认开启思考。本站科普对话对这两个TokenHub模型明确发送thinking.type=disabled，让1024 token输出预算用于正文，避免思考耗完额度后返回空答案；旧版混元参数不变，隐藏推理仍不展示。

真实验证通过独立临时SQLite账号、HTTP登录鉴权、真实腾讯SSE及生产aiClient解析，未向当前用户数据库添加测试账号。一次“用一句话解释月相变化的原因”收到15个文字事件，首段约3.16秒、完整约3.93秒；只代表这次实测，不是性能保证。临时测试数据库已在校验路径后清理。报告在工作区output/ai-live-check.json，仅有公开科普回答和测量信息，不含凭据。

新增Hy4直接回答与旧版参数兼容回归验证后，后端25项通过，前端既有106项通过记录，总计131项；本次构建通过。公网和正式0.1.8交付包未修改，当前为可真实问答的本机0.1.9-preview.1，仍待用户人工预览确认。
