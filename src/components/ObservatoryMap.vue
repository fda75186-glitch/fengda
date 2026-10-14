<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Layers, MapPin, Maximize, RefreshCw, WifiOff } from '@lucide/vue';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { createObservatoryMapStyle, observatoryBounds } from '../observatories.js';
import { mapApiBase } from '../useObservatories.js';
import OfflineObservatoryMap from './OfflineObservatoryMap.vue';
import { observatoryLabelOffsets, isObservatoryAnchorVisible } from './observatoryLabelLayout.js';

const props = defineProps({ places: { type: Array, required: true }, selectedId: { type: String, required: true } });
const emit = defineEmits(['select', 'open']);
const fallbackRef = ref(null);
const mapElement = ref(null), state = ref('loading'), is3d = ref(true), terrainIssue = ref(false), mapIssue = ref(false), terrainLoaded = ref(false), baseLoading = ref(true);
const message = ref('正在加载真实地理底图与高程数据…');
const selected = computed(() => props.places.find(p => p.id === props.selectedId) || props.places[0]);
let map, library, markers = [], loadTimer, terrainTimer, resizeObserver, layoutFrame, generation = 0, disposed = false, styleInitialized = false;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function markActive() {
  markers.forEach(({ id, element }) => {
    element.classList.toggle('is-selected', id === props.selectedId);
    element.setAttribute('aria-pressed', String(id === props.selectedId));
  });
}
function stopMotion() {
  map?.stop();
  cancelAnimationFrame(layoutFrame); layoutFrame = undefined;
  layoutMarkers();
}
function layoutMarkers() {
  layoutFrame = undefined;
  if (!map || !mapElement.value) return;
  const width = mapElement.value.clientWidth, height = mapElement.value.clientHeight;
  const projected = markers.map(entry => ({ ...entry, point: map.project(entry.marker.getLngLat()) }));
  projected.forEach(({ element, point }) => { element.style.display = isObservatoryAnchorVisible(point, width, height) ? '' : 'none'; });
  const offsets = observatoryLabelOffsets(projected.map(({ id, point, label }) => ({
    id, x: point.x, y: point.y - 42 - label.offsetHeight / 2, anchorX: point.x, anchorY: point.y,
    width: label.offsetWidth, height: label.offsetHeight,
  })), width, 8, height);
  markers.forEach(({ id, element, connector }) => {
    if (!offsets.has(id)) { element.style.display = 'none'; connector.style.visibility = 'hidden'; return; }
    const offset = offsets.get(id) || 0;
    element.style.setProperty('--label-shift', `${offset}px`);
    connector.setAttribute('d', `M15,0 L${15 + offset},-8`);
    connector.style.visibility = Math.abs(offset) > 1 ? 'visible' : 'hidden';
  });
}
function scheduleMarkerLayout() {
  if (layoutFrame === undefined) layoutFrame = requestAnimationFrame(layoutMarkers);
}
function openFallback(id, label) { stopMotion(); emit('select', id); emit('open', id, label); }
function focusPlace(id = props.selectedId) {
  const place = props.places.find(p => p.id === id);
  fallbackRef.value?.focusPlace(id);
  if (!place || !map) return;
  map.stop();
  map.flyTo({ center: [place.longitude, place.latitude], zoom: place.zoom, pitch: is3d.value ? 58 : 0, bearing: -16, duration: reducedMotion() ? 0 : 1700 });
  markActive();
}
function showAll() {
  fallbackRef.value?.showAll();
  if (!map) return;
  map.fitBounds(observatoryBounds(props.places), { padding: { top: 100, bottom: 80, left: 70, right: 70 }, pitch: 0, bearing: 0, duration: reducedMotion() ? 0 : 1300 });
}
function toggleDimension() {
  if (!map || terrainIssue.value) return;
  is3d.value = !is3d.value;
  map.setTerrain(is3d.value ? { source: 'terrain', exaggeration: 1 } : null);
  map.easeTo({ pitch: is3d.value ? 58 : 0, duration: reducedMotion() ? 0 : 800 });
}
function destroyMap() {
  clearTimeout(loadTimer);
  clearTimeout(terrainTimer);
  cancelAnimationFrame(layoutFrame); layoutFrame = undefined;
  resizeObserver?.disconnect();
  markers.forEach(({ marker }) => marker.remove());
  markers = [];
  map?.remove();
  map = undefined;
  styleInitialized = false;
}
function useFlatTerrain() {
  if (!map || !styleInitialized) return;
  map.setTerrain(null);
  map.easeTo({ pitch: 0, duration: 0 });
}
function makeMarkers() {
  props.places.forEach(place => {
    const element = document.createElement('button');
    element.type = 'button'; element.className = 'observatory-marker'; element.dataset.place = place.id;
    element.setAttribute('aria-label', `打开${place.name}的资料卡片`);
    const pin = document.createElement('span'); pin.className = 'observatory-pin'; pin.textContent = '●';
    const label = document.createElement('span'); label.className = 'observatory-label'; label.textContent = place.name;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    line.classList.add('observatory-connector'); line.setAttribute('viewBox', '0 0 30 34'); line.setAttribute('aria-hidden', 'true');
    const connector = document.createElementNS('http://www.w3.org/2000/svg', 'path'); line.append(connector);
    element.append(line, pin, label);
    element.addEventListener('click', () => { stopMotion(); emit('select', place.id); emit('open', place.id, label); });
    const marker = new library.Marker({ element, anchor: 'bottom', pitchAlignment: 'viewport' })
      .setLngLat([place.longitude, place.latitude]).addTo(map);
    markers.push({ id: place.id, element, marker, label, connector });
  });
  markActive();
  scheduleMarkerLayout();
}
async function initialize() {
  const attempt = ++generation;
  destroyMap();
  terrainIssue.value = false; mapIssue.value = false; is3d.value = true; terrainLoaded.value = false; baseLoading.value = true;
  if (!navigator.onLine) { state.value = 'offline'; message.value = '当前处于离线状态，联网后可以加载地图。地标介绍与坐标仍可查看。'; return; }
  state.value = 'loading'; message.value = '正在加载真实地理底图与高程数据…';
  try {
    library ||= await import('maplibre-gl');
    if (disposed || attempt !== generation) return;
    // v6 ships its worker separately. Vite must bundle it explicitly.
    library.setWorkerUrl(workerUrl);
    map = new library.Map({ container: mapElement.value, style: createObservatoryMapStyle(mapApiBase),
      center: [112, 34], zoom: 4.4,
      pitch: 0, bearing: 0, maxPitch: 75, maxZoom: 18, minZoom: 3, maxBounds: [[70,10],[140,60]],
      attributionControl: false, cooperativeGestures: true, renderWorldCopies: false,
      locale: { 'CooperativeGesturesHandler.WindowsHelpText': '按住 Ctrl 并滚动以缩放地图',
        'CooperativeGesturesHandler.MacHelpText': '按住 ⌘ 并滚动以缩放地图',
        'CooperativeGesturesHandler.MobileHelpText': '用两根手指移动地图',
        'NavigationControl.ZoomIn': '放大', 'NavigationControl.ZoomOut': '缩小', 'NavigationControl.ResetBearing': '恢复朝北' },
    });
    map.addControl(new library.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new library.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');
    map.addControl(new library.AttributionControl({ compact: true }), 'bottom-right');
    makeMarkers();
    map.on('move', scheduleMarkerLayout); map.on('resize', scheduleMarkerLayout);
    showAll();
    resizeObserver = new ResizeObserver(() => map?.resize()); resizeObserver.observe(mapElement.value);
    map.on('style.load', () => { styleInitialized = true; if (terrainIssue.value) useFlatTerrain(); });
    map.on('sourcedata', event => {
      // A style 'load' event alone does not prove that an imagery tile loaded.
      if (event.sourceId === 'osm' && event.tile?.state === 'loaded') {
        if (navigator.onLine) state.value = 'ready';
        clearTimeout(loadTimer);
      }
      if (event.sourceId === 'osm') baseLoading.value = !event.isSourceLoaded;
      if (event.sourceId === 'terrain' && event.tile?.state === 'loaded') { terrainLoaded.value = true; clearTimeout(terrainTimer); }
    });
    map.on('sourcedataloading', event => { if (event.sourceId === 'osm') baseLoading.value = true; });
    map.on('error', event => {
      const source = event.sourceId || event.error?.sourceId;
      const text = event.error?.message || '';
      if (source === 'terrain' || source === 'hillshade' || /mapterhorn|\/map\/terrain\//i.test(text)) {
        terrainIssue.value = true; is3d.value = false;
        useFlatTerrain();
      } else { mapIssue.value = true; }
    });
    loadTimer = setTimeout(() => {
      if (state.value !== 'ready') { state.value = 'error'; message.value = '底图未能加载。请检查网络后重试，或通过下方链接打开地图。'; }
    }, 18000);
    terrainTimer = setTimeout(() => {
      if (!terrainLoaded.value) { terrainIssue.value = true; is3d.value = false; useFlatTerrain(); }
    }, 25000);
  } catch {
    if (disposed || attempt !== generation) return;
    state.value = 'error'; message.value = '当前浏览器未能初始化立体地图，请重试或在外部地图中查看。';
  }
}
function onOffline() { clearTimeout(loadTimer); clearTimeout(terrainTimer); map?.stop(); state.value = 'offline'; message.value = '网络已断开，地图可能不完整。地标资料与坐标仍可查看。'; }
function onOnline() { if (state.value === 'offline') initialize(); }
watch(() => props.selectedId, markActive);
watch(() => props.places, () => {
  if (!map) return;
  markers.forEach(({ marker }) => marker.remove()); markers = []; makeMarkers();
});
onMounted(() => { initialize(); window.addEventListener('offline', onOffline); window.addEventListener('online', onOnline); });
onBeforeUnmount(() => { disposed = true; generation++; destroyMap(); window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); });
defineExpose({ focusPlace, stopMotion });
</script>

