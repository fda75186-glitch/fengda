<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { Bold, Check, FileText, Hash, Heading, ImagePlus, Link, List, LoaderCircle, Plus, Quote, Redo2, Save, Smile, Trash2, Undo2, Video, X } from '@lucide/vue';
import SaturnLogo from './SaturnLogo.vue';
import SafeMarkdown from './SafeMarkdown.vue';
import { useCommunityStore } from '../communityClient.js';
import { deletePublishingDraft, listPublishingDrafts, readPublishingDraft, savePublishingDraft } from '../communityDrafts.js';

const emit = defineEmits(['navigate', 'login', 'published', 'notify']);
const store = useCommunityStore();
const user = computed(() => store.state.user);
const categories = ['观星日记', '天文问答', '摄影分享', '学习交流'];
const topicSuggestions = ['今晚的月亮', '我的第一台望远镜', '行星观察', '银河摄影', '一起观星', '天文冷知识'];
const kinds = [{ id: 'image', label: '发布图文' }, { id: 'article', label: '发布文章' }, { id: 'video', label: '发布视频' }];
const draft = reactive({ type: 'image', title: '', content: '', communities: ['观星日记'], topics: [], visibility: 'public', originality: 'original', sourceUrl: '' });
const images = ref([]), video = ref(null), cover = ref(null);
const imageInput = ref(null), articleImageInput = ref(null), videoInput = ref(null), coverInput = ref(null), contentInput = ref(null);
const status = ref(''), formError = ref(''), busy = ref(false), saving = ref(false), initialized = ref(false);
const openPicker = ref(''), customTopic = ref(''), helpTab = ref('keys'), draggedIndex = ref(null);
const draftDialog = ref(null), drafts = ref([]), draftsLoading = ref(false), activeSavedDraftId = ref(null);
const linkDialog = ref(null), linkText = ref(''), linkUrl = ref(''), linkError = ref('');
const imageUrls = computed(() => images.value.map(item => item.url));
const previewName = computed(() => user.value?.name || user.value?.displayName || '星语观星者');
const charCount = computed(() => [...draft.content].length);
const contentLimit = computed(() => draft.type === 'article' ? 20000 : 5000);
const history = ref([{ title: '', content: '' }]), historyIndex = ref(0);
const canUndo = computed(() => historyIndex.value > 0), canRedo = computed(() => historyIndex.value < history.value.length - 1);
let saveTimer, alive = true, loadingDraft = false, autoSaveFlight = Promise.resolve();

function uid() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function mediaEntry(file, id = uid()) { return { id, file, url: URL.createObjectURL(file) }; }
function release(entry) { if (entry?.url) URL.revokeObjectURL(entry.url); }
function inform(message) { status.value = message; }
function remember() {
  const value = { title: draft.title, content: draft.content };
  const current = history.value[historyIndex.value];
  if (current?.title === value.title && current?.content === value.content) return;
  history.value = history.value.slice(0, historyIndex.value + 1);
  history.value.push(value);
  if (history.value.length > 150) history.value.shift();
  historyIndex.value = history.value.length - 1;
}
function changeTitle(event) { draft.title = event.target.value; remember(); }
function changeContent(event) { draft.content = event.target.value; remember(); }
function undo() { if (!canUndo.value) return; const item = history.value[--historyIndex.value]; draft.title = item.title; draft.content = item.content; }
function redo() { if (!canRedo.value) return; const item = history.value[++historyIndex.value]; draft.title = item.title; draft.content = item.content; }
function switchType(type) { draft.type = type; formError.value = ''; openPicker.value = ''; }

