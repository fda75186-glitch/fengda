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
export function formatCoordinates(place) {
  return `${place.longitude.toFixed(5)}° E · ${place.latitude.toFixed(5)}° N`;
}
export function observatoryBounds(places = observatories) {
  return [
    [Math.min(...places.map(p => p.longitude)), Math.min(...places.map(p => p.latitude))],
    [Math.max(...places.map(p => p.longitude)), Math.max(...places.map(p => p.latitude))],
  ];
}
export function createObservatoryMapStyle() {
  const dem = {
    type: 'raster-dem', url: 'https://tiles.mapterhorn.com/tilejson.json',
    encoding: 'terrarium', tileSize: 512,
    attribution: '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener noreferrer">© Mapterhorn</a>',
  };
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256, maxzoom: 19,
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
