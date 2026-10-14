<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { Map, X, Rocket, Pause, Play, Volume2, VolumeX, Info, Camera, RotateCcw, ScanLine } from '@lucide/vue';
import UniverseNavigator from './UniverseNavigator.vue';
import { assetUrl } from '../assets.js';
import { journeyStops, exoplanetStop } from '../universe/catalog.js';
import { explorationFor, resolveStop, scaleIndex } from '../universe/exploration.js';
import { createFlightScene } from '../universe/flightScene.js';
import { useFlightNarration } from '../universe/useFlightNarration.js';
import { useFlightCamera } from '../universe/useFlightCamera.js';

const emit = defineEmits(['ask', 'navigate']);
const viewport = ref(null), universe = ref(null), cameraVideo = ref(null);
const current = shallowRef(journeyStops[0]), arrived = shallowRef(journeyStops[0]);
const catalog = shallowRef(null), catalogStatus = ref('loading'), markers = shallowRef([]);
const ready = ref(false), error = ref(''), mapOpen = ref(false), detailOpen = ref(true), controlsOpen = ref(false);
const view = ref('cockpit'), speed = ref(1), paused = ref(false), autoFlight = ref(false), fullscreen = ref(false), manualFlying = ref(false);
const travel = shallowRef({ active: false, progress: 0, target: '' }), telemetry = shallowRef({});
const headerBottom = ref(80), narration = useFlightNarration();
let flight, headerObserver, fetchController, autoTimer, bodyCursor = 0, disposed = false, previousOverflow;
const camera = useFlightCamera(cameraVideo, active => flight?.setCameraOverlay(active));
const levelIndex = computed(() => scaleIndex(current.value));
const branchView=computed(()=>!journeyStops.some(stop=>stop.id===current.value.id));
const parentStop=computed(()=>current.value.returnStop||resolveStop(current.value.parentId));
const interiorDestination=computed(()=>explorationFor(arrived.value,catalog.value,current.value));
const nextLevel = computed(() => journeyStops[levelIndex.value + 1]);
const arrivalTitle = computed(() => arrived.value?.name || current.value.name);
const travelTarget = computed(() => typeof travel.value.target === 'object' ? travel.value.target?.name : travel.value.target);

