<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Pause, Play, RotateCcw, Plus, Minus, Maximize2 } from '@lucide/vue';
import { createModel, disposeModel } from '../explore3d/models.js';
import { bodyNames, isConcept } from '../exploreBodies.js';

const props = defineProps({ body: { type: String, default: 'earth' }, compact: Boolean, suspended: Boolean });
const emit = defineEmits(['focus']);
const holder = ref(null), viewport = ref(null), state = ref('waiting'), spinning = ref(true);
const name = computed(() => bodyNames[props.body] || props.body);
const concept = computed(() => isConcept(props.body));
let renderer, camera, scene, controls, model, observer, resizeObserver, animation, visible = false;
let generation = 0, baseline = 4, initialSpin = 0, last = 0, motion;

function release() {
  generation++; cancelAnimationFrame(animation); last = 0;
  controls?.dispose(); controls = null;
  if (scene) disposeModel(scene);
  renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
  renderer = null; scene = null; model = null; camera = null;
}
function fit() {
  if (!renderer || !camera || !viewport.value) return;
  const { width, height } = viewport.value.getBoundingClientRect();
  if (!width || !height) return;
  const ratio = camera.position.length() / baseline;
  renderer.setSize(width, height, false); camera.aspect = width / height;
  const angle = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect));
  baseline = (model?.userData.radius || 1.08) / Math.sin(angle) * 1.04;
  camera.position.setLength(baseline * Math.max(.6, Math.min(2.4, ratio)));
  controls.minDistance = baseline * .6; controls.maxDistance = baseline * 2.4;
  camera.updateProjectionMatrix(); controls.update();
}
function reset() {
  if (!camera) return;
  camera.position.copy(model?.userData.view || new THREE.Vector3(0, .3, 1)).normalize().multiplyScalar(baseline);
  if (model) model.userData.spin.rotation.y = initialSpin;
  controls.target.set(0, 0, 0); controls.update();
}
function zoom(factor) {
  if (!camera) return;
  camera.position.setLength(THREE.MathUtils.clamp(camera.position.length() * factor, baseline * .6, baseline * 2.4));
  controls.update();
}
function keyControl(event) {
  if (event.target !== viewport.value || !camera) return;
  if (['+', '=', '-', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.preventDefault();
  if (event.key === '+' || event.key === '=') zoom(.85);
  else if (event.key === '-') zoom(1.18);
  else if (event.key === ' ') spinning.value = !spinning.value;
  else if (event.key.toLowerCase() === 'r') reset();
  else if (event.key.startsWith('Arrow')) {
    const spherical = new THREE.Spherical().setFromVector3(camera.position);
    if (event.key === 'ArrowLeft') spherical.theta -= .15;
    if (event.key === 'ArrowRight') spherical.theta += .15;
    if (event.key === 'ArrowUp') spherical.phi -= .15;
    if (event.key === 'ArrowDown') spherical.phi += .15;
    spherical.makeSafe(); camera.position.setFromSpherical(spherical); controls.update();
  }
}
function animate(time) {
  animation = requestAnimationFrame(animate);
  if (!renderer || !model || !visible || props.suspended || document.hidden) { last = 0; return; }
  if (last && time - last < 32) return;
  const delta = last ? Math.min((time - last) / 1000, .06) : 0; last = time;
  if (spinning.value) model.userData.spin.rotation.y += delta * model.userData.speed;
  model.userData.update?.(delta, spinning.value);
  controls.update(); renderer.render(scene, camera);
}
async function mountScene() {
  release();
  const ticket = generation; state.value = 'loading';
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, concept.value ? (props.compact ? .8 : 1.15) : (props.compact ? 1.25 : 1.75)));
    renderer.setClearColor(concept.value ? '#08121e' : '#ffffff', concept.value ? 1 : 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !props.compact;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.addEventListener('webglcontextlost', event => {
      if (!canvas.isConnected) return;
      event.preventDefault(); state.value = 'error'; release();
    });
    // Ordinary wheel gestures continue scrolling the page; Ctrl + wheel zooms the model.
    canvas.addEventListener('wheel', event => { if (!event.ctrlKey) event.stopImmediatePropagation(); }, { capture: true, passive: true });
    viewport.value.appendChild(canvas);
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(38, 1, .05, 100);
    baseline = 4; camera.position.set(0, 1.1, 3.85);
    scene.add(new THREE.HemisphereLight('#e5efff', '#4b5363', 1.05));
    const sun = new THREE.DirectionalLight('#fff5df', 3.1); sun.position.set(-3.5, 3, 5);
    sun.castShadow = !props.compact; sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -3; sun.shadow.camera.right = 3; sun.shadow.camera.top = 3; sun.shadow.camera.bottom = -3;
    sun.shadow.bias = -.0008; sun.shadow.normalBias = .025; scene.add(sun);
    controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.enablePan = false;
    controls.zoomSpeed = .65; controls.rotateSpeed = .65;
    fit();
    const created = await createModel(props.body, props.compact);
    if (ticket !== generation) { disposeModel(created); return; }
    model = created; scene.add(model); initialSpin = model.userData.spin.rotation.y;
    fit(); reset(); state.value = 'ready'; animation = requestAnimationFrame(animate);
  } catch {
    if (ticket === generation) { state.value = 'error'; release(); }
  }
}
onMounted(() => {
  motion = matchMedia('(prefers-reduced-motion: reduce)'); spinning.value = !motion.matches;
  observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !renderer && state.value !== 'error') mountScene();
    else if (!visible && renderer) { release(); state.value = 'waiting'; }
  }, { threshold: .01 });
  observer.observe(holder.value);
  resizeObserver = new ResizeObserver(fit); resizeObserver.observe(viewport.value);
});
watch(() => props.body, () => { if (visible) mountScene(); else { release(); state.value = 'waiting'; } });
onBeforeUnmount(() => { observer?.disconnect(); resizeObserver?.disconnect(); release(); });
</script>

