// Scene coordinates and radii are deliberately compressed for a readable voyage.
// They are not an ephemeris, a navigation solution, or one consistent physical scale.
const nasa = 'https://science.nasa.gov/';
const archive = 'https://exoplanetarchive.ipac.caltech.edu/';
const earthFacts = nasa + 'earth/facts/';
const moonFacts = nasa + 'moon/facts/';
const galaxyFacts = nasa + 'universe/galaxies/';
const sourceName = 'NASA Science';

function body(id, name, kind, radius, position, color, description, detailFacts, path, extra = {}) {
  return { id, name, kind, radius, position, color, description, detailFacts, sourceUrl: path.startsWith('http') ? path : nasa + path, sourceName, ...extra };
}

const earth = body('earth', '地球', 'planet', 3.3, [0, 0, 0], '#7eaedb',
  '海洋、陆地与薄薄的大气共同构成我们的家园。地球是太阳系第三颗行星，也是目前唯一确认存在生命的世界。',
  ['绕太阳公转约 365.25 天。', '地表大部分被液态水覆盖。', '蓝色边缘是大气的示意；模型大小与距离为教学缩放。'], earthFacts, { texture: 'earth' });
const moon = body('moon', '月球', 'moon', .9, [11, .7, -4], '#bbb4aa',
  '月球是地球的天然卫星。月海、撞击坑和高地保存了太阳系早期的历史，月相则来自我们看见的受光部分变化。',
  ['地月平均距离约 38.44 万千米。', '月球自转和绕地球公转同步，通常以同一面朝向地球。', '月球几乎没有能像地球大气那样保护地表的浓厚大气。'], moonFacts, { texture: 'moon', parentBodyId: 'earth' });

