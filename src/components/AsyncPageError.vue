<script setup>
// Consume Vue's loader error without exposing internal file names or network details.
defineProps({ error: Object });
function reload() { window.location.reload(); }
</script>

<template>
  <section class="empty-state" role="alert">
    <h2>页面暂时未能加载</h2>
    <p>请检查网络连接后重新加载。</p>
    <button type="button" class="button secondary" @click="reload">重新加载</button>
  </section>
</template>
