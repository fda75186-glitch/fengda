<script setup>
import { assetUrl } from '../assets.js';
import { ref, onUnmounted, watch } from 'vue';
import { WandSparkles, Sparkles, ArrowRight, Bookmark, Download, ExternalLink, Orbit, Share2 } from '@lucide/vue';
import { createAiClient, createAiRequestScope } from '../aiClient.js';
import { getCommunityToken, useCommunityStore } from '../communityClient.js';
import { knowledgeCardMarkdown } from '../../shared/assistant-tools.mjs';
const props=defineProps({initialCard:Object});
const emit=defineEmits(['save','login','generated','share']);
const topic=ref(props.initialCard?.title || '木星大红斑'),level=ref(props.initialCard?.level || '入门'),card=ref(props.initialCard || null),busy=ref(false),error=ref(''),progress=ref('');
const store=useCommunityStore(),requests=createAiRequestScope();
const client=createAiClient({apiBase:new URL(import.meta.env.VITE_COMMUNITY_API_URL || '/',window.location.origin),getToken:getCommunityToken});
onUnmounted(()=>requests.cancel());
watch(()=>props.initialCard,value=>{if(value){requests.cancel();busy.value=false;error.value='';card.value=value;topic.value=value.title;level.value=value.level;}});
watch(()=>store.state.user,(user,old)=>{if(user?.id!==old?.id){requests.cancel();busy.value=false;card.value=null;}});
async function generate(){
 if(!topic.value.trim() || busy.value)return;
 if(!store.state.user){error.value='登录星语账号后即可制作AI知识卡。';emit('login');return;}
 const request=requests.begin();busy.value=true;error.value='';progress.value='正在查阅站内资料…';let prepared;
 try{
  await client.agent({task:{kind:'knowledge_card',topic:topic.value.trim(),level:level.value},messages:[{role:'user',content:`请制作一张主题为“${topic.value.trim()}”的${level.value}天文知识卡。先检索并阅读站内资料，调用create_knowledge_card生成卡片，并附上真实参考资料；不要发布到社区。`}],signal:request.signal,onEvent(event){
   if(!request.current())return;
   if(event.type==='tool')progress.value=event.name==='create_knowledge_card'?'正在排版知识卡…':'正在查阅知识与来源…';
   if(event.type==='action' && event.action.type==='knowledge_card')prepared=event.action.card;
  }});
  if(!request.current())return;
  if(!prepared)throw Error('AI没有生成完整知识卡，请换一个更具体的主题重试。');
  card.value=prepared;emit('generated',prepared);
 }catch(e){if(request.current())error.value=e.message || '制作未完成，请重试。';}
 finally{if(request.current())busy.value=false;requests.finish(request);}
}
function stopGeneration(){requests.cancel();busy.value=false;progress.value='';error.value='已停止制作，原知识卡仍然保留。';}
function exportCard(){if(!card.value)return;const url=URL.createObjectURL(new Blob([knowledgeCardMarkdown(card.value)],{type:'text/markdown;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`星语知识卡-${card.value.cardId}.md`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
</script>
<template>
  <section class="page-shell"><div class="eyebrow">TURN YOUR CURIOSITY INTO A KEEPSAKE</div><h1>知识卡工作室<span class="heading-dot">.</span></h1><p class="page-description">一个小问题，一张装得下宇宙的知识卡。</p><div class="studio-layout"><div class="studio-form"><div class="studio-title"><WandSparkles :size="24"/><h2>今天，想了解什么？</h2></div><span class="demo-pill">腾讯混元 · AI知识卡</span><form @submit.prevent="generate"><label for="card-topic">探索主题</label><input id="card-topic" v-model="topic" maxlength="100" placeholder="例如：木星大红斑"/><div class="suggestion-row"><button v-for="name in ['木星大红斑','土星光环','仙女座星系','太阳']" type="button" @click="topic=name">{{name}}</button></div><label for="card-level">阅读深度</label><select id="card-level" v-model="level"><option>入门</option><option>进阶</option></select><p class="small-note">入门：简洁概述 · 进阶：增加背景原理。<br/>AI查阅站内资料后制作，参考来源可点击核实。</p><button type="submit" class="button primary" :disabled="busy||!topic.trim()"><Sparkles :size="17"/>{{busy?progress:'制作我的知识卡'}} <ArrowRight :size="17"/></button><button v-if="busy" type="button" class="button secondary" @click="stopGeneration">停止制作</button><p v-if="error" class="form-error" role="alert">{{error}}</p></form></div><div class="studio-preview" :aria-busy="busy"><article v-if="card" class="generated-card"><img :src="assetUrl(`/images/${card.image}.jpg`)" :alt="card.title"/><div class="generated-content"><div class="eyebrow">STARWHISPER KNOWLEDGE CARD · {{card.level}}</div><h2>{{card.title}}</h2><p>{{card.intro}}</p><ol><li v-for="point in card.points">{{point}}</li></ol><div class="mini-fact"><Sparkles :size="17"/><span>{{card.fact}}</span></div><a v-if="card.source" class="source-link" :href="card.source" target="_blank" rel="noopener noreferrer">{{card.sourceName}} <ExternalLink :size="13"/></a><p v-if="!card.source" class="small-note">AI生成内容，尚无站内参考来源，请核实。</p><p class="small-note">AI辅助制作，配图为站内栏目素材。</p><div class="detail-actions"><button class="button primary" :disabled="busy" @click="emit('share',card,$event.currentTarget)"><Share2 :size="16"/> 分享到社区</button><button class="button primary" @click="$emit('save',card)"><Bookmark :size="16"/> 收藏知识卡</button><button class="button secondary" @click="exportCard"><Download :size="16"/> 导出 Markdown</button></div></div></article><div v-else class="studio-empty"><div class="preview-outline"><Orbit :size="60" :stroke-width="1"/><span>YOUR UNIVERSE,<br/>IN A CARD.</span><i></i><i></i><i></i></div><p>你的第一张宇宙知识卡，<br/>即将在这里诞生。</p></div></div></div></section>
</template>
