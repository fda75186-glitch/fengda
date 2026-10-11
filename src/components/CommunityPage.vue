<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { BookOpen, MessageCircle, Plus, Search, Sparkles, Telescope, X } from '@lucide/vue';
import { assetUrl } from '../assets.js';
import { useCommunityStore } from '../communityClient.js';
import SaturnLogo from './SaturnLogo.vue';
import CommunityPostCard from './CommunityPostCard.vue';
import { capturePostSurface, morphPostSurface } from '../postMorph.js';
import '../community-feed.css';

const props = defineProps({ initialPost: String });
const emit = defineEmits(['ask', 'navigate', 'login', 'notify', 'viewed']);
const store = useCommunityStore();
const categories = ['全部', '观星日记', '天文问答', '摄影分享', '学习交流'];
const channels = [
  { id: 'all', name: '全部社区', image: 'starfield-night', description: '在这里，分享你的宇宙', keywords: [] },
  { id: 'moon', name: '月球观察', image: 'moon', description: '记录每一天不同的月亮', keywords: ['月球', '月亮', '月相'] },
  { id: 'planet', name: '行星世界', image: 'saturn', description: '从地球出发，认识太阳系', keywords: ['行星', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '地球'] },
  { id: 'photo', name: '星空摄影', image: 'starfield-night', description: '把抬头的瞬间留在照片里', category: '摄影分享', keywords: [] },
  { id: 'deep', name: '深空探索', image: 'andromeda', description: '星系、星云与更远的故事', keywords: ['星系', '星云', '仙女座', '黑洞', '深空'] },
  { id: 'gear', name: '器材交流', image: 'telescope-night', description: '聊聊望远镜与拍摄经验', keywords: ['器材', '设备', '望远镜', '相机', '支架', '拍摄'] },
  { id: 'question', name: '天文问答', image: 'earth', description: '每一个问题，都是新的起点', category: '天文问答', keywords: [] },
];
const featuredTopics = [{ label: '今晚的月亮', query: '月亮' }, { label: '第一次观星', query: '第一次' }, { label: '我的星空照片', query: '星空' }, { label: '望远镜怎么选', query: '望远镜' }];
const query = ref(''), category = ref('全部'), channelId = ref('all');
const sortBy = ref('recommend'), notice = ref(''), loadError = ref('');
const busyIds = ref(new Set()), activeId = ref(null), detailDialog = ref(null), communityHub = ref(null);
const comment = ref(''), commentError = ref(''), submitting = ref(false);
const detailClosing = ref(false);
const detailOpening = ref(false);
const detailBody = ref(null), morphHost = ref(null);
let focusBeforeDialog;
let detailMotion, originCard;
let scrollLockOwned = false, savedScroll;
const channel = computed(() => channels.find(item => item.id === channelId.value) || channels[0]);
const allPosts = computed(() => Array.isArray(store.state.posts) ? store.state.posts : []);
const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  const result = allPosts.value.filter(post => {
    const text = `${post.title || ''} ${post.content || ''} ${(post.topics || []).join(' ')} ${post.author?.name || ''}`.toLowerCase();
    const chosen = channel.value;
    const categoryMatch = category.value === '全部' || post.category === category.value;
    const channelMatch = chosen.id === 'all' || (chosen.category ? post.category === chosen.category : chosen.keywords.some(word => text.includes(word)));
    return categoryMatch && channelMatch && (!keyword || text.includes(keyword));
  });
  if (sortBy.value === 'latest') return [...result].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (sortBy.value === 'popular') return [...result].sort((a, b) => (b.likeCount || 0) + (b.commentCount || 0) * 2 - (a.likeCount || 0) - (a.commentCount || 0) * 2);
  return result;
});
const activePost = computed(() => allPosts.value.find(post => post.id === activeId.value));
const comments = computed(() => Array.isArray(activePost.value?.comments) ? activePost.value.comments : []);
const errorMessage = computed(() => loadError.value || store.state.error || '');
const popularChannels = computed(() => channels.filter(item => item.id !== 'all').slice(0, 5));

