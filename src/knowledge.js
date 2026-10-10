export const categories = ['全部', '宇宙起源', '太阳系', '恒星世界', '深空天体', '探索史', '观测入门'];
export const articles = [
  { id:'saturn', category:'太阳系', title:'土星的光环，是宇宙送来的情书', short:'数不清的冰与岩石，组成了太阳系最浪漫的圆环。', image:'saturn', minutes:4, tag:'行星档案', source:'https://spaceplace.nasa.gov/saturn-rings/en/', sourceName:'NASA Space Place', keywords:['土星','光环','星环'], points:['土星环主要由冰粒组成，也含有岩石和尘埃。','环不是一整块固体，无数颗粒沿各自的轨道绕土星运行。','从地球看，环的倾斜角度会随着土星公转而改变。'], body:'远远望去，土星像戴着一顶轻盈的帽子。靠近后才会发现，这不是完整的圆盘，而是无数冰粒、岩石与尘埃组成的巨大环系。每一颗粒都在引力作用下绕着土星运动。\n\n不同区域的颗粒密度、大小和组成有所不同，因此呈现明暗相间的结构。那些看起来空无一物的缝隙，也往往与卫星的引力作用有关。\n\n观察土星时，别忘了：照片呈现的是探测器在特定角度、光照和波段下看到的景象，并不等同于从地球肉眼所见。', fact:'土星不是唯一有环的行星。木星、天王星和海王星也有自己的环。' },
  { id:'jupiter', category:'太阳系', title:'木星大红斑：一场延续百年的风暴', short:'在这颗气态巨行星上，天气有着超乎想象的尺度。', image:'jupiter', minutes:5, tag:'宇宙奇观', source:'https://science.nasa.gov/jupiter/jupiter-facts/', sourceName:'NASA Science · Jupiter', keywords:['木星','大红斑','风暴'], points:['木星是太阳系中最大的行星。','大红斑是木星大气中的巨大、长期存在的风暴。','木星主要由氢和氦组成，没有像地球一样可站立的固体表面。'], body:'木星云层上的那枚红色椭圆，实际上是一场巨大的风暴。它能持续很长时间，与木星复杂的大气环流和不同纬度之间的风有关。\n\n它的形状、颜色和大小都在变化。因此，“大红斑有多大”需要结合观测时间来回答，而不能把某一年的数字当作永远不变的事实。\n\n探测器通过拍摄云层、测量微波与引力场来研究木星。这些不同角度的信息帮助我们理解这颗气态巨行星。', fact:'木星的质量超过太阳系其他行星质量总和的两倍。' },
  { id:'earth', category:'太阳系', title:'如果地球是一颗蓝色弹珠', short:'从太空回望，才懂得这颗星球有多特别。', image:'earth', minutes:3, tag:'我们的家园', source:'https://science.nasa.gov/earth/facts/', sourceName:'NASA Science · Earth', keywords:['地球','蓝色','海洋'], points:['地球表面约 71% 被水覆盖。','地球是目前唯一已知存在生命的星球。','大气层与磁场为地表生命提供重要保护。'], body:'从太空看地球，最醒目的颜色是蓝色。广阔的海洋、洁白的云层与褐绿相间的大陆，共同组成了我们的家园。\n\n液态水、适宜的温度、大气和复杂的物质循环，为生命提供了条件。但这些条件如何共同促成生命出现，仍有很多问题值得研究。', fact:'我们脚下看似辽阔的世界，在太阳系中只是一颗小小的行星。' },
  { id:'andromeda', category:'深空天体', title:'仙女座星系：来自远方的古老星光', short:'抬头仰望时，你也在看向过去。', image:'andromeda', minutes:5, tag:'深空漫游', source:'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/', sourceName:'NASA · Hubble', keywords:['仙女座','星系','光年'], points:['仙女座是距离银河系较近的大型旋涡星系。','它距离我们约 250 万光年。','光年是距离单位：光在真空中一年走过的距离。'], body:'夜空中那些微弱的光，有些来自太阳系之外的恒星，有些则来自由无数恒星构成的星系。仙女座星系就是后者。\n\n光需要时间才能穿过宇宙。仙女座的光旅行了约 250 万年才来到我们眼前，所以我们看到的，是它遥远过去的样子。\n\n在无光污染的暗夜里，它可呈现为一小片朦胧光斑。照片中的颜色和细节则需要望远镜与长时间曝光。', fact:'望远镜也是一台“时间机器”：看得越远，往往也就看得越早。' },
  { id:'blackhole', category:'深空天体', title:'黑洞会把整个宇宙吸进去吗？', short:'它不是宇宙吸尘器。让我们从引力开始理解。', image:'blackhole', minutes:6, tag:'好奇心问答', source:'https://science.nasa.gov/universe/black-holes/', sourceName:'NASA Science · Black Holes', keywords:['黑洞','引力','事件视界'], points:['黑洞的事件视界是连光也无法逃出的边界。','在足够远的距离，黑洞的引力取决于质量，与其他天体遵循相同规律。','黑洞内部仍存在未解决的科学问题。'], body:'黑洞最特别的地方，是它有一道叫作“事件视界”的边界。越过这道边界后，光也无法逃到外面。\n\n但这不意味着黑洞会吸走一切。远离它时，天体仍然可以绕着它运行，正如行星绕恒星运行。决定远处引力大小的关键是质量和距离。\n\n我们通过周围物质、恒星运动和引力波等证据研究黑洞。对于黑洞内部，现有理论还没有给出完整、可验证的答案。', fact:'黑洞配图为 NASA 艺术概念图，不是直接拍摄的真实照片。' },
  { id:'sun', category:'恒星世界', title:'太阳为什么一直发光？', short:'不是燃烧的火球，而是一座天然的核聚变工厂。', image:'sun', minutes:4, tag:'恒星课堂', source:'https://science.nasa.gov/sun/facts/', sourceName:'NASA Science · Sun', keywords:['太阳','恒星','核聚变','烧多久'], points:['太阳是距离地球最近的恒星。','太阳核心的核聚变把氢转化为氦并释放能量。','未来太阳会经历红巨星等演化阶段，最终留下白矮星。'], body:'我们常把太阳画成燃烧的火球，但它产生能量的方式并不是柴火燃烧。太阳核心的高温与高压使氢发生核聚变，转化为氦并释放能量。\n\n能量从内部逐渐向外传递，再以光和其他形式离开太阳。到达地球的阳光维持了我们的气候与生态。\n\n恒星的演化与初始质量密切相关。太阳质量不够大，不会以超新星爆发的方式结束生命。', fact:'太阳影像的颜色常由观测波段决定，不同波段能让我们研究不同温度的物质。' },
  { id:'origin', category:'宇宙起源', title:'大爆炸，是在哪里发生的？', short:'宇宙膨胀的故事，比一场爆炸更奇妙。', image:'andromeda', minutes:6, tag:'宇宙简史', source:'https://science.nasa.gov/universe/overview/', sourceName:'NASA Science · Universe', keywords:['宇宙','大爆炸','起源'], points:['宇宙年龄约为 138 亿年。','大爆炸模型描述宇宙从早期高温高密状态演化。','宇宙膨胀不是物质从某个空间中的中心向外飞散。'], body:'“大爆炸”这个名字很容易让人联想到在空地上爆开的烟花。但宇宙学中的大爆炸模型，讲的是空间本身与物质、辐射共同演化的历史。\n\n观测到的宇宙膨胀、宇宙微波背景和轻元素丰度等证据，支持早期宇宙处于高温高密状态。\n\n这一模型并不等于我们已经知道宇宙为什么存在，也不意味着“爆炸前是什么”已经有确定答案。', fact:'科学不仅告诉我们知道什么，也告诉我们哪些问题仍在探索。' },
  { id:'moon', category:'观测入门', title:'今晚，从认识月亮开始', short:'不需要昂贵的望远镜，也能开启你的观星旅程。', image:'moon', minutes:3, tag:'观星指南', source:'https://science.nasa.gov/moon/moon-phases/', sourceName:'NASA Science · Moon', keywords:['月亮','月相','观测','观星'], points:['月亮本身不发光，我们看到的是反射的阳光。','月相变化来自日、地、月相对位置的变化。','观察明暗交界附近，常能更清楚地看到月面起伏。'], body:'第一次观星，可以先从月亮开始。记录日期、时间、方向和月亮的形状，连续观察几天，你就会发现变化。\n\n月相通常不是地球影子遮住月亮造成的。我们看见月球被太阳照亮部分的比例不断改变，才有了新月、上弦、满月等月相。\n\n使用双筒望远镜时，让成年人指导并检查设备。白天不要用任何普通望远镜直接看太阳。', fact:'月球总是几乎以同一面朝向地球，这是潮汐锁定的结果。' },
  { id:'cassini', category:'探索史', title:'卡西尼：写给土星的最后一封信', short:'一次跨越多年的旅程，改变了我们对土星的认识。', image:'saturn', minutes:5, tag:'探索档案', source:'https://science.nasa.gov/mission/cassini/', sourceName:'NASA · Cassini', keywords:['卡西尼','探测器','探索','人类'], points:['卡西尼于 2004 年进入土星轨道。','它研究了土星、环系和卫星。','任务在 2017 年以进入土星大气的方式结束。'], body:'卡西尼不仅拍下了壮丽的土星照片，也帮助我们认识了土卫六的大气、土卫二的喷流和复杂的环系。\n\n在任务结束时，探测器受控进入土星大气。这一安排有助于避免未来意外撞上那些值得研究的卫星。\n\n人类的探索并不总是载人航行。机器人探测器也能替我们穿过漫长的距离，把陌生的世界带回眼前。', fact:'首页土星照片就来自卡西尼任务。' },
];

