<script setup>
import { assetUrl } from '../assets.js';
import { ArrowDown } from '@lucide/vue';
const props=defineProps({eyebrow:String,title:String,description:String,image:String,number:{type:String,default:'01'},target:{type:String,default:'feature-content'}});
function scrollNext(){document.getElementById(props.target)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})}
</script>
<template><section class="feature-intro"><div class="feature-stage"><img :src="assetUrl(image)" alt=""/><div class="feature-shade"></div><span class="feature-number">{{number}} / EXPLORE</span><div class="feature-caption"><span>{{eyebrow}}</span><h2>{{title}}</h2><p>{{description}}</p><button class="feature-scroll" @click="scrollNext">向下探索 <ArrowDown :size="16"/></button></div><span class="feature-sideword">STARWHISPER</span></div></section></template>
