<script setup>
import { ref } from 'vue';
import { X, Share2 } from '@lucide/vue';
import AnchoredDialog from './AnchoredDialog.vue';
import AssistantActionCard from './AssistantActionCard.vue';
import { useCommunityStore } from '../communityClient.js';
const props=defineProps({open:Boolean,source:Object,action:Object,ownerId:String});
const emit=defineEmits(['close','execute','edit','published']);
const dialog=ref(null),store=useCommunityStore();
function published(post,id,ownerId){if(props.action?.id===id && props.ownerId===ownerId)props.action.publishedPost=post;emit('published',post,id,ownerId);}
function execute(action){dialog.value?.requestClose();emit('execute',action);}
function edit(action){props.action.handedOff=true;dialog.value?.requestClose();emit('edit',action);}
</script>
<template>
  <AnchoredDialog ref="dialog" :open="open" :source="source" panel-class="knowledge-share-panel" label="分享到社区" @close="emit('close')">
    <div class="knowledge-share-content"><header><div><h2><Share2 :size="20"/>分享到社区</h2><p>以文章形式分享这张知识卡的完整内容与参考资料。</p></div><button type="button" aria-label="关闭知识卡分享" @click="dialog?.requestClose()"><X :size="21"/></button></header>
      <AssistantActionCard v-if="action" :key="ownerId+action.id" :action="action" :owner-id="ownerId" :enabled="store.state.user?.id===ownerId" :active="open" @execute="execute" @edit="edit" @published="published"/>
    </div>
  </AnchoredDialog>
</template>
<style scoped>
.knowledge-share-content{width:min(720px,calc(100vw - 40px));padding:24px;background:#fff;border-radius:14px;color:#405d71}.knowledge-share-content>header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.knowledge-share-content h2{display:flex;align-items:center;gap:9px;font-size:21px;margin:0 0 8px}.knowledge-share-content header p{font-size:12px;line-height:1.8;color:#71889b;margin:0}.knowledge-share-content header button{padding:4px;color:#647c8d}.knowledge-share-content :deep(.ai-operation){margin-bottom:0}.knowledge-share-content :deep(summary){font-weight:600}@media(max-width:600px){.knowledge-share-content{padding:16px}.knowledge-share-content h2{font-size:18px}}
</style>
