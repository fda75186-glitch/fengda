<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Plus, ArrowUp, ArrowUpRight, MessageSquare, ExternalLink, Square, History, X, CircleHelp, Search, ChartNoAxesCombined, Telescope, WandSparkles, BrainCircuit, Sparkles } from '@lucide/vue';
import SaturnLogo from './SaturnLogo.vue';
import SafeMarkdown from './SafeMarkdown.vue';
import ImageGenerationCard from './ImageGenerationCard.vue';
import { validateGeneratedImage } from '../../shared/image-generation.mjs';
import AssistantActionCard from './AssistantActionCard.vue';
import { assetUrl } from '../assets.js';
import { articles } from '../knowledge.js';
import { getCommunityToken, useCommunityStore } from '../communityClient.js';
import { AiClientError, buildChatMessages, createAiClient, createAiRequestScope } from '../aiClient.js';

const props = defineProps({ initialQuestion: String, active: { type: Boolean, default: true } });
const emit = defineEmits(['open', 'navigate', 'consumed', 'login', 'save', 'execute', 'edit', 'published', 'generated', 'share']);
const store = useCommunityStore();
const client = createAiClient({ apiBase: new URL(import.meta.env.VITE_COMMUNITY_API_URL || '/', window.location.origin), getToken: getCommunityToken });
const imageOpen = ref(false);
const input = ref(''), busy = ref(false), messages = ref([]), chat = ref(null), sessions = ref([]), activeId = ref(null), historyOpen = ref(false), helpOpen = ref(false);
const status = ref({ configured: false, model: '' }), statusPhase = ref('loading'), notice = ref(''), sessionExpired = ref(false), pendingInitial = ref('');
const requests = createAiRequestScope(), statusRequests = createAiRequestScope();
let activeReply = null, mounted = false, disposed = false, scrollPending = false, nextId = 0;
const loginRequired = computed(() => !store.state.user || sessionExpired.value);
const canSend = computed(() => statusPhase.value === 'ready' && status.value.configured && !loginRequired.value);
const assistantMode = computed(() => statusPhase.value === 'loading' || (busy.value && !activeReply?.text) ? '连接中' : statusPhase.value === 'error' ? '连接失败' : status.value.configured ? '腾讯混元' : '未配置');
const prompts = [
  { title: '宇宙问答', description: '把复杂原理，变成看得懂的答案', question: '黑洞会吸走一切吗？', icon: Search, color: 'blue' },
  { title: '行星对比', description: '看大小、看距离，感受宇宙尺度', route: 'atlas', icon: ChartNoAxesCombined, color: 'purple' },
  { title: '观星入门', description: '从月相开始，认识头顶的星空', question: '月相为什么会变化？', icon: Telescope, color: 'green' },
  { title: '知识卡创作', description: '查阅站内资料，生成可收藏的科普卡', question: '请帮我制作一张木星大红斑的入门知识卡，附上参考资料。', icon: WandSparkles, color: 'orange' },
  { title: 'AI宇宙绘画', description: '将你的宇宙想象，变成科普插画', image: true, icon: Sparkles, color: 'pink' },
  { title: '天文挑战', description: '五个问题，检验你的宇宙知识力', route: 'quiz', icon: BrainCircuit, color: 'teal' },
];