async function load() {
  loadError.value = '';
  try { await store.loadPosts(); }
  catch (error) { loadError.value = error.message || '社区暂时无法加载，请稍后再试。'; }
}
function selectChannel(item) { channelId.value = item.id; category.value = '全部'; query.value = ''; }
function searchTopic(topic) { channelId.value = 'all'; category.value = '全部'; query.value = topic; }
function clearFilters() { category.value = '全部'; channelId.value = 'all'; query.value = ''; }
function publish() { emit('navigate', 'publish'); }
function requireLogin() { emit('login'); }
function feedback(message) { notice.value = message; emit('notify', message); }
async function like(post) {
  if (!store.state.user) return requireLogin();
  if (busyIds.value.has(post.id)) return;
  busyIds.value = new Set([...busyIds.value, post.id]);
  try { await store.likePost(post.id); }
  catch (error) { feedback(error.message || '暂时无法点赞，请稍后再试。'); }
  finally { const remaining = new Set(busyIds.value); remaining.delete(post.id); busyIds.value = remaining; }
}
function stopDetailMotion() {
  detailMotion?.dispose();
  detailMotion = null;
}
function restoreScroll() {
  if (!scrollLockOwned) return;
  document.documentElement.classList.remove('ch-post-modal-active');
  if (savedScroll) window.scrollTo({ left: savedScroll.x, top: savedScroll.y, behavior: 'instant' });
  scrollLockOwned = false;
}
function reduceMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
async function finishOpening() {
  const motion = detailMotion;
  detailOpening.value = false;
  await nextTick();
  if (detailMotion === motion && !detailClosing.value) {
    stopDetailMotion();
    detailDialog.value?.querySelector('.ch-detail-top button')?.focus({ preventScroll: true });
  }
}
async function openPost(post, event) {
  if (detailDialog.value?.open) return;
  stopDetailMotion();
  detailClosing.value = false;
  activeId.value = post.id; comment.value = ''; commentError.value = '';
  focusBeforeDialog = document.activeElement;
  originCard = event?.currentTarget?.closest?.('.ch-post') || [...(communityHub.value?.querySelectorAll('.ch-post[data-post-id]') || [])].find(card => card.dataset.postId === String(post.id));
  const origin = originCard?.isConnected && !reduceMotion() ? capturePostSurface(originCard, originCard, true) : null;
  detailOpening.value = Boolean(origin);
  savedScroll = { x: window.scrollX, y: window.scrollY };
  scrollLockOwned = !document.documentElement.classList.contains('ch-post-modal-active');
  document.documentElement.classList.add('ch-post-modal-active');
  await nextTick();
  const panel = detailDialog.value;
  if (!panel) { restoreScroll(); return; }
  panel.showModal();
  panel.scrollTop = 0;
  if (!origin || !panel.animate) return finishOpening();
  const destination = capturePostSurface(detailBody.value, panel);
  detailMotion = morphPostSurface(morphHost.value, origin, destination, true, finishOpening);
}
function finishClose() {
  // Remove the top layer before disposing the final frame, so the source card is the next paint.
  detailDialog.value?.close();
  stopDetailMotion();
  restoreScroll();
}
function closePost() {
  const panel = detailDialog.value;
  if (!panel?.open || detailClosing.value) return;
  if (reduceMotion() || !originCard?.isConnected || !panel.animate) return finishClose();
  detailClosing.value = true;
  if (detailOpening.value && detailMotion) {
    detailMotion.reverse(finishClose);
    return;
  }
  const from = capturePostSurface(detailBody.value, panel);
  const to = capturePostSurface(originCard, originCard, true);
  stopDetailMotion();
  detailMotion = morphPostSurface(morphHost.value, from, to, false, finishClose);
}
function afterClose() {
  stopDetailMotion();
  restoreScroll();
  detailOpening.value = false;
  detailClosing.value = false;
  activeId.value = null;
  originCard = null;
  if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus?.({ preventScroll: true });
}
function backdropClose(event) {
  if (event.target !== event.currentTarget) return;
  const rect = event.currentTarget.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePost();
}
async function postComment() {
  if (!store.state.user) return requireLogin();
  if (!comment.value.trim() || submitting.value || !activePost.value) return;
  submitting.value = true; commentError.value = '';
  try { await store.addComment(activeId.value, comment.value.trim()); comment.value = ''; }
  catch (error) { commentError.value = error.message || '评论发布失败，请稍后再试。'; }
  finally { submitting.value = false; }
}
function commentKeydown(event) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault(); postComment();
}
function ask() { const question = activePost.value?.title; if (question) { closePost(); emit('ask', question); } }
function timeLabel(value) {
  if (!value) return '精选科普';
  const elapsed = Math.max(0, Date.now() - value);
  if (elapsed < 60_000) return '刚刚';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} 分钟前`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} 小时前`;
  return new Date(value).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}
