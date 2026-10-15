<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { ImagePlus, Download, LoaderCircle, Square, ArrowUpRight } from '@lucide/vue';
import { imageSizes, imageStyles, validateImageRequest } from '../../shared/image-generation.mjs';
import { createImageClient } from '../imageClient.js';
import { useCommunityStore, getCommunityToken } from '../communityClient.js';

const props = defineProps({ ownerId: String, enabled: Boolean, active: { type: Boolean, default: true }, initialRequest: Object, savedResult: Object, configured: Boolean });
const emit = defineEmits(['completed', 'use', 'login']);
const store = useCommunityStore();
const client = createImageClient({ apiBase: new URL(import.meta.env.VITE_COMMUNITY_API_URL || '/', window.location.origin), getSession: () => ({ userId: store.state.user?.id, token: getCommunityToken() }) });
const form = reactive({ prompt: '', ratio: 'landscape', style: 'realistic', ...props.initialRequest });
const job = ref(props.savedResult || null), busy = ref(false), imageUrl = ref(''), error = ref(''), history = ref([]), historyOpen = ref(false);
const canUse = computed(() => props.enabled && !!props.ownerId && store.state.user?.id === props.ownerId);
let controller, blob, disposed = false;
function clearPreview() { if (imageUrl.value) URL.revokeObjectURL(imageUrl.value); imageUrl.value = ''; blob = null; }
function cancel() { controller?.abort(); }
async function show(result, signal) {
  job.value = result;
  if (result.status === 'failed') { error.value = result.error; return; }
  if (result.status === 'complete') {
    const content = await client.read(result, props.ownerId, signal);
    if (disposed || signal.aborted || !canUse.value) return;
    clearPreview(); blob = content; imageUrl.value = URL.createObjectURL(blob); emit('completed', result);
  }
}
async function operate(task) {
  if (!canUse.value || busy.value) return;
  const current = new AbortController(); controller = current; busy.value = true; error.value = '';
  try { await task(current.signal); }
  catch (e) { if (e.code === 'IMAGE_NOT_FOUND' && job.value?.status === 'pending') job.value.status='failed'; if (!disposed) error.value = e.name === 'AbortError' ? '已停止等待。可检查本次结果；再次生成会创建新的请求。' : e.message; }
  finally { if (controller === current) { busy.value = false; controller = null; } }
}
async function generate() {
  if (!store.state.user) { emit('login'); return; }
  if (!props.configured) { error.value = '管理员尚未开通腾讯 Hy-Image-3.0 或授予当前 Key 生图权限。'; return; }
  await operate(async signal => {
    const input = validateImageRequest(form);
    clearPreview(); job.value = { id: crypto.randomUUID(), status: 'pending', ...input };
    emit('completed', job.value);
    await show(await client.generate(job.value.id, input, props.ownerId, signal), signal);
    if (job.value.status === 'pending') error.value = '同一次请求仍在处理中，可稍后检查结果。';
  });
}
function check() { return operate(async signal => show(await client.get(job.value.id, props.ownerId, signal), signal)); }
function download() {
  if (!blob || !canUse.value) return;
  const link = document.createElement('a'); link.href = imageUrl.value; link.download = `星语-AI科普示意-${job.value.id}.${blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1]}`; link.click();
}
function use() { if (job.value?.status === 'complete' && imageUrl.value && canUse.value) emit('use', job.value); }
function recent() { return operate(async signal => { history.value = await client.recent(props.ownerId, signal); historyOpen.value = true; }); }
function select(result) { return operate(async signal => { clearPreview(); Object.assign(form, { prompt: result.prompt, ratio: result.ratio, style: result.style }); await show(result.status === 'pending' ? await client.get(result.id, props.ownerId, signal) : result, signal); }); }
watch(() => props.active, active => { if (!active) cancel(); });
watch(() => store.state.user?.id, () => { cancel(); clearPreview(); job.value = null; history.value = []; });
onMounted(() => { if (job.value?.status === 'complete' && canUse.value) select(job.value); });
onUnmounted(() => { disposed = true; cancel(); clearPreview(); });
</script>
<template>
  <section class="image-generation" :aria-busy="busy" aria-label="AI图片生成">
    <header><ImagePlus :size="19"/><h3>AI 图片创作</h3><span>腾讯混元 · 科普示意</span></header>
    <label>画面描述<textarea v-model="form.prompt" rows="3" maxlength="1600" placeholder="例如：从月球表面看地球升起，灰色环形山、深黑星空，细腻的科幻插画。" :disabled="busy || !canUse"/></label>
    <div class="image-options"><label>画面比例<select v-model="form.ratio" :disabled="busy || !canUse"><option v-for="(item,id) in imageSizes" :key="id" :value="id">{{item.label}}</option></select></label><label>风格<select v-model="form.style" :disabled="busy || !canUse"><option v-for="(label,id) in imageStyles" :key="id" :value="id">{{label}}</option></select></label></div>
    <p class="image-note">每次生成 1 张，最多 1024 像素，每账号每天最多 5 次。描述发送给腾讯处理；AI 图像不能用作真实观测证据。</p>
    <p v-if="!configured" class="image-warning" role="status">生图模型尚未开通或未获授权，当前可先编辑画面描述。</p>
    <div v-if="busy" class="image-loading" role="status"><LoaderCircle :size="20"/><span>正在请求图片，请稍候…</span><button type="button" @click="cancel"><Square :size="13"/>停止等待</button></div>
    <figure v-if="imageUrl"><img :src="imageUrl" :alt="`AI科普示意：${job.prompt}`"/><figcaption>AI 生成 · {{imageSizes[job.ratio]?.label}} · {{imageStyles[job.style]}} · 非实拍</figcaption></figure>
    <p v-if="error" class="image-warning" role="alert">{{error}}</p>
    <div class="image-buttons"><button v-if="!store.state.user" type="button" @click="emit('login')">登录后生成图片</button><button v-else type="button" :disabled="busy || !canUse || !form.prompt.trim() || !configured || job?.status==='pending'" @click="generate"><ImagePlus :size="15"/>{{job?'再生成一张':'生成图片'}}</button><button v-if="job" type="button" :disabled="busy || !canUse" @click="check">检查本次结果</button><button v-if="imageUrl" type="button" :disabled="!canUse || busy" @click="download"><Download :size="15"/>下载图片</button><button v-if="imageUrl" type="button" :disabled="!canUse || busy" @click="use">用于社区发布 <ArrowUpRight :size="15"/></button><button type="button" :disabled="!canUse || busy" @click="recent">最近的图片</button></div>
    <div v-if="historyOpen" class="image-history"><p v-if="!history.length">还没有生图记录。</p><button v-for="item in history" :key="item.id" type="button" :disabled="busy || !canUse" @click="select(item)"><span>{{item.prompt}}</span><small>{{item.status==='complete'?'查看图片':item.status==='pending'?'检查进度':'查看失败原因'}}</small></button></div>
  </section>
