<script setup>
import { computed, ref } from 'vue';
import { FileText, Heart, MessageCircle, Play } from '@lucide/vue';
import SaturnLogo from './SaturnLogo.vue';
import SafeMarkdown from './SafeMarkdown.vue';

const props = defineProps({ post: { type: Object, required: true }, full: Boolean, busy: Boolean });
const emit = defineEmits(['open', 'like', 'topic']);
const expanded = ref(false);
const images = computed(() => Array.isArray(props.post.images) ? props.post.images.filter(item => item?.url) : []);
const visibleImages = computed(() => props.full ? images.value : images.value.slice(0, 4));
const longContent = computed(() => (props.post.content || '').length > 240 || (props.post.content || '').split('\n').length > 5);
const expandedArticle = computed(() => props.post.type === 'article' && (props.full || expanded.value));
const previewContent = computed(() => props.post.type === 'article' ? (props.post.content || '').replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/^(?:#{1,3}|>)\s+/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').trim() : props.post.content);
const inlineArticleImages = computed(() => expandedArticle.value && /!\[[^\]]*\]\([^)]+\)/.test(props.post.content || ''));
const author = computed(() => props.post.author || { name: '星语爱好者' });
const time = computed(() => {
  if (props.post.example) return '精选科普';
  if (!props.post.createdAt) return '刚刚';
  const elapsed = Math.max(0, Date.now() - props.post.createdAt);
  if (elapsed < 60_000) return '刚刚';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} 分钟前`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} 小时前`;
  return new Date(props.post.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
});
</script>

<template>
  <article class="ch-post" :class="{ 'ch-post-full': full }" :data-post-id="post.id" :data-reveal="full ? undefined : ''">
    <header class="ch-post-author"><span class="ch-avatar"><img v-if="author.avatar" :src="author.avatar" alt="" loading="lazy" /><SaturnLogo v-else :size="29" /></span><div><strong>{{ post.example ? '星语科普' : author.name || '星语爱好者' }}</strong><div class="ch-post-byline"><time>{{ time }}</time><span v-if="post.category">{{ post.category }}</span><span v-if="post.visibility==='private'" class="ch-type-label">仅自己可见</span><span v-if="post.type === 'article'" class="ch-type-label"><FileText :size="12" />文章</span><span v-if="post.type === 'video'" class="ch-type-label"><Play :size="12" />视频</span></div></div><span v-if="post.example" class="ch-curated">精选</span></header>
    <h2 :id="full ? 'community-detail-title' : undefined" class="ch-post-title"><span v-if="full">{{ post.title }}</span><button v-else @click="emit('open', $event)">{{ post.title }}</button></h2>
    <SafeMarkdown v-if="expandedArticle" class="ch-article-markdown" :content="post.content" :images="images" />
    <p v-else class="ch-post-content" :class="{ 'is-collapsed': !full && !expanded && longContent }">{{ previewContent }}</p>
    <button v-if="!full && longContent" class="ch-expand" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起全文' : '展开全文' }}</button>
    <div v-if="visibleImages.length && !inlineArticleImages" class="ch-post-gallery" :class="[`ch-gallery-${Math.min(visibleImages.length, 4)}`, { 'is-full': full }]"><button v-for="(image, index) in visibleImages" :key="`${image.url}-${index}`" class="ch-gallery-tile" :aria-label="`查看${post.title}的第${index + 1}张图片`" @click="emit('open', $event)" :disabled="full"><img :src="image.url" :alt="image.alt || post.title" loading="lazy" /><span v-if="!full && index === 3 && images.length > 4" class="ch-more-images">+{{ images.length - 4 }} 张</span></button></div>
    <video v-if="post.type === 'video' && post.video?.url" class="ch-post-video" :src="post.video.url" :poster="post.video.poster || undefined" controls playsinline preload="metadata"></video>
    <div v-if="post.topics?.length" class="ch-post-topics"><button v-for="topic in post.topics" :key="topic" @click="emit('topic', topic)"># {{ topic }}</button></div>
    <footer class="ch-post-bottom"><span class="ch-category-badge">{{ post.category || '星语社区' }}</span><div><button class="ch-post-action" :disabled="busy" :class="{ 'is-liked': post.liked }" :aria-pressed="Boolean(post.liked)" :aria-label="`${post.liked ? '取消点赞' : '点赞'}：${post.title}`" @click="emit('like')"><Heart :size="18" /><span>{{ post.likeCount || '点赞' }}</span></button><button v-if="!full" class="ch-post-action" :aria-label="`查看${post.title}的评论`" @click="emit('open', $event)"><MessageCircle :size="18" /><span>{{ post.commentCount || post.comments?.length || '评论' }}</span></button><span v-else class="ch-detail-comment-count"><MessageCircle :size="18" />{{ post.commentCount || post.comments?.length || 0 }}</span></div></footer>
  </article>
</template>
