import { reactive } from 'vue';
import { assetUrl } from './assets.js';
import { communitySeeds } from './community.js';

const apiBase = new URL(import.meta.env.VITE_COMMUNITY_API_URL || '/', window.location.origin);
const tokenKey = `xingyu-account:${apiBase.origin}`;
const state = reactive({ user: null, posts: [], loading: false, error: '', mode: import.meta.env.VITE_COMMUNITY_MODE || 'shared', ready: false });
let token = '';
let loadPromise;
let events;
const protectedMedia = new Map();
try { token = localStorage.getItem(tokenKey) || ''; } catch {}
const categoryMap = { 星空摄影: '摄影分享', 行星观测: '观星日记' };
const apiUrl = path => new URL(path, apiBase).href;

function mediaUrl(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    const url = new URL(value, apiBase);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function normalizePost(post) {
  const author = typeof post.author === 'object' ? post.author : { id: post.authorId || '', name: post.author || '天文爱好者', avatar: null };
  const images = Array.isArray(post.images) ? post.images.map(image => ({ url: mediaUrl(typeof image === 'string' ? image : image.url), alt: (typeof image === 'object' && image.alt) || post.title })).filter(image => image.url) : [];
  if (!images.length && post.image) images.push({ url: assetUrl(`/images/${post.image}.jpg`), alt: post.title });
  const poster=post.coverUrl || post.coverImage || post.cover;
  const video = typeof post.video === 'object' && post.video ? { url: mediaUrl(post.video.url), poster: mediaUrl(post.video.poster || poster) } : post.videoUrl ? { url: mediaUrl(post.videoUrl), poster: mediaUrl(poster) } : null;
  const comments = (post.comments || []).map(comment => ({ ...comment, author: typeof comment.author === 'object' ? comment.author : { id: comment.authorId || '', name: comment.author || '天文爱好者', avatar: null }, createdAt: Number(comment.createdAt) || Date.now() }));
  return { ...post, type: post.type || post.kind || 'image', author: { ...author, name: author.name || author.nickname || '天文爱好者' }, category: categoryMap[post.category] || post.category, images, video, topics: post.topics || post.tags || [], createdAt: Number(post.createdAt) || null, likeCount: Number(post.likeCount ?? post.likes) || 0, liked: post.liked === true, commentCount: Number(post.commentCount ?? comments.length), comments, example: post.example === true || post.isExample === true };
}

const examples = communitySeeds.map((post, index) => normalizePost({ ...post, author: { id: 'editor', name: '星语编辑', avatar: null }, content: post.content.replace('示例话题：', '').replace('欢迎在本机评论里写下你的观察。', '你可以分享自己的观测记录，与更多爱好者一起交流。'), type: index === 3 ? 'article' : 'image', topics: [['月相观察', '第一次观星'], ['土星', '太阳系'], ['星空摄影', '观测记录'], ['地球', '科普交流']][index], comments: [], likes: 0, example: true }));
state.posts = examples;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.json !== undefined) headers.set('Content-Type', 'application/json');
  try {
    const response = await fetch(apiUrl(path), { ...options, headers, body: options.json === undefined ? options.body : JSON.stringify(options.json), signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) { token = ''; state.user = null; try { localStorage.removeItem(tokenKey); } catch {} }
      throw new Error(data.error || data.message || (response.status === 404 ? '当前账号服务尚未接入，请使用本版独立预览服务。' : `操作未完成，请稍后重试（${response.status}）。`));
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('连接超时，请稍后再试。');
    if (error instanceof TypeError) throw new Error('暂时无法连接社区服务，请确认预览服务正在运行。');
    throw error;
  } finally { clearTimeout(timer); }
}

async function loadPosts() {
  if (loadPromise) return loadPromise;
  state.loading = true;
  state.error = '';
  loadPromise = (async () => {
    try {
      const result = await request('/api/posts');
      const posts=(result.posts || []).map(normalizePost);
      await resolvePrivateMedia(posts);
      state.posts = posts.length ? posts : examples;
      state.ready = true;
    } catch (error) { state.error = error.message; }
    finally { state.loading = false; loadPromise = undefined; }
  })();
  return loadPromise;
}

