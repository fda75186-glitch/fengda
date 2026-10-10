<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCelestial, disposeScene } from '../celestial3d.js';
import { assetUrl } from '../assets.js';
const props=defineProps({body:String,title:String});const emit=defineEmits(['open']);
const mount=ref(null),failed=ref(false),rotating=ref(true);let renderer,scene,camera,controls,object,observer,frame,visible=true;
function build(){if(!scene)return;if(object){scene.remove(object);disposeScene(object)}object=createCelestial(['earth','moon','jupiter','saturn','sun'].includes(props.body)?props.body:'moon');scene.add(object);camera.position.set(0,.45,props.body==='saturn'?5.6:3.3);controls.target.set(0,0,0);controls.update()}
function resize(){const w=mount.value.clientWidth,h=mount.value.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}
function animate(){frame=requestAnimationFrame(animate);if(!visible)return;if(rotating.value&&!matchMedia('(prefers-reduced-motion: reduce)').matches)object.rotation.y+=.002;controls.update();renderer.render(scene,camera)}
function reset(){build()}
onMounted(()=>{try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));mount.value.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label',props.title+'，可拖动旋转的三维天体');scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,1,.1,100);scene.add(new THREE.HemisphereLight(0xbcd6f2,0x534632,1.9));const light=new THREE.DirectionalLight(0xffefcf,3.6);light.position.set(-4,3,5);scene.add(light);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2;controls.maxDistance=8;build();observer=new ResizeObserver(resize);observer.observe(mount.value);resize();animate()}catch{failed.value=true}});
watch(()=>props.body,build);onBeforeUnmount(()=>{cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();if(scene)disposeScene(scene);renderer?.dispose()});
</script>
<template><div class="celestial-model"><div ref="mount" class="celestial-canvas"></div><img v-if="failed" class="model-fallback" :src="assetUrl('/images/'+body+'.jpg')" :alt="title"/><span class="model-caption">{{failed?'当前设备使用影像备用显示':'3D 天体 · 拖动旋转，滚动缩放'}}</span><div class="model-actions"><button @click="rotating=!rotating">{{rotating?'暂停自转':'开始自转'}}</button><button @click="reset">重置视角</button><button class="button secondary" @click="emit('open')">阅读天体故事</button></div></div></template>
