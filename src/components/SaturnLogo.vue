<script setup>
import { assetUrl } from '../assets.js';
defineProps({size:{type:Number,default:44}});
</script>
<template><img class="saturn-logo" :src="assetUrl('/saturn-logo.svg')" alt="" aria-hidden="true" :width="size" :height="size" :style="{width:`${size}px`,height:`${size}px`}" draggable="false"/></template>
