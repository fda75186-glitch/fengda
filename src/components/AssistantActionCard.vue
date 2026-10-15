<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { Bookmark, Download, ArrowUpRight, Check, Send, FileText, Share2 } from '@lucide/vue';
import ImageGenerationCard from './ImageGenerationCard.vue';
import SafeMarkdown from './SafeMarkdown.vue';
import { assetUrl } from '../assets.js';
import { assistantCategories, assistantPages, assistantArticles, assistantDestinations, knowledgeCardMarkdown } from '../../shared/assistant-tools.mjs';
import { useCommunityStore, getCommunityToken } from '../communityClient.js';
import { createAssistantPublication } from '../assistantPublication.js';
const props = defineProps({ action: Object, ownerId: String, enabled: Boolean, active: Boolean, imagesConfigured: Boolean });
const emit = defineEmits(['save', 'execute', 'edit', 'published', 'image', 'share']);
const store = useCommunityStore(), approved = ref(false), busy = ref(false), error = ref(''), posted = ref(props.action.publishedPost || null), saved = ref(Boolean(props.action.saved)), locked = ref(false);
const draft = reactive({ ...props.action.draft });
watch(draft, () => { if (props.action.type === 'community_draft') props.action.draft = { ...draft }; }, { deep: true });
const publication = props.action.type === 'community_draft' ? createAssistantPublication({ action: props.action, ownerId: props.ownerId, getSession: () => ({ userId: store.state.user?.id, token: getCommunityToken() }), publish: (payload, guard) => store.publishPost(payload, guard) }) : null;
const canUse = computed(() => props.enabled && store.state.user?.id === props.ownerId && !props.action.handedOff);
const operationLabel = computed(() => {
  const a = props.action;
  if (a.operation === 'navigate') return `打开${assistantPages[a.target]}`;
  if (a.operation === 'open_knowledge') return `阅读：${assistantArticles.find(p => p.id === a.target)?.title}`;
  if (a.operation === 'bookmark_knowledge') return '收藏这篇知识';
  if (a.operation === 'locate_observatory') return '在地图中定位观测站';
  if (a.operation === 'explore_universe') return `进入宇宙：${assistantDestinations.find(p => p.id === a.target)?.name}`;
  if (a.operation === 'explore_system') return `在NASA目录中探索 ${a.target}`;
  if (a.operation === 'select_planet') return '打开行星图谱';
  if (a.operation === 'compare_planets') return '打开行星数据对比';
  if (a.operation === 'prepare_upload') return a.target==='video'?'选择视频并发布':'选择图片并发布';
  if (a.operation === 'search_community') return `搜索社区：${a.query}`;
  return '打开社区帖子';
});
function save() { if (!canUse.value) return; emit('save', props.action.card); saved.value = true; }
function download() {
  if (!canUse.value) return;
  const url = URL.createObjectURL(new Blob([knowledgeCardMarkdown(props.action.card)], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `星语知识卡-${props.action.id}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function publish() {
  if (!canUse.value || busy.value || posted.value) return;
  busy.value = true; error.value = '';
  try { const ownerId=props.ownerId,token=getCommunityToken(),actionId=props.action.id;const work = publication.confirm(draft, approved.value); locked.value = publication.locked; const result = await work;if(store.state.user?.id!==ownerId || getCommunityToken()!==token)throw Error('账号已变化，请使用原账号查看发布结果。');posted.value=result;props.action.publishedPost=result;emit('published', result, actionId, ownerId); }
  catch (e) { error.value = e.message; } finally { busy.value = false; locked.value = publication.locked; }
}
</script>
<template>
  <ImageGenerationCard v-if="action.type==='image_request'" :initial-request="action.request" :saved-result="action.generatedImage" :owner-id="ownerId" :enabled="enabled" :active="active" :configured="imagesConfigured" @completed="action.generatedImage=$event" @use="emit('image',$event)"/>
  <section v-else class="ai-operation" :aria-busy="busy">
    <template v-if="action.type === 'knowledge_card'">
      <div class="ai-operation-type">知识卡 · AI辅助制作 · {{action.card.level}}</div>
      <img class="ai-card-cover" :src="assetUrl(`/images/${action.card.image}.jpg`)" alt="知识卡栏目配图，非本次AI生成图片"/>
      <h3>{{action.card.title}}</h3><p>{{action.card.intro}}</p><ol><li v-for="point in action.card.points" :key="point">{{point}}</li></ol><p class="ai-card-fact">{{action.card.fact}}</p>
      <div class="ai-card-sources"><a v-for="source in action.card.sources" :key="source.id" :href="source.url" target="_blank" rel="noopener noreferrer">参考：{{source.name}} · {{source.title}}</a><span v-if="!action.card.sources.length">未找到站内参考资料，请核实AI内容。</span></div>
      <div class="ai-operation-buttons"><button :disabled="!canUse" @click="emit('share',action.card,$event.currentTarget)"><Share2 :size="15"/>分享到社区</button><button :disabled="!canUse || saved" @click="save"><Check v-if="saved" :size="15"/><Bookmark v-else :size="15"/>{{saved?'已收藏':'收藏到我的星空'}}</button><button :disabled="!canUse" @click="download"><Download :size="15"/>导出卡片</button><button :disabled="!canUse" @click="emit('execute',{id:action.id,type:'site_action',operation:'navigate',target:'studio',query:'',card:action.card})">在工作室查看</button></div>
    </template>
    <template v-else-if="action.type === 'community_draft'">
      <div class="ai-operation-type">社区文章草稿 · {{posted?'已发布':'尚未发布'}}</div>
      <template v-if="!posted"><label>标题<input v-model="draft.title" maxlength="30" :disabled="locked || !canUse" @input="approved=false"/></label><label>正文<textarea v-model="draft.content" rows="7" maxlength="5000" :disabled="locked || !canUse" @input="approved=false"/></label><div class="ai-draft-options"><label>社区<select v-model="draft.category" :disabled="locked || !canUse" @change="approved=false"><option v-for="c in assistantCategories" :key="c">{{c}}</option></select></label><label>可见范围<select v-model="draft.visibility" :disabled="locked || !canUse" @change="approved=false"><option value="public">所有人可见</option><option value="private">仅自己可见</option></select></label></div><details><summary>查看发布排版</summary><SafeMarkdown :content="draft.content"/></details><p class="ai-draft-note">纯文字文章，无配图；发布时附上“AI辅助整理”说明。需要图片或视频，可进入编辑器补充。</p><label class="ai-publication-consent"><input v-model="approved" type="checkbox" :disabled="!canUse || busy"/>我已检查内容，确认以 {{store.state.user?.name}} 的账号{{draft.visibility==='public'?'公开发布':'保存为仅自己可见'}}。</label><div class="ai-operation-buttons"><button :disabled="!canUse || !approved || busy" @click="publish"><Send :size="15"/>{{busy?'正在发布…':locked?'重试同一次发布':'确认发布文章'}}</button><button :disabled="!canUse || locked || busy" @click="emit('edit',{...action,draft:{...draft}})"><FileText :size="15"/>编辑并补充媒体</button></div></template>
      <template v-else><h3>{{posted.title}}</h3><p role="status"><Check :size="15"/>{{draft.visibility==='private'?'已保存，仅自己可见。':'已发布到社区。'}}</p><button @click="emit('execute',{id:action.id,type:'site_action',operation:'open_community_post',target:posted.id,query:''})">查看刚发布的内容 <ArrowUpRight :size="15"/></button></template>
      <p v-if="action.handedOff" class="ai-draft-note">已交给发布编辑器继续编辑，请在发布页确认并完成发布。</p><p v-if="error" class="ai-operation-error" role="alert">{{error}}</p>
    </template>
    <template v-else><div class="ai-operation-type">站内操作 · 点击执行</div><button class="ai-site-action" :disabled="!canUse" @click="emit('execute',action)">{{operationLabel}} <ArrowUpRight :size="16"/></button></template>
    <p v-if="!enabled" class="ai-draft-note">{{action.type==='community_draft'?'待本次生成完整结束后检查并发布。':'待本次生成完整结束后操作。'}}</p>
  </section>
</template>
<style scoped>
.ai-operation{margin:16px 0;padding:20px;border:1px solid #dbe5ec;border-radius:14px;background:#fff;max-width:700px;color:#405d71;font-size:13px;line-height:1.8}.ai-operation-type{font-size:11px;color:#8296a7;margin-bottom:12px}.ai-operation h3{font-size:19px;margin:12px 0}.ai-operation p{margin:10px 0}.ai-operation ol{padding-left:22px}.ai-card-cover{width:100%;height:140px;object-fit:cover;border-radius:8px}.ai-card-fact{background:#f4f7fa;padding:12px;border-radius:8px}.ai-card-sources{display:flex;flex-direction:column;font-size:11px;gap:7px}.ai-card-sources a{text-decoration:underline}.ai-operation-buttons{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.ai-operation button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #cbdbe5;border-radius:8px;padding:8px 12px;background:#f3f7fa;color:#3b596f;font-size:12px}.ai-operation button:disabled{opacity:.5;cursor:default}.ai-operation label{display:block;font-size:12px;margin:10px 0}.ai-operation input:not([type=checkbox]),.ai-operation textarea,.ai-operation select{width:100%;padding:10px;border:1px solid #d6e2e9;border-radius:6px;background:#f9fbfc;color:inherit;font:inherit}.ai-draft-options{display:grid;grid-template-columns:1fr 1fr;gap:15px}.ai-operation .ai-publication-consent{display:flex;align-items:flex-start;gap:8px;margin:14px 0}.ai-publication-consent input{margin-top:5px}.ai-draft-note{font-size:11px;color:#7e94a4}.ai-operation-error{color:#974b39}.ai-operation details{padding:10px 0}.ai-site-action{width:100%;text-align:left}summary{cursor:pointer}@media(max-width:600px){.ai-operation{padding:14px}.ai-draft-options{grid-template-columns:1fr;gap:0}}
</style>
