<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Orbit, ArrowUpRight, Pause, Play, Info, ExternalLink } from '@lucide/vue';
import { planets } from '../knowledge.js';
import { ORBIT_SCENE, orbitLayouts, orbitPosition, advanceOrbitTime } from '../orbits.js';
defineEmits(['ask', 'open']);
const selected = ref(planets[2]), paused = ref(false), mode = ref('orbit'), metric = ref('diameter');
const units = { diameter: '千米', year: '地球年', distance: 'AU' };
const maxValue = computed(() => Math.max(...planets.map(p => p[metric.value])));
const metricName = { diameter: '赤道直径', year: '公转周期', distance: '距太阳平均距离' };
const elapsed = ref(0), reducedMotion = ref(false);
const orbitPlanets = computed(() => planets.map((planet, index) => ({ ...planet, ...orbitLayouts[index], ...orbitPosition(orbitLayouts[index], elapsed.value), index })));
let frame, previousTime, motionQuery;
function tick(timestamp) {
  elapsed.value = advanceOrbitTime(elapsed.value, previousTime === undefined ? 0 : timestamp - previousTime, paused.value || reducedMotion.value || mode.value !== 'orbit' || document.hidden);
  previousTime = timestamp;
  frame = requestAnimationFrame(tick);
}
function updateMotion(event) { reducedMotion.value = event.matches; previousTime = undefined; }
function toggleAnimation() { paused.value = !paused.value; previousTime = undefined; }
watch(mode, () => { previousTime = undefined; });
onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.value = motionQuery.matches;
  motionQuery.addEventListener('change', updateMotion);
  frame = requestAnimationFrame(tick);
});
onUnmounted(() => { cancelAnimationFrame(frame); motionQuery?.removeEventListener('change', updateMotion); });
</script>
<template>
  <section class="page-shell atlas-page">
    <div class="eyebrow">A CLOSER LOOK AT OUR COSMIC NEIGHBORS</div>
    <div class="page-title-row">
      <div><h1>星空图谱<span class="heading-dot">.</span></h1><p class="page-description">从我们的宇宙邻居开始，感受世界的尺度。</p></div>
      <div class="segmented" aria-label="图谱展示方式">
        <button :class="{ selected: mode === 'orbit' }" :aria-pressed="mode === 'orbit'" @click="mode = 'orbit'">太阳系漫游</button>
        <button :class="{ selected: mode === 'compare' }" :aria-pressed="mode === 'compare'" @click="mode = 'compare'">行星对比</button>
      </div>
    </div>
    <div class="atlas-layout">
      <div class="atlas-canvas">
        <div class="canvas-header">
          <span><Orbit :size="16" /> SOLAR SYSTEM</span>
          <div v-if="mode === 'orbit'" class="orbit-controls">
            <span class="motion-status">{{ reducedMotion ? '已尊重减少动效偏好' : paused ? '轨道已暂停' : '八大行星 · 公转示意' }}</span>
            <button class="icon-button" :disabled="reducedMotion" :aria-label="paused ? '继续轨道动画' : '暂停轨道动画'" :aria-pressed="paused || reducedMotion" @click="toggleAnimation"><Play v-if="paused || reducedMotion" :size="16" /><Pause v-else :size="16" /></button>
          </div>
        </div>
        <template v-if="mode === 'orbit'">
          <svg class="solar-diagram" :viewBox="`0 0 ${ORBIT_SCENE.width} ${ORBIT_SCENE.height}`" aria-labelledby="orbit-title orbit-description" preserveAspectRatio="xMidYMid meet">
            <title id="orbit-title">八大行星围绕太阳公转的交互示意图</title>
            <desc id="orbit-description">太阳位于所有轨道的共同中心。点击行星或用 Tab、回车键选择，查看右侧详情。轨道间距、行星大小与速度为示意。</desc>
            <defs>
              <radialGradient id="diagram-sun" cx="32%" cy="28%"><stop offset="0" stop-color="#fff5d1" /><stop offset=".52" stop-color="#ffd38a" /><stop offset="1" stop-color="#db932e" /></radialGradient>
              <radialGradient v-for="planet in orbitPlanets" :key="planet.en" :id="`diagram-planet-${planet.en}`" cx="28%" cy="24%"><stop offset="0" stop-color="#fff" stop-opacity=".85" /><stop offset=".44" :stop-color="planet.color" /><stop offset="1" stop-color="#132234" /></radialGradient>
            </defs>
            <g class="orbit-paths" aria-hidden="true">
              <ellipse v-for="(orbit, index) in orbitLayouts" :key="index" :cx="ORBIT_SCENE.cx" :cy="ORBIT_SCENE.cy" :rx="orbit.rx" :ry="orbit.ry" :class="{ 'selected-orbit': selected.name === planets[index].name }" />
            </g>
            <circle class="sun-glow" :cx="ORBIT_SCENE.cx" :cy="ORBIT_SCENE.cy" r="43" aria-hidden="true" />
            <circle :cx="ORBIT_SCENE.cx" :cy="ORBIT_SCENE.cy" r="27" fill="url(#diagram-sun)" aria-hidden="true" />
            <text class="sun-label" :x="ORBIT_SCENE.cx" :y="ORBIT_SCENE.cy + 48" text-anchor="middle">太阳</text>
            <g v-for="planet in orbitPlanets" :key="planet.name" class="diagram-planet" :class="{ chosen: selected.name === planet.name }" :transform="`translate(${planet.x}, ${planet.y})`" role="button" tabindex="0" :aria-label="`查看${planet.name}资料`" :aria-pressed="selected.name === planet.name" @click="selected = planets[planet.index]" @keydown.enter.prevent="selected = planets[planet.index]" @keydown.space.prevent="selected = planets[planet.index]">
              <circle class="planet-hit-target" r="27" />
              <circle class="planet-selection" :r="planet.size + 6" />
              <ellipse v-if="planet.name === '土星'" class="saturn-diagram-ring" :rx="planet.size * 1.85" :ry="planet.size * .55" transform="rotate(-22)" />
              <circle :r="planet.size" :fill="`url(#diagram-planet-${planet.en})`" />
              <text class="planet-name" :y="planet.size + 23" text-anchor="middle">{{ planet.name }}</text>
            </g>
          </svg>
          <div class="canvas-note"><Info :size="14" /> 轨道间距、行星大小和速度均为示意，未按真实比例绘制。</div>
        </template>
        <div v-else class="comparison">
          <div class="filter-row"><button v-for="(label, key) in metricName" :key="key" :class="{ selected: metric === key }" :aria-pressed="metric === key" @click="metric = key">{{ label }}</button></div>
          <p class="chart-unit">{{ metricName[metric] }} / {{ units[metric] }} · 线性比例</p>
          <button v-for="planet in planets" :key="planet.name" class="comparison-row" :aria-label="`${planet.name}，${metricName[metric]} ${planet[metric]} ${units[metric]}`" :aria-pressed="selected.name === planet.name" @click="selected = planet"><span>{{ planet.name }}</span><div><i :style="{ width: `${Math.max(0.5, planet[metric] / maxValue * 100)}%`, background: planet.color }"></i></div><strong>{{ planet[metric].toLocaleString() }}</strong></button>
        </div>
      </div>
      <aside class="planet-detail" aria-live="polite">
        <div class="eyebrow">PLANET PROFILE · {{ selected.en }}</div>
        <div class="detail-planet" :style="{ '--planet-color': selected.color }" :class="{ 'is-saturn': selected.name === '土星' }"></div>
        <h2>{{ selected.name }}<span>{{ selected.en }}</span></h2>
        <p>{{ selected.intro }}</p>
        <dl><div><dt>赤道直径</dt><dd>{{ selected.diameter.toLocaleString() }} <small>km</small></dd></div><div><dt>公转周期</dt><dd>{{ selected.year }} <small>地球年</small></dd></div><div><dt>距太阳平均距离</dt><dd>{{ selected.distance }} <small>AU</small></dd></div></dl>
        <button class="button primary" @click="$emit('ask', `关于${selected.name}，我想了解更多`)">问问星语 </button>
        <a class="source-link" href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noopener noreferrer">NASA 行星数据 </a>
      </aside>
    </div>
    <div class="planet-selector" aria-label="选择行星"><button v-for="p in planets" :key="p.name" :class="{ selected: selected.name === p.name }" :aria-pressed="selected.name === p.name" @click="selected = p"><i :style="{ background: p.color }"></i>{{ p.name }}</button></div>
    <p class="small-note">AU 为天文单位，约等于地球到太阳的平均距离。此处展示公转规律；行星位置不代表当前真实天象。</p>
  </section>
