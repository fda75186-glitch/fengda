<script setup>
import { assetUrl } from '../assets.js';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Camera, CameraOff, Compass, Minus, Plus, RotateCcw, ScanLine } from '@lucide/vue';
import SaturnLogo from './SaturnLogo.vue';

const emit = defineEmits(['ask', 'navigate']);
const modes = [
  { id: 'deep', name: '深空云图', subtitle: '从银河系，望向更遥远的世界', bodies: [
    { id: 'andromeda', name: '仙女座星系', type: '邻近的大型星系', image: 'andromeda', x: 32, y: 42, size: 220, round: false, description: '这片朦胧的光由大量恒星汇成。仙女座星系距离我们约 250 万光年，看到它，也是在看它很久以前的样子。', note: 'NASA/JPL-Caltech 影像 · 非实时位置' },
    { id: 'blackhole', name: '黑洞与吸积盘', type: '艺术概念图', image: 'blackhole', x: 72, y: 34, size: 155, round: false, description: '黑洞本身不发光。周围物质旋转、变热形成吸积盘，帮助我们间接研究黑洞。这张图片是艺术概念图。', note: 'NASA 艺术概念图 · 科普示意' },
    { id: 'sun', name: '我们的太阳', type: '一颗普通恒星', image: 'sun', x: 62, y: 72, size: 100, round: true, description: '太阳是一颗恒星。它的能量来自核心的核聚变，光到达地球大约需要 8 分钟。', note: 'NASA 太阳影像 · 非实时位置' },
  ] },
  { id: 'solar', name: '太阳系漫游', subtitle: '认识离我们更近的宇宙邻居', bodies: [
    { id: 'earth', name: '地球', type: '我们的家园', image: 'earth', x: 32, y: 45, size: 180, round: true, description: '海洋、大气与适宜的温度，让地球成为我们已知唯一有生命的星球。云层与海洋共同构成这颗蓝色星球的外观。', note: 'NASA 地球影像 · 位置与大小为示意' },
    { id: 'moon', name: '月球', type: '地球的天然卫星', image: 'moon', x: 65, y: 27, size: 85, round: true, description: '月球不会自己发光，我们看到的是它反射的太阳光。月相变化来自太阳、地球与月球之间的位置关系。', note: 'NASA 月球影像 · 位置与大小为示意' },
    { id: 'saturn', name: '土星', type: '有壮观光环的行星', image: 'saturn', x: 69, y: 66, size: 210, round: false, description: '土星的光环主要由冰粒和岩石碎片组成。它们各自沿轨道绕土星运行，远看像一整片光环。', note: 'NASA/JPL-Caltech 影像 · 位置与大小为示意' },
  ] },
];
const modeId = ref('deep'), selectedId = ref('andromeda');
const mode = computed(() => modes.find(item => item.id === modeId.value));
const selected = computed(() => mode.value.bodies.find(item => item.id === selectedId.value) || mode.value.bodies[0]);
const zoom = ref(1), offset = ref({ x: 0, y: 0 }), dragging = ref(false);
const stage = ref(null), cameraVideo = ref(null), cameraActive = ref(false), cameraPending = ref(false), cameraMessage = ref('');
let pointerStart = null, stream = null, cameraRequest = 0, mounted = true;
const sceneStyle = computed(() => ({ transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${zoom.value})` }));
function resetView() { zoom.value = 1; offset.value = { x: 0, y: 0 }; }
function changeMode(id) { modeId.value = id; selectedId.value = mode.value.bodies[0].id; resetView(); }
function pan(x, y) {
  const width = stage.value?.clientWidth || 800, height = stage.value?.clientHeight || 560;
  offset.value = { x: Math.max(-width * .42, Math.min(width * .42, offset.value.x + x)), y: Math.max(-height * .42, Math.min(height * .42, offset.value.y + y)) };
}
function changeZoom(amount) { zoom.value = Math.max(.65, Math.min(1.8, +(zoom.value + amount).toFixed(2))); }
function startDrag(event) {
  if (event.button !== 0 || event.target.closest('button')) return;
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  stage.value.setPointerCapture(event.pointerId); dragging.value = true;
}
function moveDrag(event) {
  if (!pointerStart || event.pointerId !== pointerStart.id) return;
  pan(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
  pointerStart.x = event.clientX; pointerStart.y = event.clientY;
}
function endDrag() { pointerStart = null; dragging.value = false; }
function keyControl(event) {
  if (event.target !== stage.value) return;
  const actions = { ArrowLeft: () => pan(-35, 0), ArrowRight: () => pan(35, 0), ArrowUp: () => pan(0, -35), ArrowDown: () => pan(0, 35), '+': () => changeZoom(.1), '=': () => changeZoom(.1), '-': () => changeZoom(-.1), '0': resetView };
  if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
}
function stopCamera(message = '') {
  cameraRequest++; stream?.getTracks().forEach(track => track.stop()); stream = null;
  if (cameraVideo.value) cameraVideo.value.srcObject = null;
  cameraActive.value = false; cameraPending.value = false; cameraMessage.value = message;
}
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { cameraMessage.value = '当前浏览器不支持相机，请在 HTTPS 或本机预览中使用。云图漫游仍然可用。'; return; }
  const requestId = ++cameraRequest; cameraPending.value = true; cameraMessage.value = '请在浏览器提示中选择是否允许相机。';
  try {
    const incoming = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    if (!mounted || requestId !== cameraRequest) { incoming.getTracks().forEach(track => track.stop()); return; }
    stream = incoming; cameraActive.value = true; await nextTick();
    cameraVideo.value.srcObject = incoming;
    try { await cameraVideo.value.play(); } catch { stopCamera('相机预览未能播放，请重试开启。'); return; }
    cameraMessage.value = '相机已开启。天体仅作科普叠加，不与真实天空位置对应。';
    incoming.getVideoTracks().forEach(track => track.addEventListener('ended', () => { if (cameraActive.value) stopCamera('相机连接已结束，已返回云图漫游。'); }, { once: true }));
  } catch (error) {
    if (!mounted || requestId !== cameraRequest) return;
    cameraMessage.value = error.name === 'NotAllowedError' ? '相机权限未获允许。可以在浏览器权限设置中开启后重试，或继续漫游云图。' : error.name === 'NotFoundError' ? '没有检测到可用相机，云图漫游仍然可用。' : '相机暂时无法开启，可能被其他应用占用。请关闭占用后重试。';
  } finally { if (requestId === cameraRequest) cameraPending.value = false; }
}
function visibilityChange() { if (document.hidden && (cameraActive.value || cameraPending.value)) stopCamera('页面已切到后台，相机已关闭。'); }
onMounted(() => document.addEventListener('visibilitychange', visibilityChange));
onBeforeUnmount(() => { mounted = false; stopCamera(); document.removeEventListener('visibilitychange', visibilityChange); });
</script>

<template>
  <div class="ar-page page-shell">
    <header class="ar-heading"><div><span class="light-eyebrow">07 / 把好奇带进现实</span><h1>AR 宇宙云图</h1><p>拖动视野，触碰天体。让宇宙，出现在你的眼前。</p></div><SaturnLogo :size="86" /></header>
    <div class="ar-mode-row"><div class="ar-modes" aria-label="云图模式"><button v-for="item in modes" :key="item.id" :class="{ selected: modeId === item.id }" :aria-pressed="modeId === item.id" @click="changeMode(item.id)">{{ item.name }}</button></div><span class="ar-demo-label"><ScanLine :size="15" />科普 AR 叠加演示</span></div>
    <section class="ar-workbench" aria-label="交互宇宙云图">
      <div ref="stage" class="ar-stage" :class="{ dragging, 'camera-on': cameraActive }" tabindex="0" aria-label="宇宙云图舞台，方向键移动视野，加减键缩放，零键复位" @keydown="keyControl" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag">
        <video v-if="cameraActive" ref="cameraVideo" class="ar-camera" autoplay muted playsinline aria-label="本机相机预览"></video>
        <div class="ar-stars"></div><div class="ar-stage-meta"><span>STARWHISPER / {{ mode.name }}</span><span>{{ Math.round(zoom * 100) }}%</span></div>
        <div class="ar-scene" :style="sceneStyle"><svg class="ar-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path v-if="modeId === 'deep'" d="M32 42 L72 34 L62 72 L32 42" /><path v-else d="M32 45 L65 27 L69 66 L32 45" /></svg><button v-for="body in mode.bodies" :key="body.id" class="ar-body" :class="{ selected: selected.id === body.id, round: body.round }" :style="{ left: `${body.x}%`, top: `${body.y}%`, '--body-size': `${body.size}px` }" :aria-label="`查看${body.name}`" :aria-pressed="selected.id === body.id" @click="selectedId = body.id"><img :src="assetUrl(`/images/${body.image}.jpg`)" :alt="body.name" draggable="false" /><span>{{ body.name }}<small>{{ body.type }}</small></span></button></div>
        <span class="ar-crosshair" aria-hidden="true"></span><span class="ar-stage-hint"><Compass :size="15" /> 拖动空白区域 · 点击天体</span>
      </div>
      <aside class="ar-detail"><span class="light-eyebrow">你正在探索</span><Transition name="ar-detail" mode="out-in"><div :key="selected.id"><span class="ar-detail-type">{{ selected.type }}</span><h2>{{ selected.name }}</h2><p>{{ selected.description }}</p><small>{{ selected.note }}</small><button class="button secondary" @click="emit('ask', `请用通俗的语言介绍${selected.name}，并告诉我资料来源。`)">问问星语 </button></div></Transition><div class="ar-truth"><ScanLine :size="20" /><p>没有使用定位或设备姿态。天体排列是科普示意，无法用于认星或导航。</p></div></aside>
    </section>
    <div class="ar-controls"><div class="ar-direction" aria-label="移动视野"><button class="icon-button" aria-label="向左移动视野" @click="pan(-35, 0)">左移</button><button class="icon-button" aria-label="向上移动视野" @click="pan(0, -35)">上移</button><button class="icon-button" aria-label="向下移动视野" @click="pan(0, 35)">下移</button><button class="icon-button" aria-label="向右移动视野" @click="pan(35, 0)">右移</button></div><div class="ar-zoom"><button class="icon-button" aria-label="缩小云图" :disabled="zoom <= .65" @click="changeZoom(-.1)"><Minus :size="18" /></button><span>{{ Math.round(zoom * 100) }}%</span><button class="icon-button" aria-label="放大云图" :disabled="zoom >= 1.8" @click="changeZoom(.1)"><Plus :size="18" /></button><button class="ar-reset" @click="resetView"><RotateCcw :size="16" /> 复位</button></div><button v-if="cameraActive || cameraPending" class="button secondary ar-camera-button" @click="stopCamera('相机已关闭，已返回云图漫游。')"><CameraOff :size="18" />{{ cameraPending ? '取消开启相机' : '关闭 AR 相机' }}</button><button v-else class="button primary ar-camera-button" @click="startCamera"><Camera :size="18" />开启 AR 相机</button></div>
    <p v-if="cameraMessage" class="ar-camera-message" role="status">{{ cameraMessage }}</p>
    <div class="ar-footer-note"><p>相机仅在你点击后开启，影像留在本机；离开页面或关闭相机时停止使用。</p><button class="text-button" @click="emit('navigate', 'atlas')">去星空图谱了解行星轨道 </button></div>
  </div>
</template>

<style scoped>
.ar-page{--ar-ink:#18242e;--ar-muted:#718399;color:var(--ar-ink)}.ar-heading{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:36px}.ar-heading h1{margin:14px 0 12px}.ar-heading p{color:var(--ar-muted);font-size:14px;margin:0}.ar-heading>.saturn-logo{object-fit:contain}.ar-mode-row{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:18px}.ar-modes{display:flex;gap:6px}.ar-modes button{padding:12px 20px;font-size:13px;border:1px solid transparent;border-radius:5px;color:#708399}.ar-modes button.selected{border-color:#cbd9e3;background:#f3f7fa;color:#24495e}.ar-modes button:hover{background:#edf4f8}.ar-demo-label{display:flex;align-items:center;gap:8px;color:#74879a;font-size:11px}.ar-workbench{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:26px}.ar-stage{height:550px;position:relative;overflow:hidden;border-radius:7px;background:#07131f;isolation:isolate;cursor:grab;touch-action:none;user-select:none}.ar-stage.dragging{cursor:grabbing}.ar-stars{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(1px 1px at 15% 20%,#d2e6f5 98%,transparent),radial-gradient(1px 1px at 70% 65%,#afc5d9 98%,transparent),radial-gradient(1.5px 1.5px at 80% 25%,#d7c4a1 98%,transparent);background-size:150px 155px,225px 250px,330px 285px;opacity:.5}.camera-on .ar-stars{opacity:.22}.ar-camera{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.72;z-index:-1}.ar-stage-meta{position:absolute;top:22px;left:24px;right:24px;display:flex;justify-content:space-between;font:9px Arial,sans-serif;letter-spacing:2px;color:#d2dfe9;pointer-events:none;z-index:2}.ar-scene{position:absolute;inset:0;transform-origin:50% 50%;will-change:transform}.ar-links{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.ar-links path{fill:none;stroke:#bed8ea;stroke-width:.12;stroke-dasharray:.4 .8;opacity:.22}.ar-body{position:absolute;translate:-50% -50%;padding:0;color:#e3eaf1;width:var(--body-size);max-width:40%;border-radius:50%}.ar-body img{width:100%;height:var(--body-size);max-height:220px;object-fit:contain;mix-blend-mode:screen;transition:filter .2s,transform .25s}.ar-body.round img{border-radius:50%;object-fit:cover;height:auto;aspect-ratio:1}.ar-body.selected img{filter:brightness(1.25);transform:scale(1.05)}.ar-body:hover img{filter:brightness(1.3);transform:scale(1.06)}.ar-body span{display:block;position:absolute;left:50%;top:calc(100% + 12px);transform:translateX(-50%);white-space:nowrap;font-size:12px;letter-spacing:1px}.ar-body small{display:block;font-size:8px;color:#9bb7ca;letter-spacing:0;margin-top:6px}.ar-body.selected span{color:#f2d59f}.ar-crosshair{position:absolute;left:calc(50% - 9px);top:calc(50% - 9px);width:18px;height:18px;border:1px solid #c0deee50;pointer-events:none}.ar-crosshair:after{content:'';position:absolute;left:6px;top:6px;width:4px;height:4px;border:1px solid #c0deee50}.ar-stage-hint{position:absolute;bottom:22px;left:24px;display:flex;gap:9px;align-items:center;font-size:10px;color:#a8c0d0;pointer-events:none}.ar-detail{display:flex;flex-direction:column;padding:34px 26px;background:#f5f8fa;border:1px solid #e1e9ef;border-radius:7px}.ar-detail>.light-eyebrow{margin-bottom:36px}.ar-detail-type{font-size:11px;color:#718a9b}.ar-detail h2{font-size:26px;font-weight:500;line-height:1.5;margin:14px 0 20px}.ar-detail p{font-size:13px;color:#657b8c;line-height:2}.ar-detail small{display:block;font-size:10px;color:#6b8294;line-height:1.8;margin:20px 0 24px}.ar-detail .button{font-size:12px;padding:12px 18px}.ar-truth{display:flex;gap:12px;align-items:flex-start;margin-top:auto;padding-top:28px;color:#7594a6}.ar-truth p{font-size:10px;line-height:1.9;margin:0}.ar-controls{display:flex;align-items:center;gap:24px;margin-top:22px;flex-wrap:wrap}.ar-direction,.ar-zoom{display:flex;align-items:center;gap:4px}.ar-zoom{border-left:1px solid #e1e8ef;padding-left:20px}.ar-zoom>span{width:42px;text-align:center;font:11px Arial,sans-serif;color:#607b8c}.ar-reset{display:flex;align-items:center;gap:7px;margin-left:10px;font-size:11px;color:#637e90;padding:10px}.ar-camera-button{margin-left:auto}.ar-camera-message{color:#466578;background:#eef5f8;padding:14px 18px;border-radius:5px;font-size:12px;margin:20px 0 0}.ar-footer-note{display:flex;gap:24px;justify-content:space-between;align-items:center;margin-top:24px;border-top:1px solid #e5ebf0;padding-top:18px}.ar-footer-note p{font-size:10px;line-height:1.9;color:#76899b;margin:0}.ar-footer-note .text-button{font-size:11px;white-space:nowrap}.ar-detail-enter-active,.ar-detail-leave-active{transition:opacity .2s,transform .2s}.ar-detail-enter-from{opacity:0;transform:translateY(12px)}.ar-detail-leave-to{opacity:0;transform:translateY(-8px)}
@media(max-width:1000px){.ar-workbench{grid-template-columns:minmax(0,1fr) 250px;gap:18px}.ar-stage{height:500px}.ar-detail{padding:26px 20px}.ar-body{--body-scale:.8}.ar-body img{max-height:170px}.ar-footer-note{align-items:flex-start;flex-direction:column;gap:8px}}
@media(max-width:700px){.ar-heading{margin-bottom:28px}.ar-heading>.saturn-logo{width:58px!important;height:58px!important}.ar-heading p{font-size:11px}.ar-mode-row{align-items:flex-start;flex-direction:column;gap:12px}.ar-modes button{font-size:11px;padding:10px 15px}.ar-demo-label{font-size:9px}.ar-workbench{grid-template-columns:1fr;gap:16px}.ar-stage{height:440px}.ar-body img{max-height:155px}.ar-body span{font-size:10px;letter-spacing:0}.ar-body small{font-size:7px}.ar-stage-meta{left:17px;right:17px;font-size:7px;letter-spacing:1px}.ar-stage-hint{left:17px;font-size:8px}.ar-detail{padding:24px}.ar-detail>.light-eyebrow{margin-bottom:18px}.ar-detail h2{font-size:24px;margin:9px 0 13px}.ar-detail p{font-size:12px}.ar-detail small{margin:14px 0 18px}.ar-truth{padding-top:20px}.ar-controls{gap:12px;margin-top:16px}.ar-zoom{padding-left:9px}.ar-reset{margin-left:0;padding:8px;font-size:10px}.ar-direction{gap:0}.ar-direction .icon-button,.ar-zoom .icon-button{width:30px;height:32px}.ar-camera-button{width:100%;margin:0;font-size:12px}.ar-camera-message{font-size:11px}.ar-footer-note .text-button{font-size:10px}.ar-footer-note p{font-size:9px}}
@media(max-width:359px){.ar-stage{height:395px}.ar-body span{font-size:9px}.ar-body small{display:none}.ar-controls{gap:6px}.ar-zoom{padding-left:6px}.ar-direction .icon-button,.ar-zoom .icon-button{width:27px}}
@media(prefers-reduced-motion:reduce){.ar-detail-enter-active,.ar-detail-leave-active,.ar-body img{transition:none}}
</style>