function stopAuto() { autoFlight.value = false; clearTimeout(autoTimer); }
function sceneFailure(message) {
  if (disposed) return; ready.value = false; stopAuto(); narration.stop();
  error.value = typeof message === 'string' ? message : '3D 场景未能启动，请启用浏览器硬件加速后重试。';
}
function manualMotion() { stopAuto(); manualFlying.value = true; narration.stop(); travel.value = { ...travel.value, active: false }; }
function moveShip(direction) { clearMotionState(); manualMotion(); flight?.move(direction); }
function flightKey(event) {
  if (event.key === ' ' && !event.repeat) paused.value = !paused.value;
  else if (['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright'].includes(event.key.toLowerCase())) manualMotion();
}
function clearMotionState() { clearTimeout(autoTimer); narration.stop(); paused.value = false; flight?.setPaused(false); }
function selectStop(stop, automatic = false) {
  if (!automatic) stopAuto(); clearMotionState(); arrived.value = stop;
  markers.value = []; bodyCursor = 0; Promise.resolve(flight?.setStop(stop)).catch(sceneFailure); if (window.innerWidth < 850) mapOpen.value = false;
}
function selectSystem(system) { selectStop(exoplanetStop(system)); }
function enterSystem(name) { const system = catalog.value?.systems.find(item => item.name === name); if (system) selectSystem(system); }
function enterScale(id) { const stop = resolveStop(id); if (stop) selectStop(stop); }
function enterBody(body){const destination=explorationFor(body,catalog.value,current.value);if(destination)selectStop(destination);}
function enterMarker(id){enterBody(current.value.bodies.find(body=>body.id===id));}
function flyTo(id, automatic = false) {
  if (!automatic) stopAuto(); clearMotionState();
  const destination = current.value.bodies.find(body => body.id === id); if (destination) {arrived.value = destination; detailOpen.value=true;}
  flight?.travelTo(id);
  if (window.innerWidth < 850) mapOpen.value = false;
}
function continueAuto() {
  if (!autoFlight.value || disposed) return;
  if (mapOpen.value || paused.value || narration.speaking.value) { autoTimer = setTimeout(continueAuto, 800); return; }
  const body = current.value.bodies[bodyCursor++];
  if (body) flyTo(body.id, true);
  else if (nextLevel.value) selectStop(nextLevel.value, true);
  else stopAuto();
}
function onArrival(item) {
  if (disposed) return;
  manualFlying.value = false; arrived.value = item; detailOpen.value = true; narration.arrive(item);
  if (autoFlight.value) { clearTimeout(autoTimer); autoTimer = setTimeout(continueAuto, 5500); }
}
function startJourney() {
  if (autoFlight.value) { stopAuto(); return; }
  autoFlight.value = true; bodyCursor = 0;
  if (current.value.id === 'earth-launch') {
    selectStop(journeyStops[1], true);
  }
  else continueAuto();
}
function togglePause() { paused.value = !paused.value; flight?.setPaused(paused.value); }
function changeView() { view.value = view.value === 'cockpit' ? 'chase' : 'cockpit'; flight?.setView(view.value); }
function setSpeed() { flight?.setSpeed(Number(speed.value)); }
function closeMap(){mapOpen.value=false;flight?.setPaused(paused.value);}
function toggleMap() { if(mapOpen.value){closeMap();return;} mapOpen.value=true;flight?.setPaused(true);if(window.innerWidth<850)detailOpen.value=false; }
function mapJump({stop,bodyId}){
  stopAuto();clearMotionState();closeMap();
  arrived.value=bodyId ? stop.bodies.find(body=>body.id===bodyId)||stop : stop;
  if(stop.id===current.value.id&&bodyId)flight?.travelTo(bodyId,{quick:true});
  else Promise.resolve(flight?.setStop(stop,{arrivalBody:bodyId,quick:true})).catch(sceneFailure);
}
function toggleDetail() { detailOpen.value = !detailOpen.value; if (window.innerWidth < 850 && detailOpen.value) mapOpen.value = false; }
async function toggleFullscreen() {
  try { if (document.fullscreenElement === universe.value) await document.exitFullscreen(); else await universe.value.requestFullscreen(); }
  catch { error.value = '浏览器暂不支持全屏，当前窗口仍可航行。'; setTimeout(() => { if (ready.value) error.value = ''; }, 3000); }
}
function syncFullscreen() { fullscreen.value = document.fullscreenElement === universe.value; }
async function loadCatalog() {
  fetchController?.abort(); fetchController = new AbortController(); catalogStatus.value = 'loading';
  try {
    const response = await fetch(assetUrl('/universe/exoplanets.json'), { signal: fetchController.signal });
    if (!response.ok) throw new Error('Catalog unavailable');
    const data = await response.json(); if (disposed) return;
    catalog.value = data; catalogStatus.value = 'ready';
  } catch (failure) { if (!disposed && failure.name !== 'AbortError') catalogStatus.value = 'error'; }
}
function startScene() {
  flight?.dispose(); markers.value = []; error.value = ''; ready.value = false;
  try {
    flight = createFlightScene(viewport.value, {
      launchDestination: journeyStops[1],
      getLabelObstacles: () => {
        const frame=viewport.value?.getBoundingClientRect(); if(!frame)return [];
        return [...universe.value.querySelectorAll('.flight-heading, .flight-information, .flight-map-overlay, .flight-bottom, .flight-extra-controls, .flight-scale-track, .info-toggle')].map(element=>{
          const r=element.getBoundingClientRect(); return {left:r.left-frame.left,right:r.right-frame.left,top:r.top-frame.top,bottom:r.bottom-frame.top};
        });
      },
      onReady: () => { ready.value = true; }, onArrival, onExplore:enterBody,
      onStopChanged: stop => { current.value = stop; markers.value = []; bodyCursor = stop.id === 'earth-moon' && autoFlight.value ? Math.max(0, stop.bodies.findIndex(body => body.id === 'moon')) : 0; },
      onTravel: state => { if (state.active) { manualFlying.value = false; if (!travel.value.active) narration.stop(); } travel.value = state; },
      onTelemetry: value => { telemetry.value = value; }, onLabels: value => { markers.value = value; },
      onError: sceneFailure,
    });
    flight.setView(view.value); flight.setSpeed(Number(speed.value)); Promise.resolve(flight.setStop(current.value, { animate: false })).catch(sceneFailure);
  } catch { error.value = '3D 场景未能启动，请启用浏览器硬件加速后重试。'; }
}
onMounted(async () => {
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const header = document.querySelector('.xingyu-header');
  if (header) { const fit = () => { headerBottom.value = header.getBoundingClientRect().bottom; }; headerObserver = new ResizeObserver(fit); headerObserver.observe(header); fit(); }
  document.addEventListener('fullscreenchange', syncFullscreen); await nextTick();
  if (!disposed) { startScene(); void loadCatalog(); }
});
onBeforeUnmount(() => {
  disposed = true; stopAuto(); fetchController?.abort(); headerObserver?.disconnect(); flight?.dispose();
  document.body.style.overflow = previousOverflow; document.removeEventListener('fullscreenchange', syncFullscreen);
});
</script>

