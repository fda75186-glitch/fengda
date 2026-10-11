<script setup>
import { assetUrl } from '../assets.js';
import { ref,onMounted,onUnmounted } from 'vue';
import { ArrowUpRight, ArrowRight, ArrowDown, BookOpen, Orbit, WandSparkles, BrainCircuit } from '@lucide/vue';
import SaturnLogo from './SaturnLogo.vue';
import ScrollChapter from './ScrollChapter.vue';
import { articles } from '../knowledge.js';
defineEmits(['navigate','open','ask']);
const film=ref(null),videoError=ref(false);let observer;
onMounted(()=>{
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 if(reducedMotion.matches)film.value?.pause();
 observer=new IntersectionObserver(([entry])=>{
  if(!entry.isIntersecting || reducedMotion.matches)film.value?.pause();
  else film.value?.play().catch(()=>{});
 },{threshold:.1});
 if(film.value)observer.observe(film.value);
});
onUnmounted(()=>observer?.disconnect());
function scrollDiscover(){document.getElementById('home-discover')?.scrollIntoView({behavior:'smooth'})}
const features=[{icon:BookOpen,title:'探索宇宙',sub:'从太阳系走向更远的星空',route:'explore'},{icon:Orbit,title:'星空图谱',sub:'看见行星，理解宇宙的尺度',route:'atlas'},{icon:WandSparkles,title:'知识卡工作室',sub:'把好奇心制作成一份知识',route:'studio'},{icon:BrainCircuit,title:'天文挑战',sub:'让每个答案成为新的发现',route:'quiz'}];
const homeStories=[{article:articles.find(a=>a.id==='moon'),image:'child-sky',alt:'孩子站在田野中仰望星空',title:'第一次抬头，就是探索的起点',short:'认识月相，为你的第一次观星做一点准备。'},{article:articles.find(a=>a.id==='cassini'),image:'telescope-night',alt:'观测者通过望远镜观看星空',title:'把目光，送到更远的地方',short:'从一台望远镜，到穿越太阳系的探测器。'},{article:articles.find(a=>a.id==='origin'),image:'starfield-night',alt:'夜晚的真实星空摄影',title:'星空里的每束光，都有故事',short:'从宇宙的早期历史，理解我们看见的世界。'}];
const chapters=[{title:'面向星空',description:'从我们熟悉的地球出发，去认识那些遥远而真实的世界。',image:'/images/child-sky.jpg',eyebrow:'从太阳系，到宇宙边缘',action:'开始探索宇宙',tone:'ink',route:'explore'}, {title:'面向好奇',description:'不懂没关系。每一个为什么，都值得被认真回答。',image:'/images/telescope-night.jpg',eyebrow:'你的宇宙同行者 · AI 星语',action:'与星语对话',tone:'blue',route:'assistant'}, {title:'面向发现',description:'看懂一个原理，回答一道问题，再带走一张属于你的知识卡。',image:'/images/starfield-night.jpg',eyebrow:'从看见，到理解',action:'制作一张知识卡',tone:'sand',route:'studio'}];
</script>
<template>
 <div class="home-v2"><section class="cinema-hero home-film-hero">
  <div class="home-film-frame">
   <video ref="film" class="hero-documentary" muted autoplay loop playsinline disablePictureInPicture controlsList="nodownload nofullscreen noremoteplayback" preload="auto" :poster="assetUrl('/images/stargazer-moving-poster.jpg')" aria-label="观星运镜之旅：从地球上的望远镜出发，环绕月球后返回地球" @loadeddata="videoError=false" @error="videoError=true">
    <source :src="assetUrl('/video/stargazer-moving-journey.mp4')" type="video/mp4"/>
   </video>
   <div class="cinema-shade"></div>
   <span class="cinema-meta">STARWHISPER / A WINDOW TO THE UNIVERSE</span>
   <p v-if="videoError" class="video-error" role="status">影片暂时无法播放，静态画面仍可浏览。</p>
  </div>
  <div class="cinema-caption"><div class="cinema-kicker">让每个人，都能听懂宇宙</div><h1>以好奇心，<br/>连接整个宇宙。</h1><button @click="$emit('navigate','explore')">从这里出发 <ArrowRight :size="20"/></button></div>
  <button class="cinema-scroll" aria-label="向下浏览探索入口" @click="scrollDiscover"><ArrowDown :size="21"/></button>
  <a class="cinema-credit" href="https://svs.gsfc.nasa.gov/5039/" target="_blank" rel="noopener noreferrer">观星想象之旅 · NASA 数据可视化 / 星语制作</a>
 </section>
 <section id="home-discover" class="home-discover content-width"><div class="editorial-top"><span>好奇心没有边界</span><h2>宇宙很大。<br/>你的探索，可以从这里开始。</h2></div><div class="feature-links"><button v-for="(f,i) in features" @click="$emit('navigate',f.route)"><span class="feature-order">0{{i+1}}</span><component :is="f.icon" :size="27" :stroke-width="1.4"/><h3>{{f.title}}</h3><p>{{f.sub}}</p><ArrowUpRight class="feature-link-arrow" :size="22"/></button></div></section>
 <ScrollChapter v-for="(chapter,i) in chapters" :key="chapter.route" v-bind="chapter" :index="'0'+(i+1)" @open="$emit('navigate',chapter.route)"/>
 <section class="home-stories content-width"><div class="section-top"><div><span class="light-eyebrow">宇宙写给我们的故事</span><h2>今天，发现一点不一样。</h2></div><button class="text-button" @click="$emit('navigate','explore')">全部科普 <ArrowRight :size="17"/></button></div><div class="article-grid"><article v-for="a in homeStories" class="article-card"><button class="article-cover" @click="$emit('open',a.article)"><img :src="assetUrl('/images/'+a.image+'.jpg')" :alt="a.alt" loading="lazy"/><span class="cover-badge">{{a.article.category}}</span><span class="cover-arrow"><ArrowUpRight :size="22"/></span></button><div class="article-info"><h3><button @click="$emit('open',a.article)">{{a.title}}</button></h3><p>{{a.short}}</p></div></article></div></section>
 <section class="home-ending"><SaturnLogo :size="90"/><h2>下一站，就在头顶。</h2><p>带上好奇心，开启属于你的星际旅程。</p><button class="button primary" @click="$emit('navigate','guide')">去看星星 <ArrowUpRight :size="18"/></button></section></div>
</template>