</template>
<style scoped>
.image-generation{--image-line:#dbe5ec;--image-text:#405d71;margin:16px 0;padding:20px;width:100%;flex-shrink:0;max-width:700px;border:1px solid var(--image-line);border-radius:14px;background:#fff;color:var(--image-text);font-size:12px;line-height:1.8}.image-generation header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.image-generation h3{margin:0;font-size:16px}.image-generation header span{margin-left:auto;color:#71889a;font-size:10px}.image-generation label{display:block;margin:12px 0 0}.image-generation textarea,.image-generation select{display:block;width:100%;padding:10px;margin-top:6px;border:1px solid var(--image-line);border-radius:7px;background:#f9fbfc;color:inherit;font:inherit}.image-options{display:grid;grid-template-columns:1fr 1fr;gap:16px}.image-note{color:#71889a;font-size:11px}.image-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.image-generation button{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbdbe5;padding:8px 12px;border-radius:8px;background:#f3f7fa;color:#3b596f;font-size:12px}.image-generation button:disabled{opacity:.5;cursor:default}.image-generation figure{margin:16px 0}.image-generation figure img{width:100%;max-height:520px;object-fit:contain;background:#f7f9fb;border-radius:8px}.image-generation figcaption{font-size:10px;color:#71889a;margin-top:6px}.image-warning{color:#8e563e;font-size:11px}.image-loading{display:flex;gap:10px;align-items:center;padding:20px 0}.image-loading>svg{animation:image-spin 1.2s linear infinite}.image-history{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--image-line);margin-top:14px;padding-top:14px}.image-history button{display:flex;text-align:left;justify-content:space-between}.image-history span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:75%}.image-history small{white-space:nowrap}@keyframes image-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.image-loading>svg{animation:none}}@media(max-width:600px){.image-generation{padding:14px}.image-options{gap:10px}}
</style>