const solarBodies = [
  body('sun', '太阳', 'star', 3.8, [0, 0, 0], '#ffe0a1', '太阳是一颗恒星，以核心核聚变提供能量。它的引力将行星和许多小天体维系在太阳系中。', ['太阳约形成于 46 亿年前。', '它没有坚实地表，可见的光球上方还有色球与日冕。', '太阳光到地球大约需要 8 分钟。'], 'sun/facts/', { texture: 'sun' }),
  body('mercury', '水星', 'planet', .42, [6.4, .1, -1.4], '#9f978b', '水星最靠近太阳，也是八大行星中最小的一颗。布满撞击坑的地表在昼夜之间经历极大的温差。', ['绕太阳公转约 88 个地球日。', '没有天然卫星。', '最热行星是金星，而不是水星。'], 'mercury/facts/', { texture: 'mercury' }),
  body('venus', '金星', 'planet', .73, [-8.2, .1, -1.6], '#dfba7c', '金星的大小与地球相近，但浓厚的二氧化碳大气造成强烈温室效应。望远镜下看到的是覆盖整个行星的云层。', ['太阳系中地表最热的行星。', '自转方向与多数行星相反。', '没有天然卫星。'], 'venus/venus-facts/', { texture: 'venus' }),
  { ...earth, radius: .8, position: [-6.2, 0, 9.7], detailFacts: ['太阳系第三颗行星。', '绕太阳公转约 365.25 天。', '月球是地球的天然卫星。'] },
  { ...moon, radius: .22, position: [-4.7, .3, 10.8] },
  body('mars', '火星', 'planet', .62, [12, .1, 9.7], '#bc624b', '火星是寒冷、干燥的岩石行星。铁矿物氧化让地表呈红色，河谷和沉积岩提示它曾有更温暖、湿润的环境。', ['绕太阳公转约 687 个地球日。', '大气非常稀薄，主要成分是二氧化碳。', '拥有火卫一、火卫二两颗小卫星。'], 'mars/facts/', { texture: 'mars' }),
  body('jupiter', '木星', 'planet', 2.1, [21, 0, -5.5], '#c49e82', '木星是太阳系最大行星。云带和大红斑属于大气中的流动与风暴，它没有像地球那样的坚实地表。', ['主要由氢和氦组成。', '自转一周约 10 小时。', '四颗伽利略卫星构成值得探索的卫星系统。'], 'jupiter/jupiter-facts/', { texture: 'jupiter' }),
  body('saturn', '土星', 'planet', 1.75, [-21.6, 0, -15], '#d9c397', '土星是一颗气态巨行星，明亮光环由大量冰与岩石颗粒组成。看似完整的圆环，其实包含许多缝隙与细微结构。', ['太阳系第二大行星。', '光环不是一整块固体。', '土卫六有浓厚大气，土卫二有向外喷出的冰与水汽。'], 'saturn/facts/', { texture: 'saturn', ring: true }),
  body('uranus', '天王星', 'planet', 1.15, [12, .4, -30], '#9bcedb', '天王星属于冰巨星。它的自转轴倾斜很大，仿佛侧躺着绕太阳运动；大气中的甲烷影响了它呈现的颜色。', ['绕太阳公转约 84 个地球年。', '存在暗淡光环。', '冰巨星内部富含水、氨和甲烷等成分。'], 'uranus/facts/', { texture: 'uranus' }),
  body('neptune', '海王星', 'planet', 1.12, [-34, 0, 18], '#6887bc', '海王星是最外侧的八大行星之一，属于冰巨星。它遥远的大气中有强风，最大的卫星海卫一沿逆行轨道运动。', ['绕太阳公转约 165 个地球年。', '1846 年的发现得到数学预测的指引。', '不是所有真实颜色都能由屏幕贴图准确还原。'], 'neptune/neptune-facts/', { texture: 'neptune' }),
  body('ceres', '谷神星', 'dwarf', .3, [14.2, 1, -11.5], '#a4a09a', '谷神星位于火星与木星之间的主小行星带。它既是这一区域最大的天体，也被归类为矮行星。', ['是内太阳系中的矮行星。', '黎明号探测器研究了它的地表与明亮盐类沉积。', '矮行星同样绕太阳运行，但没有清空轨道邻域。'], 'dwarf-planets/ceres/facts/'),
  body('pluto', '冥王星', 'dwarf', .35, [26, 1.5, 30], '#c6b4a0', '冥王星是柯伊伯带中的矮行星。新视野号揭示了心形区域、冰山与复杂地貌，说明遥远的冰世界也可能十分活跃。', ['2006 年起被归类为矮行星。', '绕太阳公转约 248 个地球年。', '与最大卫星冥卫一构成特殊的双天体系统。'], 'dwarf-planets/pluto/facts/'),
  body('eris', '阋神星', 'dwarf', .34, [-43, 4, -25], '#c3bdb3', '阋神星是太阳系外缘的矮行星，大小与冥王星相近。它的发现推动了对行星定义的讨论。', ['位于海王星之外。', '有一颗名为 Dysnomia 的卫星。', '这里的地表花纹是示意，并非近距离实测照片。'], 'dwarf-planets/eris/'),
  body('haumea', '妊神星', 'dwarf', .3, [-5, 3, 42], '#bebdb5', '妊神星是柯伊伯带中的矮行星，自转很快，因此外形明显拉长。它也是已知具有光环的柯伊伯带天体。', ['自转一周约 4 小时。', '有 Hiʻiaka 与 Namaka 两颗卫星。', '形状、光环尺寸与朝向采用示意。'], 'dwarf-planets/haumea/', { ring: true, shape: [1.65, .72, .85] }),
  body('makemake', '鸟神星', 'dwarf', .31, [37, 3, -28], '#bf9d86', '鸟神星位于遥远的柯伊伯带。它是一颗覆盖着冰冷物质的矮行星，帮助我们理解太阳系外缘的形成历史。', ['位于海王星轨道之外。', '拥有已发现的卫星。', '目前没有飞船近距离到访，外观为教学示意。'], 'dwarf-planets/makemake/'),
  body('io', '木卫一 · 艾奥', 'moon', .22, [24.1, .25, -6.3], '#ceba72', '木卫一被木星和邻近卫星的引力拉扯，潮汐加热推动着剧烈火山活动。它展示了引力如何为地质活动提供能量。', ['是四颗伽利略卫星之一。', '太阳系中火山活动最强烈的世界之一。'], 'jupiter/moons/io/', { parentBodyId: 'jupiter' }),
  body('europa', '木卫二 · 欧罗巴', 'moon', .21, [20.7, .3, -9.4], '#d3c1aa', '木卫二的冰壳下可能存在全球海洋。地表交错的裂纹，使它成为研究太阳系海洋世界的重要目标。', ['证据支持冰壳下存在液态海洋。', '是否具有适合生命的条件仍需研究，尚未发现生命。'], 'jupiter/moons/europa/', { parentBodyId: 'jupiter' }),
  body('ganymede', '木卫三 · 盖尼米得', 'moon', .29, [16.5, .45, -7.3], '#989a95', '木卫三是太阳系最大的卫星，比水星还大。它的明暗地形记录了不同阶段的地表演化。', ['拥有自身磁场。', '内部可能存在海洋层。'], 'jupiter/moons/ganymede/', { parentBodyId: 'jupiter' }),
  body('callisto', '木卫四 · 卡利斯托', 'moon', .27, [21, .3, -.9], '#8c857f', '木卫四的古老地表布满撞击坑。与木星内侧卫星相比，它保存了更多撞击历史的痕迹。', ['是四颗伽利略卫星中轨道最外侧的一颗。', '古老的撞击地貌提供太阳系早期线索。'], 'jupiter/moons/callisto/', { parentBodyId: 'jupiter' }),
  body('titan', '土卫六 · 泰坦', 'moon', .28, [-17.6, .35, -16.2], '#c89957', '泰坦具有浓厚大气，地表的河流、湖泊与降雨由甲烷和乙烷参与循环。它让我们看见与地球不同的气候系统。', ['土星最大的卫星。', '是唯一已知拥有浓厚大气的卫星。', '2005 年惠更斯号着陆器抵达地表。'], 'saturn/moons/titan/', { parentBodyId: 'saturn' }),
  body('enceladus', '土卫二 · 恩克拉多斯', 'moon', .15, [-24.7, .25, -18.6], '#e4e7e1', '土卫二南极区域向太空喷出冰粒和水汽，冰壳之下存在海洋。它是寻找宜居环境的重要目标。', ['冰粒喷流补给土星的 E 环。', '存在生命的说法尚未得到证实。'], 'saturn/moons/enceladus/', { parentBodyId: 'saturn' }),
  body('triton', '海卫一 · 特里同', 'moon', .22, [-30.8, .5, 16], '#bcb0af', '海卫一是海王星最大卫星，公转方向与海王星自转方向相反。科学家认为它很可能是被捕获的柯伊伯带天体。', ['拥有逆行轨道。', '旅行者 2 号曾观察到喷流现象。'], 'neptune/moons/triton/', { parentBodyId: 'neptune' }),
  body('charon', '冥卫一 · 卡戎', 'moon', .19, [27.4, 1.9, 30.9], '#aaa39b', '冥卫一是冥王星最大卫星。二者围绕位于冥王星之外的共同质心运动，并相互保持同一面朝向对方。', ['新视野号在 2015 年飞掠时近距离研究了这个系统。', '地表可见巨大的峡谷和色彩不同的极区。'], 'dwarf-planets/pluto/moons/charon/', { parentBodyId: 'pluto' }),
  body('phobos', '火卫一 · 福波斯', 'moon', .12, [13.2, .45, 9.1], '#999084', '火卫一是一颗形状不规则的小卫星，紧贴火星运行。巨大的斯蒂克尼撞击坑占据了它地表的显眼区域。', ['围绕火星运行，比火星自转一周更快。', '形状、尺寸和轨道间距在这里被放大。'], 'mars/moons/phobos/', { parentBodyId: 'mars', shape: [1.3, .9, .85] }),
  body('deimos', '火卫二 · 戴摩斯', 'moon', .1, [10.9, .6, 11.2], '#bbb1a5', '火卫二比火卫一更小，在更远的轨道上围绕火星。它的不规则形状与覆盖着细碎物质的地表，让人想起小行星。', ['是火星两颗天然卫星之一。', '图中外观是简化地形示意。'], 'mars/moons/deimos/', { parentBodyId: 'mars', shape: [1.3, .8, .9] }),
  body('titania', '天卫三 · 泰坦妮亚', 'moon', .2, [14.3, 1.1, -31.7], '#b5b3ac', '泰坦妮亚是天王星最大的卫星。地表的峡谷和断裂记录了冰冷天体内部与外壳的演化。', ['旅行者 2 号在 1986 年飞掠天王星系统。', '它的卫星轨道位于明显倾斜的天王星赤道平面附近。'], 'uranus/moons/titania/', { parentBodyId: 'uranus' }),
  body('oberon', '天卫四 · 奥伯隆', 'moon', .19, [9.5, 2.1, -29], '#a79c96', '奥伯隆是天王星的一颗大型卫星，古老地表布满撞击坑。冰与岩石组成的世界并非只有白色，撞击和辐射也能影响表面。', ['是天王星第二大卫星。', '当前模型没有重建真实地形高度。'], 'uranus/moons/oberon/', { parentBodyId: 'uranus' }),
  body('rhea', '土卫五 · 瑞亚', 'moon', .19, [-23.5, .9, -12.8], '#c3c0b8', '瑞亚是土星第二大卫星，表面遍布撞击坑。较明亮的地表与沟槽展示了一个冰冷卫星的复杂过去。', ['主要由冰与岩石组成。', '卡西尼号曾近距离研究其地表。'], 'saturn/moons/rhea/', { parentBodyId: 'saturn' }),
  body('iapetus', '土卫八 · 伊阿珀托斯', 'moon', .18, [-25.5, 1.8, -15.2], '#a99c89', '伊阿珀托斯有一明一暗的显著地表差异，也有沿赤道延伸的山脊。它提醒我们，同一颗卫星的两面也可能很不一样。', ['在土星较外侧的倾斜轨道上运行。', '图中颜色只作明暗差异的简化表达。'], 'saturn/moons/iapetus/', { parentBodyId: 'saturn' }),
];