function stop() {
  if (activeReply?.status === 'streaming') {
    activeReply.status = 'stopped';
    activeReply.error = '已停止回答。已收到的内容保留在这里，可以重新尝试。';
  }
  requests.cancel();
  activeReply = null;
  busy.value = false;
}
function newChat() {
  stop(); messages.value = []; activeId.value = null; input.value = ''; pendingInitial.value = ''; notice.value = ''; historyOpen.value = false;
}
function loadSession(session) {
  stop(); activeId.value = session.id; messages.value = session.messages; pendingInitial.value = ''; notice.value = ''; historyOpen.value = false;
}
function keepSession() {
  if (!activeId.value) {
    activeId.value = ++nextId;
    sessions.value.unshift({ id: activeId.value, title: messages.value[0].text, messages: messages.value });
  }
}
async function scrollChat() {
  if (scrollPending) return;
  scrollPending = true;
  await nextTick();
  scrollPending = false;
  if (!disposed) chat.value?.scrollTo({ top: chat.value.scrollHeight, behavior: 'smooth' });
}
async function checkStatus() {
  const request = statusRequests.begin();
  statusPhase.value = 'loading'; notice.value = '';
  try {
    const result = await client.status({ signal: request.signal });
    if (!request.current()) return;
    status.value = result; statusPhase.value = 'ready';
    maybeSendInitial();
  } catch (error) {
    if (!request.current()) return;
    statusPhase.value = 'error'; notice.value = error.message;
  } finally { statusRequests.finish(request); }
}
function readyToSend(text) {
  if (statusPhase.value === 'loading') { input.value = text; notice.value = '正在连接 AI 服务，问题已保留。'; return false; }
  if (statusPhase.value === 'error') { input.value = text; notice.value = 'AI 服务暂时无法连接，请点击“重新连接”后再提问。'; return false; }
  if (!status.value.configured) { input.value = text; notice.value = 'AI 服务尚未配置。网站管理员配置腾讯云 API Key 后即可提问。'; return false; }
  if (loginRequired.value) { input.value = text; notice.value = '登录星语账号后即可提问，问题已保留。'; emit('login'); return false; }
  return true;
}
async function requestAnswer(reply) {
  const request = requests.begin();
  reply.text = ''; reply.error = ''; reply.warning = ''; reply.status = 'streaming';
  reply.actions = []; reply.steps = [];
  activeReply = reply; busy.value = true; notice.value = '';
  scrollChat();
  try {
    await client.agent({ messages: reply.requestMessages, signal: request.signal, onEvent(event) {
      if (!request.current()) return;
      if (event.type === 'meta') reply.model = event.model;
      else if (event.type === 'delta') { reply.text += event.text; scrollChat(); }
      else if (event.type === 'status') reply.warning = event.message;
      else if (event.type === 'done') reply.finishReason = event.finishReason;
      else if (event.type === 'action') { reply.actions.push(event.action); scrollChat(); }
      else if (event.type === 'tool') {
        const existing = reply.steps.find(s => s.step === event.step);
        if (existing) Object.assign(existing, event); else reply.steps.push(event);
        scrollChat();
      }
    } });
    if (!request.current()) return;
    if (!reply.text.trim() && !reply.actions.length) throw new AiClientError('AI 未返回回答，请重新尝试。', 'AI_EMPTY_RESPONSE');
    reply.status = 'complete';
    const completedCard=reply.actions.findLast(action=>action.type==='knowledge_card');
    if(completedCard)emit('generated',completedCard.card);
    if (reply.finishReason === 'length' && !reply.warning) reply.warning = '已达到本次回答长度上限，可以继续追问。';
  } catch (error) {
    if (!request.current()) return;
    reply.status = 'error'; reply.error = error.message || 'AI 回答未完成，请重试。';
    if (['LOGIN_REQUIRED', 'SESSION_EXPIRED'].includes(error.code) || error.status === 401) sessionExpired.value = true;
    if (['AI_NOT_CONFIGURED', 'AI_CONFIG_INVALID'].includes(error.code)) status.value.configured = false;
  } finally {
    if (request.current()) { busy.value = false; activeReply = null; scrollChat(); }
    requests.finish(request);
  }
}
async function send(text = input.value) {
  if (busy.value || !text?.trim()) return;
  const question = text.trim();
  if (!readyToSend(question)) return;
  let requestMessages;
  try { requestMessages = buildChatMessages(messages.value, question); }
  catch (error) { notice.value = error.message; return; }
  pendingInitial.value = ''; input.value = '';
  messages.value.push({ id: ++nextId, role: 'user', text: question });
  const article = articles.find(item => item.keywords.some(keyword => question.includes(keyword))) || null;
  messages.value.push({ id: ++nextId, role: 'assistant', text: '', status: 'streaming', error: '', warning: '', article, requestMessages, ownerId: store.state.user.id, actions: [], steps: [] });
  keepSession();
  await requestAnswer(messages.value.at(-1));
}
function retry(reply) {
  if (busy.value || !readyToSend(reply.requestMessages.at(-1).content)) return;
  requestAnswer(reply);
}
function toggleImage() { imageOpen.value=!imageOpen.value; if(imageOpen.value)nextTick(()=>chat.value?.scrollTo({top:0,behavior:'smooth'})); }
function choose(prompt) { if (prompt.image) { if(!imageOpen.value)toggleImage(); return; } if (prompt.route) emit('navigate', prompt.route); else send(prompt.question); }
function useImage(raw) {
  try {
    const image=validateGeneratedImage(raw);
    if (!store.state.user) return;
    const drafts=messages.value.filter(m=>m.role==='assistant' && m.status==='complete' && m.ownerId===store.state.user.id).flatMap(m=>m.actions||[]).filter(a=>a.type==='community_draft' && !a.handedOff && !a.publishedPost);
    const source=drafts.at(-1);
    const action=source ? {...source,draft:{...source.draft}} : {id:crypto.randomUUID(),type:'community_draft',draft:{title:'我的宇宙想象',content:'这张图片由星语AI根据文字描述生成，是天文科普艺术示意，并非真实的天文观测照片。\n\n画面描述：'+image.prompt,category:'学习交流',topics:['AI科普示意'],visibility:'public'}};
    if(source)source.handedOff=true;
    emit('edit',{...action,generatedImages:[image]});
  } catch(e) { notice.value=e.message; }
}
const toolLabels = { prepare_image: '准备生图描述', search_site: '检索站内资料', read_knowledge: '阅读知识与来源', create_knowledge_card: '制作知识卡', draft_community_post: '撰写社区草稿', site_action: '准备站内操作' };
function published(message, action, post) { action.publishedPost = post; (message.receipts ||= []).push({ actionId: action.id, postId: post.id, title: post.title, visibility: post.visibility, status: 'published' }); emit('published', post, action.id, message.ownerId); }
function onComposeEnter(event) { if (!event.isComposing) { event.preventDefault(); send(); } }
function maybeSendInitial() {
  if (mounted && props.active && canSend.value && !busy.value && pendingInitial.value && input.value.trim() === pendingInitial.value) send(pendingInitial.value);
}
watch(() => props.initialQuestion, question => {
  if (!question?.trim()) return;
  stop(); pendingInitial.value = question.trim(); input.value = question.trim(); emit('consumed'); maybeSendInitial();
}, { immediate: true });
watch(() => store.state.user, (user, previous) => {
  stop(); sessionExpired.value = false;
  if (user?.id !== previous?.id) { messages.value = []; sessions.value = []; activeId.value = null; }
  maybeSendInitial();
}, { flush: 'sync' });
onMounted(() => { mounted = true; checkStatus(); });
watch(() => props.active, active => { if (!active) stop(); else { checkStatus(); maybeSendInitial(); } });
onUnmounted(() => { disposed = true; stop(); statusRequests.cancel(); });
</script>

