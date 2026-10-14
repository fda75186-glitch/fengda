<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Search, Menu, X, ChevronDown, LogOut, Bookmark, Plus } from '@lucide/vue';
import SaturnLogo from './SaturnLogo.vue';
const props = defineProps({ routes: Array, route: String, user: Object, searchItems: { type: Array, default: () => [] } });
const emit = defineEmits(['navigate', 'publish', 'login', 'logout', 'select-search']);
const menu = ref(false), account = ref(false), searching = ref(false), query = ref(''), searchInput = ref(null), header = ref(null);
const searchArea = ref(null), searchTrigger = ref(null), searchWidth = ref(480);
let searchPinned = false, searchLeaveTimer, headerResizeObserver;
const exploreSurface = ref(null), desktopExplore = ref(null), mobileExplore = ref(null), desktopChallenge = ref(null), mobileChallenge = ref(null);
const exploreActive = computed(() => props.route === 'explore' || props.route === 'quiz');
const results = computed(() => query.value.trim() ? props.searchItems.filter(item => `${item.label} ${item.description || ''}`.toLowerCase().includes(query.value.trim().toLowerCase())).slice(0, 8) : []);
function setExploreElement(surface, kind, element) {
  const elements = surface === 'desktop' ? { trigger: desktopExplore, challenge: desktopChallenge } : { trigger: mobileExplore, challenge: mobileChallenge };
  elements[kind].value = element;
}
function closeSearch(restoreFocus = false) {
  clearTimeout(searchLeaveTimer); searchPinned = false; searching.value = false;
  if (restoreFocus) searchTrigger.value?.focus({ preventScroll: true });
}
function fitSearch() {
  const right = searchTrigger.value?.getBoundingClientRect().right;
  if (right) searchWidth.value = Math.min(560, Math.max(34, right - 12));
}
async function openSearch(focus = false) {
  clearTimeout(searchLeaveTimer); fitSearch(); searching.value = true;
  account.value = false; menu.value = false; exploreSurface.value = null;
  if (focus) { searchPinned = true; await nextTick(); searchInput.value?.focus({ preventScroll: true }); }
}
function hoverSearch(event) { if (event.pointerType === 'mouse' || event.pointerType === 'pen') void openSearch(); }
function leaveSearch() {
  clearTimeout(searchLeaveTimer);
  searchLeaveTimer = setTimeout(() => {
    if (!searchPinned && !searchArea.value?.contains(document.activeElement)) closeSearch();
  }, 220);
}
function pinSearch() { clearTimeout(searchLeaveTimer); searchPinned = true; }
function go(route) { menu.value = false; account.value = false; closeSearch(); exploreSurface.value = null; emit('navigate', route); }
function choose(item, source) {
  // Leave article results mounted so the knowledge card can return to its opener.
  if (item.kind !== 'article') closeSearch();
  else searchPinned = true;
  exploreSurface.value = null; emit('select-search', item, source);
}
function openExplore(surface, forceOpen = false) {
  const enteringExplore = props.route !== 'explore';
  exploreSurface.value = forceOpen || enteringExplore || exploreSurface.value !== surface ? surface : null;
  account.value = false; closeSearch();
  if (surface === 'desktop') menu.value = false;
  if (enteringExplore) emit('navigate', 'explore');
}
async function focusChallenge(surface) {
  openExplore(surface, true);
  await nextTick();
  (surface === 'desktop' ? desktopChallenge.value : mobileChallenge.value)?.focus();
}
function leaveExplore(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) exploreSurface.value = null;
}
function outside(event) {
  if (event.target.closest?.('dialog[open]')) return;
  if (!searchArea.value?.contains(event.target)) closeSearch();
  if (!header.value?.contains(event.target)) { account.value = false; searching.value = false; menu.value = false; exploreSurface.value = null; }
  else if (!event.target.closest?.('.xingyu-explore-group')) exploreSurface.value = null;
}
function escape(event) {
  if (event.key !== 'Escape' || event.target.closest?.('dialog[open]')) return;
  if (exploreSurface.value) {
    const trigger = exploreSurface.value === 'desktop' ? desktopExplore.value : mobileExplore.value;
    exploreSurface.value = null;
    trigger?.focus();
    event.preventDefault();
    return;
  }
  if (searching.value) { closeSearch(true); event.preventDefault(); }
  account.value = false; menu.value = false;
}
watch(() => props.route, route => {
  account.value = false;
  // Keep the disclosure visible when its parent click navigates into Explore.
  if (route === 'explore' && exploreSurface.value) return;
  menu.value = false; exploreSurface.value = null;
});
watch(menu, open => { if (!open && exploreSurface.value === 'mobile') exploreSurface.value = null; });
onMounted(() => {
  document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
  headerResizeObserver = new ResizeObserver(fitSearch); headerResizeObserver.observe(header.value); fitSearch();
});
onBeforeUnmount(() => {
  clearTimeout(searchLeaveTimer); headerResizeObserver?.disconnect();
  document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape);
});
</script>
<template>
  <header ref="header" class="xingyu-header">
    <div class="xingyu-header-inner">
      <a class="xingyu-brand" href="#home" @click.prevent="go('home')"><SaturnLogo :size="48"/><span>星语<small>STARWHISPER</small></span></a>
      <nav class="xingyu-nav" aria-label="主导航">
        <template v-for="item in routes" :key="item.id">
          <div v-if="item.id === 'explore'" class="xingyu-explore-group" @focusout="leaveExplore">
            <button :ref="element => setExploreElement('desktop', 'trigger', element)" class="xingyu-explore-trigger" :class="{ active: exploreActive }" :aria-expanded="exploreSurface === 'desktop'" aria-controls="xingyu-explore-subnav" :aria-current="route === 'explore' ? 'page' : undefined" @click="openExplore('desktop')" @keydown.down.prevent="focusChallenge('desktop')">{{ item.label }}</button>
            <Transition name="explore-dropdown"><div v-if="exploreSurface === 'desktop'" id="xingyu-explore-subnav" class="xingyu-explore-subnav"><a :ref="element => setExploreElement('desktop', 'challenge', element)" href="#quiz" :class="{ 'is-current': route === 'quiz' }" :aria-current="route === 'quiz' ? 'page' : undefined" @click.prevent="go('quiz')"><strong>天文挑战</strong><small>用五个问题，发现新的宇宙知识</small></a></div></Transition>
          </div>
          <a v-else :href="`#${item.id}`" :class="{active:route===item.id}" :aria-current="route===item.id?'page':undefined" @click.prevent="go(item.id)">{{ item.label }}</a>
        </template>
      </nav>
      <div class="xingyu-header-actions">
        <div ref="searchArea" class="xingyu-search-area" :class="{ 'is-open': searching }" :style="{ '--search-width': searchWidth + 'px' }" @pointerenter="hoverSearch" @pointerleave="leaveSearch" @focusin="pinSearch">
          <form class="xingyu-inline-search" role="search" aria-label="全站搜索" @submit.prevent="results.length && choose(results[0],searchArea.querySelector('.xingyu-search-result'))">
            <div class="xingyu-search-drawer" :inert="!searching" :aria-hidden="!searching">
              <input id="xingyu-search-keywords" ref="searchInput" v-model="query" :tabindex="searching ? 0 : -1" type="search" aria-label="全站搜索关键词" placeholder="搜索天体、知识、社区话题…" @keydown.esc.prevent.stop="closeSearch(true)"/>
              <button class="xingyu-icon-button" type="button" :tabindex="searching ? 0 : -1" aria-label="收起搜索" @click="closeSearch(true)"><X :size="17"/></button>
            </div>
            <button ref="searchTrigger" class="xingyu-icon-button xingyu-search-trigger" type="button" aria-label="全站搜索" :aria-expanded="searching" aria-controls="xingyu-search-keywords" @click="openSearch(true)"><Search :size="20"/></button>
          </form>
          <div v-if="searching && query.trim()" class="xingyu-inline-search-results" aria-label="全站搜索结果">
            <button v-for="item in results" :key="item.kind+item.id" class="xingyu-search-result" @click="choose(item,$event.currentTarget)"><span>{{ item.kind==='article'?'科普知识':'社区内容' }}</span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></button>
            <p v-if="!results.length" role="status">没有找到相关内容，试试“月球”“土星”或“观星”。</p>
          </div>
        </div>
        <button class="xingyu-publish-button" @click="emit('publish')"><Plus :size="17"/><span>发布内容</span></button>
        <div class="xingyu-account-area">
          <button v-if="!user" class="xingyu-login-button" @click="emit('login')">登录</button>
          <button v-else class="xingyu-user-button" :aria-expanded="account" aria-label="打开账号菜单" @click="account=!account"><img v-if="user.avatar" :src="user.avatar" :alt="user.name"/><SaturnLogo v-else :size="35"/><span>{{ user.name }}</span><ChevronDown :size="14"/></button>
          <div v-if="account && user" class="xingyu-account-menu"><strong>{{ user.name }}</strong><button @click="go('notebook')"><Bookmark :size="16"/>我的星空</button><button @click="go('publish')"><Plus :size="16"/>我的草稿与创作</button><button @click="account=false;emit('logout')"><LogOut :size="16"/>退出登录</button></div>
        </div>
        <button class="xingyu-icon-button xingyu-menu-toggle" aria-label="打开导航菜单" :aria-expanded="menu" @click="menu=!menu"><X v-if="menu" :size="22"/><Menu v-else :size="22"/></button>
      </div>
    </div>
    <nav v-if="menu" class="xingyu-mobile-nav" aria-label="移动导航">
      <template v-for="item in routes" :key="item.id">
        <div v-if="item.id === 'explore'" class="xingyu-explore-group xingyu-mobile-explore" @focusout="leaveExplore">
          <button :ref="element => setExploreElement('mobile', 'trigger', element)" class="xingyu-explore-trigger" :class="{ active: exploreActive }" :aria-expanded="exploreSurface === 'mobile'" aria-controls="xingyu-mobile-explore-subnav" :aria-current="route === 'explore' ? 'page' : undefined" @click="openExplore('mobile')" @keydown.down.prevent="focusChallenge('mobile')">{{ item.label }}</button>
          <Transition name="explore-dropdown"><div v-if="exploreSurface === 'mobile'" id="xingyu-mobile-explore-subnav" class="xingyu-explore-subnav"><a :ref="element => setExploreElement('mobile', 'challenge', element)" href="#quiz" :class="{ 'is-current': route === 'quiz' }" :aria-current="route === 'quiz' ? 'page' : undefined" @click.prevent="go('quiz')"><strong>天文挑战</strong></a></div></Transition>
        </div>
        <a v-else :href="`#${item.id}`" :class="{active:route===item.id}" :aria-current="route===item.id?'page':undefined" @click.prevent="go(item.id)">{{ item.label }}</a>
      </template>
      <a href="#notebook" @click.prevent="go('notebook')">我的星空</a><button @click="openSearch(true)">全站搜索</button>
    </nav>
  </header>
