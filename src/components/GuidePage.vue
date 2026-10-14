<script setup>
import { computed, ref } from 'vue';
import { Telescope, MapPin, Moon, Backpack, Cloud, RefreshCw, BookOpen } from '@lucide/vue';
import { articles as baseArticles } from '../knowledge.js';
import { additionalGuideKnowledge } from '../guideKnowledge.js';
import { useObservatories } from '../useObservatories.js';
import ObservatoryMap from './ObservatoryMap.vue';
import ObservatoryInfoDialog from './ObservatoryInfoDialog.vue';

defineEmits(['open', 'navigate']);
const articles = [...baseArticles, ...additionalGuideKnowledge];
const { places, status, reconnect } = useObservatories();
const selectedId = ref('xinglong'), openedId = ref(null), mapRef = ref(null);
const openedSource = ref(null);
const openedPlace = computed(() => places.value.find(place => place.id === openedId.value) || null);
const tipCards = [
  { id: 'guide-moon-observation', title: '从月亮开始', description: '观察月相，记录几天的变化。', icon: Moon },
  { id: 'guide-first-sky', title: '先抬头，再买设备', description: '认识方位，找一片远离强光的天空。', icon: Telescope },
  { id: 'guide-night-ready', title: '做好夜间准备', description: '保暖、结伴，提前查看当地天气。', icon: Backpack },
];
function selectPlace(id) { selectedId.value = id; mapRef.value?.focusPlace(id); }
function openPlace(id, source) { selectedId.value = id; openedSource.value = source; openedId.value = id; }
</script>

<template>
  <section class="page-shell guide-page">
    <div class="eyebrow">THE BEST VIEW IS THE ONE YOU LOOK UP TO</div>
    <h1>下一站，去看星星<span class="heading-dot">.</span></h1>
    <p class="page-description">从一场科普之旅，到第一次夜空观察。</p>
    <div class="guide-tips">
      <button v-for="tip in tipCards" :key="tip.id" class="guide-tip-card" @click="$emit('open', articles.find(article => article.id===tip.id), $event.currentTarget)">
        <component :is="tip.icon" :size="26"/>
        <span><h2>{{ tip.title }}</h2><p>{{ tip.description }}</p></span>
        <BookOpen class="tip-read-icon" :size="17"/>
      </button>
    </div>
    <div class="section-top guide-heading">
      <div><h2>认识中国的天文地标</h2><p>点下方卡片定位，点地图上的名字了解它的故事。</p></div>
      <div class="guide-share-state" role="status"><Cloud :size="15"/><span>{{ status==='shared' ? '共享地图 · 所有人可浏览' : status==='connecting' ? '正在连接共享地图' : status==='reconnecting' ? '共享连接恢复中' : '使用备用地点资料' }}</span><button v-if="status==='fallback'" aria-label="重连共享地图" @click="reconnect"><RefreshCw :size="13"/></button></div>
    </div>
    <div class="guide-layout">
      <ObservatoryMap ref="mapRef" :places="places" :selected-id="selectedId" @select="selectedId=$event" @open="openPlace"/>
    </div>
    <div class="place-list" aria-label="定位天文地标">
      <button v-for="place in places" :key="place.id" :class="{selected:selectedId===place.id}" :aria-pressed="selectedId===place.id" :aria-label="`定位${place.name}`" @click="selectPlace(place.id)"><MapPin :size="19"/><span>{{ place.name }}<small>{{ place.region }}</small></span><span class="place-action">定位</span></button>
    </div>
    <p class="small-note map-data-note">地图中的标记位于真实 WGS84 经纬度。在线地图支持平移、缩放和 3D 地形；每位访客可以独立浏览，共享相同的地标资料。</p>
    <div class="guide-ar-entry" data-reveal><button type="button" class="button primary" @click="$emit('navigate', 'ar')">进入 AR 宇宙云图</button></div>
    <ObservatoryInfoDialog :place="openedPlace" :source="openedSource" @close="openedId=null;openedSource=null"/>
  </section>
</template>

<style scoped>
.guide-ar-entry{display:flex;justify-content:center;margin-top:36px}.guide-ar-entry .button{min-height:48px;padding:14px 28px}
.guide-layout{display:block;width:100%}.guide-tip-card{display:flex;gap:16px;align-items:center;text-align:left;width:100%;padding:24px 22px;border:1px solid var(--line);border-radius:6px;background:#f8fafc;box-shadow:0 3px 0 #e5edf2;transition:transform .16s,box-shadow .16s,background .16s,border-color .16s}
.guide-tip-card>svg{flex-shrink:0;color:#789ab2}.guide-tip-card>span{flex:1}.guide-tip-card h2{font-size:14px;margin-bottom:8px;font-weight:500;color:#3f5b70}.guide-tip-card p{font-size:10px;color:#8296a7;margin:0;line-height:1.8}.guide-tip-card .tip-read-icon{color:#879ead}
.guide-tip-card:hover{background:#eef5f9;border-color:#aac3d3}.guide-tip-card:active{transform:translateY(3px);box-shadow:0 0 0 #e5edf2}.guide-tip-card:focus-visible,.place-list button:focus-visible{outline:3px solid #497d9b;outline-offset:3px}
.guide-heading{align-items:flex-end;gap:20px}.guide-heading p{font-size:12px;color:#8599a8;line-height:1.8;margin:12px 0 0}.guide-share-state{display:flex;align-items:center;gap:8px;font-size:11px;color:#6b889b;white-space:nowrap;padding-bottom:3px}.guide-share-state button{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--line);border-radius:5px;background:#fff}
.place-list button{box-shadow:0 3px 0 #e5edf2;transition:background .16s,box-shadow .16s,transform .16s,border-color .16s}.place-list button:hover{background:#f4f8fa}.place-list button:active{transform:translateY(3px);box-shadow:0 0 0 #e5edf2}.place-list .place-action{flex:0 0 auto;font-size:10px;color:#6d899e}.map-data-note{margin-top:24px;line-height:1.9}
@media(max-width:800px){.guide-heading{align-items:flex-start;flex-direction:column;gap:14px}.guide-share-state{white-space:normal}.guide-tips{grid-template-columns:1fr;gap:14px}.guide-tip-card{padding:20px}}
@media(prefers-reduced-motion:reduce){.guide-tip-card,.place-list button{transition:none}}
</style>
