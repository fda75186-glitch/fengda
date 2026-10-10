export const communityCategories = ['观星日记', '天文问答', '摄影分享', '学习交流'];
export const communitySeeds = [
  { id: 'example-moon', category: '观星日记', title: '今晚的月亮，和昨天有什么不一样？', content: '示例话题：试着连续几天在相近的时间看看月亮，记录它的形状和位置。你会发现，月亮每天都在变化。欢迎在本机评论里写下你的观察。', image: 'moon' },
  { id: 'example-saturn', category: '天文问答', title: '土星的光环，真的是一整块吗？', content: '示例话题：远看像一片完整光环，近看却是无数冰粒与岩石碎片。它们各自绕着土星运行。还有哪些天文问题让你好奇？', image: 'saturn' },
  { id: 'example-camera', category: '摄影分享', title: '第一次拍星空，先学会记录一次夜晚', content: '示例话题：找一处视野开阔、安全且远离强光的地方，用固定支架拍摄并记录设备、时间和环境。保护自己与同行者，再慢慢积累观察经验。', image: 'andromeda' },
  { id: 'example-blue', category: '学习交流', title: '把一颗蓝色星球，讲给身边的人听', content: '示例话题：试着用自己的话解释地球为什么看起来是蓝色，再制作一张知识卡。比背住术语更重要的，是让别人也能听懂。', image: 'earth' },
].map(post => ({ ...post, example: true, createdAt: null, liked: false, comments: [] }));

export function restoreCommunity(raw) {
  if (!raw) return { posts: structuredClone(communitySeeds), recovered: false };
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Array.isArray(value.posts)) throw new Error('Invalid community data');
    const posts = value.posts.filter(post => post && typeof post.id === 'string' && typeof post.title === 'string' && typeof post.content === 'string' && communityCategories.includes(post.category)).map(post => ({
      id: post.id.slice(0, 80), title: post.title.slice(0, 80), content: post.content.slice(0, 2000), category: post.category,
      example: post.example === true && communitySeeds.some(seed => seed.id === post.id),
      image: ['moon', 'saturn', 'andromeda', 'earth'].includes(post.image) ? post.image : null,
      createdAt: Number.isFinite(post.createdAt) ? post.createdAt : null, liked: post.liked === true,
      comments: (Array.isArray(post.comments) ? post.comments : []).filter(comment => comment && typeof comment.id === 'string' && typeof comment.content === 'string').map(comment => ({ id: comment.id.slice(0, 80), content: comment.content.slice(0, 500), createdAt: Number.isFinite(comment.createdAt) ? comment.createdAt : null })),
    }));
    const unique = posts.filter((post, index) => posts.findIndex(item => item.id === post.id) === index);
    if (!unique.length) throw new Error('Empty community data');
    return { posts: unique, recovered: false };
  } catch { return { posts: structuredClone(communitySeeds), recovered: true }; }
}

export function createCommunityPost(draft, id, createdAt) {
  const title = draft.title.trim(), content = draft.content.trim();
  if (title.length < 4 || title.length > 80) throw new Error('标题请填写 4–80 个字符。');
  if (content.length < 10 || content.length > 2000) throw new Error('正文请填写 10–2000 个字符。');
  if (!communityCategories.includes(draft.category)) throw new Error('请选择一个有效的讨论分类。');
  return { id, createdAt, title, content, category: draft.category, example: false, image: null, liked: false, comments: [] };
}

export function toggleCommunityLike(posts, id) {
  return posts.map(post => post.id === id ? { ...post, liked: !post.liked } : post);
}

export function addCommunityComment(posts, postId, content, commentId, createdAt) {
  const text = content.trim();
  if (!text || text.length > 500) throw new Error('评论请填写 1–500 个字符。');
  if (!posts.some(post => post.id === postId)) throw new Error('这条讨论已不存在，请重新打开讨论。');
  return posts.map(post => post.id === postId ? { ...post, comments: [...post.comments, { id: commentId, content: text, createdAt }] } : post);
}
