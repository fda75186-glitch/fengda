<script setup>
import { computed, ref, nextTick, watch, onMounted } from 'vue';
import { Telescope, MapPin, ArrowUpRight, Moon, Backpack, ExternalLink, X } from '@lucide/vue';
import { observatoryHistory } from '../observatoryHistory.js';
import { articles } from '../knowledge.js';
import { observatories, formatCoordinates } from '../observatories.js';
import ObservatoryMap from './ObservatoryMap.vue';
const emit=defineEmits(['open','consumed']);const props=defineProps({requestedPlace:String});const historyDialog=ref(null),tipDialog=ref(null),tip=ref('');const history=computed(()=>observatoryHistory[selectedId.value]);
async function showHistory(id){selectedId.value=id;mapRef.value?.focusPlace(id);await nextTick();if(!historyDialog.value.open)historyDialog.value.showModal()}
function showTip(value){tip.value=value;tipDialog.value.showModal()}
watch(()=>props.requestedPlace,id=>{if(id){showHistory(id);emit('consumed')}});onMounted(()=>{if(props.requestedPlace){showHistory(props.requestedPlace);emit('consumed')}});
const selectedId = ref(observatories[0].id);
const selected = computed(() => observatories.find(place => place.id === selectedId.value) || observatories[0]);
const mapRef = ref(null);
function selectPlace(id) {
  selectedId.value = id;
  mapRef.value?.focusPlace(id);
}
</script>
<template>
  <section class="page-shell guide-page">
    <div class="eyebrow">THE BEST VIEW IS THE ONE YOU LOOK UP TO</div>
    <h1>下一站，去看星星<span class="heading-dot">.</span></h1>
    <p class="page-description">从一场科普之旅，到第一次夜空观察。</p>
    <div class="guide-tips"><button class="guide-tip-button" @click="emit('open',articles.find(a=>a.id==='moon'))"><Moon :size="27"/><span><h2>从月亮开始</h2><p>观察月相，记录几天的变化。</p></span></button><button class="guide-tip-button" @click="showTip('equipment')"><Telescope :size="27"/><span><h2>先抬头，再买设备</h2><p>从肉眼到望远镜，了解怎么开始。</p></span></button><button class="guide-tip-button" @click="showTip('prepare')"><Backpack :size="27"/><span><h2>做好夜间准备</h2><p>打开观星准备清单。</p></span></button></div>
    <div class="section-top guide-heading"><h2>认识中国的天文地标</h2><span class="small-note">点击地标，阅读它的发展历史</span></div>
    <div class="guide-layout">
      <ObservatoryMap ref="mapRef" :places="observatories" :selected-id="selectedId" @select="showHistory($event)"/>
      <aside class="observatory-detail" aria-live="polite">
        <span class="category-label">{{ selected.type }}</span><Telescope :size="40" :stroke-width="1"/>
        <h2>{{ selected.name }}</h2><span class="place-region"><MapPin :size="14"/>{{ selected.region }}</span>
        <p>{{ selected.intro }}</p>
        <div class="observatory-coordinates"><span>WGS84 经纬度</span><strong>{{ formatCoordinates(selected) }}</strong><small>{{ selected.coordinateNote }}</small></div>
        <button class="button primary" @click="showHistory(selected.id)">阅读历史与科普</button><button class="button secondary locate-place" @click="mapRef?.focusPlace(selected.id)">在地图中定位 <MapPin :size="16"/></button>
        <a class="source-link coordinate-source" :href="selected.sourceUrl" target="_blank" rel="noopener noreferrer">{{ selected.sourceLabel }} </a>
        <a class="button secondary" :href="selected.url" target="_blank" rel="noopener noreferrer">访问官方信息 </a>
        <div class="small-note">{{ selected.visitNote }}</div>
      </aside>
    </div>
    <div class="place-list" aria-label="选择天文地标">
      <button v-for="place in observatories" :key="place.id" :class="{selected:selectedId===place.id}" :aria-pressed="selectedId===place.id" @click="showHistory(place.id)"><MapPin :size="17"/><span>{{ place.name }}<small>{{ place.region }}</small></span></button>
    </div>
    <p class="small-note map-data-note">地标使用真实 WGS84 坐标。立体底图与高程需要网络；资源不可用时自动显示随网站打包的地理概览，地标科普仍可使用。</p>
