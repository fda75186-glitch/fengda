# AR 宇宙航行：数据来源与模型范围

本次预览以正式版 0.1.6 为基线。航行路线从地球、地月系统、太阳系、恒星邻域、银河系、本星系群延伸至宇宙网。它是用于科普的 3D 航行场景，各尺度之间分别缩放，不能用屏幕上的距离、大小或时间推算现实航程。

0.1.7-preview.3 的地面起点采用文昌风格滨海发射场，参考[中国载人航天工程办公室介绍](https://www.cmse.gov.cn/gygc/xtzc/hnfscxt/)。发射场布局、海岸与飞船为示意模型，不对应精确测绘位置。先沿地表法线爬升，再转入近地空间；自动避障路线用于交互体验，不是引力轨道计算或真实任务规划。详情见 [AR航行优化说明.md](AR航行优化说明.md)。

## NASA 系外行星目录快照

- 文件：`public/universe/exoplanets.json`。
- 来源：NASA Exoplanet Archive 的 Planetary Systems Composite Parameters（`pscomppars`）表，通过官方 TAP 接口获取。
- 抓取时间：2026-10-12 08:40:07 UTC，即北京时间 2026-10-12 16:40:07。
- 归档宿主名称分组数：**4,842**。
- 归档行星记录数：**6,445**。
- 其中 **58** 条行星记录带有归档的文献争议标记，资料卡保留这一说明。

这两个数量表示此次快照完整响应中的记录数，不表示宇宙中所有行星都已发现，也不表示每一个系统的轨道、伴星位置和行星表面都已测得。目录覆盖已收录系统，访问者选择一个系统时再生成该系统的示意场景。

[官方 TAP 查询方法](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html)、[PS 与 PSCompPars 表及字段定义](https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html)。PSCompPars 每颗行星一行，组合参数可能来自不同研究，未必组成同一个自洽轨道解。

实际查询如下，没有限制 TOP 或用少数热门系统替代全量响应：

```sql
select hostname,pl_name,pl_letter,pl_orbsmax,pl_orbper,pl_rade,pl_bmasse,pl_bmassprov,pl_controv_flag,st_teff,st_rad,sy_dist,sy_snum from pscomppars order by hostname,pl_name
```

[本次查询的官方数据地址](https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+hostname%2Cpl_name%2Cpl_letter%2Cpl_orbsmax%2Cpl_orbper%2Cpl_rade%2Cpl_bmasse%2Cpl_bmassprov%2Cpl_controv_flag%2Cst_teff%2Cst_rad%2Csy_dist%2Csy_snum+from+pscomppars+order+by+hostname%2Cpl_name&format=json)。

### 字段与单位

| 页面数据 | NASA 字段 | 处理方式 |
| --- | --- | --- |
| 宿主系统名称 | `hostname` | 按归档名称分组；原名称不替换 |
| 行星名称、字母 | `pl_name`、`pl_letter` | 保留归档名称 |
| 系统距离 | `sy_dist` | 原单位为秒差距，乘 3.261563777 转为光年 |
| 系统恒星数 | `sy_snum` | 指系统内引力相关恒星总数；不表示全都紧贴行星的宿主星 |
| 宿主有效温度 | `st_teff` | 开尔文 K；不是行星地表温度 |
| 宿主半径 | `st_rad` | 太阳半径 |
| 行星半径 | `pl_rade` | 地球半径，可能包含归档推算值 |
| 行星质量 | `pl_bmasse` | 地球质量；结合 `pl_bmassprov` 判断来源 |
| 公转周期 | `pl_orbper` | 地球日 |
| 轨道半长轴或投影距离 | `pl_orbsmax` | 天文单位 AU；对部分微引力透镜或直接成像记录，可能表示天球面投影距离 |
| 归档争议标记 | `pl_controv_flag` | 等于 1 时在资料卡说明文献中存在确认争议 |

`pl_bmassprov` 为 `Msini` 时，资料卡显示“最低质量 M sin i”；为 `Msin(i)/sin(i)` 时显示归档推算质量；为 `M-R relationship` 时显示“按质量半径关系估计的质量”。不把这些数值统一写成精确实测质量。未提供的科学字段保留 `null` 并显示“归档中未提供”。

例如此快照中的 TRAPPIST-1 有七颗行星；Proxima Cen 有两颗行星，系统恒星数为三。Kepler-90 的宿主字段为 **KOI-351**，八颗行星中有一颗的归档名称为 Kepler-90 i，因此搜索可以兼用宿主名和行星名。

## 太阳系与航行层级

太阳系场景有 **29 个可选择天体**：太阳、八大行星、五颗正式命名矮行星和十五颗精选天然卫星。没有把太阳系所有小卫星、小行星或彗星都画成独立模型。

| 内容 | 主来源 |
| --- | --- |
| 太阳系组成、太阳所处的猎户臂、柯伊伯带 | [NASA Solar System Facts](https://science.nasa.gov/solar-system/solar-system-facts/) |
| 太阳的核聚变、形成与大气层 | [NASA Sun Facts](https://science.nasa.gov/sun/facts/) |
| 水星 | [NASA Mercury Facts](https://science.nasa.gov/mercury/facts/) |
| 金星 | [NASA Venus Facts](https://science.nasa.gov/venus/venus-facts/) |
| 地球 | [NASA Earth Facts](https://science.nasa.gov/earth/facts/) |
| 火星 | [NASA Mars Facts](https://science.nasa.gov/mars/facts/) |
| 木星 | [NASA Jupiter Facts](https://science.nasa.gov/jupiter/jupiter-facts/) |
| 土星 | [NASA Saturn Facts](https://science.nasa.gov/saturn/facts/) |
| 天王星 | [NASA Uranus Facts](https://science.nasa.gov/uranus/facts/) |
| 海王星 | [NASA Neptune Facts](https://science.nasa.gov/neptune/neptune-facts/) |
| 谷神星、冥王星 | [谷神星资料](https://science.nasa.gov/dwarf-planets/ceres/facts/)、[冥王星资料](https://science.nasa.gov/dwarf-planets/pluto/facts/) |
| 阋神星、妊神星、鸟神星 | [阋神星](https://science.nasa.gov/dwarf-planets/eris/)、[妊神星](https://science.nasa.gov/dwarf-planets/haumea/)、[鸟神星](https://science.nasa.gov/dwarf-planets/makemake/) |
| 月球与地月距离、自转同步、月球大气 | [NASA Moon Facts](https://science.nasa.gov/moon/facts/) |
| 火卫一、火卫二 | [Phobos](https://science.nasa.gov/mars/moons/phobos/)、[Deimos](https://science.nasa.gov/mars/moons/deimos/) |
| 木卫一、二、三、四 | [Io](https://science.nasa.gov/jupiter/jupiter-moons/io/)、[Europa](https://science.nasa.gov/jupiter/jupiter-moons/europa/)、[Ganymede](https://science.nasa.gov/jupiter/jupiter-moons/ganymede/)、[Callisto](https://science.nasa.gov/jupiter/jupiter-moons/callisto/) |
| 土卫二、五、六、八 | [Enceladus](https://science.nasa.gov/saturn/moons/enceladus/)、[Rhea](https://science.nasa.gov/saturn/moons/rhea/)、[Titan](https://science.nasa.gov/saturn/moons/titan/)、[Iapetus](https://science.nasa.gov/saturn/moons/iapetus/) |
| 天卫三、四与海卫一 | [Titania](https://science.nasa.gov/uranus/moons/titania/)、[Oberon](https://science.nasa.gov/uranus/moons/oberon/)、[Triton](https://science.nasa.gov/neptune/moons/triton/) |
| 冥卫一及冥王星系统质心 | [Charon](https://science.nasa.gov/dwarf-planets/pluto/moons/charon/)、[NASA 冥王星与冥卫一质心动画说明](https://science.nasa.gov/photojournal/pluto-and-charon-in-color-barycentric-view-animation/) |

地月距离使用约 384,400 千米的常用平均值，月球自身几乎以同一面朝向地球。没有把地球也写成目前已与月球完全相互潮汐锁定。月相主要由受光部分的观察角度决定，月食才涉及地球影子。

| 星系及宇宙尺度内容 | 主来源 |
| --- | --- |
| 比邻星的行星与归档名称 | [NASA Proxima Centauri b](https://science.nasa.gov/exoplanet-catalog/proxima-centauri-b/)及本次 NASA 归档快照 |
| TRAPPIST-1 的七颗行星、未知大气与宜居条件 | [NASA Webb 对 TRAPPIST-1 系统的解释](https://science.nasa.gov/mission/webb/science-overview/science-explainers/what-is-webb-revealing-about-the-trappist-1-system/) |
| Kepler-90 i 及多行星系统 | [NASA Kepler-90 i](https://science.nasa.gov/exoplanet-catalog/kepler-90-i/)及归档 KOI-351 数据 |
| 银河系、星系群与宇宙层级 | [NASA Galaxies](https://science.nasa.gov/universe/galaxies/) |
| 太阳距银河中心约 26,000 光年 | [NASA Exploring the Milky Way 教学材料](https://science.nasa.gov/wp-content/uploads/2023/10/Exploring_the_Milky_Way.pdf) |
| 人马座 A* | [NASA 银河系中心说明](https://science.nasa.gov/mission/webb/science-overview/science-explainers/what-is-the-center-of-our-galaxy-like/) |
| 仙女座与三角座星系 | [NASA M31](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/)、[NASA M33](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-33/) |
| 大、小麦哲伦云 | [NASA The Galaxy Next Door](https://science.nasa.gov/earth/earth-observatory/the-galaxy-next-door/)、[NASA 麦哲伦星流的来源](https://science.nasa.gov/missions/hubble/hubble-finds-source-of-magellanic-stream/) |
| 室女座星系团 | [NASA Hubble ACS Image of 100 Virgo Cluster Galaxies](https://science.nasa.gov/asset/hubble/hubble-acs-image-of-100-virgo-cluster-galaxies/) |
| 宇宙网的丝状结构与空洞 | [NASA Webb Identifies the Earliest Strands of the Cosmic Web](https://science.nasa.gov/missions/webb/nasas-webb-identifies-the-earliest-strands-of-the-cosmic-web/) |

科学介绍采用中文概述，每个可选择天体保留来源链接。模型中星系的亮点、宇宙网的节点与行星场景里的恒星不是同一个尺度下的对象。

## 示意模型的边界

- 行星表面程序纹理、伴星朝向、轨道相位、偏心率和倾角没有足够观测字段，因此采用示意。轨道示意不代表今天的真实位置。
- 天体半径和天体间距分别压缩；原始科学字段留在资料卡，不能从可见大小反推数值。未知半径的天体仍可显示为可选择模型，但不生成“测得的半径”。
- 多恒星系统的 `sy_snum` 表达恒星总数，不提供伴星完整轨道。在场景中出现的伴星明确写“示意”，避免把宽距伴星画面当成真实近邻轨道。
- 恒星邻域与本星系群的位置用于层级导航，没有使用真实完整三维坐标。银河系外观为结构重建；宇宙网为概念场景。
- 在宜居带不等于发现生命；系外行星模型外观也不证明存在海洋或可供人类呼吸的大气。

## 更新与验证

队友可在项目根目录用 Python 3 运行 `python tools/fetch-exoplanets.py` 更新快照。脚本只使用标准库，请求全表、按宿主分组并保留缺失值；响应异常、名称缺失或重复行星记录时会停止，避免写入不完整目录。目录不是自动持续更新服务，页面读的是打包日期的静态快照。

已运行 `node --test tests/universe-catalog.test.js`，**5 项语义检查通过**：

1. 航线层级无循环，太阳系包含八大行星与五颗矮行星，精选卫星均有父天体。
2. 元数据计数与唯一记录一致，逐个转换全部 4,842 个系统后，每颗行星均保留，所有坐标与半径有限且有效。
3. 缺失科学参数保持未知，未把 `null` 变成实测数值。
4. 超过八颗行星的系统不被截断，按同类单位排序且不修改输入目录。
5. 最低质量、质量半径关系估计与争议标记进入资料说明。

这里记录的是数据与逻辑验证，没有进行自动 UI 审核，也没有发布公网或运行正式交付包。
