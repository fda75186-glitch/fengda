# 首页精简运镜素材与制作说明

本片是观星想象旅程，采用实拍背景、3D 光学近景和 NASA 科学数据可视化。地面望远镜为本项目 CG，月球镜头为数据模型与摄影机运动；不应称为全程实拍纪录片。

## 本版镜头顺序

1. 地面近景约 7.93 秒：第一人称摄影机移向望远镜目镜，随后推进进入黑色光学视野。
2. 唯一一次月球主体镜头约 10 秒：月球模型保持静止，摄影机约 2.5 秒从远处接近，再约 7.5 秒沿轨迹完整环绕 360°。没有第二次月球飞行特写，片中月球占比较前版明显降低。
3. 返回地球约 9 秒：NASA SVS 5039 只选第 20–30 秒地球接近镜头，排除前半段月球。
4. 退出目镜约 4 秒：反向播放地面推进素材前 0–4 秒，回到望远镜近景并衔接循环。

总时长约 31 秒。精确时长、剪辑区间和速度见 `首页影片参数.json`。NASA 4619 月球飞行整段已删除，避免科学标注线及重复月球画面；NASA 4619 仅作为目镜里静态月轮帧的来源。

## 实际采用的来源

- 地面草野背景：Pavel Danilyuk，[Pexels 9121273 — A Person Using a Telescope](https://www.pexels.com/video/a-person-using-a-telescope-9121273/)。裁出原片右侧无人的草野与天空并调色，远景保留视频运动；前景器材和摄影机为 CG。[Pexels License](https://www.pexels.com/license/)。
- 目镜中的月轮帧：[NASA SVS 4619 — Tour of the Moon 4K Redux](https://svs.gsfc.nasa.gov/4619/)，仅取无字幕源片第 5 秒的画面用于光学视野纹理。[源视频](https://svs.gsfc.nasa.gov/vis/a000000/a004600/a004619/moontour_notitle_1080p30.mp4)。本版没有剪入其摄影机飞行片段。署名 NASA's Scientific Visualization Studio；Ernie Wright、David Ladd、Noah Petro。
- 唯一一次连续接近/绕月 CG：[NASA SVS 4720 — CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) 的 [LROC 8K 色彩图](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_8k.tif)与 [LOLA 测高数据](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif)。月球颜色没有重绘，地形依真实测高计算，摄影机路径为叙事设计。署名 NASA's Scientific Visualization Studio / LRO / LROC / LOLA；Ernie Wright、Noah Petro。
- 地球返程：[NASA SVS 5039 — From the Moon to the Earth](https://svs.gsfc.nasa.gov/5039/)，仅取第 20–30 秒地球接近部分。[1080p30 源视频](https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005039/moon_to_earth_1080p30.mp4)。署名 NASA's Scientific Visualization Studio；Blue Marble data courtesy of Reto Stockli (NASA/GSFC)；Ernie Wright、David Ladd。
- 3D 工具远处地球的颜色与云图纹理由既有版本提供，作者 Solar System Scope / INOVE，[原作者页](https://www.solarsystemscope.com/textures/)，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。纹理经过作者美术处理，不是实时卫星数据。星空为程序生成，非星表。

NASA 使用参照[官方媒体规范](https://www.nasa.gov/nasa-brand-center/images-and-media/)，保留来源署名。未采用原视频音乐或第三方纪录片配乐。

## 重新制作

工具源在 `tools/home-motion-renderers/`。网站启动不需要运行这些影片制作工具。两个渲染页仅用于产出镜头，制作控件不进入网站或影片画面。

根目录运行 `pnpm install --frozen-lockfile`；Python 需要 `imageio-ffmpeg`、`numpy` 和 `Pillow`。

1. 从官方链接重新下载 Pexels 原视频和 NASA 5039，置入工具根 `downloads/`。命名参照合成脚本。NASA 4619 只在需要重新提取目镜纹理时下载；整段片源不参与精简影片合成。
2. Moon Kit 两份 TIFF 下载至 `orbit-render/source-data/`，命名 `moon-color-8k.tif`、`moon-dem-16.tif`；运行 `python orbit-render/prepare-data.py` 生成颜色、地形和法线资源。交付已包含本次运行纹理，普通网页不需重新下载大体积 TIFF。
3. `make-ground-plate.py` 处理 Pexels 草野视频，产物放入 `telescope-render/public/`。望远镜三维模型沿透视摄影机路径录制，下载为 `telescope-camera.webm`；环月制作页使用本版约 10 秒摄影机轨迹，导出为 `moon-camera-orbit.webm`。工具源码含逐帧编码/封装模块。
4. 用根目录锁定 Vite 构建渲染页，例如 `node node_modules/vite/bin/vite.js build --config tools/home-motion-renderers/orbit-render/vite.config.mjs`。另一个配置位于 `telescope-render/`。在合适的本地服务中人工打开页面，操作导出按钮。构建不等于视觉验收。
5. 运行 `python tools/home-motion-renderers/compose-moving-journey.py`。准确输入名以该版本脚本为准。将其输出 MP4/JPG 分别复制至 `public/video/stargazer-moving-journey.mp4`、`public/images/stargazer-moving-poster.jpg`，参数复制至 `docs/首页影片参数.json`，再构建网站。

本版待用户人工审核，尚未发布、安装或启动交付包。已确认正式网站仍为 0.1.1。
