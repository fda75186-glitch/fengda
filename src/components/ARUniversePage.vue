<script setup>
import UniverseFlightPage from './UniverseFlightPage.vue';
defineEmits(['ask', 'navigate']);
</script>
<template><UniverseFlightPage @ask="$emit('ask', $event)" @navigate="$emit('navigate', $event)"/></template>
