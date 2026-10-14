<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import land from '../map-data/land.json';
import { Maximize } from '@lucide/vue';
import { observatoryLabelOffsets, isObservatoryAnchorVisible } from './observatoryLabelLayout.js';

const props = defineProps({ places: Array, selectedId: String });
const emit = defineEmits(['open']);
const container = ref(null), labelShifts = ref({});
const labels = new Map();
let resizeObserver;
const view = ref({ west: 95, east: 130, south: 19, north: 46 });
const mercator = latitude => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
function project([longitude, latitude]) {
  const box = view.value;
  return [(longitude - box.west) / (box.east - box.west) * 1000,
    (mercator(box.north) - mercator(Math.max(-85, Math.min(85, latitude)))) / (mercator(box.north) - mercator(box.south)) * 520];
}
const paths = computed(() => land.features.flatMap(feature => {
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return polygons.map(polygon => polygon.map(ring => ring.map((point, index) => `${index ? 'L' : 'M'}${project(point).map(n => n.toFixed(2)).join(',')}`).join(' ')+'Z').join(' '));
}));
const gridLines = computed(() => {
  const lines = [];
  for (let lon = 70; lon <= 140; lon += 5) lines.push({ path: `M${project([lon, view.value.north]).join(',')}L${project([lon, view.value.south]).join(',')}`, key: 'lon'+lon });
  for (let lat = 10; lat <= 60; lat += 5) lines.push({ path: `M${project([view.value.west, lat]).join(',')}L${project([view.value.east, lat]).join(',')}`, key: 'lat'+lat });
  return lines;
});
function position(place) {
  const [x, y] = project([place.longitude, place.latitude]);
  return { left: `${x/10}%`, top: `${y/5.2}%` };
}
function showAll() { view.value = { west: 95, east: 130, south: 19, north: 46 }; }
function focusPlace(id) {
  const place = props.places.find(place => place.id === id);
  if (place) view.value = { west: place.longitude-5, east: place.longitude+5, south: place.latitude-4, north: place.latitude+4 };
}
function layoutLabels() {
  if (!container.value) return;
  const { clientWidth: width, clientHeight: height } = container.value;
  const projected = props.places.map(place => {
    const [x, y] = project([place.longitude, place.latitude]);
    const label = labels.get(place.id);
    const point = { x: x / 1000 * width, y: y / 520 * height };
    if (label?.parentElement) label.parentElement.style.display = isObservatoryAnchorVisible(point,width,height) ? '' : 'none';
    return { place, label, point };
  });
  const offsets = observatoryLabelOffsets(projected.map(({ place, label, point }) => ({
    id: place.id, x: point.x, y: point.y - 42 - (label?.offsetHeight || 30) / 2,
    anchorX: point.x, anchorY: point.y, width: label?.offsetWidth || 90, height: label?.offsetHeight || 30,
  })), width, 8, height);
  labelShifts.value = Object.fromEntries(offsets);
}
function openPlace(id) { emit('open', id, labels.get(id)); }
watch([view, () => props.places], async () => { await nextTick(); layoutLabels(); }, { deep: true });
onMounted(() => { layoutLabels(); resizeObserver = new ResizeObserver(layoutLabels); resizeObserver.observe(container.value); });
onBeforeUnmount(() => resizeObserver?.disconnect());
defineExpose({ focusPlace, showAll });
</script>

<template>
  <div ref="container" class="fallback-geography" aria-label="备用地理图，按真实经纬度显示观测站">
    <svg class="fallback-basemap" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
      <path v-for="(path,index) in paths" :key="index" :d="path" fill-rule="evenodd" class="land"/>
      <path v-for="line in gridLines" :key="line.key" :d="line.path" class="grid"/>
    </svg>
    <button class="fallback-all" @click="showAll"><Maximize :size="14"/>全部地标</button>
    <button v-for="place in places" :key="place.id" class="fallback-place" :class="{'is-selected':selectedId===place.id}" :style="{...position(place),'--label-shift':`${labelShifts[place.id]||0}px`}" :aria-label="`打开${place.name}的资料卡片`" @click="openPlace(place.id)">
      <svg class="fallback-connector" viewBox="0 0 30 34" aria-hidden="true"><path v-if="Math.abs(labelShifts[place.id]||0)>1" :d="`M15,0 L${15+(labelShifts[place.id]||0)},-8`"/></svg>
      <span class="fallback-pin" aria-hidden="true">●</span>
      <span :ref="element=>element ? labels.set(place.id,element) : labels.delete(place.id)" class="fallback-label">{{ place.name }}</span>
    </button>
    <div class="fallback-credit">备用地理图 · 真实 WGS84 地点 · Natural Earth 陆地轮廓</div>
  </div>
</template>

<style scoped>
.fallback-geography{position:absolute;inset:0;overflow:hidden;background:#e3eff4;color:#355263}
.fallback-basemap{display:block;width:100%;height:100%}.land{fill:#ecf1e6;stroke:#b2c5b4;stroke-width:1;vector-effect:non-scaling-stroke}.grid{fill:none;stroke:#c9dce3;stroke-width:.5;vector-effect:non-scaling-stroke}
.fallback-place{position:absolute;width:30px;height:34px;transform:translate(-50%,-100%);padding:0;color:#3d708b;transition:color .2s;white-space:nowrap;background:transparent;border:0;overflow:visible;z-index:1}
.fallback-label{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(calc(-50% + var(--label-shift,0px)));padding:7px 10px;border:1px solid #d6e1e7;border-radius:4px;background:#ffffffef;box-shadow:0 3px 12px #1b3a501a;font-size:11px;color:#385265;z-index:2}
.fallback-pin{position:relative;z-index:1;display:grid;place-items:center;width:30px;height:34px;color:#fff;background:#386781;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 10px #18334138;font-size:13px;text-shadow:none}
.fallback-connector{position:absolute;inset:0;width:30px;height:34px;overflow:visible;pointer-events:none}.fallback-connector path{fill:none;stroke:#58798b;stroke-width:1}
.fallback-place.is-selected{z-index:2}.fallback-place.is-selected .fallback-label{border-color:#cf9251;color:#685034}.fallback-place.is-selected .fallback-pin{background:#cf9251;box-shadow:0 0 0 6px #eec8954d,0 3px 12px #20364630}.fallback-place:hover .fallback-label{background:#f0f7fa}
.fallback-all{position:absolute;top:18px;left:18px;display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #cbd9e0;border-radius:5px;padding:10px 14px;font-size:11px}
.fallback-credit{position:absolute;bottom:12px;right:12px;background:#ffffffdf;padding:7px 10px;border-radius:4px;font-size:10px}.fallback-place:focus-visible,.fallback-all:focus-visible{outline:3px solid #497d9b;outline-offset:3px}
.fallback-place:active .fallback-label{filter:brightness(.92);box-shadow:inset 0 2px 3px #28465920;}
</style>