</template>
<style scoped>
.xingyu-search-area{position:relative;flex:none;width:34px;height:40px;z-index:3}
.xingyu-inline-search{position:absolute;right:0;top:0;display:flex;align-items:center;width:34px;height:40px;gap:0;padding:0;border:1px solid transparent;border-radius:6px;background:transparent;transition:width .32s cubic-bezier(.22,.8,.24,1),background .2s,border-color .2s,box-shadow .2s}
.xingyu-search-area.is-open .xingyu-inline-search{width:var(--search-width);background:#fff;border-color:#dce5eb;box-shadow:0 3px 12px #243b5110}
.xingyu-search-drawer{display:flex;align-items:center;min-width:0;flex:1;overflow:hidden;visibility:hidden;opacity:0;transition:opacity .16s,visibility .16s}
.is-open .xingyu-search-drawer{visibility:visible;opacity:1;transition:opacity .2s .06s,visibility 0s}
.xingyu-search-drawer input{flex:1;min-width:0;width:100%;padding:10px 4px 10px 14px;border:0;outline:0;background:none;color:#2b3e4c;font:inherit;font-size:14px;line-height:18px}
.xingyu-search-drawer input::placeholder{color:#91a0ad}.xingyu-search-drawer input::-webkit-search-cancel-button{display:none}
.xingyu-search-drawer .xingyu-icon-button{flex:none;width:28px;height:30px;color:#8393a0;margin-right:4px}
.xingyu-inline-search .xingyu-search-trigger{display:inline-flex;flex:none;width:32px;height:36px;transform:none}
.xingyu-inline-search:focus-within{border-color:#7c9bb1;box-shadow:0 0 0 3px #648da418}
.xingyu-inline-search-results{position:absolute;right:0;top:calc(100% + 10px);width:var(--search-width);max-height:min(520px,calc(100dvh - 100px));overflow:auto;background:#fff;border:1px solid #e0e7ec;border-radius:6px;padding:6px;box-shadow:0 14px 35px #20364a18;overscroll-behavior:contain}
.xingyu-search-result{display:grid;gap:5px;width:100%;padding:12px;text-align:left;background:#fff;border:1px solid transparent;border-radius:4px;color:#3b4d5c;cursor:pointer}
.xingyu-search-result:hover,.xingyu-search-result:focus-visible{background:#f4f7f9;border-color:#dfe7ed}.xingyu-search-result span{font-size:10px;color:#7e91a0}.xingyu-search-result strong{font-size:14px;font-weight:550;line-height:1.5}.xingyu-search-result small{font-size:11px;line-height:1.6;color:#8293a1;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.xingyu-inline-search-results>p{font-size:12px;line-height:1.8;color:#7f919e;margin:8px}
@media(max-width:600px){.xingyu-header-inner{gap:6px}.xingyu-header-actions{gap:5px}.xingyu-publish-button{padding:8px}.xingyu-login-button{padding:8px}.xingyu-search-drawer input{font-size:12px;padding-left:10px}.xingyu-search-result{padding:9px}.xingyu-search-result strong{font-size:12px}}
@media(prefers-reduced-motion:reduce){.xingyu-inline-search,.xingyu-search-drawer,.is-open .xingyu-search-drawer{transition:none}}
.xingyu-explore-group{position:relative;display:flex;align-items:stretch}
.xingyu-explore-trigger{position:relative;display:flex;align-items:center;font:inherit;font-size:14px;font-weight:500;color:#737d87;background:transparent;border:0;padding:0;cursor:pointer;white-space:nowrap}
.xingyu-explore-trigger:hover,.xingyu-explore-trigger.active{color:#1d2b34}
.xingyu-explore-trigger.active{font-weight:700}
.xingyu-explore-trigger.active::after{content:'';position:absolute;bottom:16px;left:0;right:0;height:2px;background:#26363e}
.xingyu-explore-trigger:focus-visible{outline:2px solid #647eaf;outline-offset:5px;border-radius:3px}
.xingyu-explore-subnav{position:absolute;top:calc(100% - 8px);left:-16px;min-width:248px;padding:8px;background:#fff;border:1px solid #e1e6ea;border-radius:6px;box-shadow:0 12px 28px #182b3b17;z-index:2;transform-origin:top left}
.xingyu-nav .xingyu-explore-subnav a{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-height:62px;padding:12px;border:1px solid transparent;border-radius:4px;color:#34434d;transition:background .18s,border-color .18s,box-shadow .18s}
.xingyu-explore-subnav a:hover,.xingyu-explore-subnav a.is-current{background:#f2f6f8;border-color:#dce5eb}
.xingyu-explore-subnav a:active{background:#e8eef2;box-shadow:inset 0 2px 4px #20354116}
.xingyu-explore-subnav strong{font-size:14px;font-weight:600;line-height:1.5}
.xingyu-explore-subnav small{font-size:11px;font-weight:400;color:#7e8d98;line-height:1.6}
.explore-dropdown-enter-active,.explore-dropdown-leave-active{transition:transform .2s cubic-bezier(.2,.8,.2,1),opacity .16s ease}
.explore-dropdown-enter-from,.explore-dropdown-leave-to{transform:translateY(-8px) scaleY(.9);opacity:0}
.xingyu-mobile-explore{display:block;min-width:0}
.xingyu-mobile-explore .xingyu-explore-trigger{width:100%;justify-content:center;padding:10px 8px;border-radius:4px;font-size:12px}
.xingyu-mobile-explore .xingyu-explore-trigger.active{background:#eaf0f4;color:#213945}
.xingyu-mobile-explore .xingyu-explore-trigger.active::after{display:none}
.xingyu-mobile-explore .xingyu-explore-subnav{position:static;min-width:0;margin-top:6px;padding:4px;box-shadow:none;background:#f8fafb;transform-origin:top center}
.xingyu-mobile-explore .xingyu-explore-subnav a{display:flex;justify-content:center;padding:10px 4px;border:1px solid transparent;white-space:nowrap}
.xingyu-mobile-explore .xingyu-explore-subnav strong{font-size:12px}
@media(max-width:1100px){.xingyu-explore-trigger{font-size:12px}}
@media(prefers-reduced-motion:reduce){.explore-dropdown-enter-active,.explore-dropdown-leave-active{transition:none}}
</style>
