<script setup>
import { assetUrl } from '../assets.js';
import { ArrowUpRight,ArrowDown } from '@lucide/vue';
defineProps({title:String,description:String,image:String,eyebrow:String,action:String,tone:{type:String,default:'ink'},index:String});
defineEmits(['open']);
</script>
<template><section class="scroll-chapter" :class="tone"><div class="chapter-sticky"><div class="chapter-image"><img :src="assetUrl(image)" alt="" loading="lazy"/><div class="chapter-shade"></div><span class="chapter-index">{{index}} / 星语探索</span><div class="chapter-caption" data-reveal><span>{{eyebrow}}</span><h2>{{title}}</h2><p>{{description}}</p><button @click="$emit('open')">{{action}} <ArrowUpRight :size="18"/></button></div><span class="chapter-down"><ArrowDown :size="21"/></span></div></div></section></template>