<template>
  <div class="terrain-map" :aria-busy="state==='loading'">
    <div ref="mapElement" class="terrain-map-canvas" role="region" aria-label="天文地标真实地理地图，可缩放、旋转、倾斜"/>
    <div v-if="state==='ready'" class="terrain-toolbar" aria-label="地图视图控制">
      <button :disabled="state!=='ready'" @click="showAll"><Maximize :size="14"/>全部地标</button>
      <button :disabled="state!=='ready'" @click="focusPlace()"><MapPin :size="14"/>定位此处</button>
      <button :disabled="state!=='ready'||terrainIssue" :aria-pressed="is3d&&!terrainIssue" @click="toggleDimension"><Layers :size="14"/>{{ is3d&&!terrainIssue ? '3D 地形' : '2D 地图' }}</button>
    </div>
    <template v-if="state!=='ready'">
      <OfflineObservatoryMap ref="fallbackRef" :places="places" :selected-id="selectedId" @open="openFallback"/>
      <div class="fallback-status" role="status">
        <WifiOff v-if="state==='offline'" :size="15"/><MapPin v-else :size="15"/>
        <span>{{ state==='loading' ? '在线底图加载中，地标可以先点开查看' : '在线底图暂不可用，已显示备用地理图' }}</span>
        <button v-if="state!=='loading'" @click="initialize"><RefreshCw :size="13"/>重试在线地图</button>
      </div>
    </template>
    <div v-if="state==='ready'" class="terrain-station-hint">点击地图上的观测站名称，打开资料卡</div>
    <div v-if="state==='ready'&&(terrainIssue||mapIssue||(is3d&&!terrainLoaded)||baseLoading)" class="terrain-warning" role="status">
      <span>{{ terrainIssue ? '高程数据暂不可用，当前显示真实二维底图。' : mapIssue ? '部分地图瓦片未加载，当前视图可能不完整。' : (is3d&&!terrainLoaded) ? '真实高程数据正在加载…' : '正在加载当前视野的地图瓦片…' }}</span>
      <button v-if="terrainIssue||mapIssue" @click="initialize">重试 <RefreshCw :size="12"/></button>
    </div>
    <div v-if="state==='ready'" class="terrain-help">拖动平移 · 右键拖动旋转与倾斜 · 按住 Ctrl 滚轮缩放</div>
  </div>
