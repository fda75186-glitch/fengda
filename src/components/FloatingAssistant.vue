<script setup>
import { computed, nextTick, ref, onMounted, onUnmounted } from 'vue';
import { GripVertical, X } from '@lucide/vue';
import SaturnLogo from './SaturnLogo.vue';
import { clampPosition, restorePosition, isDragGesture } from '../interaction.js';

const emit = defineEmits(['ask']);
const DOCK_SIZE = 60, PANEL_WIDTH = 224;
const panel = ref(null), logoButton = ref(null), restoreButton = ref(null);
const hidden = ref(false), ready = ref(false), position = ref({ x: 0, y: 0 });
const hovered = ref(false), pinned = ref(false), keyboardFocus = ref(false);
const dragging = ref(false), dragExpanded = ref(false);
const viewportSize = ref({ width: 0, height: 0 });
// Only the logo dock moves; the controls grow into the available space beside it.
const expanded = computed(() => hovered.value || pinned.value || keyboardFocus.value || (dragging.value && dragExpanded.value));
const space = computed(() => ({
  left: Math.max(0, position.value.x - 12),
  right: Math.max(0, viewportSize.value.width - position.value.x - DOCK_SIZE - 12),
}));
const expandsRight = computed(() => space.value.left < PANEL_WIDTH - DOCK_SIZE && space.value.right > space.value.left);
const surfaceWidth = computed(() => Math.min(PANEL_WIDTH, DOCK_SIZE + (expandsRight.value ? space.value.right : space.value.left)));
let gesture = null, moved = false, suppressClick = false, clickTimer;

function save() {
  try { localStorage.setItem('xingyu-assistant-widget', JSON.stringify({ position: position.value, hidden: hidden.value })); } catch {}
}
function constrain() {
  viewportSize.value = { width: window.innerWidth, height: window.innerHeight };
  position.value = clampPosition(position.value, viewportSize.value, { width: DOCK_SIZE, height: DOCK_SIZE });
}
function begin(event) {
  if (event.button !== 0 || event.target.closest('[data-no-drag]')) return;
  gesture = { start: { x: event.clientX, y: event.clientY }, origin: { ...position.value }, id: event.pointerId };
  dragExpanded.value = expanded.value;
  moved = false;
}
function move(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  if (!event.buttons) { releaseGesture(); return; }
  const point = { x: event.clientX, y: event.clientY };
  if (!moved && isDragGesture(gesture.start, point)) {
    moved = true;
    dragging.value = true;
    panel.value.setPointerCapture(event.pointerId);
  }
  if (moved) position.value = clampPosition({
    x: gesture.origin.x + point.x - gesture.start.x,
    y: gesture.origin.y + point.y - gesture.start.y,
  }, viewportSize.value, { width: DOCK_SIZE, height: DOCK_SIZE });
}
function releaseGesture() {
  if (gesture && panel.value?.hasPointerCapture(gesture.id)) panel.value.releasePointerCapture(gesture.id);
  gesture = null;
  dragging.value = false;
  dragExpanded.value = false;
  save();
}
function finish(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  if (moved) {
    suppressClick = true;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { suppressClick = false; }, 350);
  }
  releaseGesture();
}
function collapse() { hovered.value = pinned.value = keyboardFocus.value = false; }
function toggle() {
  if (suppressClick) { suppressClick = false; return; }
  pinned.value = !pinned.value;
  hovered.value = keyboardFocus.value = false;
}
function enter(event) {
  if (event.pointerType === 'mouse' || event.pointerType === 'pen') hovered.value = true;
}
function focusIn(event) {
  if (event.target.matches(':focus-visible')) keyboardFocus.value = true;
}
function focusOut(event) {
  if (!panel.value?.contains(event.relatedTarget)) keyboardFocus.value = false;
}
function outside(event) {
  if (!panel.value?.contains(event.target)) collapse();
}
function escape(event) {
  if (event.key !== 'Escape' || !expanded.value) return;
  if (panel.value?.contains(document.activeElement)) logoButton.value?.focus({ preventScroll: true });
  collapse();
}
async function hide() {
  const keepFocus = panel.value?.contains(document.activeElement);
  collapse();
  hidden.value = true;
  save();
  if (keepFocus) { await nextTick(); restoreButton.value?.focus({ preventScroll: true }); }
}
async function show() {
  const keepFocus = document.activeElement === restoreButton.value;
  hidden.value = false;
  collapse();
  constrain();
  save();
  if (keepFocus) { await nextTick(); logoButton.value?.focus({ preventScroll: true }); keyboardFocus.value = false; }
}
function ask() { collapse(); emit('ask'); }
function keyboardMove(event) {
  if (event.key === 'Home') {
    event.preventDefault();
    position.value = restorePosition(null, viewportSize.value, { width: DOCK_SIZE, height: DOCK_SIZE });
    save();
    return;
  }
  const changes = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
  if (!changes[event.key]) return;
  event.preventDefault();
  const [x, y] = changes[event.key];
  position.value = clampPosition({ x: position.value.x + x, y: position.value.y + y }, viewportSize.value, { width: DOCK_SIZE, height: DOCK_SIZE });
  save();
}
onMounted(() => {
  viewportSize.value = { width: window.innerWidth, height: window.innerHeight };
  let saved;
  try { saved = JSON.parse(localStorage.getItem('xingyu-assistant-widget')); } catch {}
  hidden.value = !!saved?.hidden;
  position.value = restorePosition(saved?.position, viewportSize.value, { width: DOCK_SIZE, height: DOCK_SIZE });
  ready.value = true;
  window.addEventListener('resize', constrain);
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown', escape);
});
onUnmounted(() => {
  clearTimeout(clickTimer);
  window.removeEventListener('resize', constrain);
  document.removeEventListener('pointerdown', outside);
  document.removeEventListener('keydown', escape);
});
</script>