export const journeyStops = [
  { id: 'earth-launch', name: '文昌 · 地球出发', subtitle: '地面待发 → 垂直升空 → 近地空间', scale: '地表到数百千米', kind: 'launch', parentId: 'earth-moon',
    description: '旅程从海南文昌风格的海岸发射场开始。登上探索船，先沿地表法线升空，穿越逐渐稀薄的大气，再转向近地空间，继续前往月球。场地与飞船是科普场景示意。',
    detailFacts: ['文昌航天发射场位于海南文昌，是中国的滨海发射场。', '发射塔架、海岸、建筑与起飞姿态采用示意布局，不是精确测绘。', '跨层航程、速度与天体间距为便于浏览分别缩放，不能用来计算现实航行。'],
    sourceName: '中国载人航天工程办公室', sourceUrl: 'https://www.cmse.gov.cn/gygc/xtzc/hnfscxt/',
    voice: '欢迎来到海南文昌风格的发射场。我们从地球表面出发，先垂直爬升，再转向近地空间。大气随着高度增加逐渐稀薄，星空也逐渐出现。随后，我们将探索地月系统。', bodies: [{ ...earth, radius: 7.5, position: [0, -5.6, -9] }, { ...moon, radius: .75, position: [18, 7, -55] }] },
  { id: 'earth-moon', name: '地月系统', subtitle: '一颗行星与它的天然卫星', scale: '38.44 万千米', kind: 'system', parentId: 'solar',
    description: '从这里可以同时看见地球和月球。现实中的平均地月距离大约能排下三十个地球直径，画面压缩了这段距离，方便你近距离比较。',
    voice: '我们抵达地月系统。月球以几乎同一面朝向地球。月相由太阳照亮的区域和我们的观察角度共同决定，通常不是地球的影子。', bodies: [earth, moon] },
  { id: 'solar', name: '太阳系', subtitle: '恒星、八大行星与冰冷的外缘', scale: '天文单位 · AU', kind: 'system', parentId: 'nearby',
    description: '沿太阳引力塑造的轨道出发，从岩石行星到气态巨行星，再到冰巨星与矮行星。选中每个天体就能近距离飞抵，查看它的资料。轨道、天体半径及卫星间距分别压缩。',
    voice: '欢迎来到太阳系。太阳提供光和能量。内侧是水星、金星、地球和火星，外侧是木星、土星、天王星和海王星。更远处还有冥王星和其他冰冷的小世界。', bodies: solarBodies },
  { id: 'nearby', name: '恒星邻域', subtitle: '离开太阳，走向别的行星系统', scale: '光年', kind: 'neighborhood', parentId: 'milky-way',
    description: '太阳只是银河系中的一颗恒星。恒星附近已发现大量行星系统；可从系外目录选择任意收录系统。恒星位置只表示航行层级，不构成精确三维星表。',
    voice: '我们已经离开太阳系。光年是距离单位，代表光在一年里走过的距离。可以选择比邻星、TRAPPIST-1，或在目录里寻找其他已经收录的行星系统。',
    bodies: [
      body('sol', '太阳', 'star', 1.3, [0, 0, 0], '#ffe4ac', '从恒星邻域回望太阳，八大行星的轨道已经小到难以分辨。太阳是我们跨越宇宙尺度的起点。', ['太阳系位于银河系中。', '光年表示距离，不表示时间。'], 'sun/facts/', { texture: 'sun' }),
      body('proxima', '比邻星系统', 'star', .65, [-13, 2, -8], '#ec987f', '比邻星是距离太阳最近的恒星，属于半人马座阿尔法星系统。它是一颗红矮星，已发现围绕它运行的行星。', ['距太阳约 4.24 光年。', '选择系外行星目录中的 Proxima Cen 可查看归档数据。', '系外行星的表面外观大多仍未知。'], 'exoplanet-catalog/proxima-centauri-b/', { systemName: 'Proxima Cen' }),
      body('trappist', 'TRAPPIST-1 系统', 'star', .6, [15, -1, -12], '#d88b75', 'TRAPPIST-1 是一颗冷红矮星，周围有七颗已确认的地球大小行星。这个紧凑系统适合用来比较行星与母恒星的关系。', ['七颗行星的轨道排列紧凑。', '处在宜居带不等于已经拥有海洋或生命。'], 'mission/webb/science-overview/science-explainers/what-is-webb-revealing-about-the-trappist-1-system/', { systemName: 'TRAPPIST-1' }),
      body('kepler90', 'Kepler-90 系统', 'star', 1.15, [3, 5, -23], '#f4d8a9', 'Kepler-90 系统因拥有八颗已知行星而受到关注。它与太阳系都包含多颗行星，但轨道分布与行星特征并不相同。', ['NASA 归档中的宿主名称为 KOI-351。', '行星数量与参数以此次 NASA 归档快照为准。'], 'exoplanet-catalog/kepler-90-i/', { systemName: 'KOI-351' }),
    ] },
  { id: 'milky-way', name: '银河系', subtitle: '从一颗恒星，看见一整个星系', scale: '约十万光年', kind: 'galaxy', parentId: 'local-group',
    description: '我们居住在一个棒旋星系里。银河系由恒星、气体、尘埃和暗物质组成；太阳位于盘面中的一条较小旋臂结构附近，远离明亮的中心。',
    voice: '现在我们把视野扩大到银河系。无数恒星组成盘面与旋臂，中央区域更加明亮。太阳在其中只是一颗普通恒星，夜空里的银河正是我们从内部看到的银河盘面。',
    bodies: [
      body('milky-way-disc', '银河系', 'galaxy', 12, [0, 0, -3], '#a9c5e9', '银河系是包含太阳系的棒旋星系。我们在它内部观测，难以直接拍摄整个银河系的外观，因此这里使用结构示意。', ['星系盘直径约十万光年。', '包含大量恒星、气体和尘埃。', '旋臂模型是教学重建，并非外部实拍。'], galaxyFacts),
      body('galactic-center', '银河中心 · 人马座 A*', 'blackhole', .28, [0, 0, -3], '#ffcea1', '银河中心存在超大质量黑洞人马座 A*。它的引力影响周围恒星，但不会把整个银河系都吸入黑洞。', ['周边恒星轨道提供黑洞存在的强证据。', '中心黑洞附近的尺度在本图中被大幅放大。'], 'mission/webb/science-overview/science-explainers/what-is-the-center-of-our-galaxy-like/'),
      body('solar-neighborhood', '太阳所在区域', 'star', .55, [7.8, .3, 1.6], '#ffdea5', '太阳系位于银河系盘面，距离银河中心约两万六千光年。这个标记连接了银河系视图与恒星邻域。', ['太阳位于猎户臂（本地臂）附近。', '画面标记与恒星亮度均被放大。'], 'solar-system/solar-system-facts/', { targetStop: 'nearby' }),
    ] },
  { id: 'local-group', name: '本星系群', subtitle: '银河系与它的星系邻居', scale: '百万光年', kind: 'group', parentId: 'cosmic',
    description: '银河系并不孤单。它与仙女座星系、三角座星系和许多较小星系组成了本星系群。此时一整个行星系统的尺寸，在这个尺度上已几乎无法辨认。',
    voice: '欢迎来到本星系群。这里的每一个明亮结构都可能包含数十亿颗恒星。银河系、仙女座星系和三角座星系，是本星系群中主要的星系成员。',
    bodies: [
      body('milky-way-group', '银河系', 'galaxy', 5.8, [-10, 0, 0], '#b7cee8', '银河系是我们的星系家园，也是本星系群的主要成员之一。', ['太阳系在银河系内部。', '选择下一级尺度可以返回银河系与恒星邻域。'], galaxyFacts, { targetStop: 'milky-way' }),
      body('andromeda', '仙女座星系 · M31', 'galaxy', 7.2, [12, 2.2, -11], '#d3bf9f', '仙女座星系是邻近的大型旋涡星系，距离银河系约 250 万光年。晴朗暗夜里，它可以呈现为一小片模糊光斑。', ['它并非银河系里的星云，而是独立星系。', '光从它出发需要约 250 万年才到达我们。'], 'mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/'),
      body('triangulum', '三角座星系 · M33', 'galaxy', 3.6, [20, -.5, 10], '#9bb8da', '三角座星系是本星系群中的旋涡星系。它富含恒星形成区域，使我们能研究气体如何诞生新恒星。', ['距离约 300 万光年。', '是本星系群主要成员之一。'], 'mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-33/'),
      body('large-magellanic', '大麦哲伦云', 'galaxy', 2, [-16, 3, 6], '#9eb9db', '大麦哲伦云是银河系附近的矮星系，内部有丰富的恒星形成区域。', ['在南半球天空更容易观测。', '是独立的星系，而非地球大气中的云。'], 'earth/earth-observatory/the-galaxy-next-door/'),
      body('small-magellanic', '小麦哲伦云', 'galaxy', 1.35, [-13, -1, 9.5], '#9faccc', '小麦哲伦云是银河系附近的矮星系。它和大麦哲伦云一起记录了星系相互作用与恒星演化的历史。', ['名称中的云指它在夜空里的外观。', '模型的位置与形状经过简化。'], 'missions/hubble/hubble-finds-source-of-magellanic-stream/'),
    ] },
  { id: 'cosmic', name: '宇宙网', subtitle: '星系群 → 星系团 → 大尺度结构', scale: '亿光年', kind: 'cosmic', parentId: null,
    description: '当视野继续扩大，星系沿丝状结构分布，密集区域形成星系团，之间则是较稀疏的空洞。这里展示大尺度结构的概念，不是完整的可观测宇宙测绘。',
    voice: '现在我们来到宏观宇宙。星系与星系团像节点一样分布在宇宙网中，节点之间由丝状结构连接。这一趟从地球开始的旅程，只揭开了我们认识宇宙的一小部分。',
    bodies: [
      body('local-group-node', '本星系群', 'cluster', 1.6, [-14, -2, 7], '#b2cae5', '本星系群是一群被引力联系起来的星系。放到宇宙网尺度，它只是一个很小的邻域。', ['银河系和仙女座星系都在其中。', '选择较近的尺度，可沿原航线返回太阳系。'], galaxyFacts, { targetStop: 'local-group' }),
      body('virgo-cluster', '室女座星系团', 'cluster', 5.2, [8, 2, -7], '#d1c8ba', '室女座星系团是我们附近的重要星系团。星系团包含许多星系、炽热气体和暗物质，是宇宙大尺度结构的组成部分。', ['星系团与行星系统相差许多个尺度层级。', '模型的亮点代表星系或星系团结构，不能当成单颗恒星。'], 'asset/hubble/hubble-acs-image-of-100-virgo-cluster-galaxies/'),
      body('cosmic-web', '丝状结构与空洞', 'web', 14, [0, 0, -24], '#849dbc', '引力让物质逐渐聚集为丝状结构与节点。稀疏的区域形成宇宙空洞，星系巡天和数值模拟帮助我们研究这些结构。', ['宇宙网中的许多物质不能由可见光直接看到。', '这里的网状布局是概念演示，而非实时天体坐标。'], 'missions/webb/nasas-webb-identifies-the-earliest-strands-of-the-cosmic-web/'),
    ] },
];