</template>

<style scoped>
.terrain-map { position: relative; min-width: 0; width:100%; height: 610px; border: 1px solid #dbe4e8; border-radius: 8px; overflow: hidden; background: #edf2ef; isolation: isolate; }
.fallback-status{position:absolute;z-index:3;bottom:44px;left:18px;right:18px;display:flex;align-items:center;gap:9px;flex-wrap:wrap;width:max-content;max-width:calc(100% - 36px);padding:10px 14px;background:#fffffff0;border:1px solid #d5e0e7;border-radius:5px;color:#5a7485;font-size:11px}
.fallback-status button{display:flex;gap:6px;align-items:center;margin-left:8px;color:#3f687e}.terrain-station-hint{position:absolute;z-index:2;top:21px;right:66px;padding:10px 14px;background:#fffffff0;border-radius:5px;font-size:11px;color:#5f7b8d;pointer-events:none}
.terrain-map-canvas { width: 100%; height: 100%; }
.terrain-toolbar { position: absolute; top: 18px; left: 18px; right: 60px; display: flex; flex-wrap: wrap; gap: 7px; z-index: 2; pointer-events: none; }
.terrain-toolbar button { display: inline-flex; align-items: center; gap: 7px; padding: 10px 13px; border: 1px solid #dbe4e8; border-radius: 5px; background: #fffffff5; color: #355163; font-size: 10px; box-shadow: 0 2px 7px #253d4b12; pointer-events: auto; }
.terrain-toolbar button:disabled { opacity: .5; cursor: default; }
.terrain-toolbar button[aria-pressed=true] { background: #2b4d61; color: white; border-color: #2b4d61; }
.terrain-toolbar button:hover:not(:disabled), .terrain-warning button:hover { background: #dfeef2; color: #26495e; }
.terrain-toolbar button:active:not(:disabled) { transform: translateY(1px); }
.terrain-map button:focus-visible, .terrain-map a:focus-visible { outline: 3px solid #497d9b; outline-offset: 3px; }
.terrain-state { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; padding: 30px; background: #f1f5f3f5; }
.terrain-state > div { text-align: center; max-width: 350px; color: #5a7382; }
.terrain-state svg { margin: 0 auto 20px; }
.terrain-state h3 { font-size: 20px; font-weight: 500; margin-bottom: 15px; color: #354d5d; }
.terrain-state p { font-size: 12px; line-height: 2; margin: 0 0 20px; }
.terrain-state .button { margin: 0 auto 20px; font-size: 11px; }
.terrain-state a { display: block; font-size: 10px; line-height: 1.8; }
.terrain-warning { position: absolute; left: 18px; right: 18px; top: 70px; z-index: 2; border-radius: 5px; background: #fff9e9f5; color: #7a643d; padding: 10px 13px; font-size: 10px; display: flex; gap: 10px; justify-content: space-between; align-items: center; }
.terrain-warning button { display: flex; gap: 6px; align-items: center; white-space: nowrap; padding: 5px; }
.terrain-help { position: absolute; bottom: 43px; left: 18px; right: 18px; width: max-content; max-width: calc(100% - 36px); color: #4a6574; background: #ffffffe8; padding: 9px 13px; border-radius: 4px; font-size: 9px; pointer-events: none; }
.terrain-map :deep(.maplibregl-ctrl-top-right) { top: 6px; right: 6px; }
.terrain-map :deep(.maplibregl-ctrl-group) { border: 1px solid #d5e0e6; box-shadow: 0 2px 7px #29465a14; border-radius: 5px; }
.terrain-map :deep(.maplibregl-ctrl-group button) { width: 34px; height: 34px; }
.terrain-map :deep(.maplibregl-ctrl-scale) { font-size: 10px; border-color: #63808b; color: #41616e; background: #ffffffe8; }
.terrain-map :deep(.maplibregl-ctrl-attrib) { font-size: 9px; color: #354b5c; }
.terrain-map :deep(.observatory-marker) { position: absolute; width: 30px; height: 34px; padding: 0; z-index: 1; background: transparent; border: 0; overflow: visible; }
.terrain-map :deep(.observatory-pin) { position: relative; z-index: 1; display: grid; place-items: center; width: 30px; height: 34px; color: #fff; background: #386781; border: 2px solid white; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 2px 10px #18334138; font-size: 13px; text-shadow: none; }
.terrain-map :deep(.observatory-label) { position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(calc(-50% + var(--label-shift, 0px))); display: block; padding: 7px 10px; background: #ffffffef; border: 1px solid #d6e1e7; border-radius: 4px; font-size: 11px; color: #385265; white-space: nowrap; box-shadow: 0 3px 12px #1b3a501a; z-index: 2; }
.terrain-map :deep(.observatory-connector) { position: absolute; inset: 0; width: 30px; height: 34px; overflow: visible; pointer-events: none; }
.terrain-map :deep(.observatory-connector path) { fill: none; stroke: #58798b; stroke-width: 1; }
.terrain-map :deep(.observatory-marker.is-selected) { z-index: 2; }
.terrain-map :deep(.observatory-marker.is-selected .observatory-pin) { background: #cf9251; box-shadow: 0 0 0 6px #eec8954d, 0 3px 12px #20364630; }
.terrain-map :deep(.observatory-marker.is-selected .observatory-label) { border-color: #cf9251; color: #685034; }
.terrain-map :deep(.observatory-marker:hover .observatory-label) { background: #f0f7fa; }
.terrain-map :deep(.observatory-marker:focus-visible .observatory-label){outline:3px solid #497d9b;outline-offset:3px}
@media(max-width:900px){.terrain-station-hint{display:none}}
@media(max-width:1100px) { .terrain-map { height: 580px; } .terrain-toolbar { left: 12px; } .terrain-toolbar button { padding: 9px; gap: 5px; font-size: 9px; } }
@media(max-width:800px) { .terrain-map { height: 500px; } }
@media(max-width:480px) { .terrain-map { height: 440px; } .terrain-toolbar { top: 13px; gap: 5px; } .terrain-toolbar button { padding: 8px; font-size: 9px; } .terrain-help { left: 12px; bottom: 42px; font-size: 8px; max-width: calc(100% - 24px); width: auto; line-height: 1.7; } .terrain-warning { top: 106px; left: 12px; right: 12px; line-height: 1.8; } .terrain-state { padding: 25px; } .terrain-state h3 { font-size: 17px; } }
.terrain-map :deep(.observatory-marker:active .observatory-label){filter:brightness(.92);box-shadow:inset 0 2px 3px #28465920;}
</style>