<template>
  <Transition name="widget">
    <div v-if="ready && !hidden" ref="panel" class="assistant-widget widget-collapsible"
      :class="{ dragging, 'is-expanded': expanded, 'expands-right': expandsRight }"
      :style="{ left: position.x + 'px', top: position.y + 'px', '--widget-expanded-width': surfaceWidth + 'px' }"
      @pointerenter="enter" @pointerleave="hovered = false" @focusin="focusIn" @focusout="focusOut"
      @pointerdown="begin" @pointermove="move" @pointerup="finish" @pointercancel="releaseGesture">
      <div class="widget-surface" aria-hidden="true"></div>
      <button ref="logoButton" type="button" class="widget-logo-trigger" :aria-expanded="expanded"
        aria-controls="xingyu-widget-actions" :aria-label="expanded ? '收起星语快捷入口' : '展开星语快捷入口'"
        title="悬停或点击展开 · 拖动移动" @click="toggle" @keydown="keyboardMove">
        <SaturnLogo :size="42" />
      </button>
      <div id="xingyu-widget-actions" class="widget-actions" :inert="!expanded" :aria-hidden="!expanded">
        <button type="button" class="widget-grip" aria-label="移动星语入口，方向键调整位置，Home 键复位"
          title="拖动移动 · 方向键调整 · Home 键复位" @keydown="keyboardMove"><GripVertical :size="16" /></button>
        <button type="button" data-no-drag class="widget-open" @click="ask"><span>问问星语</span></button>
        <button type="button" data-no-drag class="widget-hide" aria-label="隐藏星语快捷入口" title="隐藏" @click="hide"><X :size="15" /></button>
      </div>
    </div>
  </Transition>
  <Transition name="widget">
    <button v-if="ready && hidden" ref="restoreButton" type="button" class="widget-restore widget-logo-restore"
      aria-label="恢复星语快捷入口" title="恢复星语" @click="show"><SaturnLogo :size="36" /></button>
  </Transition>
</template>

<style scoped>
.assistant-widget.widget-collapsible {
  width:60px;height:60px;padding:0;border:0;background:none;border-radius:30px;
  box-shadow:none;backdrop-filter:none;transition:none;
}
.widget-collapsible .widget-surface {
  position:absolute;top:0;right:0;width:60px;height:60px;pointer-events:auto;
  border:1px solid #ded7c9;border-radius:30px;background:#fffdf8f7;
  box-shadow:0 6px 24px #29384b18;backdrop-filter:blur(12px);
  transition:width .32s cubic-bezier(.22,.8,.24,1),border-color .2s,box-shadow .2s;
}
.widget-collapsible.is-expanded .widget-surface {width:var(--widget-expanded-width);border-color:#c7b395;box-shadow:0 8px 28px #29384b24}
.widget-collapsible.expands-right .widget-surface {right:auto;left:0}
.widget-logo-trigger {position:absolute;top:8px;left:8px;width:44px;height:44px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:none;cursor:grab;z-index:1;transition:transform .18s}
.widget-logo-trigger:hover {transform:rotate(-5deg)}
.widget-logo-trigger:active {transform:scale(.93)}
.widget-collapsible.dragging .widget-logo-trigger {cursor:grabbing;transform:none}
.widget-collapsible .widget-actions {
  position:absolute;top:8px;right:60px;width:calc(var(--widget-expanded-width) - 72px);height:44px;
  display:flex;align-items:center;gap:4px;opacity:0;visibility:hidden;pointer-events:none;
  transform:translateX(12px);transition:opacity .16s,transform .28s cubic-bezier(.22,.8,.24,1),visibility .16s;
}
.widget-collapsible.expands-right .widget-actions {right:auto;left:60px;transform:translateX(-12px)}
.widget-collapsible.is-expanded .widget-actions {opacity:1;visibility:visible;pointer-events:auto;transform:translateX(0);transition-delay:.05s,0s,0s}
.widget-collapsible .widget-grip,.widget-collapsible .widget-hide {width:28px;height:44px;flex:none;border-radius:14px}
.widget-collapsible .widget-open {height:44px;flex:1;min-width:0;cursor:pointer;border-radius:12px}
.widget-collapsible .widget-open>span {margin:0;font-size:12px;white-space:nowrap}
.widget-collapsible .widget-open:hover {background:#f5ecdf;color:#775531}
.widget-collapsible .widget-open:active,.widget-collapsible .widget-hide:active {transform:translateY(1px)}
.widget-collapsible button:focus-visible,.widget-restore.widget-logo-restore:focus-visible {outline:2px solid #719cb7;outline-offset:2px}
.widget-restore.widget-logo-restore {width:48px;height:48px;right:8px;padding:0;border:1px solid #ded7c9;border-radius:50%;transition:background .2s,transform .2s}
.widget-restore.widget-logo-restore:hover {padding:0;transform:scale(1.06)}
@media(max-width:360px){.widget-collapsible .widget-grip,.widget-collapsible .widget-hide{width:24px}}
@media(prefers-reduced-motion:reduce){.widget-collapsible .widget-surface,.widget-collapsible .widget-actions,.widget-collapsible button,.widget-restore.widget-logo-restore{transition:none}}
</style>