async function insertText(before, after = '', fallback = '') {
  const input = contentInput.value;
  const start = input?.selectionStart ?? draft.content.length, end = input?.selectionEnd ?? start;
  const selected = draft.content.slice(start, end) || fallback;
  const inserted = before + selected + after;
  if (draft.content.length - (end - start) + inserted.length > contentLimit.value) { formError.value = '正文已达到字数上限，请缩短后再插入。'; return; }
  draft.content = draft.content.slice(0, start) + inserted + draft.content.slice(end);
  remember(); await nextTick();
  contentInput.value?.focus();
  contentInput.value?.setSelectionRange(start + before.length, start + before.length + selected.length);
}
function format(kind) {
  if (kind === 'bold') insertText('**', '**', '重点文字');
  else if (kind === 'heading') insertText('\n## ', '\n', '小标题');
  else if (kind === 'quote') insertText('\n> ', '\n', '引用内容');
  else if (kind === 'list') insertText('\n- ', '\n', '观察记录');
}
async function openLink() {
  const input = contentInput.value;
  linkText.value = input ? draft.content.slice(input.selectionStart, input.selectionEnd) || '相关资料' : '相关资料';
  linkUrl.value = ''; linkError.value = ''; await nextTick(); linkDialog.value?.showModal();
}
async function addLink() {
  let url;
  try { url = new URL(linkUrl.value.trim()); } catch { linkError.value = '请输入完整链接，例如 https://www.nasa.gov/。'; return; }
  if (!['https:', 'http:'].includes(url.protocol)) { linkError.value = '链接需以 https:// 或 http:// 开头。'; return; }
  const label = linkText.value.replace(/[\[\]\n]/g, '').trim() || '相关资料';
  linkDialog.value?.close(); await insertText(`[${label}](${url.href})`);
}
function togglePicker(picker) { openPicker.value = openPicker.value === picker ? '' : picker; }
function toggleCommunity(value) {
  const index = draft.communities.indexOf(value);
  if (index >= 0) draft.communities.splice(index, 1);
  else if (draft.communities.length < 2) draft.communities.push(value);
  else inform('最多关联两个社区。');
}
function toggleTopic(value) {
  const clean = value.trim().replace(/^#+|#+$/g, '').slice(0, 24);
  if (!clean) return;
  const index = draft.topics.indexOf(clean);
  if (index >= 0) draft.topics.splice(index, 1);
  else if (draft.topics.length < 5) draft.topics.push(clean);
  else inform('最多关联五个话题。');
}
function addCustomTopic() { if (!customTopic.value.trim()) return; toggleTopic(customTopic.value); customTopic.value = ''; }
function removeImage(index) {
  release(images.value[index]); images.value.splice(index, 1);
  // Keep article image references aligned with the remaining attachment order.
  draft.content = draft.content.replace(/!\[([^\]]*)\]\(image:(\d+)\)/g, (match, label, number) => Number(number) === index + 1 ? '' : Number(number) > index + 1 ? `![${label}](image:${Number(number) - 1})` : match);
  remember();
}
function moveImage(index, direction) {
  const destination = index + direction;
  if (destination < 0 || destination >= images.value.length) return;
  [images.value[index], images.value[destination]] = [images.value[destination], images.value[index]];
  draft.content = draft.content.replace(/\(image:(\d+)\)/g, (match, number) => Number(number) === index + 1 ? `(image:${destination + 1})` : Number(number) === destination + 1 ? `(image:${index + 1})` : match);
  remember();
}
function dropImage(index) {
  const from = draggedIndex.value; draggedIndex.value = null;
  if (from === null || from === index) return;
  const ids = images.value.map(item => item.id), moved = images.value.splice(from, 1)[0];
  images.value.splice(index, 0, moved);
  draft.content = draft.content.replace(/\(image:(\d+)\)/g, (match, number) => {
    const oldId = ids[Number(number) - 1]; return oldId ? `(image:${images.value.findIndex(item => item.id === oldId) + 1})` : match;
  });
  remember();
}
async function chooseImages(event, insert = false) {
  const chosen = Array.from(event.target.files || []); event.target.value = '';
  formError.value = '';
  for (const file of chosen) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { formError.value = '请选择 JPG、PNG 或 WebP 图片。'; continue; }
    if (file.size > 8 * 1024 * 1024) { formError.value = `“${file.name}”超过 8 MB，请压缩后再上传。`; continue; }
    if (images.value.length >= 9) { formError.value = '最多上传 9 张图片。'; break; }
    const entry = mediaEntry(file); images.value.push(entry);
    if (insert) await insertText(`\n![${file.name.replace(/[\[\]\n]/g, '')}](image:${images.value.length})\n`);
  }
}
function chooseVideo(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
  if (!['video/mp4', 'video/webm'].includes(file.type)) { formError.value = '请选择 MP4 或 WebM 视频文件。'; return; }
  if (file.size > 50 * 1024 * 1024) { formError.value = '视频最大 50 MB，请压缩后再上传。'; return; }
  release(video.value); video.value = mediaEntry(file); formError.value = '';
}
function chooseCover(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { formError.value = '封面请选择 8 MB 以内的 JPG、PNG 或 WebP 图片。'; return; }
  release(cover.value); cover.value = mediaEntry(file); formError.value = '';
}
function removeVideo() { release(video.value); video.value = null; }
function removeCover() { release(cover.value); cover.value = null; }

