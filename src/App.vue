<script setup>
import { assetUrl } from './assets.js';
import { computed, ref, watch, defineAsyncComponent, nextTick, onMounted, onUnmounted } from 'vue';
import { Orbit, Search, ArrowUpRight, UserRound, Sparkles, Menu, X, Bookmark, ArrowRight, ExternalLink } from '@lucide/vue';
import SaturnLogo from './components/SaturnLogo.vue';
import FloatingAssistant from './components/FloatingAssistant.vue';
import FeatureIntro from './components/FeatureIntro.vue';
import HomePage from './components/HomePage.vue';
import SiteHeader from './components/SiteHeader.vue';
import AccountDialog from './components/AccountDialog.vue';
import { useCommunityStore } from './communityClient.js';
import ExplorePage from './components/ExploreUniverse.vue';
import AssistantPage from './components/AssistantPage.vue';
import AtlasPage from './components/AtlasPage.vue';
import QuizPage from './components/QuizPage.vue';
import GuidePage from './components/GuidePage.vue';
import CardStudio from './components/CardStudio.vue';
import { useScrollReveal } from './useScrollReveal.js';
const ARUniversePage=defineAsyncComponent(()=>import('./components/ARUniversePage.vue'));
const CommunityPage=defineAsyncComponent(()=>import('./components/CommunityPage.vue'));
const PublishPage=defineAsyncComponent(()=>import('./components/PublishPage.vue'));
import { exploreArticles as articles } from './exploreBodies.js';
const ExploreBody3D = defineAsyncComponent(() => import('./components/ExploreBody3D.vue'));
const detailIs3D = computed(() => selectedArticle.value?.explore3d || ['mercury','venus','mars','uranus','neptune'].includes(selectedArticle.value?.id));
const routes = [{id:'home',label:'首页'},{id:'explore',label:'探索宇宙'},{id:'atlas',label:'星空图谱'},{id:'assistant',label:'AI 星语'},{id:'guide',label:'观测指南'},{id:'ar',label:'AR 宇宙云图'},{id:'community',label:'社区'}];
const validRoutes=[...routes.map(r=>r.id),'quiz','studio','notebook','publish'];
const getRoute=()=>validRoutes.includes(location.hash.slice(1))?location.hash.slice(1):'home';
const route=ref(getRoute()),menu=ref(false),selectedArticle=ref(null),search=ref(''),question=ref(''),toast=ref(''),dialog=ref(null);
const community=useCommunityStore(),loginOpen=ref(false),targetCommunityPost=ref(null);
const globalSearchItems=computed(()=>[...articles.map(a=>({id:a.id,kind:'article',label:a.title,description:a.short})),...community.state.posts.map(p=>({id:p.id,kind:'post',label:p.title,description:p.content}))]);
function openLogin(){loginOpen.value=true}
function contentPublished(post){navigate('community');notify(post.visibility==='private'?'私密内容已保存，仅自己可见。':'内容已发布到社区。')}
async function logoutAccount(){try{await community.logout();notify('已退出登录')}catch(error){notify(error.message)}}
function searchSelect(item){if(item.kind==='article'){const a=articles.find(a=>a.id===item.id);if(a)openArticle(a)}else{targetCommunityPost.value=item.id;navigate('community')}}
onMounted(()=>community.initialize());
useScrollReveal(route);
let toastTimeout;
function readSaved(key,fallback){try{const result=JSON.parse(localStorage.getItem(key));return Array.isArray(result)?result:fallback}catch{return fallback}}
const favorites=ref(readSaved('xingyu-favorites',[])),savedCards=ref(readSaved('xingyu-cards',[])),learned=ref(readSaved('xingyu-learned',[]));
const savedArticles=computed(()=>articles.filter(a=>favorites.value.includes(a.id)));
function notify(message){toast.value=message;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>toast.value='',3200)}
function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{notify('浏览器存储不可用，本次操作仅在当前页面保留。')}}
watch(favorites,v=>persist('xingyu-favorites',v),{deep:true});watch(savedCards,v=>persist('xingyu-cards',v),{deep:true});watch(learned,v=>persist('xingyu-learned',v),{deep:true});
function navigate(page){location.hash=page;route.value=page;menu.value=false;window.scrollTo(0,0)}
window.addEventListener('hashchange',()=>{route.value=getRoute();menu.value=false;window.scrollTo(0,0)});
function toggleFavorite(a){favorites.value=favorites.value.includes(a.id)?favorites.value.filter(id=>id!==a.id):[...favorites.value,a.id];notify(favorites.value.includes(a.id)?'已收藏到「我的星空」':'已取消收藏')}
async function openArticle(a){selectedArticle.value=a;if(!learned.value.includes(a.id))learned.value.push(a.id);await nextTick();dialog.value.showModal()}
function closeArticle(){dialog.value.close();selectedArticle.value=null}
function ask(text){question.value=text;navigate('assistant')}
function saveCard(card){if(savedCards.value.some(c=>c.cardId===card.cardId)){notify('这张知识卡已经收藏过了');return}savedCards.value.push(card);notify('知识卡已保存到「我的星空」')}
const featureIntros={
 atlas:{title:'把宇宙，拉近一点。',eyebrow:'02 · 星空图谱',description:'用手指触碰行星，用数据感受宇宙的尺度。',image:'/images/starfield-night.jpg',number:'02'},
 studio:{title:'把好奇，装进一张卡。',eyebrow:'03 · 知识卡工作室',description:'选择一个主题，带走一份属于你的宇宙记忆。',image:'/images/telescope-night.jpg',number:'03'},
 quiz:{title:'宇宙的秘密，你知道多少？',eyebrow:'04 · 天文挑战',description:'五个问题，让每一个答案成为新的发现。',image:'/images/child-sky.jpg',number:'04'},
 guide:{title:'下一站，去看星星。',eyebrow:'05 · 观测指南',description:'不必等到远行，第一次探索就从抬头开始。',image:'/images/telescope-night.jpg',number:'05'},
 notebook:{title:'你的好奇，自成一个宇宙。',eyebrow:'06 · 我的星空',description:'把探索过的故事，收藏成自己的星图。',image:'/images/starfield-night.jpg',number:'06'},
};
function tapFeedback(event){const element=event.target.closest('button,a');if(!element||element.disabled)return;element.classList.remove('tap-feedback');void element.offsetWidth;element.classList.add('tap-feedback');setTimeout(()=>element.classList.remove('tap-feedback'),450)}
onMounted(()=>document.addEventListener('click',tapFeedback,true));
onUnmounted(()=>document.removeEventListener('click',tapFeedback,true));
const credits={saturn:'NASA/JPL-Caltech/Space Science Institute · PIA17474',jupiter:'NASA/JPL/University of Arizona · PIA02873',earth:'NASA/JPL-Caltech · PIA18033',andromeda:'NASA/JPL-Caltech · PIA04921',sun:'NASA/SDO · GSFC_20171208_Archive_e002035',moon:'NASA/JPL/USGS · PIA00405',blackhole:'NASA/JPL-Caltech · PIA16697 · 艺术概念图'};
</script>
<template>
  <a class="skip-link" href="#main-content">跳到正文</a>
  <SiteHeader :routes="routes" :route="route" :user="community.state.user" :search-items="globalSearchItems" @navigate="navigate" @publish="navigate('publish')" @login="openLogin" @logout="logoutAccount" @select-search="searchSelect"/>
  <AccountDialog v-model:open="loginOpen" @success="notify('登录成功，欢迎来到星语')"/>
  <main id="main-content" :class="{'assistant-route':route==='assistant','community-route':['community','publish'].includes(route)}"><Transition name="page" mode="out-in"><div :key="route" class="route-view"><FeatureIntro v-if="featureIntros[route]" v-bind="featureIntros[route]" target="feature-content"/><div id="feature-content">
    <HomePage v-if="route==='home'" @navigate="navigate" @open="openArticle" @ask="ask"/>
    <ExplorePage :suspended="Boolean(selectedArticle)" v-else-if="route==='explore'" v-model:search="search" :favorites="favorites" @open="openArticle" @favorite="toggleFavorite" @navigate="navigate"/>
    <AssistantPage v-else-if="route==='assistant'" :initial-question="question" @open="openArticle" @navigate="navigate" @consumed="question=''"/>
    <AtlasPage v-else-if="route==='atlas'" @ask="ask" @open="openArticle"/>
    <QuizPage v-else-if="route==='quiz'" @navigate="navigate"/>
    <GuidePage v-else-if="route==='guide'" @open="openArticle"/>
    <CardStudio v-else-if="route==='studio'" @save="saveCard"/>
    <ARUniversePage v-else-if="route==='ar'" @ask="ask" @navigate="navigate"/>
    <CommunityPage v-else-if="route==='community'" :initial-post="targetCommunityPost" @viewed="targetCommunityPost=null" @ask="ask" @navigate="navigate" @login="openLogin" @notify="notify"/>
    <PublishPage v-else-if="route==='publish'" @navigate="navigate" @login="openLogin" @notify="notify" @published="contentPublished"/>
    <section v-else class="page-shell notebook"><div class="eyebrow">YOUR LITTLE UNIVERSE</div><h1>我的探索记录</h1><p class="page-description">把每一次好奇，收藏成自己的宇宙。</p><div class="notebook-stats"><div><strong>{{learned.length}}</strong><span>已探索的知识</span></div><div><strong>{{favorites.length}}</strong><span>收藏的文章</span></div><div><strong>{{savedCards.length}}</strong><span>专属知识卡</span></div><div class="local-note"><SaturnLogo :size="44"/><span>访客探索者<br/><small>记录保存在当前浏览器</small></span></div></div><h2 class="section-heading">我的收藏 <Bookmark :size="20"/></h2><div v-if="!savedArticles.length" class="empty-state"><Bookmark :size="35"/><h3>你的星空，等着第一颗星</h3><p>收藏感兴趣的科普文章，下次回来接着探索。</p><button class="button primary" @click="navigate('explore')">去探索宇宙 <ArrowRight :size="17"/></button></div><div v-else class="article-grid"><article v-for="a in savedArticles" :key="a.id" class="article-card"><div v-if="['mercury','venus','mars','uranus','neptune'].includes(a.id)" class="saved-planet-model"><ExploreBody3D :body="a.image" compact @focus="openArticle(a)"/></div><button v-else class="article-cover" @click="openArticle(a)"><img :src="assetUrl(`/images/${a.image}.jpg`)" :alt="a.title"/></button><div class="article-info"><span class="category-label">{{a.category}}</span><h3><button @click="openArticle(a)">{{a.title}}</button></h3><p>{{a.short}}</p><button class="text-button" @click="toggleFavorite(a)">取消收藏</button></div></article></div><h2 v-if="savedCards.length" class="section-heading">我的知识卡</h2><div class="saved-card-grid"><article v-for="card in savedCards" class="saved-card"><SaturnLogo :size="40"/><h3>{{card.title}}</h3><p>{{card.intro}}</p><ul><li v-for="point in card.points">{{point}}</li></ul><a :href="card.source" target="_blank" rel="noopener noreferrer">查看知识来源 <ExternalLink :size="13"/></a></article></div></section>
  </div></div></Transition></main>
  <footer v-if="!['assistant','community','publish'].includes(route)" class="site-footer"><div class="footer-inner"><a class="footer-brand" href="#home"><SaturnLogo :size="39"/> 星语<span>让每个人，都能听懂宇宙。</span></a><div><a href="#explore" @click.prevent="navigate('explore')">探索宇宙</a><a href="#studio" @click.prevent="navigate('studio')">知识卡工作室</a><a href="https://science.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA 资料来源 <ArrowUpRight :size="13"/></a></div></div><div class="footer-bottom"><span>© 2026 星语 · 传智杯参赛原型</span><span>NASA 科普资料 · 图片署名见详情 · AI 为离线演示</span></div></footer>
  <FloatingAssistant v-if="!['assistant','publish'].includes(route)" @ask="ask('')"/><div v-if="toast" class="toast" role="status">{{toast}}</div>
  <dialog ref="dialog" class="article-dialog" @cancel="selectedArticle=null" @click="($event.target===dialog)&&closeArticle()"><template v-if="selectedArticle"><button class="dialog-close icon-button" aria-label="关闭文章" @click="closeArticle"><X :size="23"/></button><div v-if="detailIs3D" class="detail-model"><ExploreBody3D :body="selectedArticle.image"/></div><img v-else class="detail-image" :src="assetUrl(`/images/${selectedArticle.image}.jpg`)" :alt="selectedArticle.title"/><div class="detail-content"><div class="category-label">{{selectedArticle.category}} <span>· {{selectedArticle.minutes}} 分钟阅读</span></div><h2>{{selectedArticle.title}}</h2><p class="detail-intro">{{selectedArticle.short}}</p><p v-for="paragraph in selectedArticle.body.split('\n\n')" class="detail-paragraph">{{paragraph}}</p><aside class="fact-box"><Sparkles :size="19"/><div><strong>多一点宇宙冷知识</strong><p>{{selectedArticle.fact}}</p></div></aside><a class="source-link" :href="selectedArticle.source" target="_blank" rel="noopener noreferrer">知识来源：{{selectedArticle.sourceName}} <ExternalLink :size="15"/></a><p v-if="detailIs3D && selectedArticle.image==='andromeda'" class="image-credit">星系：按参考风格生成的美术纹理与 3D 体积模型，用于科普示意，非天文实拍照片。</p><p v-else-if="detailIs3D" class="image-credit">交互式 3D 科普模型，尺寸、光照、自转速度为示意。纹理：<a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">Solar System Scope / INOVE</a>，<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>；星系与黑洞为自建概念几何。</p><p v-else class="image-credit">图片：{{credits[selectedArticle.image]}}。部分文章使用栏目主题配图，具体天体请以说明为准。</p><div class="detail-actions"><button class="button secondary" @click="toggleFavorite(selectedArticle)"><Bookmark :size="17"/>{{favorites.includes(selectedArticle.id)?'已收藏':'收藏文章'}}</button><button class="button primary" @click="ask(`关于${selectedArticle.keywords[0]}，我还想知道更多`);closeArticle()">继续问星语 <ArrowUpRight :size="17"/></button></div></div></template></dialog>
</template>

<style>
.detail-model{height:410px;background:#f3f6f9;padding:24px 20px 10px}.saved-planet-model{height:260px}.article-dialog:has(.detail-model) .dialog-close{z-index:5;background:#ffffffeb;color:#304c64}.image-credit a{text-decoration:underline;text-underline-offset:3px}@media(max-width:600px){.detail-model{height:330px;padding:34px 10px 8px}}
</style>
