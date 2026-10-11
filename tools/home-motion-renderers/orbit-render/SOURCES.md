# 独立环月渲染源文件（历史数据与工具说明）

本文件保留此前 17 秒镜头的数据来源。**本目录当前版本为 10 秒单个连续月球镜头**，准确的时长与机位以 `README-short.md`、`src.js` 为准；没有此前末段后撤。纹理、地形、光照没有变化，未复用 NASA 4619 带线条或标注的影片。

这是叙事用途的 CG 摄影机镜头，而非真实航天器拍摄的纪录片片段。月球固定不自转，摄影机在 14.5 秒内走完 360°，再用 2.5 秒后撤并下移取景，使月轮升到画面上部、远处地球从下方月缘出现。

## 数据与参考

- 月球颜色：NASA SVS [CGI Moon Kit（4720）](https://svs.gsfc.nasa.gov/4720/)，2019 版 LROC 8192 × 4096 色彩图。源文件：https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_8k.tif 。本页只转换为 JPEG 供 WebGL 解码，未重绘颜色。
- 月球地形：同页 LOLA `ldem_16_uint.tif`，5760 × 2880，16 位无符号整数，每单位半米，基准半径 1727400 m。源文件：https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif 。顶点位移依其高度计算，法线贴图由该测高数据的球面梯度计算。基准球半径为 1737400 m，几何高度未夸张。
- 场景基于 NASA 科学数据；请署名 **NASA's Scientific Visualization Studio / LRO / LROC / LOLA**。CGI Moon Kit 可视化：Ernie Wright（USRA）；科学支持：Noah Petro（NASA/GSFC）。使用边界参见 [NASA 媒体使用指南](https://www.nasa.gov/nasa-brand-center/images-and-media/)。不包含 NASA 商标、背景音乐或第三方纪录片片段。
- 运镜研究：NASA SVS [Tour of the Moon 4K Redux（4619）](https://svs.gsfc.nasa.gov/4619/)。学习贴近月面与改变机位的飞越方式，未将其标注/配乐影片嵌入本渲染页。
- 地球颜色与云图：随已确认星语版本提供的 **Solar System Scope / INOVE** 纹理，许可 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，原始作者页 [Textures](https://www.solarsystemscope.com/textures/)。这些纹理经过原作者艺术处理，不应标注实时卫星云图。
- 星空：固定随机种子的程序化三维星点，艺术背景，非星表数据。

## 运镜与参数

1. 开始：46° 垂直视野；机位约 `(0, 0.559, 2.621)`，月轮直径约占 92% 画面高度。初始近侧地形纹理方向由固定的月球旋转设置给定。
2. 中间：摄影机绕世界 Y 轴走完一圈，距离由 2.68 Moon radii 平滑收近至 1.81，纬度与 bank 随轨迹变化。月面会在画面中斜向流动并有局部裁切，地形法线、日夜分界与远景星空产生不同视差。
3. 14.5 秒：360° 已完成，摄影机回到初始经度。
4. 17 秒：机位约 `(0, -0.040, 4.030)`，看向 `(0, -0.630, 0)`；月轮抬高。地球固定在 `(-55, -58, -190)`，半径 3.667 Moon radii，月地距离约 359400 km。地球方向、时间压缩及镜头轨道属于叙事设计，并非科学任务复现。

月球 DEM 为全月 16 px/degree，约 1.9 km/像素赤道尺度；这比 4619 中局部高解析地形低。该渲染可满足真正摄影机环绕，但不能等同于 NASA 低空区域飞越的 25 cm–数米影像质量。不要为了“写实”使用光滑塑料材质、月球自转或屏幕贴图缩放替代摄影机路径。

## 录制与构建

- 本页 canvas 始终输出 1920 × 1080，界面可缩放显示，输出比例 16:9。
- 点击“开始录制”；保持页面前台约 17 秒；完成后点击“下载绕月影片”。MediaRecorder 优先 VP9 WebM，30 fps，目标码率 15 Mbps，预估 32 MB 左右，无声。
- Three.js 与 Vite 使用桌面预览版内已锁定依赖。`vite.config.mjs` 的别名路径是本机制作路径；交付项目时应换成普通依赖声明。
- 构建：用随 Codex 的 Node 执行桌面预览版 `node_modules/vite/bin/vite.js build --config vite.config.mjs`，工作目录为本文件所在目录。静态路径 `/moon-camera-render/`，构建输出 `build/`，根代理可将其复制到现有预览服务器的新子目录，禁止启动新的后台服务。
- 这是影片制作页面，不会出现在正式网站 UI 中。

## 后续逐帧导出工具（2026-10-11）

新增源页按钮“逐帧导出”，使用浏览器本地 WebCodecs VideoEncoder 而非实时 canvas.captureStream。按 `i / 30` 渲染 510 个机位，VideoFrame timestamp 为 `round(i × 1e6 / 30)` 微秒；限制编码队列小于 3，优先 VP9、回退 VP8。输出通过独立 `webm-muxer.mjs` 按 WebM 规范封装为 17 秒无声影片。它不依赖后台 requestAnimationFrame 帧率；后台定时器节流只可能延长生产时间，不会压缩镜头帧数。

此模块保留为源工具，未重新构建或替换根代理已成功录制的 508 帧实时素材。当前 `build/` 仍是录制该素材时的版本。后续需要此功能时再构建。

WebM 封装器采用 EBML + Info + Tracks + 每 2 秒 Cluster/SimpleBlock，未实现 SeekHead/Cues，适合先下载到本机再用 FFmpeg 转 H.264 的制作流程。其输入为 WebCodecs VP8/VP9 EncodedVideoChunk；导出检查完整帧数后才提供文件，避免输出不足帧影片。

封装验证：用 FFmpeg 生成 70 帧 VP9 IVF 小样，经同一 `webm-muxer.mjs` 封装并由 FFmpeg 解码，确认完整解出 70 帧、30 fps、2.333 秒，覆盖 2 秒 Cluster 边界；记录见 `verify/decode-log.txt`。没有对网站执行自动 UI 检查，也没有验证浏览器 WebCodecs 的实际运行，因此逐帧工具须在下次需要时通过正常页面按钮运行。

参考：[W3C WebCodecs](https://w3c.github.io/webcodecs/)、[WebM Container Guidelines](https://www.webmproject.org/docs/container/)、[Matroska/CELLAR 元素表](https://raw.githubusercontent.com/ietf-wg-cellar/matroska-specification/master/ebml_matroska.xml)。