watch(() => [props.initialPost, allPosts.value], async () => {
  if (!props.initialPost) return;
  const post=allPosts.value.find(post=>post.id===props.initialPost);
  if(post){await openPost(post);emit('viewed');}
}, {immediate:true});
onMounted(load);
onBeforeUnmount(finishClose);
</script>

<template>
  <div ref="communityHub" class="community-hub">
    <h1 class="ch-visually-hidden">星语社区</h1>
    <div class="ch-container">
      <form class="ch-search" role="search" @submit.prevent>
        <Search :size="21" aria-hidden="true" />
        <label class="ch-visually-hidden" for="community-feed-search">搜索社区内容</label>
        <input id="community-feed-search" v-model="query" type="search" placeholder="搜索观星日记、天文问题、摄影与器材…" autocomplete="off" />
        <button v-if="query" type="button" class="ch-icon-button" aria-label="清空社区搜索" @click="query = ''"><X :size="18" /></button>
        <span class="ch-search-caption">星语社区</span>
      </form>
      <div class="ch-layout">
        <section class="ch-main-column" aria-label="社区内容">
          <nav class="ch-channels" aria-label="天文社区分区">
            <button v-for="item in channels" :key="item.id" class="ch-channel" :class="{ 'is-selected': channelId === item.id }" :aria-pressed="channelId === item.id" @click="selectChannel(item)"><span class="ch-channel-image"><img :src="assetUrl(`/images/${item.image}.jpg`)" alt="" loading="lazy" /></span><span>{{ item.name }}</span></button>
          </nav>
          <div class="ch-feed-bar"><div class="ch-feed-category" aria-label="内容分类"><button v-for="item in categories" :key="item" :class="{ 'is-selected': category === item }" :aria-pressed="category === item" @click="category = item">{{ item }}</button></div><label class="ch-sort"><span class="ch-visually-hidden">内容排序</span><select v-model="sortBy"><option value="recommend">推荐</option><option value="latest">最新</option><option value="popular">热议</option></select></label></div>
          <div v-if="channelId !== 'all' || query" class="ch-filter-summary"><span>{{ query ? `“${query}”的搜索结果` : channel.name }} <small>{{ filtered.length }} 条内容</small></span><button class="ch-quiet-button" @click="clearFilters">查看全部</button></div>
          <div v-if="errorMessage" class="ch-status ch-error" role="alert"><p>{{ errorMessage }}</p><button class="ch-button" @click="load">重新加载</button></div>
          <div v-if="notice" class="ch-status ch-notice" role="status"><span>{{ notice }}</span><button class="ch-icon-button" aria-label="关闭提示" @click="notice = ''"><X :size="16" /></button></div>
          <div v-if="store.state.loading && !allPosts.length" class="ch-loading" aria-busy="true" aria-label="正在加载社区内容"><div v-for="item in 3" :key="item" class="ch-skeleton"><div class="ch-skeleton-author"></div><div class="ch-skeleton-title"></div><div class="ch-skeleton-text"></div><div class="ch-skeleton-image"></div></div></div>
          <div v-else-if="filtered.length" class="ch-feed"><CommunityPostCard v-for="post in filtered" :key="post.id" :post="post" :busy="busyIds.has(post.id)" @open="openPost(post, $event)" @like="like(post)" @topic="searchTopic" /><div class="ch-feed-end"><SaturnLogo :size="27" /><span>你已经看完这些内容了，把你的发现也分享给大家吧。</span><button class="ch-quiet-button" @click="publish">发布内容</button></div></div>
          <div v-else class="ch-empty"><Telescope :size="39" /><h2>{{ query ? '还没有找到相关内容' : '这里还在等待新的发现' }}</h2><p>{{ query ? '试试“月亮”“星空摄影”或更简短的关键词。' : '分享一次观察、一张照片，或一个让你好奇的问题。' }}</p><div><button class="ch-button" @click="clearFilters">查看全部内容</button><button class="ch-button ch-primary" @click="publish">发布内容</button></div></div>
        </section>
        <aside class="ch-sidebar" aria-label="社区推荐，可独立滚动" tabindex="0">
          <section class="ch-panel ch-welcome"><div class="ch-welcome-brand"><SaturnLogo :size="48" /><div><h2>星语社区</h2><p>每一份好奇，都值得被看见。</p></div></div><p class="ch-welcome-description">记录你的夜晚，分享你发现的星空。和天文爱好者一起，让宇宙离我们更近一点。</p><button class="ch-button ch-primary ch-wide" @click="publish"><Plus :size="17" />发布内容</button><button v-if="!store.state.user" class="ch-quiet-button ch-login-invite" @click="requireLogin">登录，加入这片星空</button><p v-else class="ch-signed-in">欢迎回来，{{ store.state.user.name }}</p></section>
          <section class="ch-panel ch-popular"><h2>热门天文社区</h2><div v-for="item in popularChannels" :key="item.id" class="ch-popular-row"><img :src="assetUrl(`/images/${item.image}.jpg`)" alt="" loading="lazy" /><div><strong>{{ item.name }}</strong><span>{{ item.description }}</span></div><button class="ch-button ch-mini" :aria-label="`查看${item.name}社区`" @click="selectChannel(item)">查看</button></div></section>
          <section class="ch-panel ch-topics"><h2>一起聊聊</h2><button v-for="topic in featuredTopics" :key="topic.label" @click="searchTopic(topic.query)"><span>#</span>{{ topic.label }}</button></section>
          <section class="ch-panel ch-newcomer"><h2>第一次来到星语？</h2><button @click="emit('navigate', 'guide')"><Telescope :size="20" /><span><strong>从抬头看天空开始</strong><small>找到适合自己的观测方式</small></span></button><button @click="emit('navigate', 'quiz')"><BookOpen :size="20" /><span><strong>天文知识挑战</strong><small>在社区里，练习新的知识</small></span></button><button @click="emit('ask', '我是第一次观星，应该从哪里开始？')"><Sparkles :size="20" /><span><strong>问问 AI 星语</strong><small>把好奇交给你的天文伙伴</small></span></button></section>
          <p class="ch-sidebar-footnote">星语 STARWHISPER<br />和每一个好奇的人，仰望同一片星空。</p>
        </aside>
      </div>
    </div>
    <dialog ref="detailDialog" class="ch-detail-dialog" :class="{ 'is-morphing': detailOpening || detailClosing }" aria-labelledby="community-detail-title" @click="backdropClose" @cancel.prevent="closePost" @close="afterClose">
      <div ref="detailBody" class="ch-detail-body">
      <template v-if="activePost">
        <div class="ch-detail-top"><span>{{ activePost.category || '星语社区' }}</span><button class="ch-icon-button" aria-label="关闭内容详情" autofocus @click="closePost"><X :size="23" /></button></div>
        <CommunityPostCard :post="activePost" :busy="busyIds.has(activePost.id)" full @like="like(activePost)" @topic="topic => { closePost(); searchTopic(topic); }" />
        <div class="ch-detail-ask"><span>对这个话题还有疑问？</span><button class="ch-button" @click="ask"><Sparkles :size="16" />问问星语</button></div>
        <section class="ch-comments" aria-labelledby="community-comment-title">
          <h2 id="community-comment-title">评论 <span>{{ activePost.commentCount || comments.length }}</span></h2>
          <p v-if="!comments.length" class="ch-comment-empty">还没有评论，分享你的观察与想法吧。</p>
          <article v-for="item in comments" :key="item.id" class="ch-comment"><span class="ch-avatar"><img v-if="item.author?.avatar" :src="item.author.avatar" alt="" /><SaturnLogo v-else :size="29" /></span><div><div class="ch-comment-meta"><strong>{{ item.author?.name || '星语爱好者' }}</strong><time>{{ timeLabel(item.createdAt) }}</time></div><p>{{ item.content }}</p></div></article>
          <form v-if="store.state.user" class="ch-comment-form" @submit.prevent="postComment"><label for="community-comment">写下你的想法</label><textarea id="community-comment" v-model="comment" maxlength="500" rows="3" placeholder="分享你的观察、经验，或对这个话题的疑问…" @keydown="commentKeydown"></textarea><p v-if="commentError" class="ch-comment-error" role="alert">{{ commentError }}</p><div><small>{{ comment.length }}/500 · Enter 发布，Shift + Enter 换行</small><button class="ch-button ch-primary" :disabled="!comment.trim() || submitting" type="submit">{{ submitting ? '发布中…' : '发表评论' }}</button></div></form>
          <div v-else class="ch-comment-login"><MessageCircle :size="20" /><span>登录后，和大家聊聊你的发现。</span><button class="ch-button ch-primary" @click="requireLogin">登录</button></div>
        </section>
      </template>
      </div>
      <div ref="morphHost" class="ch-morph-host" aria-hidden="true"></div>
    </dialog>
  </div>
</template>