function snapshot(id) {
  return { id, version: 1, updatedAt: Date.now(), userId: user.value?.id || null,
    fields: { ...draft, communities: [...draft.communities], topics: [...draft.topics] },
    images: images.value.map(item => ({ id: item.id, file: item.file })),
    video: video.value ? { id: video.value.id, file: video.value.file } : null,
    cover: cover.value ? { id: cover.value.id, file: cover.value.file } : null,
  };
}
function hasContent() { return Boolean(draft.title.trim() || draft.content.trim() || images.value.length || video.value); }
async function saveDraft() {
  if (saving.value || busy.value) return;
  if (!hasContent()) { inform('写一点内容或添加图片后，就可以保存草稿了。'); return; }
  saving.value = true; formError.value = '';
  try {
    const id = activeSavedDraftId.value || uid();
    await savePublishingDraft(snapshot(id)); await savePublishingDraft(snapshot('current-edit'));
    activeSavedDraftId.value = id;
    inform('草稿已保存，包括本次添加的图片和视频。');
  } catch (error) { formError.value = error.message; }
  finally { saving.value = false; }
}
async function autoSave() {
  if (!initialized.value || loadingDraft || busy.value || !hasContent()) return;
  try { autoSaveFlight = savePublishingDraft(snapshot('current-edit')); await autoSaveFlight; }
  catch (error) { if (alive) inform(error.message); }
}
function scheduleSave() { if (!initialized.value || loadingDraft) return; clearTimeout(saveTimer); saveTimer = setTimeout(autoSave, 1800); }
async function loadDraft(value) {
  if (!value?.fields) return;
  loadingDraft = true;
  images.value.forEach(release); release(video.value); release(cover.value);
  Object.assign(draft, value.fields);
  images.value = (value.images || []).filter(item => item.file instanceof Blob).map(item => mediaEntry(item.file, item.id));
  video.value = value.video?.file instanceof Blob ? mediaEntry(value.video.file, value.video.id) : null;
  cover.value = value.cover?.file instanceof Blob ? mediaEntry(value.cover.file, value.cover.id) : null;
  history.value = [{ title: draft.title, content: draft.content }]; historyIndex.value = 0;
  activeSavedDraftId.value = value.id === 'current-edit' ? null : value.id;
  formError.value = ''; await nextTick(); loadingDraft = false;
}
async function openDrafts() {
  await nextTick(); draftDialog.value?.showModal(); draftsLoading.value = true;
  try { drafts.value = await listPublishingDrafts(); }
  catch (error) { formError.value = error.message; }
  finally { draftsLoading.value = false; }
}
async function restoreSaved(value) {
  // Preserve the current editor in the draft box before replacing it.
  if (hasContent()) {
    try { await savePublishingDraft(snapshot(activeSavedDraftId.value || uid())); }
    catch (error) { formError.value = error.message; return; }
  }
  await loadDraft(value); draftDialog.value?.close(); inform('草稿已载入，可以继续编辑。'); scheduleSave();
}
async function discardSaved(id) {
  try { await deletePublishingDraft(id); drafts.value = drafts.value.filter(item => item.id !== id); if (activeSavedDraftId.value === id) activeSavedDraftId.value = null; }
  catch (error) { formError.value = error.message; }
}
function dateLabel(value) { return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function sizeLabel(file) { return file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ''; }
function validate() {
  if (!draft.title.trim()) return '请为这次分享填写标题。';
  if ([...draft.title.trim()].length < 2) return '标题至少填写两个字。';
  if (draft.title.trim().length > 30) return '标题最多 30 个字。';
  if (!draft.communities.length) return '请至少选择一个关联社区。';
  if (draft.type === 'image' && !images.value.length) return '图文分享至少添加一张图片，也可以切换到发布文章。';
  if (!draft.content.trim()) return draft.type === 'article' ? '请写下文章正文。' : '请写一段介绍，分享这次拍摄或观察的发现。';
  if (draft.type === 'video' && !video.value) return '请选择要分享的视频。';
  if (draft.content.length > contentLimit.value) return '正文超过了字数上限，请缩短后发布。';
  if (draft.originality === 'repost') {
    try { const url = new URL(draft.sourceUrl.trim()); if (!['https:', 'http:'].includes(url.protocol)) throw new Error(); }
    catch { return '转载内容请填写完整的原文链接。'; }
  }
  return '';
}
async function publish() {
  if (busy.value || saving.value) return;
  formError.value = validate(); if (formError.value) return;
  if (!user.value) { await autoSave(); emit('login'); inform('登录后即可发布，当前编辑内容已保留。'); return; }
  busy.value = true; clearTimeout(saveTimer); status.value = '正在上传附件并发布，请保留此页面…';
  try {
    const post = await store.publishPost({ type: draft.type, title: draft.title.trim(), content: draft.content.trim(), category: draft.communities[0], communities: [...draft.communities], topics: [...draft.topics], images: draft.type === 'video' ? [] : images.value.map(item => item.file), video: draft.type === 'video' ? video.value?.file : null, cover: draft.type === 'video' ? cover.value?.file : null, visibility: draft.visibility, originality: draft.originality, sourceUrl: draft.originality === 'repost' ? draft.sourceUrl.trim() : '' });
    try { await autoSaveFlight.catch(() => {}); await deletePublishingDraft('current-edit'); if (activeSavedDraftId.value) await deletePublishingDraft(activeSavedDraftId.value); } catch { /* A successful post is retained even when draft cleanup fails. */ }
    draft.title = ''; draft.content = ''; images.value.forEach(release); images.value = []; removeVideo(); removeCover();
    history.value = [{ title: '', content: '' }]; historyIndex.value = 0; activeSavedDraftId.value = null;
    emit('notify', draft.visibility === 'private' ? '内容已保存，仅自己可见。' : '你的分享已发布。'); emit('published', post);
  } catch (error) { formError.value = error.message || '发布失败，编辑内容仍然保留，请稍后重试。'; status.value = ''; }
  finally { busy.value = false; if (formError.value) await autoSave(); }
}
function keyboard(event) {
  if (busy.value || !(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return;
  const key = event.key.toLowerCase();
  if (key === 's') { event.preventDefault(); saveDraft(); }
  else if (key === 'b' && event.target === contentInput.value) { event.preventDefault(); format('bold'); }
  else if (key === 'z' && (event.target === contentInput.value || event.target?.id === 'publish-title')) { event.preventDefault(); event.shiftKey ? redo() : undo(); }
  else if (key === 'y' && event.target === contentInput.value) { event.preventDefault(); redo(); }
}
function closeDialog(event) { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close(); }

watch(draft, scheduleSave, { deep: true });
watch([images, video, cover], scheduleSave, { deep: true });
onMounted(async () => {
  window.addEventListener('keydown', keyboard);
  try { const current = await readPublishingDraft('current-edit'); if (current && !hasContent()) { await loadDraft(current); inform('已恢复上次未完成的编辑。'); } }
  catch (error) { inform(error.message); }
  finally { initialized.value = true; }
});
onBeforeUnmount(() => {
  clearTimeout(saveTimer); window.removeEventListener('keydown', keyboard);
  if (hasContent() && !busy.value) savePublishingDraft(snapshot('current-edit')).catch(() => {});
  alive = false; images.value.forEach(release); release(video.value); release(cover.value);
  draftDialog.value?.close(); linkDialog.value?.close();
});
</script>

<template>
  <div class="publish-page">
    <div class="publish-page-heading"><div><h1>发布内容</h1><p>把今晚的发现，分享给同样仰望星空的人。</p></div><button type="button" class="publish-plain-button" @click="emit('navigate', 'community')">返回社区</button></div>
    <div class="publish-layout">
      <section class="publish-editor-card" aria-label="内容编辑器" :aria-busy="busy">
        <div class="publish-kind-tabs" role="tablist" aria-label="内容类型"><button v-for="kind in kinds" :id="`publish-tab-${kind.id}`" :key="kind.id" type="button" role="tab" :aria-selected="draft.type === kind.id" aria-controls="publish-editor-panel" :class="{ selected: draft.type === kind.id }" :disabled="busy" @click="switchType(kind.id)">{{ kind.label }}</button></div>
        <div id="publish-editor-panel" role="tabpanel" :aria-labelledby="`publish-tab-${draft.type}`" :inert="busy">
          <div v-if="draft.type === 'image'" class="publish-image-upload">
            <div class="publish-image-gallery"><div v-for="(item, index) in images" :key="item.id" class="publish-image-item" draggable="true" @dragstart="draggedIndex = index" @dragover.prevent @drop.prevent="dropImage(index)" @dragend="draggedIndex = null"><img :src="item.url" :alt="`图片 ${index + 1}：${item.file.name}`" /><span class="publish-image-number">{{ index + 1 }}</span><button type="button" class="publish-remove-media" :aria-label="`移除图片 ${index + 1}`" @click="removeImage(index)"><X :size="13" /></button><div class="publish-image-order"><button type="button" :disabled="index === 0" @click="moveImage(index, -1)">前移</button><button type="button" :disabled="index === images.length - 1" @click="moveImage(index, 1)">后移</button></div></div><button v-if="images.length < 9" type="button" class="publish-upload-square" aria-label="添加图片" @click="imageInput?.click()"><Plus :size="31" /><span>添加图片</span></button></div>
            <div class="publish-media-tip"><span>{{ images.length }} / 9 张 · 单张不超过 8 MB</span><span v-if="images.length > 1">拖动图片调整顺序</span></div>
          </div>
          <div v-if="draft.type === 'video'" class="publish-video-upload"><div v-if="video" class="publish-video-selection"><video :src="video.url" :poster="cover?.url" controls playsinline preload="metadata"></video><div><span>{{ video.file.name }} · {{ sizeLabel(video.file) }}</span><button type="button" class="publish-plain-button" @click="removeVideo">移除视频</button></div></div><button v-else type="button" class="publish-video-dropzone" @click="videoInput?.click()"><Video :size="30" /><strong>选择观星视频</strong><span>MP4、WebM 格式 · 最大 50 MB</span></button><div class="publish-cover-row"><button type="button" class="publish-cover-selector" @click="coverInput?.click()"><img v-if="cover" :src="cover.url" alt="视频封面" /><ImagePlus v-else :size="22" /><span>{{ cover ? '更换封面' : '添加封面' }}</span></button><button v-if="cover" type="button" class="publish-plain-button" @click="removeCover">移除封面</button><small>建议使用横向照片，未添加时显示视频首帧。</small></div></div>
          <div class="publish-writing" :class="`publish-writing-${draft.type}`"><label for="publish-title" class="publish-sr-only">内容标题</label><div class="publish-title-field"><input id="publish-title" :value="draft.title" maxlength="30" autocomplete="off" placeholder="填写标题" :disabled="busy" @input="changeTitle" /><span>{{ [...draft.title].length }} / 30</span></div><label for="publish-content" class="publish-sr-only">正文内容</label><textarea id="publish-content" ref="contentInput" :value="draft.content" :maxlength="contentLimit" :disabled="busy" :placeholder="draft.type === 'article' ? '从一段观察、一个问题，开始你的天文故事…' : draft.type === 'video' ? '介绍你的拍摄对象、设备与这次发现…' : '写下你的观察时间、地点，以及想分享的发现…'" @input="changeContent"></textarea><div class="publish-word-count">字数 {{ charCount }} / {{ contentLimit }}</div><div class="publish-format-bar"><div class="publish-format-tools"><button type="button" title="表情" aria-label="添加表情" :aria-expanded="openPicker === 'emoji'" @click="togglePicker('emoji')"><Smile :size="20" /></button><button type="button" v-if="draft.type !== 'video'" title="插入图片" aria-label="插入图片" @click="(draft.type === 'article' ? articleImageInput : imageInput)?.click()"><ImagePlus :size="20" /></button><span class="publish-tool-separator"></span><button type="button" title="加粗（Ctrl+B）" aria-label="插入加粗文字" @click="format('bold')"><Bold :size="20" /></button><button type="button" title="小标题" aria-label="插入小标题" @click="format('heading')"><Heading :size="20" /></button><button type="button" title="引用" aria-label="插入引用" @click="format('quote')"><Quote :size="20" /></button><button type="button" title="列表" aria-label="插入列表" @click="format('list')"><List :size="20" /></button><button type="button" title="链接" aria-label="插入资料链接" @click="openLink"><Link :size="20" /></button></div><div class="publish-history-tools"><button type="button" :disabled="!canUndo" title="撤销（Ctrl+Z）" aria-label="撤销编辑" @click="undo"><Undo2 :size="20" /></button><button type="button" :disabled="!canRedo" title="重做（Ctrl+Shift+Z）" aria-label="重做编辑" @click="redo"><Redo2 :size="20" /></button></div><div v-if="openPicker === 'emoji'" class="publish-emoji-picker"><button v-for="emoji in ['🌙', '✨', '🪐', '🔭', '🌌', '🌍', '☀️', '🌠', '⭐', '🚀']" :key="emoji" type="button" :aria-label="`插入 ${emoji}`" @click="insertText(emoji); openPicker = ''">{{ emoji }}</button></div></div></div>
          <div v-if="draft.type === 'article' && images.length" class="publish-article-attachments"><span>文章插图 {{ images.length }} / 9</span><div><div v-for="(item, index) in images" :key="item.id" class="publish-article-image"><button type="button" :title="`插入图片 ${index + 1}`" @click="insertText(`\n![图片 ${index + 1}](image:${index + 1})\n`)"><img :src="item.url" :alt="`插图 ${index + 1}`" /></button><button type="button" class="publish-remove-media" :aria-label="`移除插图 ${index + 1}`" @click="removeImage(index)"><X :size="10" /></button></div></div><p>点击缩略图可再次插入正文。<button type="button" class="publish-plain-button" @click="imageInput?.click()">添加图片</button></p></div>
          <div class="publish-associations"><div class="publish-association-row"><div><strong>关联社区</strong><small>{{ draft.communities.length }} / 2</small></div><div class="publish-selected-chips"><button v-for="item in draft.communities" :key="item" type="button" class="publish-chip" :aria-label="`取消关联${item}`" @click="toggleCommunity(item)">{{ item }}<X :size="12" /></button><button type="button" class="publish-add-tag" :aria-expanded="openPicker === 'community'" @click="togglePicker('community')"><Plus :size="15" />添加社区</button></div></div><div v-if="openPicker === 'community'" class="publish-choice-panel"><button v-for="item in categories" :key="item" type="button" :class="{ selected: draft.communities.includes(item) }" :aria-pressed="draft.communities.includes(item)" @click="toggleCommunity(item)">{{ item }}<Check v-if="draft.communities.includes(item)" :size="14" /></button></div><div class="publish-association-row"><div><strong>关联话题</strong><small>{{ draft.topics.length }} / 5</small></div><div class="publish-selected-chips"><button v-for="item in draft.topics" :key="item" type="button" class="publish-chip" :aria-label="`取消话题${item}`" @click="toggleTopic(item)"><Hash :size="12" />{{ item }}<X :size="12" /></button><button type="button" class="publish-add-tag" :aria-expanded="openPicker === 'topic'" @click="togglePicker('topic')"><Plus :size="15" />添加话题</button></div></div><div v-if="openPicker === 'topic'" class="publish-choice-panel publish-topics-picker"><div><button v-for="item in topicSuggestions" :key="item" type="button" :class="{ selected: draft.topics.includes(item) }" :aria-pressed="draft.topics.includes(item)" @click="toggleTopic(item)"># {{ item }}</button></div><form @submit.prevent="addCustomTopic"><label for="publish-custom-topic" class="publish-sr-only">自定义话题</label><input id="publish-custom-topic" v-model="customTopic" maxlength="24" placeholder="创建你自己的天文话题" /><button type="submit" :disabled="!customTopic.trim()">添加</button></form></div></div>
          <section class="publish-settings"><h2>发布设置</h2><div><label for="publish-visibility">可见范围</label><select id="publish-visibility" v-model="draft.visibility" :disabled="busy"><option value="public">所有人可见</option><option value="private">仅自己可见</option></select></div><div><label for="publish-originality">内容声明</label><select id="publish-originality" v-model="draft.originality" :disabled="busy"><option value="original">原创</option><option value="repost">转载</option></select></div><div v-if="draft.originality === 'repost'" class="publish-source-field"><label for="publish-source">原文出处</label><input id="publish-source" v-model="draft.sourceUrl" type="url" placeholder="https://…" :disabled="busy" /></div></section>
        </div>
        <p v-if="formError" class="publish-form-error" role="alert">{{ formError }}</p><p v-if="status" class="publish-status" role="status">{{ status }}</p><progress v-if="busy" class="publish-upload-progress" aria-label="正在上传并发布"></progress>
        <footer class="publish-editor-footer"><button type="button" class="publish-save-button" :disabled="saving || busy" @click="saveDraft"><LoaderCircle v-if="saving" :size="17" class="publish-spinning" /><Save v-else :size="17" />{{ saving ? '保存中' : '保存草稿' }}</button><div><button type="button" class="publish-secondary-button" :disabled="busy" @click="openDrafts">草稿箱</button><button type="button" class="publish-primary-button" :disabled="busy || saving" @click="publish"><LoaderCircle v-if="busy" :size="16" class="publish-spinning" />{{ busy ? '发布中…' : user ? '发布' : '登录后发布' }}</button></div></footer>
      </section>
      <aside class="publish-preview-column"><section class="publish-preview-card"><header><h2>预览</h2><span>实时更新</span></header><div class="publish-preview-scroll"><article :class="['publish-preview-post', `publish-preview-${draft.type}`]"><h3 v-if="draft.type === 'article'" class="publish-preview-title">{{ draft.title || '标题' }}</h3><div class="publish-preview-author"><img v-if="user?.avatar" :src="user.avatar" :alt="previewName" /><SaturnLogo v-else :size="38" /><div><strong>{{ previewName }}</strong><small>刚刚 · {{ draft.originality === 'original' ? '原创' : '转载' }}</small></div><span>{{ draft.visibility === 'private' ? '仅自己' : '公开' }}</span></div><h3 v-if="draft.type !== 'article'" class="publish-preview-title">{{ draft.title || '标题' }}</h3><div v-if="draft.content" class="publish-preview-content"><SafeMarkdown :content="draft.content" :images="imageUrls" /></div><p v-else class="publish-preview-placeholder">你的故事，将从这里开始。</p><div v-if="draft.type === 'image' && images.length" class="publish-preview-images" :class="{ single: images.length === 1 }"><img v-for="(item, index) in images" :key="item.id" :src="item.url" :alt="`预览图片 ${index + 1}`" /></div><video v-if="draft.type === 'video' && video" class="publish-preview-video" :src="video.url" :poster="cover?.url" controls playsinline preload="metadata"></video><div v-if="draft.topics.length" class="publish-preview-topics"><span v-for="item in draft.topics" :key="item"># {{ item }}</span></div><div class="publish-preview-category"><span v-for="item in draft.communities" :key="item">{{ item }}</span></div><p v-if="draft.originality === 'repost' && draft.sourceUrl" class="publish-preview-source">原文出处：{{ draft.sourceUrl }}</p></article></div></section><section class="publish-help-card"><h2>帮助说明 <span>{{ kinds.find(item => item.id === draft.type)?.label }}</span></h2><div class="publish-help-tabs" aria-label="编辑帮助"><button type="button" :class="{ selected: helpTab === 'keys' }" :aria-pressed="helpTab === 'keys'" @click="helpTab = 'keys'">快捷键</button><button type="button" :class="{ selected: helpTab === 'markdown' }" :aria-pressed="helpTab === 'markdown'" @click="helpTab = 'markdown'">Markdown</button><button type="button" :class="{ selected: helpTab === 'panel' }" :aria-pressed="helpTab === 'panel'" @click="helpTab = 'panel'">面板说明</button></div><dl v-if="helpTab === 'keys'"><div><dt>保存草稿</dt><dd><kbd>Ctrl</kbd> + <kbd>S</kbd></dd></div><div><dt>加粗</dt><dd><kbd>Ctrl</kbd> + <kbd>B</kbd></dd></div><div><dt>撤销</dt><dd><kbd>Ctrl</kbd> + <kbd>Z</kbd></dd></div><div><dt>重做</dt><dd><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd></dd></div></dl><div v-else-if="helpTab === 'markdown'" class="publish-help-text"><p><code>## 小标题</code> 为文章分段</p><p><code>**重点文字**</code> 突出重点</p><p><code>&gt; 引用内容</code> 引用资料</p><p><code>- 观察记录</code> 创建列表</p><p>使用工具栏插入图片与资料链接，右侧同步展示排版。</p></div><div v-else class="publish-help-text"><p>左侧编辑，右侧实时预览。发布图文适合观星照片，发布文章适合完整的科普故事，发布视频适合记录天体的变化。</p><p>草稿和附件保存在当前浏览器，登录前也可以编辑。发布成功后才会清空编辑内容。</p><p>关联社区帮助大家找到你的内容；话题可以自定义，最多添加五个。</p></div></section></aside>
    </div>
    <input ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp" multiple class="publish-hidden-input" aria-label="选择图文图片" @change="chooseImages($event, false)" /><input ref="articleImageInput" type="file" accept="image/jpeg,image/png,image/webp" multiple class="publish-hidden-input" aria-label="选择文章插图" @change="chooseImages($event, true)" /><input ref="videoInput" type="file" accept="video/mp4,video/webm" class="publish-hidden-input" aria-label="选择视频文件" @change="chooseVideo" /><input ref="coverInput" type="file" accept="image/jpeg,image/png,image/webp" class="publish-hidden-input" aria-label="选择视频封面" @change="chooseCover" />
    <dialog ref="linkDialog" class="publish-small-dialog" aria-labelledby="publish-link-heading" @click="closeDialog"><header><h2 id="publish-link-heading">插入资料链接</h2><button type="button" aria-label="关闭链接窗口" @click="linkDialog?.close()"><X :size="20" /></button></header><form @submit.prevent="addLink"><label>显示文字<input v-model="linkText" maxlength="100" required /></label><label>链接地址<input v-model="linkUrl" type="url" placeholder="https://…" required /></label><p v-if="linkError" class="publish-form-error" role="alert">{{ linkError }}</p><button type="submit" class="publish-primary-button">插入链接</button></form></dialog>
    <dialog ref="draftDialog" class="publish-drafts-dialog" aria-labelledby="publish-drafts-heading" @click="closeDialog"><header><div><h2 id="publish-drafts-heading">草稿箱</h2><p>保存在这台设备的浏览器里，包括图片和视频。</p></div><button type="button" aria-label="关闭草稿箱" @click="draftDialog?.close()"><X :size="20" /></button></header><p v-if="draftsLoading" class="publish-drafts-empty">正在读取草稿…</p><p v-else-if="!drafts.length" class="publish-drafts-empty"><FileText :size="28" />还没有保存的草稿</p><div v-else class="publish-drafts-list"><article v-for="item in drafts" :key="item.id"><div class="publish-draft-icon"><Video v-if="item.fields.type === 'video'" :size="20" /><ImagePlus v-else-if="item.fields.type === 'image'" :size="20" /><FileText v-else :size="20" /></div><div><h3>{{ item.fields.title || '未命名草稿' }}</h3><small>{{ kinds.find(kind => kind.id === item.fields.type)?.label }} · {{ dateLabel(item.updatedAt) }}</small></div><button type="button" class="publish-secondary-button" @click="restoreSaved(item)">继续编辑</button><button type="button" class="publish-delete-draft" :aria-label="`删除草稿：${item.fields.title || '未命名草稿'}`" @click="discardSaved(item.id)"><Trash2 :size="17" /></button></article></div></dialog>
  </div>
</template>
