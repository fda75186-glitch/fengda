<script setup>
import { computed, ref, defineAsyncComponent } from 'vue';
import { Search, ArrowUpRight, ArrowRight, ArrowLeft, Bookmark, Clock3, X, WandSparkles } from '@lucide/vue';
import { categories, findArticles } from '../knowledge.js';
import { exploreArticles, solarBodies, bodyNames, isConcept } from '../exploreBodies.js';
const ExploreBody3D = defineAsyncComponent(() => import('./ExploreBody3D.vue'));
const props = defineProps({ search: String, favorites: Array, suspended: Boolean });
const emit = defineEmits(['update:search', 'open', 'favorite', 'navigate']);
const previewBody = new URLSearchParams(location.search).get('body');
const category = ref('全部'), activeId = ref(exploreArticles.some(a => a.id === previewBody) ? previewBody : 'earth');
const results = computed(() => findArticles(exploreArticles, category.value, props.search));
const featured = computed(() => results.value.find(a => a.id === activeId.value) || results.value[0] || exploreArticles[2]);
const index = computed(() => results.value.findIndex(a => a.id === featured.value.id));
function step(direction) {
  if (!results.value.length) return;
  activeId.value = results.value[(index.value + direction + results.value.length) % results.value.length].id;
}
function selectBody(id, scroll = false) {
  category.value = '全部'; emit('update:search', ''); activeId.value = id;
  if (scroll) document.getElementById('explore-model-stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function scrollLibrary() { document.getElementById('explore-library')?.scrollIntoView({ behavior: 'smooth' }); }
function open(article, source) { emit('open', { ...article, explore3d: true }, source); }
function openLibraryArticle(article, event) {
  const source = event?.currentTarget?.closest('.article-card') || event?.target?.closest('.article-card');
  open(article, source);
}
</script>

<template>
  <div class="explore-v2 explore-all3d">
    <section class="explore-hero">
      <div class="explore-atmosphere"></div>
      <div class="explore-hero-inner">
        <div class="explore-copy">
          <button class="explore-studio-entry" @click="emit('navigate','studio')"><WandSparkles :size="17"/> 制作知识卡 <ArrowUpRight :size="15"/></button>
          <span class="light-eyebrow">一个更容易理解的宇宙</span>
          <h1>探索宇宙，<br/>发现世界的另一面。</h1>
          <p>轻轻转动一颗星球，换个角度看宇宙。<br/>从山川与海洋，到遥远星系的光。</p>
          <div class="explore-actions">
            <button class="button primary" @click="scrollLibrary">浏览科普故事 <ArrowRight :size="17"/></button>
            <button class="button secondary" @click="open(featured,$event.currentTarget)">了解{{bodyNames[featured.image]}} <ArrowUpRight :size="17"/></button>
          </div>
          <div class="explore-current">
            <span class="current-rule"></span><span>{{featured.category}} / {{featured.tag}}<strong>{{featured.title}}</strong></span>
            <div class="explore-arrows">
              <button class="icon-button" aria-label="上一个精选天体" :disabled="results.length<2" @click="step(-1)"><ArrowLeft :size="17"/></button>
              <button class="icon-button" aria-label="下一个精选天体" :disabled="results.length<2" @click="step(1)"><ArrowRight :size="17"/></button>
            </div>
          </div>
        </div>
        <div id="explore-model-stage" class="explore-visual">
          <div class="model-stage-heading"><span>INTERACTIVE UNIVERSE</span><strong>{{bodyNames[featured.image]}} <small>{{isConcept(featured.image)?'3D 概念模型':'3D 天体模型'}}</small></strong></div>
          <div class="hero-model-frame"><ExploreBody3D :body="featured.image" :suspended="suspended"/></div>
          <div class="model-body-picker" aria-label="选择三维天体">
            <button v-for="body in [...solarBodies,'andromeda','blackhole']" :key="body" :aria-pressed="featured.image===body" :class="{selected:featured.image===body}" @click="selectBody(body)">{{bodyNames[body]}}</button>
          </div>
          <p class="model-source-note">
            {{isConcept(featured.image)?'空间结构为科普示意，不代表精确观测重建。':'比例、光照与自转速度为演示效果。'}}
            <span v-if="featured.image==='andromeda'">艺术化星系纹理 · 3D 体积呈现</span>
            <span v-else-if="featured.image==='blackhole'">实时光线示意</span>
            <a v-else href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">纹理 · Solar System Scope / CC BY 4.0</a>
          </p>
        </div>
      </div>
      <div class="explore-topic-nav">
        <button v-for="(c,i) in categories" :key="c" :class="{selected:category===c}" :aria-pressed="category===c" @click="category=c;emit('update:search','')"><span>0{{i+1}}</span>{{c==='全部'?'全部宇宙':c}}<ArrowUpRight :size="13"/></button>
      </div>
    </section>
    <section id="explore-library" class="page-shell">
      <div class="section-top"><div><span class="light-eyebrow">转动天体，读懂它的故事</span><h2>宇宙知识库</h2></div><span class="library-number">{{results.length}} 篇科普故事 · 全部支持 3D 探索</span></div>
      <div class="search-field"><Search :size="19"/><input aria-label="搜索天文知识" :value="search" @input="emit('update:search',$event.target.value)" placeholder="搜索一个天体，或一个让你好奇的问题…"/><button v-if="search" class="icon-button" aria-label="清除搜索" @click="emit('update:search','')"><X :size="17"/></button></div>
      <div class="filter-row" aria-label="知识分类"><button v-for="c in categories" :key="c" :class="{selected:category===c}" :aria-pressed="category===c" @click="category=c">{{c}}</button></div>
      <TransitionGroup v-if="results.length" name="cards" tag="div" class="article-grid library-grid">
        <article v-for="a in results" :key="a.id" class="article-card">
          <div class="article-model-cover"><ExploreBody3D :body="a.image" compact :suspended="suspended" @open="openLibraryArticle(a,$event)" @focus="selectBody(a.id,true)"/></div>
          <div class="article-info">
            <div class="card-meta"><span>{{a.category}}</span><span><Clock3 :size="12"/> {{a.minutes}} 分钟阅读</span></div>
            <h3><button @click="openLibraryArticle(a,$event)">{{a.title}}</button></h3><p>{{a.short}}</p>
            <div class="card-bottom"><button class="text-button model-read-story" @click="openLibraryArticle(a,$event)">阅读故事 <ArrowUpRight :size="14"/></button><button class="icon-button" :class="{favorited:favorites.includes(a.id)}" :aria-label="(favorites.includes(a.id)?'取消收藏':'收藏')+a.title" :aria-pressed="favorites.includes(a.id)" @click="emit('favorite',a)"><Bookmark :size="17"/></button></div>
          </div>
        </article>
      </TransitionGroup>
      <div v-else class="empty-state"><Search :size="32"/><h2>还没找到这颗星</h2><p>换一个关键词，或者试试其他分类。</p><button class="button secondary" @click="category='全部';emit('update:search','')">重置筛选</button></div>
    </section>
  </div>
</template>

<style scoped>
.explore-all3d .explore-hero-inner{padding-top:24px;padding-bottom:28px;gap:32px}
.explore-all3d .explore-visual{height:auto;min-width:0;display:flex;flex-direction:column;align-items:stretch;margin:0;padding:22px 0 0}
.model-stage-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;color:#668096;min-height:42px}
.model-stage-heading>span{font-size:9px;letter-spacing:2px;padding-top:7px}
.model-stage-heading>strong{color:#2e485a;font-weight:500;font-size:20px;text-align:right;line-height:1.25}
.model-stage-heading small{display:block;font-size:10px;letter-spacing:1px;color:#8b9cab;margin-top:8px}
.hero-model-frame{height:clamp(340px,36vw,540px);width:100%;margin:4px 0 15px}
.model-body-picker{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;border-top:1px solid #e0e7ee;padding-top:17px}
.model-body-picker button{background:transparent;border:1px solid transparent;border-radius:5px;color:#7c90a0;font-size:11px;padding:7px 9px;transition:background .2s,color .2s,transform .2s}
.model-body-picker button:hover{color:#294b64;background:#edf2f6}.model-body-picker button:active{transform:translateY(2px)}
.model-body-picker button.selected{background:#fff;color:#234861;border-color:#c9d8e2;box-shadow:0 2px 6px #213b5210}
.model-body-picker button:focus-visible{outline:2px solid #537e9c;outline-offset:3px}
.model-source-note{font-size:9px;text-align:center;line-height:1.9;color:#889baa;margin:13px 0 0}
.model-source-note a{display:inline-block;text-decoration:underline;text-underline-offset:3px;margin-left:6px}
.article-model-cover{height:270px;position:relative;overflow:hidden;border-bottom:1px solid #e7edf2}
.model-read-story{font-size:11px;gap:8px;padding:5px 0}
#explore-model-stage{scroll-margin-top:125px}
@media(min-width:1600px){.hero-model-frame{height:590px}}
@media(max-width:1000px){.explore-all3d .explore-hero-inner{gap:20px}.model-stage-heading>span{font-size:7px;letter-spacing:1px}.hero-model-frame{height:350px}.model-body-picker button{padding:6px 7px;font-size:10px}.article-model-cover{height:230px}}
@media(max-width:600px){.explore-all3d .explore-hero-inner{padding-top:35px;padding-bottom:15px;gap:24px}.model-stage-heading{padding:0 6px}.model-stage-heading>strong{font-size:17px}.hero-model-frame{height:360px}.model-body-picker{gap:4px}.model-body-picker button{font-size:11px;padding:7px 10px}.article-model-cover{height:280px}.library-number{white-space:normal;max-width:120px;text-align:right;line-height:1.7}.model-source-note{font-size:8px}}
</style>
