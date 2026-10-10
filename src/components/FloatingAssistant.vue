<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { GripVertical, X, ArrowUpRight } from '@lucide/vue';
import SaturnLogo from './SaturnLogo.vue';
import { clampPosition, restorePosition, isDragGesture } from '../interaction.js';
const emit=defineEmits(['ask']);
const panel=ref(null),hidden=ref(false),position=ref({x:0,y:0}),dragging=ref(false),ready=ref(false);
let gesture=null,moved=false;
function size(){return {width:panel.value?.offsetWidth||192,height:panel.value?.offsetHeight||60}}
function viewport(){return {width:window.innerWidth,height:window.innerHeight}}
function save(){try{localStorage.setItem('xingyu-assistant-widget',JSON.stringify({position:position.value,hidden:hidden.value}))}catch{}}
function constrain(){position.value=clampPosition(position.value,viewport(),size())}
function begin(event){if(event.button!==0||event.target.closest('[data-no-drag]'))return;gesture={start:{x:event.clientX,y:event.clientY},origin:{...position.value},id:event.pointerId,open:!!event.target.closest('.widget-open')};moved=false;panel.value.setPointerCapture(event.pointerId)}
function move(event){if(!gesture)return;const point={x:event.clientX,y:event.clientY};if(isDragGesture(gesture.start,point)){moved=true;dragging.value=true}if(moved){position.value=clampPosition({x:gesture.origin.x+point.x-gesture.start.x,y:gesture.origin.y+point.y-gesture.start.y},viewport(),size())}}
function finish(event){if(!gesture)return;const wasDrag=moved,shouldOpen=gesture.open;gesture=null;dragging.value=false;if(panel.value.hasPointerCapture(event.pointerId))panel.value.releasePointerCapture(event.pointerId);save();if(!wasDrag&&shouldOpen)emit('ask')}
function cancel(){gesture=null;dragging.value=false;save()}
function hide(){hidden.value=true;save()}
function show(){hidden.value=false;constrain();save()}
function keyboardMove(event){if(event.key==='Home'){event.preventDefault();position.value=restorePosition(null,viewport(),size());save();return}const changes={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};if(!changes[event.key])return;event.preventDefault();const [x,y]=changes[event.key];position.value=clampPosition({x:position.value.x+x,y:position.value.y+y},viewport(),size());save()}
onMounted(()=>{try{const saved=JSON.parse(localStorage.getItem('xingyu-assistant-widget'));hidden.value=!!saved?.hidden;position.value=restorePosition(saved?.position,viewport(),size())}catch{position.value=restorePosition(null,viewport(),size())}ready.value=true;window.addEventListener('resize',constrain)});
onUnmounted(()=>window.removeEventListener('resize',constrain));
</script>
<template>
 <Transition name="widget"><div v-if="ready&&!hidden" ref="panel" class="assistant-widget" :class="{dragging}" :style="{left:position.x+'px',top:position.y+'px'}" @pointerdown="begin" @pointermove="move" @pointerup="finish" @pointercancel="cancel"><button class="widget-grip" aria-label="移动星语入口，方向键调整位置，Home 键复位" title="拖动移动 · 方向键调整 · Home 键复位" @keydown="keyboardMove"><GripVertical :size="16"/></button><button class="widget-open" aria-label="向星语提问" @keydown.enter.prevent="emit('ask')" @keydown.space.prevent="emit('ask')"><SaturnLogo :size="36"/><span>问问星语</span></button><button data-no-drag class="widget-hide" aria-label="隐藏星语快捷入口" title="隐藏" @click.stop="hide"><X :size="13"/></button></div></Transition>
 <Transition name="widget"><button v-if="ready&&hidden" class="widget-restore" aria-label="恢复星语快捷入口" title="恢复星语" @click="show"><SaturnLogo :size="32"/><span>显示星语</span></button></Transition>
</template>