function positive(value) { return Number.isFinite(value) && value > 0; }
function display(value, unit) { return positive(value) ? `${Number(value.toPrecision(5))} ${unit}` : '归档中未提供'; }
function catalogueUrl(name) { return archive + 'overview/' + encodeURIComponent(name); }
function starColor(temperature) { return positive(temperature) ? temperature < 3800 ? '#f6ac82' : temperature < 6500 ? '#ffe3ad' : '#c6dcff' : '#ffe0b2'; }

/** Convert one real archive system to a bounded, readable educational 3D scene. */
export function exoplanetStop(system) {
  if (!system?.id || !system.name || !Array.isArray(system.planets) || !system.planets.length) throw new TypeError('系外系统缺少归档名称或行星数据');
  const distance = display(system.distanceLy, '光年');
  const starCount = positive(system.stars) ? Math.floor(system.stars) : null;
  const planets = [...system.planets].sort((a, b) => {
    if (positive(a.semiMajorAxisAU) && positive(b.semiMajorAxisAU)) return a.semiMajorAxisAU - b.semiMajorAxisAU || a.name.localeCompare(b.name);
    if (positive(a.semiMajorAxisAU) !== positive(b.semiMajorAxisAU)) return positive(a.semiMajorAxisAU) ? -1 : 1;
    const periodDifference = (positive(a.orbitalPeriodDays) ? a.orbitalPeriodDays : Infinity) - (positive(b.orbitalPeriodDays) ? b.orbitalPeriodDays : Infinity);
    return periodDifference || a.name.localeCompare(b.name);
  });
  const distanceSentence = positive(system.distanceLy) ? `系统距地球约 ${distance}。` : '系统距地球的距离在当前归档字段中未知。';
  const host = body('host:' + system.id, system.name, 'star', 2.7, [0, 0, 0], starColor(system.temperatureK),
    `${system.name} 是 NASA 系外行星归档收录的宿主系统，当前快照包含 ${planets.length} 颗行星。${distanceSentence}`,
    [`距离：${distance}。`, `归档恒星数：${starCount ?? '未提供'}。`, `宿主有效温度：${display(system.temperatureK, 'K')}。`, `宿主半径：${display(system.starRadiusSolar, '太阳半径')}。`, '组合参数可能取自不同研究，伴星布局与外观为示意。'], catalogueUrl(system.name), { sourceName: 'NASA Exoplanet Archive' });
  const stars = [host];
  // PSCompPars reports multiplicity but not companion orbits. Additional stars are labelled as schematic.
  for (let index = 1; index < Math.min(starCount ?? 1, 4); index++) {
    stars.push(body(`companion:${system.id}:${index}`, `伴星 ${index} · 示意`, 'star', 1.3, [index * 5 - 2, 4 + index, -7 - index * 4], '#f4d7c2',
      '归档记载该系统含有多颗引力相关的恒星。当前快照未包含伴星轨道，本标记只表达恒星数量，不代表真实位置、温度或质量。',
      ['恒星数量来自 sy_snum。', '伴星位置、大小与颜色为示意。'], catalogueUrl(system.name), { sourceName: 'NASA Exoplanet Archive' }));
  }
  const renderedPlanets = planets.map((planet, index) => {
    const radial = 7.3 + index * 3.7;
    const angle = index * 2.39996323 + .45;
    const radius = positive(planet.radiusEarth) ? Math.min(1.75, Math.max(.35, .38 * Math.pow(planet.radiusEarth, .48))) : .62;
    const massLabel = planet.massProvenance === 'Msini' ? '最低质量 M sin i' : planet.massProvenance === 'Msin(i)/sin(i)' ? '归档推算质量' : planet.massProvenance === 'M-R relationship' ? '按质量半径关系估计的质量' : '归档质量或质量估计';
    return body(planet.id, planet.name, 'planet', radius, [Math.cos(angle) * radial, .15 * Math.sin(index), Math.sin(angle) * radial],
      positive(planet.radiusEarth) && planet.radiusEarth > 4 ? '#9dbed3' : ['#b99483', '#bdc7bb', '#ab9a8d', '#cab78b'][index % 4],
      `${planet.name} 是这个系统中归档收录的行星。${positive(planet.orbitalPeriodDays) ? '绕宿主公转的归档周期约 ' + display(planet.orbitalPeriodDays, '天') + '。' : '当前快照没有提供公转周期。'}画面中的外观是示意，不能据此判断地表、液态水或生命。`,
      [`半径：${display(planet.radiusEarth, '地球半径')}。`, `${massLabel}：${display(planet.massEarth, '地球质量')}。`, `公转周期：${display(planet.orbitalPeriodDays, '天')}。`, `归档轨道半长轴 / 投影距离：${display(planet.semiMajorAxisAU, 'AU')}。`,
        ...(planet.controversial ? ['NASA 归档记录：确认状态在文献中存在争议。'] : []), '半径或质量可能为归档推算值；未知数据没有替换成实测数值。', '轨道相位、倾角、偏心率与半径缩放为教学示意，不代表当前真实位置。'], catalogueUrl(planet.name),
      { sourceName: 'NASA Exoplanet Archive', parentBodyId: host.id, catalogue: { radiusEarth: planet.radiusEarth, massEarth: planet.massEarth, massProvenance: planet.massProvenance, orbitalPeriodDays: planet.orbitalPeriodDays, semiMajorAxisAU: planet.semiMajorAxisAU } });
  });
  return { id: 'exo:' + system.id, name: system.name, subtitle: `${planets.length} 颗归档行星 · ${positive(system.distanceLy) ? distance : '距离待测'}`, scale: '系外行星系统', kind: 'exoplanet', parentId: 'nearby',
    description: `抵达 ${system.name}。这里列出 NASA 归档快照中的 ${planets.length} 颗行星，每颗都有可阅读的数据卡。系统中的天体大小和轨道间距分别压缩；未知表面、轨道相位和伴星位置采用示意。`,
    voice: `我们抵达 ${system.name} 系统。这个系统在当前 NASA 归档快照中收录了 ${planets.length} 颗行星。${positive(system.distanceLy) ? '它距离地球约 ' + Number(system.distanceLy.toPrecision(3)) + ' 光年。' : ''}选择一个天体，继续近距离探索。`,
    bodies: [...stars, ...renderedPlanets], sourceUrl: catalogueUrl(system.name), sourceName: 'NASA Exoplanet Archive' };
}
