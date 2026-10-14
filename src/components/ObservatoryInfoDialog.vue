<script setup>
import { computed, ref } from 'vue';
import { ExternalLink, MapPin, Telescope, X } from '@lucide/vue';
import { formatCoordinates } from '../observatories.js';
import AnchoredDialog from './AnchoredDialog.vue';

const props = defineProps({ place: Object, source: Object });
const emit = defineEmits(['close']);
const dialog = ref(null);
const history = computed(() => (props.place?.history || []).map(item => {
  const match = String(item.year).match(/^(\d{4})(?:\s*[·年]?\s*(.*))?$/);
  const year = match?.[1] || String(item.year);
  const detail = (match?.[2] || '').replace(/\s+/g, '');
  const monthDay = detail.match(/^(\d{1,2})月(\d{1,2})日$/);
  return { ...item, yearLabel: year, dateLabel: detail,
    datetime: monthDay ? `${year}-${monthDay[1].padStart(2,'0')}-${monthDay[2].padStart(2,'0')}` : year };
}));
function close() { dialog.value?.requestClose(); }
</script>

<template>
  <AnchoredDialog ref="dialog" :open="Boolean(place)" :source="source" panel-class="observatory-info-panel" labelledby="observatory-info-title" @close="emit('close')">
    <article v-if="place" class="station-card">
      <button class="station-close" aria-label="关闭观测站资料" autofocus @click="close"><X :size="22"/></button>
      <div class="station-category"><Telescope :size="23"/>{{ place.type }}</div>
      <h2 id="observatory-info-title">{{ place.name }}</h2>
      <p class="station-region"><MapPin :size="15"/>{{ place.region }}</p>
      <p class="station-intro">{{ place.intro }}</p>
      <section class="station-history"><h3>发展历程</h3><ol><li v-for="item in history" :key="item.year"><time class="station-history-date" :datetime="item.datetime"><strong>{{ item.yearLabel }}</strong><span v-if="item.dateLabel">{{ item.dateLabel }}</span></time><p>{{ item.text }}</p></li></ol></section>
      <section v-for="section in place.sections" :key="section.title" class="station-section"><h3>{{ section.title }}</h3><p>{{ section.text }}</p></section>
      <div class="station-coordinate"><span>WGS84 经纬度</span><strong>{{ formatCoordinates(place) }}</strong><p>{{ place.coordinateNote }}</p></div>
      <p class="station-visit">{{ place.visitNote }}</p>
      <a class="button secondary station-official" :href="place.url" target="_blank" rel="noopener noreferrer">访问官方信息<ExternalLink :size="15"/></a>
      <div class="station-sources"><span>资料来源</span><a v-for="source in place.sources" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }}<ExternalLink :size="12"/></a><a :href="place.sourceUrl" target="_blank" rel="noopener noreferrer">{{ place.sourceLabel }}<ExternalLink :size="12"/></a></div>
    </article>
  </AnchoredDialog>
</template>

<style scoped>
:deep(.observatory-info-panel){padding:0;border:1px solid var(--line);border-radius:12px;width:min(740px,calc(100% - 32px));background:#fff;color:#263e50}
.station-card{padding:44px 48px;position:relative}.station-close{position:absolute;top:16px;right:16px;display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--line);border-radius:6px;background:#f7fafb;color:#577487}.station-close:active{transform:translateY(2px)}
.station-category,.station-region{display:flex;align-items:center;gap:10px;color:#6c8a9e;font-size:12px}.station-card h2{font-size:30px;color:#2c4c61;margin:22px 0 14px}.station-intro{font-size:15px;line-height:1.9;margin:28px 0;color:#607c8e}
.station-card h3{font-size:16px;margin:0 0 14px;color:#34586c}.station-history{border-block:1px solid var(--line);padding:26px 0;margin-bottom:26px}.station-history ol{list-style:none;padding:0;margin:0;display:grid;gap:22px}.station-history li{display:grid;grid-template-columns:92px minmax(0,1fr);gap:24px;align-items:start}.station-history-date{display:grid;gap:5px;color:#a37c4c;font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1.65}.station-history-date strong{font-size:15px}.station-history-date span{font-size:11px;font-weight:500}.station-history p,.station-section p{font-size:13px;line-height:1.9;color:#657f90;margin:0}.station-section{margin:0 0 26px}
.station-coordinate{padding:20px;background:#f4f8fa;border-radius:6px;display:grid;gap:9px}.station-coordinate span{font-size:10px;color:#7c93a3}.station-coordinate strong{font-size:13px;font-weight:500;font-variant-numeric:tabular-nums}.station-coordinate p{font-size:11px;color:#7c93a3;margin:0}.station-visit{font-size:12px;line-height:1.8;color:#7c93a3;margin:20px 0}.station-official{font-size:12px;margin-bottom:26px}.station-sources{border-top:1px solid var(--line);padding-top:18px;display:flex;flex-wrap:wrap;gap:12px;font-size:10px;color:#7591a2}.station-sources>span{width:100%;color:#97a9b4}.station-sources a{display:flex;align-items:center;gap:5px}
@media(max-width:600px){.station-card{padding:36px 24px}.station-card h2{font-size:25px}.station-history li{grid-template-columns:80px minmax(0,1fr);gap:16px}}
</style>