<dialog ref="historyDialog" class="observatory-history-dialog"><header><div><span class="category-label">{{selected.type}} · {{selected.region}}</span><h2>{{selected.name}}</h2></div><button class="icon-button" aria-label="关闭天文地标介绍" @click="historyDialog.close()"><X :size="22"/></button></header><p>{{history.lead}}</p><span class="small-note">{{formatCoordinates(selected)}}</span><h3>它的故事，沿时间展开。</h3><ol class="history-timeline"><li v-for="item in history.timeline"><strong>{{item[0]}}</strong><p>{{item[1]}}</p></li></ol><h3>带走一点天文知识</h3><div class="history-facts"><div v-for="f in history.facts"><h3>{{f[0]}}</h3><p>{{f[1]}}</p></div></div><p>{{selected.visitNote}}</p><div class="history-sources"><a class="button secondary" :href="history.source" target="_blank" rel="noopener noreferrer">资料来源：{{history.sourceName}}</a><a class="button secondary" :href="selected.url" target="_blank" rel="noopener noreferrer">场馆官方网站</a></div></dialog><dialog ref="tipDialog" class="observatory-history-dialog"><header><h2>{{tip==='equipment'?'第一次观星，从熟悉天空开始':'夜间观星准备清单'}}</h2><button class="icon-button" aria-label="关闭观星建议" @click="tipDialog.close()"><X :size="22"/></button></header><template v-if="tip==='equipment'"><p>先在安全、开阔且远离强光的位置，用肉眼认识月亮和明亮的星点。固定时间连续观察，比一开始购买复杂设备更容易建立方向感。</p><p>想用望远镜时，可以先参加天文馆或社团的公开观测活动，了解视场、放大倍数和支架的区别，再选择适合自己的设备。</p><p>观测太阳需要专门的安全设备。不要用普通望远镜、双筒镜或肉眼直视太阳。</p></template><template v-else><p>出门前：查看当地天气，确认地点开放情况；找熟悉、安全的观测地点，并与同伴约好返程时间。</p><p>随身带：保暖衣物、饮水、充电设备、记录本。红色低亮度照明可以减少对暗适应的影响。</p><p>到现场：避开车道、悬崖等危险区域；把屏幕调暗，不用强光照射其他观测者；不留下垃圾。</p></template></dialog>  </section>
</template>
<style scoped>
.guide-layout { grid-template-columns: minmax(0, 1fr) 320px; align-items: stretch; }
.observatory-detail { display: flex; flex-direction: column; padding: 28px 25px; }
.observatory-detail > svg { margin: 24px 0 20px; }
.observatory-detail > p { margin: 20px 0; }
.observatory-detail .button { margin-bottom: 16px; justify-content: center; width: 100%; }
.observatory-coordinates { padding: 16px 0; border-top: 1px solid #dfe7ec; border-bottom: 1px solid #dfe7ec; margin-bottom: 20px; }
.observatory-coordinates > span { display: block; font-size: 10px; letter-spacing: .5px; color: #758b9a; margin-bottom: 9px; }
.observatory-coordinates > strong { display: block; font-size: 12px; font-weight: 500; color: #284b61; font-variant-numeric: tabular-nums; }
.observatory-coordinates > small { display: block; color: #6e8291; font-size: 10px; line-height: 1.8; margin-top: 9px; }
.coordinate-source { font-size: 10px; margin: 0 0 24px; justify-content: center; }
.observatory-detail > .small-note { line-height: 1.9; margin-top: auto; }
.map-data-note { margin-top: 24px; line-height: 1.9; }
@media(max-width:1100px) { .guide-layout { grid-template-columns: minmax(0, 1fr) 275px; } }
@media(max-width:800px) {
  .guide-layout { grid-template-columns: minmax(0, 1fr); }
  .observatory-detail { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; }
  .observatory-detail > .category-label, .observatory-detail > p, .observatory-coordinates { grid-column: 1/-1; }
  .observatory-detail > svg { display: none; }
  .observatory-detail > h2 { margin-bottom: 0; }
  .coordinate-source { grid-column: 1/-1; justify-self: start; margin: 0; }
  .observatory-detail > .small-note { grid-column: 1/-1; }
  .observatory-coordinates { margin: 0; }
  .observatory-detail .locate-place { grid-column: 1/-1; width: max-content; margin: 0; }
}
@media(max-width:480px) { .observatory-detail { grid-template-columns: 1fr; gap: 14px; padding: 24px; } .observatory-detail > * { grid-column: 1!important; } .observatory-detail .button { width: 100%; } }
</style>