async function resolvePrivateMedia(posts) {
  const attachments=[];
  for(const post of posts) {
    if(post.visibility!=='private')continue;
    for(const image of post.images)attachments.push([image,'url']);
    if(post.video?.url)attachments.push([post.video,'url']);
    if(post.video?.poster)attachments.push([post.video,'poster']);
  }
  const results=await Promise.allSettled(attachments.map(async ([object,key])=>{
    const url=object[key], cacheKey=`${state.user?.id}:${url}`;
    if(protectedMedia.has(cacheKey)){object[key]=protectedMedia.get(cacheKey);return;}
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
    if(!response.ok)throw new Error('私密内容附件暂时无法读取，请重新登录后重试。');
    const blobUrl=URL.createObjectURL(await response.blob());
    protectedMedia.set(cacheKey,blobUrl);object[key]=blobUrl;
  }));
  const failed=results.find(result=>result.status==='rejected');
  if(failed)state.error=failed.reason.message;
}

function clearPrivateMedia(){for(const url of protectedMedia.values())URL.revokeObjectURL(url);protectedMedia.clear();}

function subscribe() {
  if (events || !window.EventSource) return;
  events = new EventSource(apiUrl('/api/events'));
  events.addEventListener('change', () => loadPosts());
}

async function initialize() {
  if (token) {
    try { state.user = (await request('/api/auth/me')).user; }
    catch { token = ''; state.user = null; try { localStorage.removeItem(tokenKey); } catch {} }
  }
  await loadPosts();
  if (state.ready) subscribe();
}

async function authenticate(kind, credentials) {
  const result = await request(`/api/auth/${kind}`, { method: 'POST', json: credentials });
  token = result.token;
  state.user = result.user;
  try { localStorage.setItem(tokenKey, token); } catch {}
  await loadPosts();
  subscribe();
  return result.user;
}

async function logout() {
  try { if (token) await request('/api/auth/logout', { method: 'POST' }); }
  finally { token = ''; state.user = null; clearPrivateMedia(); try { localStorage.removeItem(tokenKey); } catch {} await loadPosts(); }
}

async function upload(file) {
  if (!file) return null;
  if (!file.type || !['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type)) throw new Error('请选择 JPG、PNG、WebP 图片，或 MP4、WebM 视频。');
  const limit = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size > limit) throw new Error(file.type.startsWith('video/') ? '视频不能超过 50 MB。' : '每张图片不能超过 8 MB。');
  return (await request('/api/media', { method: 'POST', headers: { 'Content-Type': file.type, 'X-Filename': encodeURIComponent(file.name) }, body: file })).url;
}

async function publishPost(payload) {
  if (!state.user) throw new Error('请先登录，再发布你的内容。');
  if (!payload.title?.trim() || !payload.content?.trim()) throw new Error('请填写标题与正文。');
  const images = [];
  for (const file of payload.images || []) images.push(await upload(file));
  const videoUrl = payload.video ? await upload(payload.video) : null;
  const coverUrl = payload.cover ? await upload(payload.cover) : null;
  const result = await request('/api/posts', { method: 'POST', json: { ...payload, kind: payload.type, format: payload.type==='article'?'markdown':'plain', images, video: videoUrl || '', cover: coverUrl || '', title: payload.title.trim(), content: payload.content.trim() } });
  await loadPosts();
  const loaded=state.posts.find(post=>post.id===result.id);
  if(loaded)return loaded;
  // A confirmed write stays successful even if the subsequent list refresh fails.
  const post=normalizePost(result.post || {...payload,id:result.id,images,videoUrl,coverUrl,createdAt:Date.now(),author:state.user,comments:[]});
  await resolvePrivateMedia([post]);state.posts.unshift(post);return post;
}

async function likePost(id) {
  if (!state.user) throw new Error('登录后就可以点赞。');
  if (id.startsWith('example-')) throw new Error('这是精选科普示例，发布真实内容后即可互动。');
  await request(`/api/posts/${encodeURIComponent(id)}/like`, { method: 'POST', json: {} });
  await loadPosts();
}

async function addComment(id, content) {
  if (!state.user) throw new Error('登录后就可以评论。');
  if (id.startsWith('example-')) throw new Error('这是精选科普示例，发布真实内容后即可互动。');
  await request(`/api/posts/${encodeURIComponent(id)}/comments`, { method: 'POST', json: { content } });
  await loadPosts();
}

async function getPost(id) {
  await loadPosts();
  const post=state.posts.find(post=>post.id===id);
  if(!post)throw new Error('这条内容已删除或当前账号无权查看。');
  return post;
}

const store = { state, initialize, loadPosts, login: credentials => authenticate('login', credentials), register: credentials => authenticate('register', credentials), logout, publishPost, likePost, addComment, getPost };
export function useCommunityStore() { return store; }

window.addEventListener('storage', async event => { if (event.key === tokenKey) { clearPrivateMedia();token = event.newValue || ''; await initialize(); } });
window.addEventListener('beforeunload',()=>{clearPrivateMedia();events?.close();});