<template>
  <div ref="holder" class="explore-model" :class="{compact, 'concept-model': concept}" :aria-label="name+'三维展示'">
    <div ref="viewport" class="explore-model-viewport" tabindex="0" role="group"
      :aria-label="name+'三维模型。拖动旋转，Ctrl 加滚轮或双指缩放；键盘方向键旋转，加减键缩放，空格暂停，R 重置。'"
      :aria-busy="state==='loading'" @keydown="keyControl"></div>
    <div v-if="state!=='ready'" class="model-state" role="status">
      <template v-if="state==='error'"><strong>暂时无法显示 3D 模型</strong><span>请启用浏览器硬件加速，或重试加载。</span><button @click="mountScene">重新加载</button></template>
      <template v-else><span class="loading-orbit"></span><span>正在准备{{name}}的 3D 模型</span></template>
    </div>
    <span v-if="compact" class="model-type-tag">{{concept?'3D 示意':'3D 模型'}}</span>
    <div v-if="state==='ready'" class="explore-model-toolbar">
      <span class="model-gesture">{{compact?'拖动旋转': '拖动旋转 · 双指 / Ctrl＋滚轮缩放'}}</span>
      <div class="model-control-buttons">
        <button :aria-label="(spinning?'暂停':'开始')+name+'自转'" :title="spinning?'暂停自转':'开始自转'" :aria-pressed="!spinning" @click="spinning=!spinning"><Pause v-if="spinning" :size="15"/><Play v-else :size="15"/></button>
        <template v-if="!compact">
          <button :aria-label="'缩小'+name+'模型'" title="缩小" @click="zoom(1.18)"><Minus :size="15"/></button>
          <button :aria-label="'放大'+name+'模型'" title="放大" @click="zoom(.85)"><Plus :size="15"/></button>
          <button :aria-label="'重置'+name+'视角'" title="重置视角" @click="reset"><RotateCcw :size="15"/></button>
        </template>
        <button v-else :aria-label="'在大视图查看'+name" title="在大视图查看" @click="emit('focus')"><Maximize2 :size="15"/></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.explore-model{position:relative;width:100%;height:100%;min-height:260px;isolation:isolate;color:#48637a;border-radius:12px;overflow:hidden}
.explore-model-viewport{position:absolute;inset:0 0 54px;cursor:grab;outline-offset:-4px;border-radius:12px}
.explore-model-viewport:active{cursor:grabbing}.explore-model-viewport:focus-visible{outline:2px solid #537e9c}
.explore-model-viewport :deep(canvas){display:block;width:100%;height:100%}
.explore-model-toolbar{position:absolute;bottom:4px;left:12px;right:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;pointer-events:none}
.model-gesture{font-size:11px;line-height:1.6;letter-spacing:.3px;color:#698294}
.model-control-buttons{display:flex;gap:6px;pointer-events:auto}
.model-control-buttons button,.model-state button{background:#ffffffde;border:1px solid #dce5eb;border-radius:7px;min-width:34px;height:34px;display:flex;align-items:center;justify-content:center;color:#34536a;transition:background .2s,transform .15s}
.model-control-buttons button:hover{background:#eaf1f6}.model-control-buttons button:active{transform:translateY(2px)}
.model-control-buttons button:focus-visible,.model-state button:focus-visible{outline:2px solid #537e9c;outline-offset:3px}
.model-state{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;font-size:12px;pointer-events:none}
.model-state button{padding:8px 15px;pointer-events:auto}.model-state strong{font-size:14px}
.loading-orbit{height:48px;width:48px;border:1px solid #99adbf;border-radius:50%;transform:rotate(-30deg) scaleY(.4)}
.loading-orbit:before{content:'';display:block;width:25px;height:25px;background:#b4c8d8;border-radius:50%;margin:10px;transform:scaleY(2.5)}
.compact{min-height:0;background:radial-gradient(ellipse at 50% 40%,#f5f8fb,#e9eff4);border-radius:0}
.compact .explore-model-viewport{inset:6px 0 39px}
.compact .explore-model-toolbar{bottom:8px;left:16px;right:12px}
.compact .model-gesture{font-size:10px}.compact .model-control-buttons button{height:29px;min-width:29px}
.model-type-tag{position:absolute;top:14px;left:15px;font-size:10px;letter-spacing:1px;color:#627d93;pointer-events:none}
.concept-model{background:#08121e;color:#c7d6e1}.concept-model .model-gesture,.concept-model .model-type-tag{color:#bdcfdd}
.concept-model .model-control-buttons button{color:#dbe8f3;background:#203548;border-color:#476073}
@media(max-width:600px){.model-gesture{font-size:9px;max-width:155px}.model-control-buttons{gap:4px}.model-control-buttons button{min-width:30px;height:30px}.explore-model-toolbar{left:4px;right:4px}.explore-model{min-height:280px}.compact{min-height:0}}
</style>
