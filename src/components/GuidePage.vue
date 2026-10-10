<script setup>
import { computed, ref } from 'vue';
import { Telescope, MapPin, ArrowUpRight, Moon, Backpack, ExternalLink } from '@lucide/vue';
import { articles } from '../knowledge.js';
import { observatories, formatCoordinates } from '../observatories.js';
import ObservatoryMap from './ObservatoryMap.vue';
defineEmits(['open']);
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
    <div class="guide-tips">
      <article><Moon :size="25"/><span><h2>从月亮开始</h2><p>观察月相，记录几天的变化。</p></span><button class="icon-button" aria-label="阅读月相指南" @click="$emit('open',articles.find(a=>a.id==='moon'))"><ArrowUpRight :size="20"/></button></article>
      <article><Telescope :size="25"/><span><h2>先抬头，再买设备</h2><p>认识方位，找一片远离强光的天空。</p></span></article>
      <article><Backpack :size="25"/><span><h2>做好夜间准备</h2><p>保暖、结伴，提前查看当地天气。</p></span></article>
    </div>
    <div class="section-top guide-heading"><h2>认识中国的天文地标</h2><span class="small-note">真实地理底图 · 3D 地形 · 4 个精选地点</span></div>
    <div class="guide-layout">
      <ObservatoryMap ref="mapRef" :places="observatories" :selected-id="selectedId" @select="selectedId=$event"/>
      <aside class="observatory-detail" aria-live="polite">
        <span class="category-label">{{ selected.type }}</span><Telescope :size="40" :stroke-width="1"/>
        <h2>{{ selected.name }}</h2><span class="place-region"><MapPin :size="14"/>{{ selected.region }}</span>
        <p>{{ selected.intro }}</p>
        <div class="observatory-coordinates"><span>WGS84 经纬度</span><strong>{{ formatCoordinates(selected) }}</strong><small>{{ selected.coordinateNote }}</small></div>
        <button class="button secondary locate-place" @click="mapRef?.focusPlace(selected.id)">在地图中定位 <MapPin :size="16"/></button>
        <a class="source-link coordinate-source" :href="selected.sourceUrl" target="_blank" rel="noopener noreferrer">{{ selected.sourceLabel }} <ExternalLink :size="12"/></a>
        <a class="button secondary" :href="selected.url" target="_blank" rel="noopener noreferrer">访问官方信息 <ExternalLink :size="16"/></a>
        <div class="small-note">{{ selected.visitNote }}</div>
      </aside>
    </div>
    <div class="place-list" aria-label="选择天文地标">
      <button v-for="place in observatories" :key="place.id" :class="{selected:selectedId===place.id}" :aria-pressed="selectedId===place.id" @click="selectPlace(place.id)"><MapPin :size="17"/><span>{{ place.name }}<small>{{ place.region }}</small></span><ArrowUpRight :size="17"/></button>
    </div>
    <p class="small-note map-data-note">地标位置依据公开 WGS84 地理数据。地图支持缩放、旋转与倾斜，山地使用真实高程；场馆附近的平坦地形会如实呈现。</p>
  </section>
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
