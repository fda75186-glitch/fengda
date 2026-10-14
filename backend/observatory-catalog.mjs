// WGS84 longitude/latitude, matching OpenStreetMap. Display precision is not
// survey accuracy; sources and coordinate choices are documented in docs/地图数据来源.md.
export const observatories = [
  {
    id: 'xinglong', name: '兴隆观测站', region: '河北 · 承德', type: '科研观测站',
    longitude: 117.57584, latitude: 40.39569, zoom: 13.2,
    coordinateNote: '定位于基地内的郭守敬望远镜（LAMOST）',
    intro: '在燕山的群峰间，郭守敬望远镜用数千根光纤收集星光，帮助我们读懂恒星的故事。',
    visitNote: '科研基地的参观安排请以官方公告为准。',
    url: 'https://www.bao.ac.cn/', sourceUrl: 'https://www.openstreetmap.org/node/8084983477',
    sourceLabel: 'OpenStreetMap · LAMOST 地物',
  },
  {
    id: 'shanghai', name: '上海天文馆', region: '上海 · 临港', type: '公众科普场馆',
    longitude: 121.92239, latitude: 30.91517, zoom: 15,
    coordinateNote: '定位于天文馆园区的中心区域',
    intro: '从我们的家园到遥远的宇宙，在展览、球幕与观测活动中，把课本里的天文学变成身边的体验。',
    visitNote: '预约与开放时间请查阅天文馆官方网站。',
    url: 'https://www.sstm-sam.org.cn/', sourceUrl: 'https://www.openstreetmap.org/way/610744664',
    sourceLabel: 'OpenStreetMap · 天文馆园区',
  },
  {
    id: 'fast', name: '中国天眼 FAST', region: '贵州 · 平塘', type: '射电天文观测设施',
    longitude: 106.85657, latitude: 25.65292, zoom: 13.5,
    coordinateNote: '定位于 FAST 反射面中心，非游客入口',
    intro: '群山围成的天然洼地里，500 米口径的“中国天眼”倾听宇宙的射电信号，寻找脉冲星与更多未知。',
    visitNote: '参观请查询当地官方安排，并遵守无线电保护要求。',
    url: 'https://fast.bao.ac.cn/', sourceUrl: 'https://www.openstreetmap.org/way/384699313',
    sourceLabel: 'OpenStreetMap · FAST 反射面',
  },
  {
    id: 'beijing', name: '北京天文馆', region: '北京 · 西城', type: '公众科普场馆',
    longitude: 116.33089, latitude: 39.93568, zoom: 15,
    coordinateNote: '定位于天文馆建筑的中心区域',
    intro: '从一场球幕节目开始，在城市里认识星座、理解日月的变化，给下一次真正的星空观察做准备。',
    visitNote: '节目、预约与开放安排请以天文馆官网为准。',
    url: 'https://www.bjp.org.cn/', sourceUrl: 'https://www.openstreetmap.org/way/78051172',
    sourceLabel: 'OpenStreetMap · 天文馆建筑',
  },
];
const stories = {
  xinglong: {
    history: [{ year: '1963', text: '开展首次台址踏勘，为在燕山建设光学观测基地寻找合适地点。' }, { year: '1968', text: '兴隆观测站建设完成并投入使用，逐步发展为多种望远镜协同工作的观测基地。' }, { year: '1989', text: '我国自主研制的 2.16 米光学望远镜落成。' }, { year: '2008', text: '郭守敬望远镜（LAMOST）落成，2009 年通过国家验收。' }],
    sections: [
      { title: '在这里，星光也是一份研究材料', text: '兴隆主要开展光学天文观测。望远镜把微弱的星光聚集起来，探测器记录亮度、形状或光谱。研究者关注的既有恒星、双星和星云，也有超新星与遥远星系。一次观测只是线索，重复测量、校准和比较，才让线索变成可信的结果。' },
      { title: '光谱怎样读出恒星的信息？', text: '把星光按波长展开，就得到光谱。不同元素留下的谱线像可以辨认的标记；谱线形状、相对强弱和位置，还能帮助研究温度与运动。可以把照片理解成天体的外貌记录，把光谱理解成它的检测报告：两者回答的问题不同，常常需要一起使用。' },
      { title: '4000 根光纤，怎样一起观察？', text: 'LAMOST 的焦面上装有 4000 根光纤，可在一次观测中收集多个目标的光并送到光谱仪，最多同时取得 4000 个天体的光谱。它擅长大范围、成批的光谱巡天。这个数字描述的是同时采集光谱的能力，不是放大倍数，也不是望远镜有 4000 个镜头。' },
      { title: '为什么基地需要不同的望远镜？', text: '通用望远镜可以围绕特定目标安排观测，巡天设备则适合系统地扫描大批天体。2.16 米望远镜和 LAMOST 在口径、结构与任务上各有特点。科研选设备并非只看谁更大，而要看目标多暗、覆盖多大天区，以及需要照片、亮度变化还是光谱。' },
      { title: '参观时，可以寻找这三条线索', text: '如果参加获准的科普活动，可以依次问：星光从哪里进入？到哪里被探测器接收？最后得到怎样的数据？再比较两种设备的结构，把听到的术语画成一张简单流程图。地图点位标注的是基地内 LAMOST 的位置，实际入口和参观路线需要另查官方安排。' },
      { title: '常见误区：观测并非一直有人看目镜', text: '专业研究通常依靠探测器和计算机收集、处理数据，不是让研究者整夜贴着目镜看。漂亮影像也不是唯一成果，曲线和光谱同样重要。可以把自己的月相观察做成日期与形状对照表，体会“持续记录—比较变化—提出解释”的研究过程。' },
    ],
    sources: [{ label: '国家天文台 · 基地简介', url: 'https://groups.bao.ac.cn/xinglong/intro/' }, { label: 'LAMOST · 仪器原理与建设历史', url: 'https://lamost.org/public/about' }, { label: 'NASA · 光谱学入门', url: 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/spectroscopy-101-introduction/' }],
  },
  shanghai: {
    history: [{ year: '2021 · 7 月 17 日', text: '上海天文馆正式开馆，成为上海科技馆分馆。' }, { year: '2021 · 7 月 18 日', text: '向公众开放，以“家园”“宇宙”“征程”三大主展区串联宇宙探索。' }],
    sections: [
      { title: '从身边的天空，走向更远的宇宙', text: '上海天文馆位于临港滴水湖畔，面向公众开展天文科普。“家园”“宇宙”“征程”把日常经验、宇宙规律和人类探索联系起来。参观时可以先选择一个问题，再沿着展览寻找解释，比如：月亮为什么变形？天文学家怎样知道一颗星的成分？' },
      { title: '建筑，也在提示天体的运行', text: '主建筑以螺旋形态呼应天体轨道，圆洞天窗、倒转穹顶与球幕影院构成有辨识度的建筑结构。可以观察建筑如何组织光线、空间和视线，再想一想：在真实天空中，我们怎样用太阳位置和星体变化认识时间？建筑的寓意是理解科学的入口，不能替代测量证据。' },
      { title: '影像、模型和实物，各自讲什么？', text: '模型便于把复杂结构展开，球幕便于展示很长时间或很大空间里的变化，实物则把探索的证据带到观众面前。开馆报道记录了嫦娥五号月壤样品入驻“征程”展区。看展时留意说明牌上的“样品”“模型”“艺术想象”等标注，避免把演示画面当成现场拍摄。' },
      { title: '它与科研观测站怎样分工？', text: '科研观测站重在获取可以分析的数据，天文馆重在解释这些数据与知识。球幕上出现星空，不意味着穹顶就是望远镜；模拟太阳系也可能压缩距离、放慢或加快运行速度。理解展项时，先看它想说明什么，再看哪些比例为了方便观察被调整了。' },
      { title: '一份适合学生的参观任务', text: '带一张纸，把感兴趣的展项记录成“我看到了什么—它如何解释—证据来自哪里”三栏。选一个展项，向同伴用自己的话讲清楚；讲不通的部分就是下一次提问的起点。离馆后观察一次真实月亮，比较现场天空与展览中模型的相同和不同。' },
      { title: '常见误区：知道名字不等于理解原理', text: '记住很多行星名字很有趣，但更有收获的问题是：为什么这样判断？测量能有多准确？有没有其他解释？不必一次看完所有内容，可以围绕一个问题深入阅读。节目、活动和预约安排可能变化，出发前以天文馆当前公告为准。' },
    ],
    sources: [{ label: '上海科技党建 · 开馆与展区介绍', url: 'https://www.shkjdw.gov.cn/c/2021-07-17/528062.shtml' }, { label: '上海天文馆 · 官方信息', url: 'https://www.sstm-sam.org.cn/' }, { label: 'NASA · 光谱与天体信息', url: 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/spectroscopy-101-introduction/' }],
  },
  fast: {
    history: [{ year: '1993', text: '南仁东等中国天文学家提出建设大型射电望远镜的构想，随后开展选址。' }, { year: '2011', text: '3 月 25 日开始建设。' }, { year: '2016', text: '9 月 25 日落成，随后进入调试阶段。' }, { year: '2020', text: '1 月 11 日通过国家验收，正式开放运行。' }],
    sections: [
      { title: '“天眼”接收的，不只是我们看得见的光', text: 'FAST 是 500 米口径球面射电望远镜，研究中性氢、脉冲星和星际分子等。射电波与可见光同属电磁波，只是波长不同。“倾听宇宙”是帮助理解的比喻：它接收电磁信号，不是让声音从太空穿过来，也不是拍摄一张普通的彩色照片。' },
      { title: '为什么会选择这片天然洼地？', text: '贵州的喀斯特洼地为巨大反射面的建设提供了有利地形。站在可以参观的位置，可以留意反射面怎样嵌入山谷，以及上方的接收系统怎样悬挂。这里既有自然条件，也有精密工程；大口径带来接收微弱信号的能力，精确指向与控制同样不可少。' },
      { title: '这口“大锅”怎样跟踪天体？', text: 'FAST 并非把整口 500 米的反射面像小望远镜那样转来转去。主动反射面会调整形状，在观测方向形成约 300 米口径的瞬时抛物面；悬挂的馈源舱配合移动接收信号。500 米描述整体口径，约 300 米描述工作时形成的有效照明区域，两者并不矛盾。' },
      { title: '怎样从数据里辨认宇宙信号？', text: '天文学家会分析信号出现的频率、强弱与随时间变化的规律。研究脉冲星时，重复测量尤其重要；一个突然的峰值也可能来自人为干扰。FAST 的观测研究中，会使用不同位置的比较等方法辨认、验证信号，所以发现并非“仪器响一下就立即下结论”。' },
      { title: '参观时，用四步认识这套装置', text: '先看地形，再找反射面、支撑塔与馈源舱，最后问接收到的信号怎样成为数据。这比只拍一张“大锅”照片更能理解它的工作方式。地图定位于反射面中心，不代表游客入口；到访安排与现场无线电保护要求，请以官方当前指引为准。' },
      { title: '常见误区：越强的信号不一定越重要', text: '手机等人为设备的信号也可能影响射电观测，保护安静的无线电环境，是帮助研究者分辨微弱宇宙信号的必要条件。观察展板里的曲线时，可以问：这是来自哪个方向？是否重复出现？怎样排除了干扰？这些问题也适用于我们判断网络上的“宇宙发现”。' },
    ],
    sources: [{ label: '国家天文台 · FAST 观测基地', url: 'https://www.bao.ac.cn/fast/' }, { label: '国家天文台 · 建设节点', url: 'https://english.nao.cas.cn/internationalcooperation/platforms/202103/t20210321_265734.html' }, { label: '国家天文台 · 国家验收', url: 'https://nao.cas.cn/news/zh/202001/t20200111_6407641.html' }, { label: 'FAST · 用户手册与主动反射面', url: 'https://fast.bao.ac.cn/static/uploadfiles/FAST_help/FAST_manual.pdf' }, { label: '中国科学院 · 馈源舱', url: 'https://lssf.cas.cn/en/facilities/sa/fast/equipment/202505/t20250528_5070732.html' }, { label: '国家天文台 · 脉冲星信号验证', url: 'https://www.bao.ac.cn/news/ky/202107/t20210720_6408155.html' }, { label: 'NASA · 电磁波与光谱', url: 'https://science.nasa.gov/mission/hubble/science/science-behind-the-discoveries/hubble-spectroscopy/' }],
  },
  beijing: {
    history: [{ year: '1957', text: '主场馆对公众开放，成为我国第一座大型天文馆。' }, { year: '2004', text: '在原址扩建的新馆开放，形成 A、B 两馆及多种科普剧场。' }, { year: '2022', text: '国际天文学联合会天文教育办公室中国中心落户北京天文馆。' }],
    sections: [
      { title: '在城市里，也能先认识星空', text: '北京天文馆西城主场馆通过天象厅、科普剧场、展览与活动，解释天文学的基本原理和探索方法。城市强光会遮盖暗弱星星，但并不妨碍我们先学习辨认方向、月相与亮星。馆内演示可以作为练习，真正走到户外时，再用日期、时间和地点核对天空。' },
      { title: '天象演示为什么能加快一整晚？', text: '天象厅可以把天空变化压缩呈现，帮助我们观察肉眼短时间不易注意到的规律。看节目时留意时间、视角与比例是否改变。穹顶上的星空是教学演示，并不等于透过屋顶直接看到了今晚的天空；模型的便利之处，是把规律清楚地展示出来。' },
      { title: '馆内与古观象台，是两处不同地点', text: '北京天文馆还包括位于建国门的北京古观象台区域，展示古代天文学与中西科学交流历史。古观象台始建于 1442 年。当前地图点定位的是西城主场馆，不是古观象台；若想比较古代仪器与现代天象演示，应先确认两个地点的参观安排。' },
      { title: '看仪器，要问它测量什么', text: '望远镜收集光线，光谱仪把光按波长分析，天象仪则帮助演示天空。面对不同设备，先问“输入是什么、输出是什么”，比只看外形更容易理解。古代测量仪器和现代探测器虽然不同，却都体现了用记录与比较认识天体规律的思路。' },
      { title: '给自己的参观设置一个小目标', text: '选一个天象现象，在参观前写下自己的解释。看过模型或节目后，用三句话重新解释：什么在运动？我站在哪里看？怎样观察能支持这个解释？离馆后连续几天记录月亮的位置和形状，把学到的原理与自己收集的观察联系起来。' },
      { title: '常见误区：科普演示不等于实时预报', text: '节目可能展示其他季节、其他地点或过去未来的天空，不能直接当作今晚一定可见的目标清单。云层、楼房遮挡和光污染也影响实际观察。先核对节目设定，再查当日星图；当前展览、节目、活动与预约信息，请查看天文馆官方公告。' },
    ],
    sources: [{ label: '北京天文馆 · 场馆与历史简介', url: 'https://www.bjp.org.cn/twgjj/index.shtml' }, { label: 'NASA · 观星与地点条件', url: 'https://science.nasa.gov/skywatching/faq/' }, { label: 'NASA · 光谱学入门', url: 'https://science.nasa.gov/mission/webb/science-overview/science-explainers/spectroscopy-101-introduction/' }],
  },
};
for (const place of observatories) Object.assign(place, stories[place.id]);
export const observatoryRevision = '2026-10-11-guide-2';
export function formatCoordinates(place) {
  return `${place.longitude.toFixed(5)}° E · ${place.latitude.toFixed(5)}° N`;
}
export function observatoryBounds(places = observatories) {
  return [
    [Math.min(...places.map(p => p.longitude)), Math.min(...places.map(p => p.latitude))],
    [Math.max(...places.map(p => p.longitude)), Math.max(...places.map(p => p.latitude))],
  ];
}
export function createObservatoryMapStyle(apiBase = '') {
  const tile = (kind, extension) => apiBase ? `${apiBase.replace(/\/$/, '')}/api/map/${kind}/{z}/{x}/{y}.${extension}` : '';
  const dem = {
    type: 'raster-dem', tiles: [tile('terrain', 'webp') || 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], maxzoom: 12,
    encoding: 'terrarium', tileSize: 512,
    attribution: '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener noreferrer">© Mapterhorn</a>',
  };
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster', tiles: [tile('base', 'png') || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256, minzoom: 3, maxzoom: 19,
        attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>',
      },
      terrain: { ...dem }, hillshade: { ...dem },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#eaf0ed' } },
      { id: 'osm', type: 'raster', source: 'osm' },
      { id: 'hillshade', type: 'hillshade', source: 'hillshade', paint: {
        'hillshade-exaggeration': 0.25, 'hillshade-shadow-color': '#66786d',
        'hillshade-highlight-color': '#ffffff',
      } },
    ],
    terrain: { source: 'terrain', exaggeration: 1 },
    sky: { 'sky-color': '#d4e5ef', 'horizon-color': '#eef3f5', 'fog-color': '#f4f7f7' },
  };
}