<template>
  <section class="assistant-v2">
    <div class="assistant-toolbar">
      <div><button class="icon-button" aria-label="查看对话历史" :aria-expanded="historyOpen" @click="historyOpen = !historyOpen; helpOpen = false"><History :size="20" /></button><button class="icon-button" aria-label="开始新的对话" title="新对话" @click="newChat"><MessageSquare :size="20" /><span class="new-chat-plus">+</span></button></div>
      <span class="assistant-mode" role="status">星语 · {{ assistantMode }}</span>
      <div><button class="icon-button" aria-label="AI图片创作" :aria-expanded="imageOpen" @click="toggleImage"><WandSparkles :size="21"/></button><button class="icon-button" aria-label="查看助手说明" :aria-expanded="helpOpen" @click="helpOpen = !helpOpen; historyOpen = false"><CircleHelp :size="21" /></button></div>
    </div>
    <Transition name="popover"><aside v-if="historyOpen" class="assistant-history"><div><h2>探索记录</h2><button class="icon-button" aria-label="关闭对话历史" @click="historyOpen = false"><X :size="17" /></button></div><button class="history-new" @click="newChat"><Plus :size="16" /> 开始新的对话</button><button v-for="session in sessions" :key="session.id" :class="['session-button', { selected: activeId === session.id }]" @click="loadSession(session)"><MessageSquare :size="15" /><span>{{ session.title }}</span></button><p v-if="!sessions.length">第一个问题，会从这里出发。</p><small>记录仅保留在本次页面会话中。</small></aside></Transition>
    <Transition name="popover"><aside v-if="helpOpen" class="assistant-help"><h2>关于 AI 星语</h2><p>配置完成后，对话通过腾讯云混元 API 生成，使用星语账号登录。你的问题、最近的完整问答、检索到的站内资料和公开社区内容会发送至腾讯云处理；确认发布前的草稿也会用于后续修改。</p><p>个人元宝账号不能作为本站 API 凭证。服务需要由网站管理员配置腾讯云 API Key，未配置时不会生成回答。</p><p v-if="status.model">当前模型：{{ status.model }} · 站内工具助手</p><p>我可以检索站内资料、制作和收藏知识卡、撰写社区文章并在你确认后发布，也能准备页面跳转、地图定位与宇宙探索。可以按画面描述生成AI插画，预览、下载后用于社区配图；AI图片并非观测实拍。相机、语音权限和本机素材需你亲自选择。AI内容可能有误，来源链接也需结合原文核实。</p><a class="source-link" href="https://cloud.tencent.com/document/product/1823/130078" target="_blank" rel="noopener noreferrer">腾讯云接入说明 <ExternalLink :size="13" /></a><button class="text-button" @click="helpOpen = false">我知道了</button></aside></Transition>
    <div ref="chat" class="assistant-conversation" :aria-busy="busy">
    <ImageGenerationCard v-show="imageOpen" :key="store.state.user?.id || 'guest'" :owner-id="store.state.user?.id" :enabled="!busy" :active="active && imageOpen" :configured="status.images?.configured" @use="useImage" @login="emit('login')"/>

      <div v-if="!messages.length" class="assistant-welcome"><h1><SaturnLogo :size="59" /><span>我是星语，你的宇宙探索伙伴</span></h1><p class="assistant-capability-tip">试着说：制作一张黑洞知识卡、生成宇宙插画，或帮我写一篇月相科普并发布。</p><div class="assistant-prompts"><button v-for="p in prompts" :key="p.title" :class="p.color" @click="choose(p)"><component :is="p.icon" :size="23" :stroke-width="1.4" /><strong>{{ p.title }}</strong><span>{{ p.description }}</span><small>试试：{{ p.question || '去' + p.title }} <ArrowUpRight :size="13" /></small></button></div></div>
      <h1 v-else class="sr-only">与星语的对话</h1>
      <div class="conversation-messages">
        <div v-for="message in messages" :key="message.id" :class="['message', message.role]">
          <span class="message-avatar"><SaturnLogo v-if="message.role === 'assistant'" :size="37" /><span v-else>我</span></span>
          <div class="message-content">
            <div class="message-author">{{ message.role === 'assistant' ? '星语 · 腾讯混元' : '你' }}</div>
            <SafeMarkdown v-if="message.role === 'assistant' && message.text" class="assistant-answer" :content="message.text" />
            <p v-else-if="message.role === 'user'">{{ message.text }}</p>
            <p v-else-if="message.status === 'streaming'" role="status">正在等待腾讯混元回答…</p>
            <ol v-if="message.steps?.length" class="assistant-task-steps" aria-label="任务执行进度"><li v-for="step in message.steps" :key="step.step" :class="step.state">{{step.step}} · {{toolLabels[step.name]}} · {{step.state==='running'?'进行中':step.state==='complete'?'已完成':'参数待修正'}}</li></ol>
            <AssistantActionCard v-for="action in message.actions || []" :key="action.type+':'+action.id" :action="action" :owner-id="message.ownerId" :active="active" :images-configured="status.images?.configured" @image="useImage" @share="(card,source)=>emit('share',card,source)" :enabled="message.status==='complete' && !busy" @save="action.saved=true;emit('save',$event)" @execute="emit('execute',$event)" @edit="action.handedOff=true;emit('edit',$event)" @published="published(message,action,$event)"/>
            <p v-if="message.error" class="assistant-response-error" role="alert">{{ message.error }}</p>
            <p v-if="message.warning" class="assistant-response-warning" role="status">{{ message.warning }}</p>
            <div v-if="['error', 'stopped'].includes(message.status)" class="message-tools"><button :disabled="busy" @click="retry(message)">重新尝试 <ArrowUpRight :size="13" /></button><button v-if="loginRequired" @click="emit('login')">登录后提问 <ArrowUpRight :size="13" /></button></div>
            <template v-if="message.article && message.status === 'complete'"><button class="related-article" @click="emit('open', message.article)"><img :src="assetUrl('/images/' + message.article.image + '.jpg')" alt="" /><span><small>相关科普</small>{{ message.article.title }}</span><ArrowUpRight :size="18" /></button><div class="message-tools"><button @click="emit('navigate', 'atlas')">去看行星图谱 <ArrowUpRight :size="13" /></button><button @click="emit('navigate', 'quiz')">试试天文挑战 <ArrowUpRight :size="13" /></button></div></template>
          </div>
        </div>
      </div>
    </div>
    <div class="assistant-compose">
      <div class="assistant-service-status" role="status">
        <span v-if="statusPhase === 'loading'">正在连接 AI 服务…</span>
        <span v-else-if="statusPhase === 'error'">AI 服务暂时无法连接。<button @click="checkStatus">重新连接</button></span>
        <span v-else-if="!status.configured">AI 服务未配置，网站管理员需配置腾讯云 API Key。<a href="https://cloud.tencent.com/document/product/1823/130078" target="_blank" rel="noopener noreferrer">接入说明 <ExternalLink :size="11" /></a><button @click="checkStatus">重新检查</button></span>
        <span v-else-if="loginRequired">登录星语账号后即可使用腾讯混元。<button @click="emit('login')">登录</button></span>
        <span v-else>腾讯混元 · 服务已配置 · 最近的完整问答用于理解上下文</span>
      </div>
      <p v-if="notice" class="assistant-notice" role="alert">{{ notice }}</p>
      <form @submit.prevent="send()"><textarea v-model="input" aria-label="向星语提问" placeholder="说说你对宇宙的好奇…" rows="2" maxlength="2000" @keydown.enter.exact="onComposeEnter"></textarea><div class="compose-bottom"><span><SaturnLogo :size="27" /> 让每一个为什么，都有下一步</span><button v-if="busy" type="button" class="send-button" aria-label="停止回答" @click="stop"><Square :size="17" /></button><button v-else-if="status.configured && loginRequired" type="button" class="assistant-login" @click="emit('login')">登录后提问</button><button v-else type="submit" class="send-button" aria-label="发送问题" :disabled="!input.trim() || !canSend"><ArrowUp :size="23" /></button></div></form>
      <p>AI 回答可能有误，请核对重要事实 · Enter 发送 / Shift + Enter 换行</p>
    </div>
  </section>
