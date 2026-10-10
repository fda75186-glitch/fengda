<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { Search, X } from '@lucide/vue';
import { articles } from '../knowledge.js';
import { observatories } from '../observatories.js';
import { communityPosts } from '../sharedCommunity.js';
const emit=defineEmits(['navigate','open','place','post']);
const opened=ref(false),query=ref(''),input=ref(null);
const pages=[['explore','探索宇宙','天体 科普 行星'],['atlas','星空图谱','太阳系 公转 星图'],['assistant','AI 星语','聊天 提问'],['guide','观测指南','天文馆 观测站'],['ar','AR 宇宙云图','相机 天空'],['community','星语社区','发布 摄影 话题'],['quiz','知识问答','测验 挑战'],['studio','知识卡工作室','制作 卡片']];
const entries=computed(()=>[...articles.map(a=>({kind:'科普故事',title:a.title,text:a.short+' '+a.keywords.join(' '),run:()=>emit('open',a)})),...observatories.map(p=>({kind:'天文地标',title:p.name,text:p.intro+' '+p.region,run:()=>emit('place',p.id)})),...pages.map(p=>({kind:'功能',title:p[1],text:p[2],run:()=>emit('navigate',p[0])})),...communityPosts.value.map(p=>({kind:'社区话题',title:p.title,text:p.content,run:()=>emit('post',p.id)}))]);
const results=computed(()=>{const q=query.value.trim().toLowerCase();return q?entries.value.filter(e=>(e.title+' '+e.text).toLowerCase().includes(q)).slice(0,30):[]});
function toggle(){opened.value=!opened.value;if(opened.value)setTimeout(()=>input.value?.focus(),30)}
function choose(e){e.run();opened.value=false;query.value=''}
function key(e){if(e.key==='Escape')opened.value=false;if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();toggle()}}
onMounted(()=>document.addEventListener('keydown',key));onUnmounted(()=>document.removeEventListener('keydown',key));
</script>
<template><div class="global-search"><button class="icon-button" aria-label="展开全站搜索" :aria-expanded="opened" @click="toggle"><Search :size="20"/></button><Transition name="search-expand"><section v-if="opened" class="global-search-panel" aria-label="全站搜索"><div class="global-search-input"><Search :size="24"/><input ref="input" v-model="query" placeholder="搜索天体、科普、天文馆或社区话题" aria-label="全站搜索关键词" @keydown.enter="results[0]&&choose(results[0])"/><button class="icon-button" aria-label="关闭全站搜索" @click="opened=false"><X :size="22"/></button></div><div class="global-search-results"><p v-if="!query.trim()">探索一个问题：<button v-for="word in ['月亮','土星','天文馆','摄影']" @click="query=word">{{word}}</button><small>Ctrl / ⌘ + K 快速搜索</small></p><p v-else-if="!results.length">没有找到相关内容，试试更短的关键词。</p><button v-for="(e,i) in results" :key="i" class="global-result" @click="choose(e)"><span>{{e.kind}}</span><strong>{{e.title}}</strong><small>{{e.text.slice(0,85)}}</small></button></div></section></Transition></div></template>
