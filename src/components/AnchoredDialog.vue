<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { captureAnchoredSurface, moveAnchoredSurface } from '../anchoredSurface.js';

const props = defineProps({ open: Boolean, source: Object, panelClass: String, labelledby: String, label: String });
const emit = defineEmits(['close']);
const nativeDialog = ref(null), panel = ref(null), animationHost = ref(null), backdrop = ref(null);
let motion, stage = 'closed', sourceElement, sourceSnapshot, sourceVisibility, previousOverflow, previousGutter, opener, epoch = 0;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function restoreSource() {
  if (sourceElement) sourceElement.style.visibility = sourceVisibility;
  sourceElement = null; sourceSnapshot = null;
}
function finishOpen() {
  if (stage !== 'opening') return;
  panel.value.style.visibility = 'visible'; backdrop.value.style.opacity = '1';
  motion?.dispose(); motion = null; stage = 'open';
  panel.value.querySelector('[autofocus],button,a[href],input,textarea')?.focus({ preventScroll: true });
}
function finishClose(notify = true) {
  if (stage === 'closed') return;
  ++epoch; stage = 'closed';
  restoreSource(); nativeDialog.value?.close(); motion?.dispose(); motion = null;
  document.body.style.overflow = previousOverflow;
  document.documentElement.style.scrollbarGutter = previousGutter;
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  if (notify) emit('close');
}
async function openDialog() {
  if (stage !== 'closed') finishClose(false);
  const currentEpoch = ++epoch;
  stage = 'opening';
  sourceElement = props.source?.isConnected ? props.source : null;
  sourceVisibility = sourceElement?.style.visibility || '';
  sourceSnapshot = sourceElement ? captureAnchoredSurface(sourceElement) : null;
  opener = sourceElement?.closest('button,a[href]') || document.activeElement;
  previousOverflow = document.body.style.overflow;
  previousGutter = document.documentElement.style.scrollbarGutter;
  document.documentElement.style.scrollbarGutter = 'stable';
  document.body.style.overflow = 'hidden';
  await nextTick();
  if (currentEpoch !== epoch || !props.open) { finishClose(false); return; }
  panel.value.style.visibility = 'visible'; backdrop.value.style.opacity = '1';
  nativeDialog.value.showModal(); panel.value.scrollTop = 0;
  const destination = captureAnchoredSurface(panel.value, sourceSnapshot);
  if (!sourceSnapshot || !destination || reducedMotion()) { finishOpen(); return; }
  sourceElement.style.visibility = 'hidden'; panel.value.style.visibility = 'hidden';
  backdrop.value.style.opacity = '0';
  motion = moveAnchoredSurface(animationHost.value, backdrop.value, sourceSnapshot, destination, true, finishOpen);
}
function requestClose() {
  if (stage === 'closing' || stage === 'closed') return;
  if (reducedMotion()) { finishClose(); return; }
  if (stage === 'opening' && motion) {
    stage = 'closing'; motion.reverse(() => finishClose()); return;
  }
  const destination = sourceElement?.isConnected ? captureAnchoredSurface(sourceElement) : null;
  const current = captureAnchoredSurface(panel.value);
  if (!destination || !current) { finishClose(); return; }
  stage = 'closing'; panel.value.style.visibility = 'hidden';
  motion = moveAnchoredSurface(animationHost.value, backdrop.value, current, destination, false, () => finishClose());
}
function onResize() {
  if (stage === 'opening') finishOpen();
  else if (stage === 'closing') finishClose();
}
watch(() => props.open, isOpen => { if (isOpen) void openDialog(); else finishClose(false); });
window.addEventListener('resize', onResize);
onBeforeUnmount(() => { ++epoch; finishClose(false); window.removeEventListener('resize', onResize); });
defineExpose({ requestClose });
</script>

<template>
  <dialog ref="nativeDialog" class="anchored-dialog-modal" :aria-labelledby="labelledby" :aria-label="label" @cancel.prevent="requestClose" @click="($event.target===nativeDialog)&&requestClose()">
    <div ref="backdrop" class="anchored-dialog-backdrop" aria-hidden="true" @click="requestClose"/>
    <div ref="panel" class="anchored-dialog-panel" :class="panelClass"><slot/></div>
    <div ref="animationHost" class="anchored-dialog-animation" aria-hidden="true"/>
  </dialog>
</template>

<style scoped>
.anchored-dialog-modal{position:fixed;inset:0;box-sizing:border-box;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:visible;animation:none!important;transform:none!important;opacity:1!important}
.anchored-dialog-modal::backdrop{background:transparent;backdrop-filter:none}
.anchored-dialog-backdrop{position:absolute;inset:0;background:#17304566;opacity:1}
.anchored-dialog-panel{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);margin:0;overflow:auto;max-height:calc(100dvh - 64px);max-width:calc(100% - 32px);overscroll-behavior:contain;scrollbar-gutter:stable;z-index:1;box-shadow:0 24px 90px #13273544;animation:none!important;opacity:1!important}
.anchored-dialog-animation{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:visible}
@media(max-width:600px){.anchored-dialog-panel{max-height:calc(100dvh - 32px)}}
</style>