<template>
  <section ref="universe" class="universe-flight" :style="{'--flight-header':headerBottom+'px'}" aria-label="AR 宇宙飞船探索">
    <video v-if="camera.active.value" ref="cameraVideo" class="flight-camera" autoplay muted playsinline aria-label="本机相机科普叠加"/>
    <div ref="viewport" class="flight-viewport" tabindex="0" aria-label="三维宇宙视野。拖动环顾，W和S前后飞行，方向键移动；也可以使用航图和屏幕按钮。" @focus="viewport?.querySelector('canvas')?.focus({preventScroll:true})" @keydown.capture="flightKey" @wheel.capture="manualMotion" @pointerdown.capture="stopAuto"/>
    <div class="flight-vignette" aria-hidden="true"/>
    <header class="flight-heading"><div><span class="flight-eyebrow">STARWHISPER / DEEP SPACE EXPEDITION</span><h1>AR 宇宙<span>{{current.name}}</span></h1><p>{{current.scale}} · {{current.subtitle}}</p></div><div class="flight-top-actions"><button class="flight-button" :aria-expanded="mapOpen" @click="toggleMap"><Map :size="16"/>宇宙地图</button><button class="flight-button view-switch" @click="changeView">{{view==='cockpit'?'驾驶舱视角':'飞船跟随视角'}}</button><button class="flight-button screen-switch" @click="toggleFullscreen">{{fullscreen?'退出全屏':'全屏体验'}}</button></div></header>
    <div v-show="!travel.wormhole" class="flight-body-markers" aria-label="视野内目的地"><svg class="flight-label-leaders" aria-hidden="true"><line v-for="marker in markers.filter(item=>item.visible)" :key="marker.id" :x1="marker.anchorX" :y1="marker.anchorY" :x2="marker.x" :y2="marker.y"/></svg><button v-for="marker in markers.filter(item=>item.visible)" :key="marker.id" class="flight-body-label" :style="{left:marker.x+'px',top:marker.y+'px',width:marker.width+'px'}" :title="marker.name+' · 点击驶近，双击可探索的结构进入内部'" :aria-label="'飞往'+marker.name" @click="flyTo(marker.id)" @dblclick.stop="enterMarker(marker.id)"><span class="label-dot"/>{{marker.name}}</button></div>
    <UniverseNavigator v-if="mapOpen" class="flight-map-overlay" :stops="journeyStops" :current="current" :catalog="catalog" :status="catalogStatus" @close="closeMap" @jump="mapJump" @reload="loadCatalog"/>
    <aside v-if="detailOpen" class="flight-information flight-panel" aria-label="抵达科普介绍"><header><span><Info :size="13"/>{{travel.active?'航行目的地':'你正在探索'}}</span><button class="flight-icon" aria-label="收起科普介绍" @click="detailOpen=false"><X :size="17"/></button></header><div class="flight-information-scroll"><span class="flight-information-type">{{arrived.subtitle || current.scale}}</span><h2>{{arrivalTitle}}</h2><p>{{arrived.description}}</p><ul v-if="arrived.detailFacts?.length"><li v-for="fact in arrived.detailFacts" :key="fact">{{fact}}</li></ul><button v-if="interiorDestination" class="flight-button warm flight-enter" @click="enterBody(arrived)"><Rocket :size="16"/>进入{{interiorDestination.name}}</button><div class="flight-narration"><button class="flight-button" @click="narration.speaking.value?narration.stop():narration.speak(arrived)"><VolumeX v-if="narration.speaking.value" :size="15"/><Volume2 v-else :size="15"/>{{narration.speaking.value?'停止讲解':'听听介绍'}}</button><button class="flight-button quiet" :aria-pressed="narration.enabled.value" @click="narration.toggle(arrived)">{{narration.enabled.value?'自动讲解已开':'开启自动讲解'}}</button></div><p v-if="narration.message.value" class="flight-notice" role="status">{{narration.message.value}}</p><a v-if="arrived.sourceUrl" :href="arrived.sourceUrl" target="_blank" rel="noopener noreferrer" class="flight-source">资料来源 · {{arrived.sourceName || 'NASA 科普资料'}}</a><button class="flight-ask" @click="emit('ask',`请介绍${arrivalTitle}，并告诉我资料来源。`)">继续问星语</button></div></aside>
    <button v-else class="flight-button info-toggle" @click="toggleDetail"><Info :size="15"/>科普介绍</button>
    <div v-if="!ready" class="flight-loading" role="status"><template v-if="error"><ScanLine :size="30"/><strong>暂时无法启动宇宙航行</strong><p>{{error}}</p><button class="flight-button warm" @click="startScene">重新启动 3D</button></template><template v-else><span class="flight-loading-ring"/><strong>正在准备飞船与宇宙…</strong><p>从我们的蓝色星球出发</p></template></div>
    <div class="flight-scale-track" aria-label="从近地到宇宙网的尺度导航"><button v-for="(stop,index) in journeyStops" :key="stop.id" :class="{active:levelIndex===index}" :aria-current="levelIndex===index?'step':undefined" @click="selectStop(stop)"><small>{{String(index+1).padStart(2,'0')}}</small>{{stop.name}}</button></div>
    <div class="flight-bottom"><div class="flight-status"><span class="status-light"/><div><strong>{{travel.active?`正驶向 ${travelTarget || current.name}`:manualFlying ? `手动航行 · ${current.name}` : `已抵达 · ${arrivalTitle}`}}</strong><small>{{travel.active?Math.round((travel.progress || 0)*100)+'% · '+(travel.phase || '天体间转移'):'点击驶近 · 双击星系/星系团进入 · W / S 航行'}}</small></div></div><div class="flight-primary-controls"><button class="flight-button warm" :disabled="!ready" @click="startJourney"><Rocket :size="16"/>{{autoFlight?'结束自动航行':current.id==='earth-launch'?'从文昌启航':'自动探索本区域'}}</button><button class="flight-icon" :disabled="!ready" :aria-label="paused?'继续航行':'暂停航行'" @click="togglePause"><Play v-if="paused" :size="17"/><Pause v-else :size="17"/></button><button class="flight-button next-scale" :disabled="!ready || !(branchView?parentStop:nextLevel)" @click="selectStop(branchView?parentStop:nextLevel)">{{branchView?'返回'+(parentStop?.name||'上层'):nextLevel?'前往'+nextLevel.name:'已到最大尺度'}}</button><button class="flight-icon" :aria-expanded="controlsOpen" aria-label="打开飞船控制" @click="controlsOpen=!controlsOpen"><RotateCcw :size="16"/></button></div></div>
    <div v-if="controlsOpen" class="flight-extra-controls flight-panel"><label>巡航速度 <span>×{{Number(speed).toFixed(1)}}</span><input v-model="speed" type="range" min="0.5" max="3" step="0.25" aria-label="巡航速度" @input="setSpeed"/></label><div class="flight-thrust"><button v-for="direction in [{id:'forward',label:'前进'},{id:'backward',label:'后退'},{id:'left',label:'左移'},{id:'right',label:'右移'}]" :key="direction.id" class="flight-button" @click="moveShip(direction.id)">{{direction.label}}</button></div><div class="flight-extra-actions"><button class="flight-button" @click="flight?.resetView()">重置视野</button><button class="flight-button" @click="camera.active.value || camera.pending.value ? camera.stop() : camera.start()"><Camera :size="15"/>{{camera.pending.value?'取消相机':camera.active.value?'关闭相机叠加':'相机叠加'}}</button></div><p class="flight-notice">显示帧率：{{telemetry.fps || '—'}} FPS · 自动平衡清晰度</p><p v-if="camera.message.value" class="flight-notice" role="status">{{camera.message.value}}</p></div>
    <span class="flight-scale-note">尺度、航行速度与外观为科普示意 · 系外行星数据来自 NASA 目录</span>
  </section>