</template>
<style scoped>
.atlas-canvas { min-height: 530px; }
.solar-diagram { position: absolute; inset: 50px 12px 48px; width: calc(100% - 24px); height: calc(100% - 98px); overflow: visible; }
.orbit-paths ellipse { fill: none; stroke: #7894ab26; stroke-width: 1; }
.orbit-paths .selected-orbit { stroke: #79bbd16b; stroke-width: 1.4; }
.sun-glow { fill: #f8bd6010; filter: blur(8px); }
.sun-label { fill: #e7bf7e; font-size: 19px; }
.diagram-planet { cursor: pointer; outline: none; }
.planet-hit-target { fill: transparent; }
.planet-selection { fill: none; stroke: transparent; stroke-width: 2; transition: stroke .2s; }
.diagram-planet.chosen .planet-selection { stroke: #75c8e8; }
.diagram-planet:hover .planet-selection, .diagram-planet:focus-visible .planet-selection { stroke: #fff; stroke-width: 3; }
.planet-name { fill: #bbd5e7; font-size: 19px; paint-order: stroke; stroke: #071422; stroke-width: 4px; stroke-linejoin: round; }
.diagram-planet.chosen .planet-name { fill: #93dcf8; }
.saturn-diagram-ring { fill: none; stroke: #c8b283; stroke-width: 5px; opacity: .75; }
.orbit-controls { display: flex; align-items: center; gap: 12px; }
.orbit-controls .icon-button { min-width: 40px; min-height: 40px; }
.motion-status { font-size: 10px; color: #8ea6bb; }
.canvas-note { font-size: 10px; line-height: 1.7; }
.planet-selector button { min-height: 44px; }
@media (max-width: 600px) {
  .atlas-canvas { min-height: 350px; height: 350px; }
  .solar-diagram { inset: 42px 4px 54px; width: calc(100% - 8px); height: calc(100% - 96px); }
  .planet-name { font-size: 24px; }
  .sun-label { font-size: 24px; }
  .motion-status { font-size: 8px; }
  .orbit-controls { gap: 5px; }
  .canvas-note { font-size: 8px; left: 14px; right: 14px; }
  .planet-selector { flex-wrap: wrap; }
  .planet-selector button { min-width: calc(25% - 6px); }
  .comparison { padding: 54px 17px 18px; }
  .comparison-row { min-height: 29px; padding: 7px 0; }
}
</style>