</template>

<style scoped>
.assistant-task-steps{list-style:none;padding:10px 14px;background:#f3f7fa;border-radius:8px;font-size:11px;color:#6a8599}.assistant-task-steps li{margin:5px 0}.assistant-task-steps .running{color:#3c718c}.assistant-task-steps .error{color:#936142}.assistant-capability-tip{font-size:12px;color:#7d94a6;line-height:1.9;margin:18px 0}
.assistant-service-status,.assistant-compose>.assistant-notice{font-size:11px;color:#607b90;line-height:1.8;margin:0 0 10px;text-align:left;overflow-wrap:anywhere}
.assistant-service-status button,.assistant-service-status a{display:inline-flex;align-items:center;gap:4px;margin-left:10px;color:#526f87;text-decoration:underline;text-underline-offset:3px}
.assistant-login{color:#fff;background:#263846;border-radius:18px;padding:8px 14px;font-size:11px;white-space:nowrap}
.message-content>.assistant-response-error{color:#94523f}.message-content>.assistant-response-warning{color:#7b6c47}
.assistant-answer{font-size:13px;color:#516779;line-height:2;overflow-wrap:anywhere}
.assistant-answer :deep(p){margin:0 0 13px;white-space:pre-wrap}.assistant-answer :deep(h3),.assistant-answer :deep(h4),.assistant-answer :deep(h5){font-size:1.1em;line-height:1.7;margin:18px 0 10px;color:#3d5569}
.assistant-answer :deep(ul),.assistant-answer :deep(ol){padding-left:22px;margin:0 0 13px}.assistant-answer :deep(pre){max-width:100%;overflow:auto;background:#f2f5f7;padding:12px;border-radius:6px;line-height:1.6}
.assistant-answer :deep(code){font-size:.94em}.assistant-answer :deep(blockquote){padding-left:14px;border-left:2px solid #d7e1e9;margin:0 0 13px;color:#657e90}
.assistant-answer :deep(a){color:#526f87;text-decoration:underline;text-underline-offset:3px}.assistant-answer :deep(img){max-width:100%;height:auto}
.message-tools button:disabled{opacity:.5;cursor:default}.assistant-help .source-link{display:inline-flex;align-items:center;gap:6px;margin-bottom:16px;font-size:10px}
@media(max-width:600px){.assistant-service-status,.assistant-compose>.assistant-notice{font-size:10px;margin-bottom:8px}.assistant-answer{font-size:12px}.assistant-login{font-size:10px;padding:7px 12px}}
</style>
