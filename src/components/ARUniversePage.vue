<script setup>
import UniverseFlightPage from './UniverseFlightPage.vue';
defineProps({initialTarget:Object});
defineEmits(['ask', 'navigate', 'consumed']);
</script>
<template><UniverseFlightPage :initial-target="initialTarget" @consumed="$emit('consumed')" @ask="$emit('ask', $event)" @navigate="$emit('navigate', $event)"/></template>