export const planets = [
  {name:'水星',en:'MERCURY',diameter:4879,year:0.24,distance:0.39,color:'#969289',intro:'离太阳最近的行星。表面布满撞击坑，昼夜温差很大。'},
  {name:'金星',en:'VENUS',diameter:12104,year:0.62,distance:0.72,color:'#dbb77c',intro:'浓厚的大气造成强烈温室效应，它是太阳系最热的行星。'},
  {name:'地球',en:'EARTH',diameter:12756,year:1,distance:1,color:'#71c3d6',intro:'我们的家园。目前唯一已知存在生命的星球。'},
  {name:'火星',en:'MARS',diameter:6792,year:1.88,distance:1.52,color:'#ca785d',intro:'红色来自地表的含铁矿物。机器人探测器正在寻找它过去的故事。'},
  {name:'木星',en:'JUPITER',diameter:142984,year:11.86,distance:5.2,color:'#d3b49d',intro:'太阳系最大的行星。大红斑是一场长期存在的巨大风暴。'},
  {name:'土星',en:'SATURN',diameter:120536,year:29.45,distance:9.58,color:'#d5c390',intro:'以明亮的环系闻名。它的环主要由无数冰粒组成。'},
  {name:'天王星',en:'URANUS',diameter:51118,year:84.02,distance:19.2,color:'#8cccd0',intro:'一颗冰巨星。自转轴高度倾斜，像是侧躺着绕太阳运行。'},
  {name:'海王星',en:'NEPTUNE',diameter:49528,year:164.79,distance:30.05,color:'#638fd2',intro:'距离太阳最远的八大行星之一，拥有非常强烈的大气风。'},
];
export const quizQuestions = [
  {question:'“一光年”描述的是什么？',options:['光的亮度','时间长度','距离','恒星的年龄'],answer:2,analysis:'光年是距离单位，表示光在真空中一年走过的距离，约为 9.46 万亿千米。',source:'https://spaceplace.nasa.gov/light-year/en/'},
  {question:'土星的环主要由什么组成？',options:['一整块金属','冰粒及少量岩石和尘埃','发光的气体','人造卫星'],answer:1,analysis:'土星环不是固体圆盘，而是无数独立绕土星运行的颗粒，主要成分是冰。',source:'https://spaceplace.nasa.gov/saturn-rings/en/'},
  {question:'太阳发光的主要能量来自哪里？',options:['氧气助燃','核心的核聚变','不断落下的陨石','行星的反射'],answer:1,analysis:'太阳核心中，氢通过核聚变转化为氦并释放能量。它不依靠氧气燃烧。',source:'https://science.nasa.gov/sun/facts/'},
  {question:'月相变化的主要原因是？',options:['月亮形状发生变化','地球每天遮住月亮','我们看到的受光部分比例改变','月亮时亮时暗'],answer:2,analysis:'日、地、月的相对位置改变，使我们看见月球受阳光照亮部分的不同比例。地球影子遮住月亮则是月食。',source:'https://science.nasa.gov/moon/moon-phases/'},
  {question:'太阳系最大的行星是哪一颗？',options:['地球','土星','木星','海王星'],answer:2,analysis:'木星是太阳系最大的行星，赤道直径约 14.3 万千米。',source:'https://science.nasa.gov/jupiter/jupiter-facts/'},
];

export function findArticles(items, category='全部', query='') {
  const key = query.trim().toLocaleLowerCase();
  return items.filter(a => (category==='全部'||a.category===category) && `${a.title}${a.short}${a.keywords.join('')}`.toLocaleLowerCase().includes(key));
}
function matchTopic(topic) {
  return articles.find(a => a.keywords.some(k => topic.includes(k)));
}
export function answerQuestion(question, history=[]) {
  const match = matchTopic(question) || (/为什么|继续|更多|它|这个/.test(question) ? [...history].reverse().find(m=>m.article)?.article : null);
  if(!match) return {text:'当前是离线演示，我还不能回答这个问题。你可以试试“土星的环是什么”“木星大红斑”或“光年是时间吗”。真实模型接入后，将结合可靠资料回答更多问题。',article:null};
  return {text:`${match.points.join('\n\n')}\n\n${match.body.split('\n\n')[0]}\n\n继续探索：${match.fact}`,article:match};
}
export function createKnowledgeCard(topic, level='入门') {
  const a=matchTopic(topic.trim());
  if(!a) return null;
  return {...a, level, cardId:`card-${a.id}`, intro:level==='进阶'?a.body.split('\n\n')[1]:a.short};
}
