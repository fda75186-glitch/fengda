import { articles, planets } from './knowledge.js';

export const bodyNames = Object.fromEntries([
  ...planets.map(p => [p.en.toLowerCase(), p.name]),
  ['sun', '太阳'], ['moon', '月球'], ['andromeda', '仙女座星系'], ['blackhole', '黑洞'],
]);
export const solarBodies = ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','sun','moon'];
const extraArticles = planets.filter(p => !articles.some(a => a.id === p.en.toLowerCase())).map(p => ({
  id: p.en.toLowerCase(), image: p.en.toLowerCase(), category: '太阳系',
  title: `${p.name}：认识太阳系的邻居`, short: p.intro, minutes: 2, tag: '行星档案',
  keywords: [p.name, p.en, '行星'], points: [p.intro, `平均距日约 ${p.distance} 天文单位。`, `公转周期约 ${p.year} 个地球年。`],
  body: `${p.intro}\n\n它的直径约为 ${p.diameter.toLocaleString('zh-CN')} 千米，平均距离太阳约 ${p.distance} 天文单位。一天文单位大约相当于地球与太阳的平均距离。\n\n绕太阳一周，大约需要 ${p.year} 个地球年。你可以拖动模型从不同角度观察它，也可以对照其他行星，看看颜色与外观有哪些不同。`,
  fact: '这里的模型分别放大展示，尺寸、光照与自转速度用于科普演示，并不按统一的真实比例呈现。',
  source: `https://science.nasa.gov/${p.en.toLowerCase()}/facts/`, sourceName: `NASA Science · ${p.name}`,
}));
export const exploreArticles = [...articles, ...extraArticles];
export const isConcept = body => ['andromeda', 'blackhole'].includes(body);