</template>

<style>
.universe-flight{--flight-text:#e8eff3;--flight-muted:#97aaba;--flight-line:#c1d9e52b;position:fixed;inset:var(--flight-header,80px) 0 0;z-index:25;background:#020711;color:var(--flight-text);overflow:hidden;isolation:isolate;font-family:inherit;text-align:left}.universe-flight:fullscreen{inset:0;width:100%;height:100dvh}.flight-viewport,.flight-camera,.flight-vignette{position:absolute;inset:0;width:100%;height:100%;margin:0}.flight-viewport{touch-action:none;outline-offset:-3px}.flight-viewport canvas{display:block;width:100%;height:100%}.flight-camera{object-fit:cover;opacity:.5}.flight-vignette{pointer-events:none;background:linear-gradient(180deg,#02071188 0%,transparent 26%,transparent 65%,#020711e0 100%);z-index:1}.flight-heading{position:absolute;left:32px;right:32px;top:24px;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;z-index:5;pointer-events:none}.flight-heading>div{pointer-events:auto}.flight-eyebrow{font:8px Arial,sans-serif;letter-spacing:2.2px;color:#8eabbf}.flight-heading h1{font-size:24px;font-weight:500;letter-spacing:2px;margin:9px 0 7px;line-height:1.2;color:var(--flight-text)}.flight-heading h1>span{display:inline-block;margin-left:18px;padding-left:18px;border-left:1px solid #afcad345;font-size:14px;letter-spacing:0;color:#cdb68f}.flight-heading p{font-size:10px;color:var(--flight-muted);margin:0}.flight-top-actions{display:flex;gap:8px;padding-top:2px;flex:none}
.universe-flight .flight-button,.universe-flight .flight-icon{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:9px 13px;color:#d9e5ef;background:#091322cc;border:1px solid #8cacc83d;border-radius:5px;box-shadow:0 2px 0 #0008;font-size:11px;line-height:1.3;cursor:pointer;transition:background .15s,border-color .15s,transform .15s,box-shadow .15s}.universe-flight .flight-icon{width:36px;padding:8px;flex:none}.universe-flight .flight-button:hover,.universe-flight .flight-icon:hover{background:#1a2d40e0;border-color:#b7ccdc70}.universe-flight .flight-button:active,.universe-flight .flight-icon:active{transform:translateY(2px);box-shadow:none}.universe-flight button:focus-visible,.universe-flight a:focus-visible,.universe-flight input:focus-visible{outline:2px solid #e0bb81;outline-offset:3px}.universe-flight .flight-button:disabled,.universe-flight .flight-icon:disabled{opacity:.45;cursor:default}.universe-flight .flight-button.warm{background:#c3a171;color:#101a24;border-color:#e6c9a0;box-shadow:0 2px 0 #73603e}.universe-flight .flight-button.warm:hover{background:#dbc297}.universe-flight .flight-button.quiet{background:transparent;font-size:10px}.flight-panel{background:#06111ee8;border:1px solid var(--flight-line);border-radius:7px;box-shadow:0 16px 40px #0003;backdrop-filter:blur(16px)}
.flight-body-markers{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden}.universe-flight .flight-body-label{position:absolute;display:flex;align-items:center;gap:8px;translate:-50% -50%;padding:7px 10px;pointer-events:auto;color:#e1ebf2;background:#08172899;border:1px solid #b3c5d62b;border-radius:4px;font-size:10px;white-space:nowrap;box-shadow:0 2px 12px #0004;transition:background .16s,border-color .16s}.universe-flight .flight-body-label:hover{background:#243f55dd;border-color:#d4b78290}.flight-label-leaders{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}.flight-label-leaders line{stroke:#bfd5df;stroke-opacity:.4;stroke-width:1}.universe-flight .flight-body-label{box-sizing:border-box;height:30px;overflow:hidden;text-overflow:ellipsis}.label-dot{flex-shrink:0;width:4px;height:4px;background:#d9be87;border-radius:50%;box-shadow:0 0 7px #e6cf9b}.flight-map-overlay{position:absolute;left:32px;top:112px;z-index:8}.flight-information{position:absolute;right:32px;top:112px;width:308px;max-height:calc(100% - 240px);display:flex;flex-direction:column;z-index:5}.flight-information>header{display:flex;align-items:center;justify-content:space-between;padding:12px 15px;border-bottom:1px solid var(--flight-line);gap:12px}.flight-information>header>span{display:flex;gap:8px;align-items:center;font-size:10px;color:var(--flight-muted)}.flight-information-scroll{overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:20px}.flight-information-type{font-size:9px;letter-spacing:1px;color:#c6b38d}.flight-information h2{font-size:24px;color:var(--flight-text);font-weight:500;line-height:1.4;margin:8px 0 15px}.flight-information p{font-size:12px;line-height:2;color:#acbdc9;margin:0 0 14px}.flight-information ul{font-size:10px;color:#c3d1db;padding-left:15px;line-height:1.8;margin:15px 0}.flight-information li+li{margin-top:7px}.flight-narration{display:flex;gap:7px;flex-wrap:wrap;margin:18px 0 12px}.flight-enter{width:100%;justify-content:center;margin:12px 0 18px}.flight-source{font-size:9px;color:#8fa8ba;text-decoration:underline;text-underline-offset:3px;line-height:1.8}.flight-ask{display:block;font-size:10px;color:#d4bb96;padding:12px 0 0;background:none;border:0;cursor:pointer}.universe-flight .flight-notice{font-size:10px;line-height:1.8;color:#b8c6d0;margin:10px 0}.info-toggle{position:absolute;right:32px;top:112px;z-index:5}
.flight-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;background:#020711db;z-index:12;color:var(--flight-text);text-align:center;padding:24px}.flight-loading strong{font-weight:500;font-size:17px;letter-spacing:1px}.flight-loading p{font-size:12px;color:var(--flight-muted);max-width:360px;line-height:1.8}.flight-loading-ring{width:48px;height:48px;border:1px solid #9fb8c74d;border-top-color:#caaa78;border-radius:50%;animation:flight-loading-spin 1.5s linear infinite}@keyframes flight-loading-spin{to{transform:rotate(360deg)}}
.flight-scale-track{position:absolute;left:50%;bottom:98px;transform:translateX(-50%);display:flex;align-items:center;border:1px solid #7f9bb232;border-radius:5px;background:#06121cd1;padding:4px;z-index:4;max-width:calc(100% - 64px);overflow:auto;scrollbar-width:none}.flight-scale-track button{display:flex;align-items:center;justify-content:center;gap:7px;color:#9bb1c2;font-size:10px;white-space:nowrap;min-height:32px;padding:7px 12px;border:1px solid transparent;border-radius:3px}.flight-scale-track small{font:8px Arial;color:#7890a0}.flight-scale-track button.active{background:#d7b98517;color:#e5d1b0;border-color:#d9b37461}.flight-scale-track button:hover{background:#b4cadb12}.flight-bottom{position:absolute;bottom:42px;left:32px;right:32px;display:flex;align-items:center;justify-content:space-between;gap:20px;z-index:5}.flight-status{display:flex;align-items:center;gap:12px;min-width:0}.status-light{flex:none;width:5px;height:5px;background:#b7bda0;box-shadow:0 0 10px #d0ddb0;border-radius:50%}.flight-status strong{font-size:11px;font-weight:400;color:#c6d8e3;display:block;line-height:1.6}.flight-status small{font-size:9px;color:#819aac;display:block;margin-top:3px}.flight-primary-controls{display:flex;align-items:center;gap:8px;flex:none}.flight-scale-note{position:absolute;left:32px;bottom:16px;font-size:8px;letter-spacing:.3px;color:#5e7b90;z-index:5;pointer-events:none}.flight-extra-controls{position:absolute;right:32px;bottom:94px;z-index:10;width:300px;padding:18px}.flight-extra-controls>label{display:block;color:#bccddb;font-size:11px}.flight-extra-controls label>span{float:right;color:#d6b98c}.flight-extra-controls input{display:block;width:100%;margin:16px 0;accent-color:#cdb385}.flight-thrust,.flight-extra-actions{display:flex;gap:6px}.flight-thrust .flight-button{flex:1;padding:9px 8px}.flight-extra-actions{margin-top:12px}.flight-extra-actions .flight-button{flex:1;font-size:10px}
@media(max-width:1100px){.flight-heading,.flight-bottom{left:20px;right:20px}.flight-heading h1{font-size:21px}.flight-heading h1>span{font-size:12px}.flight-map-overlay{left:20px}.flight-information{right:20px;width:280px}.info-toggle{right:20px}.flight-scale-track button{padding:7px 8px}.flight-status small{max-width:240px;font-size:8px}.flight-primary-controls{gap:6px}.universe-flight .flight-button{padding:9px 11px}.flight-extra-controls{right:20px}}
@media(max-width:850px){.flight-information{width:280px;max-height:calc(100% - 230px)}.flight-scale-track{bottom:109px;max-width:calc(100% - 32px)}.next-scale{display:none!important}.flight-heading h1>span{display:block;margin:7px 0 0;padding:0;border:0;font-size:12px}.flight-bottom{bottom:48px;gap:12px}.flight-status strong{font-size:10px}.flight-status small{max-width:180px}.flight-scale-note{left:20px;font-size:7px}.screen-switch{display:none!important}}
@media(max-width:600px){.flight-heading{top:16px;left:16px;right:16px;gap:8px}.flight-heading h1{font-size:19px;margin:7px 0}.flight-eyebrow{font-size:6px;letter-spacing:1px}.flight-heading p{font-size:8px;max-width:170px;line-height:1.6}.flight-top-actions{flex-direction:column;gap:5px}.flight-top-actions .flight-button{min-height:31px;padding:7px 9px;font-size:9px}.flight-information{top:120px;left:16px;right:16px;width:auto;max-height:calc(100% - 288px)}.flight-information-scroll{padding:14px 16px}.flight-information>header{padding:5px 12px}.flight-information h2{font-size:19px;margin:7px 0 10px}.flight-information p{font-size:11px;line-height:1.9}.flight-information ul{font-size:9px}.flight-map-overlay{top:120px;left:16px}.info-toggle{top:120px;right:16px;font-size:10px}.flight-scale-track{bottom:136px;left:16px;right:16px;transform:none;max-width:none;justify-content:flex-start}.flight-scale-track button{font-size:9px;padding:7px 9px}.flight-scale-track small{display:none}.flight-bottom{bottom:37px;left:16px;right:16px;flex-direction:column;align-items:stretch;gap:12px}.flight-status small{max-width:none}.flight-primary-controls{justify-content:space-between}.flight-primary-controls .warm{flex:1}.flight-scale-note{left:16px;bottom:12px;font-size:6px}.flight-extra-controls{left:16px;right:16px;width:auto;bottom:133px}.flight-loading strong{font-size:15px}}
@media(prefers-reduced-motion:reduce){.flight-loading-ring{animation:none}.universe-flight button{transition:none}}
</style>
